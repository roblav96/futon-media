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
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { rxHttpUrl } from '@/emby/tail-logs'

const rxPlayback = rxHttpUrl.pipe(
	Rx.Op.filter<PlaybackArgs>(({ url, query }) => {
		let endings = ['PlaybackInfo', 'stream']
		if (!endings.find(v => path.basename(url).startsWith(v))) return
		// console.log(`rxPlayback filter ->`, url, query)
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

rxPlayback.subscribe(async ({ url, query }) => {
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

		let { PlayState, NowPlayingItem } = Session
		if (PlayState && PlayState.MediaSourceId) return
		if (NowPlayingItem && NowPlayingItem.Container) return

		let strm = _.trim(await fs.readFile(Eitem.Path, 'utf-8'))
		if (strm != `/dev/null`) return

		let [provider, id] = Object.entries(Eitem.ProviderIds)[0]
		let result = ((await trakt.client.get(
			`/search/${provider.toLowerCase()}/${id}`
		)) as trakt.Result[])[0]
		let item = new media.Item(result)

		await emby.sendMessage(Session.Id, `Scraping providers...`)
		let torrents = await scraper.scrapeAll(item)
		torrents = torrents.filter(v => v.cached.includes('realdebrid'))
		if (torrents.length == 0) throw new Error(`!torrents`)
		await emby.sendMessage(Session.Id, `Found ${torrents.length} results...`)
		let sortby = User.Name.toLowerCase().includes('robert') ? 'bytes' : 'seeders'
		torrents.sort((a, b) => b[sortby] - a[sortby])

		console.log(`torrents ->`, torrents.map(v => v.toJSON()))

		let link = await debrid.getLink(torrents, item)
		if (!link) throw new Error(`!link`)
		await fs.outputFile(Eitem.Path, link)
		await emby.sendMessage(Session.Id, `👍 Starting playback`)

		await emby.client.post(`/Sessions/${Session.Id}/Playing`, {
			query: {
				ItemIds: ItemId,
				MediaSourceId: query.MediaSourceId,
				PlayCommand: 'PlayNow',
				StartPositionTicks: query.StartTimeTicks,
				SubtitleStreamIndex: query.SubtitleStreamIndex,
			},
		})

		let rxContainer = socket.rxSession.pipe(
			Rx.Op.filter(({ Id, NowPlayingItem }) => {
				if (Id != Session.Id) return
				return _.isString(NowPlayingItem && NowPlayingItem.Container)
			}),
			Rx.Op.take(5)
		)
		await Promise.race([utils.pTimeout(30000), rxContainer.toPromise()])
		await fs.outputFile(Eitem.Path, `/dev/null`)
	} catch (error) {
		console.error(`rxPlayback subscribe -> %O`, error)
		if (Session) emby.sendMessage(Session.Id, error)
	}
})

type PlaybackArgs = { url: string; query: PlaybackQuery }
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
