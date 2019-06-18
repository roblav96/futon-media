import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as pQueue from 'p-queue'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import * as realdebrid from '@/debrids/realdebrid'

process.nextTick(() => {
	let rxFavorite = emby.rxHttp.pipe(
		Rx.op.filter(({ method, parts }) => method == 'POST' && parts.includes('favoriteitems')),
		Rx.op.map(({ query }) => ({ ItemId: query.ItemId, UserId: query.UserId }))
	)
	rxFavorite.subscribe(async ({ ItemId, UserId }) => {
		let Session = await emby.sessions.byUserId(UserId)
		if (!Session.isHD) return

		let Item = await emby.library.byItemId(ItemId)
		if (!Item || !['Movie', 'Series', 'Episode'].includes(Item.Type)) return

		let actives = (await realdebrid.client.get('/torrents/activeCount', {
			silent: true,
		})) as realdebrid.ActiveCount
		if (actives.nb >= _.ceil(actives.limit * 0.8)) {
			throw new Error(`RealDebrid actives ${actives.nb} >= ${actives.limit}`)
		}

		let item = await emby.library.item(Item.Path, Item.Type)

		if (Item.Type == 'Movie') {
			queue.add(() => download(item))
		}

		if (['Series', 'Episode'].includes(Item.Type)) {
			let seasons = (await trakt.client.get(`/shows/${item.slug}/seasons`, {
				silent: true,
			})) as trakt.Season[]
			seasons = seasons.filter(v => v.number > 0 && v.aired_episodes > 0)
			if (Item.Type == 'Series') {
				if (item.isDaily || (item.show && item.show.aired_episodes) >= 500) {
					return console.warn(`favorites item.isDaily || item.episodes >= 500`)
				}
				if (process.DEVELOPMENT) {
					return download(item.use({ type: 'season', season: seasons[0] }))
				}
				queue.addAll(
					seasons.map(season => () => download(item.use({ type: 'season', season })))
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
				queue.add(() => download(item))
			}
		}
	})
})

let queue = new pQueue({ concurrency: 1 })
async function download(item: media.Item) {
	let slug = item.slug
	if (item.S.z) slug += ` S${item.S.z}`
	if (item.E.z) slug += `E${item.E.z}`
	let gigs = _.round((item.runtime / (item.movie ? 30 : 40)) * (item.isPopular() ? 1 : 0.5), 2)
	console.info(`download '${slug}' ->`, utils.fromBytes(utils.toBytes(`${gigs} GB`)))

	let torrents = await scraper.scrapeAll(item)
	console.log(`download all torrents ->`, torrents.length, torrents.map(v => v.short))

	// let index = torrents.findIndex(({ cached }) => cached.length > 0)
	// if (index == -1) console.warn(`download best cached ->`, 'index == -1')
	// else console.log(`download best cached ->`, torrents[index].short)

	torrents = torrents.filter(v => {
		if (v.cached.length > 0) return true
		// console.log(`boosts '${utils.fromBytes(v.boosts(item.S.e).bytes)}' ->`, v.short)
		if (v.boosts(item.S.e).bytes < utils.toBytes(`${gigs} GB`)) return false
		return v.seeders >= 3 // || v.cached.length > 0
	})
	console.log(`download torrents ->`, torrents.length, torrents.map(v => v.short))

	if (process.DEVELOPMENT) throw new Error(`DEV`)

	if (torrents.length == 0) return console.warn(`download torrents.length == 0`)
	await debrids.download(torrents)
	console.info(`download '${slug}' ->`, 'DONE')
}
