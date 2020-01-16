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
	let rxFavorite = emby.rxItemId.pipe(
		Rx.op.filter(({ method, parts }) => method == 'POST' && parts.includes('favoriteitems')),
		Rx.op.distinctUntilChanged((a, b) => {
			if (process.DEVELOPMENT) return false
			return `${a.ItemId}${a.UserId}` == `${b.ItemId}${b.UserId}`
		}),
	)
	rxFavorite.subscribe(async ({ ItemId, UserId, useragent }) => {
		let [Item, Session, PlaybackInfo] = await Promise.all([
			emby.library.byItemId(ItemId),
			emby.Session.byUserId(UserId),
			emby.PlaybackInfo.get(useragent, UserId),
		])
		if (!['Movie', 'Episode'].includes(Item.Type)) return
		console.warn(`[${Session.short}] rxFavorite ->`, emby.library.toTitle(Item))

		let item = await emby.library.item(Item)

		let isHD = PlaybackInfo ? PlaybackInfo.Quality != 'SD' : false
		if (process.DEVELOPMENT) isHD = true
		let torrents = await scraper.scrapeAllQueue(item, isHD)

		console.log(
			`rxFavorite cached torrents '${item.strm}' ->`,
			torrents.filter(v => v.cached.length > 0).map(v => v.short()),
			torrents.length,
		)

		if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

		// let index = torrents.findIndex(({ cached }) => cached.length > 0)
		// if (index == -1) console.warn(`download best cached ->`, 'index == -1')
		// else console.log(`download best cached ->`, torrents[index].short)

		await debrids.downloadQueue(torrents, item)
		console.info(`rxFavorite '${item.strm}' ->`, 'DONE')
	})
})
