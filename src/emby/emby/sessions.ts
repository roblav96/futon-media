import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	// if (process.DEVELOPMENT) await db.flush()
	let rxSession = emby.rxItemId.pipe(
		Rx.op.distinctUntilChanged((a, b) => `${a.ItemId}${a.UserId}` == `${b.ItemId}${b.UserId}`),
	)
	rxSession.subscribe(async ({ ItemId, UserId }) => {
		await db.put(ItemId, UserId, utils.duration(1, 'day'))
	})
})

export class Session {
	static db = db
	static async get() {
		let Sessions = (await emby.client.get('/Sessions', { silent: true })) as Session[]
		_.remove(Sessions, ({ DeviceId, PlayableMediaTypes, UserName }) => {
			if (!UserName) return true
			if (_.isEmpty(PlayableMediaTypes)) return true
			if (DeviceId == process.env.EMBY_SERVER_ID) return true
		})
		Sessions.sort((a, b) => {
			return new Date(b.LastActivityDate).valueOf() - new Date(a.LastActivityDate).valueOf()
		})
		return Sessions.map(v => new Session(v))
	}
	static async byUserId(UserId: string) {
		return (await Session.get()).find(v => v.UserId == UserId)
	}
	static async broadcast(text: string) {
		await pAll(
			(await Session.get()).map(v => () => v.Message(text)),
			{ concurrency: 1 },
		)
	}

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
		return `${parts[0]}@${parts[1]}.${parts[2]}|${this.Age}ms`
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
		return (await emby.client.get(`/Devices/Info`, {
			query: { Id: this.DeviceId },
			silent: true,
		})) as Device
	}

	async Message(text: string | Error) {
		let body = { Text: `🔶 ${text}` }
		if (_.isError(text)) body.Text = `⛔ [ERROR] ${text.message}`
		Object.assign(body, { TimeoutMs: _.clamp(body.Text.length * 100, 5000, 15000) })
		try {
			await emby.client.post(`/Sessions/${this.Id}/Message`, { body, silent: true })
		} catch {}
	}

	async GoToSearch(String: string) {
		await emby.client.post(`/Sessions/${this.Id}/Command/GoToSearch`, {
			// query: { api_key: process.env.EMBY_ADMIN_TOKEN },
		})
		await emby.client.post(`/Sessions/${this.Id}/Command/SendString`, {
			body: { Arguments: { String } },
			// query: { api_key: process.env.EMBY_ADMIN_TOKEN },
			debug: true,
		})
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
	UserId: string
	UserName: string
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
	MediaStreams: emby.MediaStream[]
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
