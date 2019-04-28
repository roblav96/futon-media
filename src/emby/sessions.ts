import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as Rx from '@/shims/rxjs'
import * as socket from '@/emby/socket'
import * as trakt from '@/adapters/trakt'

export const rxSessions = socket.rxSocket.pipe(
	Rx.Op.filter(({ MessageType }) => MessageType == 'Sessions'),
	Rx.Op.map(({ Data }) => sessions.parse(Data))
)

export const rxSession = new Rx.BehaviorSubject({} as Session)
rxSessions.subscribe(Sessions => {
	let Session = Sessions[0]
	if (!rxSession.value.LastActivityDate) return rxSession.next(Session)
	let a = new Date(Session.LastActivityDate).valueOf()
	let b = new Date(rxSession.value.LastActivityDate).valueOf()
	if (a > b) rxSession.next(Session)
})
process.nextTick(() => sessions.get().then(([v]) => rxSession.next(v)))

export const sessions = {
	async get() {
		return sessions.parse((await emby.client.get('/Sessions')) as Session[])
	},
	async admin() {
		return (await sessions.get()).find(v => v.UserId == process.env.EMBY_API_USER)
	},
	async fromUserId(UserId: string) {
		return (await sessions.get()).find(v => v.UserId == UserId)
	},
	parse(Sessions: Session[]) {
		Sessions = Sessions.filter(({ UserName }) => !!UserName).sort((a, b) => {
			return new Date(b.LastActivityDate).valueOf() - new Date(a.LastActivityDate).valueOf()
		})
		return Sessions.map(v => new Session(v))
	},
	async broadcast(message: string) {
		let Sessions = await sessions.get()
		Sessions.forEach(v => v.message(message))
	},
}

export class Session {
	get isRoku() {
		return `${this.Client} ${this.DeviceName}`.toLowerCase().includes('roku')
	}

	get quality(): emby.Quality {
		let dotpath = `Capabilities.DeviceProfile.TranscodingProfiles`
		let profiles = _.get(this, dotpath) as TranscodingProfiles[]
		if (!_.isArray(profiles)) return '4K'
		let max = _.max([2].concat(profiles.map(v => _.parseInt(v.MaxAudioChannels))))
		return max == 2 ? '1080p' : '4K'
	}

	get age() {
		let day = dayjs(this.LastActivityDate)
		return `+${Date.now() - day.valueOf()}ms ${day.fromNow()}`
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

export interface User {
	Configuration: {
		DisplayCollectionsView: boolean
		DisplayMissingEpisodes: boolean
		EnableLocalPassword: boolean
		EnableNextEpisodeAutoPlay: boolean
		GroupedFolders: any[]
		HidePlayedInLatest: boolean
		LatestItemsExcludes: any[]
		MyMediaExcludes: any[]
		OrderedViews: string[]
		PlayDefaultAudioTrack: boolean
		RememberAudioSelections: boolean
		RememberSubtitleSelections: boolean
		SubtitleMode: string
	}
	HasConfiguredEasyPassword: boolean
	HasConfiguredPassword: boolean
	HasPassword: boolean
	Id: string
	LastActivityDate: string
	LastLoginDate: string
	Name: string
	Policy: {
		AccessSchedules: any[]
		AuthenticationProviderId: string
		BlockUnratedItems: any[]
		BlockedTags: any[]
		DisablePremiumFeatures: boolean
		EnableAllChannels: boolean
		EnableAllDevices: boolean
		EnableAllFolders: boolean
		EnableAudioPlaybackTranscoding: boolean
		EnableContentDeletion: boolean
		EnableContentDeletionFromFolders: any[]
		EnableContentDownloading: boolean
		EnableLiveTvAccess: boolean
		EnableLiveTvManagement: boolean
		EnableMediaConversion: boolean
		EnableMediaPlayback: boolean
		EnablePlaybackRemuxing: boolean
		EnablePublicSharing: boolean
		EnableRemoteAccess: boolean
		EnableRemoteControlOfOtherUsers: boolean
		EnableSharedDeviceControl: boolean
		EnableSubtitleDownloading: boolean
		EnableSubtitleManagement: boolean
		EnableSyncTranscoding: boolean
		EnableUserPreferenceAccess: boolean
		EnableVideoPlaybackTranscoding: boolean
		EnabledChannels: any[]
		EnabledDevices: any[]
		EnabledFolders: any[]
		ExcludedSubFolders: any[]
		InvalidLoginAttemptCount: number
		IsAdministrator: boolean
		IsDisabled: boolean
		IsHidden: boolean
		IsHiddenRemotely: boolean
		RemoteClientBitrateLimit: number
	}
	ServerId: string
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
