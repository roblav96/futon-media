import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as realdebrid from '@/debrids/realdebrid'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import pQueue from 'p-queue'

let queue = new pQueue({ concurrency: 1 })
process.nextTick(() => {
	let rxFavorite = emby.rxItemId.pipe(
		Rx.op.filter(({ method, parts }) => {
			return method == 'POST' && parts.includes('favoriteitems')
		}),
		Rx.op.distinctUntilChanged((a, b) => `${a.ItemId}${a.UserId}` == `${b.ItemId}${b.UserId}`),
		Rx.op.concatMap(async ({ ItemId, UserId }) => {
			let Item = await emby.library.byItemId(ItemId)
			let Session = await emby.sessions.byUserId(UserId)
			console.warn(`[${Session.short}] rxFavorite ->`, emby.library.toName(Item))
			let PlaybackInfo = await Session.getPlaybackInfo()
			return { Item, PlaybackInfo }
		}),
		Rx.op.filter(({ Item }) => ['Movie', 'Series', 'Episode'].includes(Item.Type)),
		Rx.op.concatMap(async ({ Item, PlaybackInfo }) => {
			let item = await emby.library.item(Item)
			if (Item.Type == 'Series') {
				if (item.show && item.show.aired_episodes > 128) {
					throw new Error(`${item.show.aired_episodes} aired_episodes greater than 128`)
				}
				let seasons = (await trakt.client.get(`/shows/${item.slug}/seasons`, {
					silent: true,
				})) as trakt.Season[]
				seasons = seasons.filter(v => v.number > 0 && v.aired_episodes > 0)
				let items = seasons.map(season =>
					new media.Item(JSON.parse(JSON.stringify(item))).use({
						type: 'season',
						season,
					}),
				)
				return { items, PlaybackInfo }
			}
			return { items: [item], PlaybackInfo }
		}),
		Rx.op.catchError((error, caught) => {
			console.error(`rxFavorite concatMap -> %O`, error)
			return caught
		}),
	)
	rxFavorite.subscribe(({ items, PlaybackInfo }) => {
		for (let item of items) {
			queue.add(async () => {
				let gigs = utils.fromBytes(utils.toBytes(`${item.gigs} GB`))
				console.warn(`rxFavorite download '${item.strm}' ->`, gigs)

				let torrents = await scraper.scrapeAll(item, PlaybackInfo.Quality == 'SD')
				console.log(`rxFavorite torrents '${item.strm}' ->`, torrents.map(v => v.short))

				if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

				// let index = torrents.findIndex(({ cached }) => cached.length > 0)
				// if (index == -1) console.warn(`download best cached ->`, 'index == -1')
				// else console.log(`download best cached ->`, torrents[index].short)

				await debrids.download(torrents, item)
				console.info(`rxFavorite '${item.strm}' ->`, 'DONE')
			})
		}
	})
})
