import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'

export const sessions = {
	async get() {
		let Sessions = (await emby.client.get('/Sessions')) as Session[]
		Sessions = Sessions.filter(({ UserName }) => !!UserName).map(v => new Session(v))
		return Sessions.sort((a, b) => b.Stamp - a.Stamp)
	},
	async byUserId(UserId: string) {
		return (await sessions.get()).find(v => v.UserId == UserId)
	},
	broadcast(message: string) {
		sessions.get().then(exts => exts.forEach(v => v.message(message)))
	},
}

export class Session {
	get IsRoku() {
		return `${this.Client} ${this.DeviceName}`.toLowerCase().includes('roku')
	}
	get Channels() {
		let dotprop = `Capabilities.DeviceProfile.TranscodingProfiles`
		let profiles = _.get(this, dotprop) as TranscodingProfiles[]
		if (!_.isArray(profiles)) return NaN
		return _.max([2].concat(profiles.map(v => _.parseInt(v.MaxAudioChannels))))
	}
	get Quality(): emby.Quality {
		return this.Channels == 2 || this.IsRoku ? '1080p' : '4K'
	}
	get Stamp() {
		return new Date(this.LastActivityDate).valueOf()
	}
	get Age() {
		return Date.now() - this.Stamp
	}

	get AudioStreamIndex() {
		return _.get(this, 'PlayState.AudioStreamIndex')
	}
	get MediaSourceId() {
		return _.get(this, 'PlayState.MediaSourceId')
	}
	get PlayMethod() {
		return _.get(this, 'PlayState.PlayMethod')
	}
	get PositionTicks() {
		return _.get(this, 'PlayState.PositionTicks')
	}
	get IsPlayState() {
		let finite = _.isFinite(this.AudioStreamIndex) && _.isFinite(this.PositionTicks)
		return finite && !!this.MediaSourceId && !!this.PlayMethod
	}

	get Container() {
		return _.get(this, 'NowPlayingItem.Container')
	}
	get ItemName() {
		return _.get(this, 'NowPlayingItem.Name')
	}
	get StrmPath() {
		return _.get(this, 'NowPlayingItem.Path')
	}
	get ItemId() {
		return _.get(this, 'NowPlayingItem.Id')
	}
	get IsNowPlaying() {
		return !!this.Container && !!this.ItemName && !!this.StrmPath && !!this.ItemId
	}

	get IsStreaming() {
		return !!this.IsPlayState && !!this.IsNowPlaying
	}

	get Ids() {
		let Ids = _.get(this, 'NowPlayingItem.ProviderIds', {})
		Ids = _.mapKeys(Ids, (v, k) => k.toLowerCase())
		return Ids as { imdb: string; tmdb: string; tvdb: string }
	}

	get json() {
		return _.fromPairs(
			_.toPairs({
				Age: this.Age,
				Ago: `${dayjs(this.LastActivityDate).from(dayjs(this.Stamp + this.Age))}`,
				Channels: this.Channels,
				Client: this.Client,
				Container: this.Container,
				DeviceName: this.DeviceName,
				IsNowPlaying: this.IsNowPlaying,
				IsPlayState: this.IsPlayState,
				IsStreaming: this.IsStreaming,
				ItemName: this.ItemName,
				Quality: this.Quality,
				StrmPath: this.StrmPath,
				UserName: this.UserName,
			}).filter(([k, v]) => !_.isNil(v))
		)
	}

	constructor(Session: Session) {
		_.merge(this, Session)
	}

	async Device() {
		return (await emby.client.get(`/Devices/Info`, { query: { Id: this.DeviceId } })) as Device
	}

	async User() {
		return (await emby.client.get(`/Users/${this.UserId}`)) as User
	}

	async Latest() {
		return (await emby.client.get(`/Users/${this.UserId}/Items/Latest`, {
			query: { Limit: 5 },
		})) as emby.Item[]
	}

	async Views() {
		return (await emby.client.get(`/Users/${this.UserId}/Views`)) as emby.View[]
	}

	async Item(ItemId: string) {
		return (await emby.client.get(`/Users/${this.UserId}/Items/${ItemId}`)) as emby.Item
	}

