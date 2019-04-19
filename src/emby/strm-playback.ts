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
		console.log(`rxPlayback pipe ->`, { url, query })
		let basenames = ['PlaybackInfo'].concat(utils.VIDEO_EXTS.map(v => `stream.${v}`))
		if (!basenames.includes(path.basename(url))) return
		if (!(query.UserId || query.DeviceId)) return
		if (!(query.MediaSourceId || query.mediasourceid)) return
		return true
	})
)

rxPlayback.subscribe(async ({ url, query }: { url: string; query: PlaybackQuery }) => {
	console.warn(`rxPlayback.subscribe ->`, { url, query })
	let Session: emby.Session
	try {
		let { DeviceId, MediaSourceId, UserId } = query

		let Sessions = await emby.getAllSessions()
		Session = Sessions.find((v, i) => {
			if (UserId) return v.UserId == UserId
			if (DeviceId) return v.DeviceId == DeviceId
		})
		!Session && (Session = Sessions[0])
		console.log(`Session ->`, Session)

		let User = (await emby.client.get(`/Users/${Session.UserId}`)) as emby.User
		console.log(`User ->`, User)

		let ItemId = url.split('/').find(v => v && !isNaN(v as any))
		let Eitem = (await emby.client.get(`/Users/${Session.UserId}/Items/${ItemId}`)) as emby.Item

		if (Session.PlayState.MediaSourceId) {
			let strm = await fs.readFile(Eitem.Path, 'utf-8')
			if (strm != `/dev/null`) {
				await emby.sendMessage(Session.Id, `👍 Streaming: ${Eitem.Name}`)
				await fs.outputFile(Eitem.Path, '/dev/null')
			}
			return
		}

		let [provider, id] = Object.entries(Eitem.ProviderIds)[0]
		let result = ((await trakt.client.get(
			`/search/${provider.toLowerCase()}/${id}`
		)) as trakt.Result[])[0]
		let item = new media.Item(result)

		throw new Error(`return`)

		let torrents = await scraper.scrapeAll(item)
		torrents = torrents.filter(v => v.cached.includes('realdebrid'))
		if (!_.size(torrents)) throw new Error(`!torrents`)
		torrents.sort((a, b) => b.seeders - a.seeders)
		let [link] = await debrid.debrids.realdebrid.links(torrents[0].magnet)
		if (!_.size(link)) throw new Error(`!link`)
		link.startsWith('http:') && (link = link.replace('http', 'https'))
		await fs.outputFile(Eitem.Path, link)

		// await emby.refreshLibrary()
		await emby.client.post(`/Sessions/${Session.Id}/Playing`, {
			query: { ItemIds: ItemId, PlayCommand: 'PlayNow', MediaSourceId },
		})

		//
	} catch (error) {
		console.error(`rxPlayback.subscribe Error ->`, error)
		if (Session) emby.sendMessage(Session.Id, error)
	}
})

type PlaybackQuery = Partial<{
	AutoOpenLiveStream: string
	DeviceId: string
	IsPlayback: string
	MaxStreamingBitrate: string
	mediasourceid: string
	MediaSourceId: string
	StartTimeTicks: string
	SubtitleStreamIndex: string
	UserId: string
}>
