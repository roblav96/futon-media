import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as fastParse from 'fast-json-parse'
import * as media from '@/media/media'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	process.DEVELOPMENT && (await db.flush())
	// global.dts(await emby.client.get('/Sessions', { silent: true }), 'Sessions')
	// await sessions.sync()
	// emby.rxSocket.subscribe(({ MessageType, Data }) => {
	// 	if (MessageType != 'Sessions') return
	// 	emby.Sessions.splice(0, Infinity, ...sessions.use(Data))
	// 	console.info(`rxSocket Session ->`, emby.Sessions[0] && emby.Sessions[0].json)
	// })
})

export const sessions = {
	parse(Sessions: Session[]) {
		_.remove(Sessions, ({ DeviceId, RemoteEndPoint, UserName }) => {
			if (!UserName) return true
			if (DeviceId == process.env.EMBY_SERVER_ID) return true
			// if (RemoteEndPoint && (urlParseLax(RemoteEndPoint) as Url).port) return true
		})
		return Sessions.sort((a, b) => {
			return new Date(b.LastActivityDate).valueOf() - new Date(a.LastActivityDate).valueOf()
		})
	},
	use(Sessions: Session[]) {
		return sessions.parse(Sessions).map(v => new Session(v))
	},
	async get() {
		return sessions.use(await emby.client.get('/Sessions', { silent: true }))
	},
	async byUserId(UserId: string) {
		return (await sessions.get()).find(v => v.UserId == UserId)
	},
	broadcast(message: string) {
		sessions.get().then(sessions => sessions.forEach(v => v.message(message)))
	},
}

export class Session {
	get Stamp() {
		return new Date(this.LastActivityDate).valueOf()
	}
	get Age() {
		return Date.now() - this.Stamp
	}

	get AudioStreamIndex() {
		return _.get(this, 'PlayState.AudioStreamIndex') as number
	}
	get MediaSourceId() {
		return _.get(this, 'PlayState.MediaSourceId') as string
	}
	get PlayMethod() {
		return _.get(this, 'PlayState.PlayMethod') as string
	}
	get PositionTicks() {
		return _.get(this, 'PlayState.PositionTicks') as number
	}
	get IsPlayState() {
		let finite = _.isFinite(this.AudioStreamIndex) && _.isFinite(this.PositionTicks)
		return finite && !!this.MediaSourceId && !!this.PlayMethod
	}
	get Container() {
		return _.get(this, 'NowPlayingItem.Container') as string
	}
	get ItemName() {
		return _.get(this, 'NowPlayingItem.Name') as string
	}
	get ItemPath() {
		return _.get(this, 'NowPlayingItem.Path') as string
	}
	get ItemId() {
		return _.get(this, 'NowPlayingItem.Id') as string
	}
	get IsNowPlaying() {
		return !!this.Container && !!this.ItemName && !!this.ItemPath && !!this.ItemId
	}
	get IsStreaming() {
		return !!this.IsPlayState && !!this.IsNowPlaying
	}

	get short() {
		let parts = [this.UserName, this.Client, this.DeviceName].map(v => v.replace(/\s+/g, ''))
		return `${this.Age}ms|${parts[0]}@${parts[1]}.${parts[2]}`
	}
	get json() {
		return utils.compact({
			Age: this.Age,
			// Audio: JSON.stringify(this.Codecs.audio),
			// Bitrate: this.Bitrate && `${utils.fromBytes(this.Bitrate)}/s`,
			// Channels: this.Channels,
			Client: this.Client,
			DeviceId: this.DeviceId,
			DeviceName: this.DeviceName,
			Id: this.Id,
			IsPlayState: this.IsPlayState || null,
			IsStreaming: this.IsStreaming || null,
			ItemId: this.ItemId,
			ItemPath: this.ItemPath,
			// Quality: this.Quality,
			// RemoteEndPoint: this.RemoteEndPoint,
			// SupportsRemoteControl: this.SupportsRemoteControl,
			UserId: this.UserId,
			UserName: this.UserName,
			// Video: JSON.stringify(this.Codecs.video),
		})
	}

	constructor(Session: Session) {
		_.merge(this, Session)
	}

	async getUser() {
		return await emby.User.byUserId(this.UserId)
	}

	async getDevice() {
		return (await emby.client.get(`/Devices/Info`, { query: { Id: this.DeviceId } })) as Device
	}

