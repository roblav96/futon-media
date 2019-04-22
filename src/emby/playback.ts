import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrid from '@/debrids/debrid'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/utils/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as socket from '@/emby/socket'
import * as tail from '@/emby/tail-logs'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

const rxPlayback = tail.rxHttp.pipe(
	Rx.Op.filter<PlaybackArgs>(({ url, query }) => {
		let endings = ['PlaybackInfo', 'stream']
		if (!endings.find(v => path.basename(url).startsWith(v))) return
		let fixcase = {
			audiostreamindex: 'AudioStreamIndex',
			autoopenlivestream: 'AutoOpenLiveStream',
			deviceid: 'DeviceId',
			isplayback: 'IsPlayback',
			maxstreamingbitrate: 'MaxStreamingBitrate',
			mediasourceid: 'MediaSourceId',
			starttimeticks: 'StartTimeTicks',
			subtitlestreamindex: 'SubtitleStreamIndex',
			userid: 'UserId',
		}
		query = _.mapKeys(query, (v, k) => fixcase[k] || k)
		console.log(`rxPlayback filter ->`, url, query)
		if (!(query.UserId || query.DeviceId)) return
		if (!query.MediaSourceId) return
		if (query.IsPlayback == 'false') return
		return true
	})
)

rxPlayback.subscribe(async ({ url, query }) => {
	return 
	console.warn(`rxPlayback subscribe ->`, url, query)

	let Session: emby.Session
	try {
		let Sessions = await emby.getSessions()
		Session = Sessions.find((v, i) => {
			if (query.UserId) return v.UserId == query.UserId
			if (query.DeviceId) return v.DeviceId == query.DeviceId
		})
		if (!Session) throw new Error(`!Session`)
		console.log(`Session ->`, Session)

		let ItemId = url.split('/').find(v => v && !isNaN(v as any))
		if (!ItemId) throw new Error(`!ItemId`)
		let [User, Eitem] = await Promise.all([
			emby.client.get(`/Users/${Session.UserId}`) as Promise<emby.User>,
			emby.client.get(`/Users/${Session.UserId}/Items/${ItemId}`) as Promise<emby.Item>,
		])

		// let { NowPlayingItem, PlayState } = Session
		// console.log(`PlayState ->`, PlayState)
		// if (NowPlayingItem && NowPlayingItem.Container) {
		// 	return console.warn(`NowPlayingItem.Container ->`, Eitem.Name)
		// }

		let strm = _.trim(await fs.readFile(Eitem.Path, 'utf-8'))
		if (strm != `/dev/null`) {
			console.warn(`strm != /dev/null ->`, Eitem.Name)
			return
		}

		let [provider, id] = Object.entries(Eitem.ProviderIds)[0]
		let result = ((await trakt.client.get(
			`/search/${provider.toLowerCase()}/${id}`
		)) as trakt.Result[])[0]
		if (!result) throw new Error(`!result`)
		let item = new media.Item(result)

		await emby.sendMessage(Session, `Scraping providers...`)
		let torrents = await scraper.scrapeAll(item)
		torrents = torrents.filter(v => v.cached.includes('realdebrid'))
		if (torrents.length == 0) throw new Error(`!torrents`)
		await emby.sendMessage(Session, `Found ${torrents.length} results...`)

		let sortby = User.Name.toLowerCase().includes('robert') ? 'bytes' : 'seeders'
		torrents.sort((a, b) => b[sortby] - a[sortby])
		// console.log(`torrents ->`, torrents.map(v => v.toJSON()))

		let link = await debrid.getLink(torrents, item)
		if (!link) throw new Error(`!link`)
		await fs.outputFile(Eitem.Path, link)
		await emby.sendMessage(Session, `👍 Starting playback`)
		
		if (emby.isRoku(Session)) {
			await emby.refreshLibrary()
		}

		if (!emby.isRoku(Session)) {
			await emby.client.post(`/Sessions/${Session.Id}/Playing`, {
				query: {
					ItemIds: ItemId,
					MediaSourceId: query.MediaSourceId,
					PlayCommand: 'PlayNow',
					StartPositionTicks: query.StartTimeTicks,
					SubtitleStreamIndex: query.SubtitleStreamIndex,
				},
			})
		}

		// let rxContainer = socket.rxSession.pipe(
		// 	Rx.Op.filter(({ Id, NowPlayingItem }) => {
		// 		if (Id != Session.Id) return
		// 		console.log(`rxContainer ->`, NowPlayingItem && NowPlayingItem.Container)
		// 		return _.isString(NowPlayingItem && NowPlayingItem.Container)
		// 	}),
		// 	Rx.Op.take(5)
		// )
		// await Rx.race(Rx.interval(30000), rxContainer).toPromise()
		// await Promise.race([utils.pTimeout(30000), rxContainer.toPromise()])
		// await utils.pTimeout(30000)
		// await fs.outputFile(Eitem.Path, `/dev/null`)
		// console.warn(`outputFile Eitem.Path /dev/null`)

		//
	} catch (error) {
		console.error(`rxPlayback subscribe -> %O`, error)
		Session && emby.sendMessage(Session, error)
	}
})

type PlaybackArgs = { url: string; query: PlaybackQuery }
type PlaybackQuery = Partial<{
	AudioStreamIndex: string
	AutoOpenLiveStream: string
	DeviceId: string
	IsPlayback: string
	MaxStreamingBitrate: string
	MediaSourceId: string
	StartTimeTicks: string
	SubtitleStreamIndex: string
	UserId: string
}>
