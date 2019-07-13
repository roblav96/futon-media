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

process.nextTick(() => {
	let rxFavorite = emby.rxHttp.pipe(
		Rx.op.filter(({ method, parts }) => method == 'POST' && parts.includes('favoriteitems')),
		Rx.op.map(({ query }) => ({ ItemId: query.ItemId, UserId: query.UserId }))
	)
	rxFavorite.subscribe(async ({ ItemId, UserId }) => {
		let Session = await emby.sessions.byUserId(UserId)
		// if (!Session.isHD) return

		let Item = await emby.library.byItemId(ItemId)
		if (!Item || !['Movie', /** 'Series', */ 'Episode'].includes(Item.Type)) return

		let actives = (await realdebrid.client.get('/torrents/activeCount', {
			silent: true,
		})) as realdebrid.ActiveCount
		if (actives.nb >= _.ceil(actives.limit * 0.8)) {
			throw new Error(`RealDebrid actives ${actives.nb} >= ${actives.limit}`)
		}

		let item = await emby.library.item(Item.Path, Item.Type)

		if (Item.Type == 'Movie') {
			queue.add(() => download(item, Session.isSD))
		}

		if ([/** 'Series', */ 'Episode'].includes(Item.Type)) {
			let seasons = (await trakt.client.get(`/shows/${item.slug}/seasons`, {
				silent: true,
			})) as trakt.Season[]
			seasons = seasons.filter(v => v.number > 0 && v.aired_episodes > 0)
			if (Item.Type == 'Series') {
				if (item.isDaily || (item.show && item.show.aired_episodes) >= 500) {
					return console.warn(`favorites item.isDaily || item.episodes >= 500`)
				}
				if (process.DEVELOPMENT) {
					return download(item.use({ type: 'season', season: seasons[0] }), Session.isSD)
				}
				queue.addAll(
					seasons.map(season => () =>
						download(item.use({ type: 'season', season }), Session.isSD)
					)
				)
			}
			if (Item.Type == 'Episode') {
				let { ParentIndexNumber: s, IndexNumber: e } = Item
				item.use({ type: 'season', season: seasons.find(v => v.number == s) })
				let episode = (await trakt.client.get(
					`/shows/${item.slug}/seasons/${s}/episodes/${e}`,
					{ silent: true }
				)) as trakt.Episode
				item.use({ type: 'episode', episode })
				queue.add(() => download(item, Session.isSD))
			}
		}
	})
})

let queue = new pQueue({ concurrency: 1 })
async function download(item: media.Item, sd: boolean) {
	console.info(`download '${item.strm}' ->`, utils.fromBytes(utils.toBytes(`${item.gigs} GB`)))

	let torrents = await scraper.scrapeAll(item, sd)
	console.log(`download all torrents '${item.strm}' ->`, torrents.map(v => v.short))

	// let index = torrents.findIndex(({ cached }) => cached.length > 0)
	// if (index == -1) console.warn(`download best cached ->`, 'index == -1')
	// else console.log(`download best cached ->`, torrents[index].short)

	await debrids.download(torrents, item)
	console.info(`download '${item.strm}' ->`, 'DONE')
}
