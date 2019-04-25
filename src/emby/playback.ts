import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as tail from '@/emby/tail'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'

export type PlaybackQuery = typeof PlaybackQuery
const PlaybackQuery = {
	AllowAudioStreamCopy: '',
	AllowVideoStreamCopy: '',
	AudioStreamIndex: '',
	AutoOpenLiveStream: '',
	DeviceId: '',
	EnableDirectPlay: '',
	EnableDirectStream: '',
	IsPlayback: '',
	MaxStreamingBitrate: '',
	MediaSourceId: '',
	StartTimeTicks: '',
	SubtitleStreamIndex: '',
	UserId: '',
}
const FixPlaybackQuery = _.invert(_.mapValues(PlaybackQuery, (v, k) => k.toLowerCase()))

export const rxPlayback = tail.rxHttpServer.pipe(
	Rx.Op.filter(({ url, query }) => {
		let basename = path.basename(url).toLowerCase()
		let basenames = ['PlaybackInfo', 'stream'].map(v => v.toLowerCase())
		return _.isString(basenames.find(v => basename.includes(v)))
	}),
	Rx.Op.map(({ url, query }) => {
		return { url, query: _.mapKeys(query, (v, k) => FixPlaybackQuery[k] || k) as PlaybackQuery }
	}),
	Rx.Op.filter(({ url, query }) => {
		// console.log(`rxHttpServer filter ->`, new Url(url).pathname, query)
		if (!(query.UserId || query.DeviceId)) return
		if (query.IsPlayback == 'false') return
		return true
	})
)

rxPlayback.subscribe(async ({ url, query }) => {
	return
	console.log(`rxPlayback subscribe ->`, new Url(url).pathname, query)

	let Session: emby.Session
	try {
		let Sessions = await emby.sessions.get()
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

		await Session.message(`Scraping providers...`)
		let torrents = await scraper.scrapeAll(item)
		torrents = torrents.filter(v => v.cached.includes('realdebrid'))
		if (torrents.length == 0) throw new Error(`!torrents`)
		await Session.message(`Found ${torrents.length} results...`)

		let sortby = User.Name.toLowerCase().includes('robert') ? 'bytes' : 'seeders'
		torrents.sort((a, b) => b[sortby] - a[sortby])
		// console.log(`torrents ->`, torrents.map(v => v.toJSON()))

		let link = await debrid.getLink(torrents, item)
		if (!link) throw new Error(`!link`)
		await fs.outputFile(Eitem.Path, link)
		await Session.message(`👍 Starting playback`)

		if (Session.isRoku) {
			await emby.library.refresh()
		}

		if (!Session.isRoku) {
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
		console.error(`rxPlayback.subscribe -> %O`, error)
		Session && Session.message(error)
	}
})