	async command(Name: string, body: any) {
		// console.log(`command '${Name}' ->`, body)
		let response = await emby.client.post(`/Sessions/${this.Id}/Command/LibraryChanged`, {
			query: {
				// messageId: utils.hash(utils.nonce(), 'md5'),
				api_key: process.env.EMBY_ADMIN_TOKEN,
			},
			body,
		})
		// console.log(`response ->`, response)
	}

	message(data: string | Error) {
		let body = { Text: `✅ ${data}`, TimeoutMs: 5000 }
		if (_.isError(data)) {
			body.Text = `❌ Error: ${data.message}`
			body.TimeoutMs *= 2
		}
		return emby.client.post(`/Sessions/${this.Id}/Message`, { body }).catch(_.noop)
	}
}

export interface Session {
	AdditionalUsers: any[]
	AppIconUrl: string
	ApplicationVersion: string
	Client: string
	DeviceId: string
	DeviceName: string
	Id: string
	LastActivityDate: string
	NowPlayingItem: NowPlayingItem
	PlayState: PlayState
	PlayableMediaTypes: string[]
	PlaylistIndex: number
	PlaylistLength: number
	RemoteEndPoint: string
	ServerId: string
	SupportedCommands: string[]
	SupportsRemoteControl: boolean
	TranscodingInfo: TranscodingInfo
	UserId: string
	UserName: string
}

export interface TranscodingInfo {
	AudioChannels: number
	AudioCodec: string
	Bitrate: number
	CompletionPercentage: number
	Container: string
	CurrentThrottle: number
	Framerate: number
	Height: number
	IsAudioDirect: boolean
	IsVideoDirect: boolean
	TranscodeReasons: string[]
	TranscodingPositionTicks: number
	TranscodingStartPositionTicks: number
	VideoCodec: string
	VideoDecoderIsHardware: boolean
	VideoEncoderIsHardware: boolean
	Width: number
}

export interface NowPlayingItem {
	BackdropImageTags: string[]
	Chapters: {
		Name: string
		StartPositionTicks: number
	}[]
	CommunityRating: number
	Container: string
	CriticRating: number
	DateCreated: string
	ExternalUrls: {
		Name: string
		Url: string
	}[]
	GenreItems: {
		Id: number
		Name: string
	}[]
	Genres: string[]
	Height: number
	Id: string
	ImageTags: {
		Primary: string
	}
	IndexNumber: number
	IsFolder: boolean
	LocalTrailerCount: number
	MediaStreams: MediaStream[]
	MediaType: string
	Name: string
	OfficialRating: string
	OriginalTitle: string
	Overview: string
	ParentBackdropImageTags: string[]
	ParentBackdropItemId: string
	ParentId: string
	ParentIndexNumber: number
	Path: string
	PremiereDate: string
	PresentationUniqueKey: string
	PrimaryImageAspectRatio: number
	ProductionYear: number
	ProviderIds: {
		Imdb: string
		Tmdb: string
		Tvdb: string
	}
	RunTimeTicks: number
	SeasonId: string
	SeasonName: string
	SeriesId: string
	SeriesName: string
	SeriesPrimaryImageTag: string
	ServerId: string
	Studios: any[]
	Taglines: any[]
	Type: string
	Width: number
}

export interface MediaStream {
	AspectRatio: string
	AverageFrameRate: number
	BitDepth: number
	BitRate: number
	ChannelLayout: string
	Channels: number
	Codec: string
	CodecTimeBase: string
	ColorPrimaries: string
	ColorSpace: string
	ColorTransfer: string
	DisplayTitle: string
	Height: number
	Index: number
	IsAVC: boolean
	IsAnamorphic: boolean
	IsDefault: boolean
	IsExternal: boolean
	IsForced: boolean
	IsInterlaced: boolean
	IsTextSubtitleStream: boolean
	Level: number
	NalLengthSize: string
	PixelFormat: string
	Profile: string
	Protocol: string
	RealFrameRate: number
	RefFrames: number
	SampleRate: number
	SupportsExternalStream: boolean
	TimeBase: string
	Type: string
	VideoRange: string
	Width: number
}

export interface PlayState {
	AudioStreamIndex: number
	CanSeek: boolean
	IsMuted: boolean
	IsPaused: boolean
	MediaSourceId: string
	PlayMethod: string
	PositionTicks: number
	RepeatMode: string
	VolumeLevel: number
}

export interface Device {
	AppName: string
	AppVersion: string
	DateLastActivity: string
	IconUrl: string
	Id: string
	LastUserId: string
	LastUserName: string
	Name: string
}
