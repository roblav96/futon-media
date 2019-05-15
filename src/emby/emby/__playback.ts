import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'

export type PlaybackQuery = typeof PlaybackQuery
const PlaybackQuery = {
	AllowAudioStreamCopy: '',
	AllowVideoStreamCopy: '',
	AudioStreamIndex: '',
	AutoOpenLiveStream: '',
	DeviceId: '',
	EnableDirectPlay: '',
	EnableDirectStream: '',
	Format: '',
	IsPlayback: '',
	ItemId: '',
	MaxStreamingBitrate: '',
	MediaSourceId: '',
	StartTimeTicks: '',
	Static: '',
	SubtitleStreamIndex: '',
	UserId: '',
}
const FixPlaybackQuery = _.invert(_.mapValues(PlaybackQuery, (v, k) => k.toLowerCase()))

export const rxPlaybackInfo = emby.rxHttp.pipe(
	Rx.op.filter(({ url }) => path.basename(url).toLowerCase() == 'playbackinfo'),
	// Rx.op.filter(({ url }) => {
	// 	let base = path.basename(url).toLowerCase()
	// 	return !!['playbackinfo', 'stream'].find(v => base.includes(v))
	// }),
	Rx.op.map(({ url, query }) => {
		query = _.mapKeys(query, (v, k) => FixPlaybackQuery[k] || _.upperFirst(k))
		// query.ItemId = _.reverse(url.split('/')).find(v => utils.isNumeric(v))
		return { url, query: query as PlaybackQuery }
	})
	// Rx.op.filter(({ url, query }) => !!query.UserId)
	// Rx.op.filter(({ url, query }) => !!query.UserId && query.IsPlayback != 'false')
	// Rx.op.map(({ query }) => query.UserId)
	// Rx.op.distinctUntilChanged()
)
// socket.rxSocket.subscribe(({ MessageType, Data }) => {
// 	console.log(`rxSocket ->`, MessageType, Data)
// })
// emby.rxHttp.subscribe(({ url, query }) => {
// 	console.log(`rxHttp ->`, new Url(url).pathname, query)
// })
export const rxPlaybackInfoIsFalse = rxPlaybackInfo.pipe(
	Rx.op.filter(({ query }) => query.IsPlayback == 'false')
	// Rx.op.filter(({ query }) => query.IsPlayback == 'false' || query.Format == 'json')
)
export const rxPlaybackInfoUserId = rxPlaybackInfo.pipe(
	Rx.op.filter(({ query }) => !!query.UserId),
	Rx.op.map(({ query }) => query.UserId)
)
