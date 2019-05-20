import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as pQueue from 'p-queue'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

process.nextTick(() => {
	let rxFavorite = emby.rxHttp.pipe(
		Rx.op.filter(({ method, parts }) => method == 'POST' && parts.includes('favoriteitems')),
		Rx.op.map(({ query }) => query.ItemId)
	)
	rxFavorite.subscribe(async ItemId => {
		let Item = await emby.library.byItemId(ItemId)
		if (!Item || !['Movie', 'Series', 'Episode'].includes(Item.Type)) return
		let item = await emby.library.item(Item.Path, Item.Type)
		if (Item.Type == 'Movie') {
			return queue.add(() => download(item))
		}
		if (Item.Type == 'Series') {
			let seasons = (await trakt.client.get(
				`/shows/${item.traktId}/seasons`
			)) as trakt.Season[]
			return queue.addAll(
				seasons.map(season => () => {
					return download(item.use({ type: 'season', season }))
				})
			)
		}
		if (Item.Type == 'Episode') {
			let { ParentIndexNumber: s, IndexNumber: e } = Item
			let episode = (await trakt.client.get(
				`/shows/${item.traktId}/seasons/${s}/episodes/${e}`
			)) as trakt.Episode
			return download(item.use({ type: 'episode', episode }))
		}
	})
})

let queue = new pQueue({ concurrency: 1 })
async function download(item: media.Item) {
	let torrents = await scraper.scrapeAll(item)
	console.log(`torrents ->`, torrents)
}