	async item(ItemId: string) {
		let Item = await this.Item(ItemId)
		let pairs = _.toPairs(Item.ProviderIds).map(pair => pair.map(v => v.toLowerCase()))
		pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))[0]
		for (let [provider, id] of pairs) {
			let results = (await trakt.client.get(`/search/${provider}/${id}`)) as trakt.Result[]
			let result = results.length == 1 && results[0]
			!result && (result = results.find(v => v[v.type].ids[provider].toString() == id))
			if (result) return { Item, item: new media.Item(result) }
		}
		throw new Error(`!result`)
	}

	message(data: string | Error) {
		let body = { Text: `⚪ ${data}`, TimeoutMs: 5000 }
		if (_.isError(data)) {
			body.Text = `🔴 Error: ${data.message}`
			body.TimeoutMs *= 2
		}
		emby.client.post(`/Sessions/${this.Id}/Message`, { body }).catch(_.noop)
	}
}

export interface Session {
	AdditionalUsers: any[]
	AppIconUrl: string
	ApplicationVersion: string
	Capabilities: {
		DeviceProfile: {
			CodecProfiles: {
				ApplyConditions: any[]
				Codec: string
				Conditions: {
					Condition: any
					IsRequired: any
					Property: any
					Value: any
				}[]
				Type: string
			}[]
			ContainerProfiles: any[]
			DirectPlayProfiles: {
				AudioCodec: string
				Container: string
				Type: string
				VideoCodec: string
			}[]
			EnableAlbumArtInDidl: boolean
			EnableMSMediaReceiverRegistrar: boolean
			EnableSingleAlbumArtLimit: boolean
			EnableSingleSubtitleLimit: boolean
			IgnoreTranscodeByteRangeRequests: boolean
			MaxAlbumArtHeight: number
			MaxAlbumArtWidth: number
			MaxStaticBitrate: number
			MaxStaticMusicBitrate: number
			MaxStreamingBitrate: number
			MusicStreamingTranscodingBitrate: number
			RequiresPlainFolders: boolean
			RequiresPlainVideoItems: boolean
			ResponseProfiles: {
				Conditions: any[]
				Container: string
				MimeType: string
				Type: string
			}[]
			SubtitleProfiles: {
				Format: string
				Method: string
			}[]
			SupportedMediaTypes: string
			TimelineOffsetSeconds: number
			TranscodingProfiles: TranscodingProfiles[]
			XmlRootAttributes: any[]
		}
		IconUrl: string
		Id: string
		PlayableMediaTypes: string[]
		PushToken: string
		PushTokenType: string
		SupportedCommands: string[]
		SupportsMediaControl: boolean
		SupportsPersistentIdentifier: boolean
		SupportsSync: boolean
	}
	Client: string
	DeviceId: string
	DeviceName: string
	Id: string
	LastActivityDate: string
	NowPlayingItem: {
		BackdropImageTags: string[]
		Chapters: Function[][]
		CommunityRating: number
		Container: string
		CriticRating: number
		DateCreated: string
		ExternalUrls: Function[][]
		GenreItems: Function[][]
		Genres: string[]
		HasSubtitles: boolean
		Height: number
		Id: string
		ImageTags: {
			Art: string
			Banner: string
			Disc: string
			Logo: string
			Primary: string
			Thumb: string
		}
		IsFolder: boolean
		LocalTrailerCount: number
		MediaStreams: Function[][]
		MediaType: string
		Name: string
		OfficialRating: string
		OriginalTitle: string
		Overview: string
		ParentId: string
		Path: string
		PremiereDate: string
		PrimaryImageAspectRatio: number
		ProductionYear: number
		ProviderIds: {
			Imdb: string
			Tmdb: string
			Tvdb: string
		}
		RunTimeTicks: number
		ServerId: string
		Studios: Function[][]
		Taglines: string[]
		Type: string
		Width: number
	}
	PlayState: {
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
	PlayableMediaTypes: string[]
	PlaylistItemId: string
	RemoteEndPoint: string
	ServerId: string
	SupportedCommands: string[]
	SupportsRemoteControl: boolean
	UserId: string
	UserName: string
}

export interface TranscodingProfiles {
	AudioCodec: string
	BreakOnNonKeyFrames: boolean
	Container: string
	Context: string
	CopyTimestamps: boolean
	EnableMpegtsM2TsMode: boolean
	EstimateContentLength: boolean
	MaxAudioChannels: string
	MinSegments: number
	Protocol: string
	SegmentLength: number
	TranscodeSeekInfo: string
	Type: string
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
