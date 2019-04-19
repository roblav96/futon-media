import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/utils/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { rxHttpUrl } from '@/emby/tail-logs'

const rxPlayback = rxHttpUrl.pipe(
	Rx.Op.filter(({ url, query }: { url: string; query: PlaybackQuery }) => {
		let basenames = ['PlaybackInfo'].concat(utils.VIDEO_EXTS.map(v => `stream.${v}`))
		if (!basenames.includes(path.basename(url))) return
		console.log(`rxPlayback filter ->`, url, query)
		if (!(query.UserId || query.DeviceId)) return
		if (query.mediasourceid) {
			query.MediaSourceId = query.mediasourceid
			_.unset(query, 'mediasourceid')
		}
		if (!query.MediaSourceId) return
		if (query.isplayback) {
			query.IsPlayback = query.isplayback
			_.unset(query, 'isplayback')
		}
		if (query.IsPlayback == 'false') return
		return true
	})
)

rxPlayback.subscribe(async ({ url, query }: { url: string; query: PlaybackQuery }) => {
	console.warn(`rxPlayback subscribe ->`, url, query)

	let Session: emby.Session
	try {
		let Sessions = await emby.getAllSessions()
		Session = Sessions.find((v, i) => {
			if (query.UserId) return v.UserId == query.UserId
			if (query.DeviceId) return v.DeviceId == query.DeviceId
		})
		!Session && (Session = Sessions[0])
		console.log(`Session ->`, Session)

		let ItemId = url.split('/').find(v => v && !isNaN(v as any))
		let [User, Eitem] = await Promise.all([
			emby.client.get(`/Users/${Session.UserId}`) as Promise<emby.User>,
			emby.client.get(`/Users/${Session.UserId}/Items/${ItemId}`) as Promise<emby.Item>,
		])

		await emby.client.post(`/Sessions/${Session.Id}/Command/Back`, {
			// query: { MediaSourceId: query.MediaSourceId },
		})
		
		return 

		let strm = _.trim(await fs.readFile(Eitem.Path, 'utf-8'))
		if (strm != '/dev/null') {
			return console.warn(`strm != /dev/null ->`, strm)
		}
		// if (Session.PlayState.MediaSourceId) {
		// 	if (strm != `/dev/null`) {
		// 		await emby.sendMessage(Session.Id, `👍 Streaming: ${Eitem.Name}`)
		// 		await fs.outputFile(Eitem.Path, '/dev/null')
		// 	}
		// 	return
		// }

		let [provider, id] = Object.entries(Eitem.ProviderIds)[0]
		let result = ((await trakt.client.get(
			`/search/${provider.toLowerCase()}/${id}`
		)) as trakt.Result[])[0]
		let item = new media.Item(result)

		let torrents = await scraper.scrapeAll(item)
		torrents = torrents.filter(v => v.cached.includes('realdebrid'))
		if (torrents.length == 0) throw new Error(`!torrents`)
		torrents.sort((a, b) => b.seeders - a.seeders)
		let [link] = await debrid.debrids.realdebrid.links(torrents[0].magnet)
		if (!link) throw new Error(`!link`)
		link.startsWith('http:') && (link = link.replace('http', 'https'))
		await fs.outputFile(Eitem.Path, link)

		// await emby.refreshLibrary()
		await emby.client.post(`/Sessions/${Session.Id}/Playing`, {
			query: { ItemIds: ItemId, PlayCommand: 'PlayNow', MediaSourceId: query.MediaSourceId },
		})

		//
	} catch (error) {
		console.error(`rxPlayback subscribe -> %O`, error)
		if (Session) emby.sendMessage(Session.Id, error)
	}
})

type PlaybackQuery = Partial<{
	AutoOpenLiveStream: string
	DeviceId: string
	IsPlayback: string
	isplayback: string
	MaxStreamingBitrate: string
	mediasourceid: string
	MediaSourceId: string
	StartTimeTicks: string
	SubtitleStreamIndex: string
	UserId: string
}>
