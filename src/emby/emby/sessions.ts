import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const sessions = {
	async get() {
		let Sessions = (await emby.client.get('/Sessions', { silent: true })) as Session[]
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
	static UHDUsers = ['admin', 'dev', 'developer', 'robert']
	static HDUsers = Session.UHDUsers.concat(['mom'])
	
	get Codecs() {
		let { audio, video } = { audio: '', video: '' }
		let cpath = 'Capabilities.DeviceProfile.CodecProfiles'
		let cprofiles = _.get(this, cpath, []) as CodecProfiles[]
		audio += `${_.join(cprofiles.filter(v => v.Type == 'Audio').map(v => v.Codec), ',')},`
		audio += `${_.join(cprofiles.filter(v => v.Type == 'VideoAudio').map(v => v.Codec), ',')},`
		video += `${_.join(cprofiles.filter(v => v.Type == 'Video').map(v => v.Codec), ',')},`
		let dpath = 'Capabilities.DeviceProfile.DirectPlayProfiles'
		let dprofiles = _.get(this, dpath, []) as DirectPlayProfiles[]
		audio += `${_.join(dprofiles.map(v => v.AudioCodec).filter(Boolean), ',')},`
		video += `${_.join(dprofiles.map(v => v.VideoCodec).filter(Boolean), ',')},`
		let tpath = 'Capabilities.DeviceProfile.TranscodingProfiles'
		let tprofiles = _.get(this, tpath, []) as TranscodingProfiles[]
		audio += `${_.join(tprofiles.map(v => v.AudioCodec).filter(Boolean), ',')},`
		video += `${_.join(tprofiles.map(v => v.VideoCodec).filter(Boolean), ',')},`
		let Codecs = {
			audio: _.sortBy(_.uniq(audio.toLowerCase().split(',')).filter(Boolean)).map(v =>
				v.startsWith('-') ? utils.minify(v) : v
			),
			video: _.sortBy(_.uniq(video.toLowerCase().split(',')).filter(Boolean)).map(v =>
				v.startsWith('-') ? utils.minify(v) : v
			),
		}
		if (Codecs.video.includes('h264')) {
			Codecs.video.push('h265')
			Codecs.video.sort()
		}
		return Codecs
	}
	get Channels() {
		if (process.DEVELOPMENT) {
			console.warn(`DEVELOPMENT Channels ->`, 8)
			return 8
		}
		let Channels = [2]
		let cpath = 'Capabilities.DeviceProfile.CodecProfiles'
		let cprofiles = _.get(this, cpath, []) as CodecProfiles[]
		cprofiles.forEach(({ Conditions, Type }) => {
			if (Type != 'VideoAudio' || !_.isArray(Conditions)) return
			let Condition = Conditions.find(({ Property }) => Property == 'AudioChannels')
			Condition && Condition.Value && Channels.push(_.parseInt(Condition.Value))
		})
		let tpath = 'Capabilities.DeviceProfile.TranscodingProfiles'
		let tprofiles = _.get(this, tpath, []) as TranscodingProfiles[]
		tprofiles.forEach(({ MaxAudioChannels }) => {
			MaxAudioChannels && Channels.push(_.parseInt(MaxAudioChannels))
		})
		if (Channels.length == 1) return 8
		return _.max(Channels)
	}
	get Quality(): emby.Quality {
		if (process.DEVELOPMENT) {
			console.warn(`DEVELOPMENT Quality ->`, 'UHD')
			return 'UHD'
		}
		if (utils.minify(this.Client + this.DeviceName).includes('mobile')) return 'SD'
		if (this.Channels > 2) {
			let user = this.UserName.toLowerCase()
			if (Session.UHDUsers.includes(user)) return 'UHD'
			if (Session.HDUsers.includes(user)) return 'HD'
		}
		return 'SD'
	}
	get Stamp() {
		return new Date(this.LastActivityDate).valueOf()
	}
	get Age() {
		return Date.now() - this.Stamp
	}
	get Bitrate() {
		let rate = NaN
		if ((rate = _.get(this, 'Capabilities.DeviceProfile.MaxStreamingBitrate'))) return rate
		if ((rate = _.get(this, 'Capabilities.DeviceProfile.MaxStaticBitrate'))) return rate
		return rate
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
	get StrmPath() {
		return _.get(this, 'NowPlayingItem.Path') as string
	}
	get ItemId() {
		return _.get(this, 'NowPlayingItem.Id') as string
	}
	get IsNowPlaying() {
		return !!this.Container && !!this.ItemName && !!this.StrmPath && !!this.ItemId
	}
	get IsStreaming() {
		return !!this.IsPlayState && !!this.IsNowPlaying
	}

	get json() {
		return utils.compact({
			Age: this.Age,
			Audio: JSON.stringify(this.Codecs.audio),
			Bitrate: this.Bitrate && `${utils.fromBytes(this.Bitrate)}/s`,
			Channels: this.Channels,
			Client: this.Client,
			DeviceName: this.DeviceName,
			IsStreaming: this.IsStreaming,
			Quality: this.Quality,
			StrmPath: this.StrmPath,
			UserName: this.UserName,
			Video: JSON.stringify(this.Codecs.video),
		})
	}

	constructor(Session: Session) {
		_.merge(this, Session)
	}

	async getUser() {
		return await emby.users.byUserId(this.UserId)
	}

	async getDevice() {
		return (await emby.client.get(`/Devices/Info`, { query: { Id: this.DeviceId } })) as Device
	}

	message(data: string | Error) {
		let body = { Text: `✅ ${data}`, TimeoutMs: 5000 }
		if (_.isError(data)) {
			body.Text = `❌ Error: ${data.message}`
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
			CodecProfiles: CodecProfiles[]
			ContainerProfiles: any[]
			DirectPlayProfiles: DirectPlayProfiles[]
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

interface CodecProfiles {
	ApplyConditions: any[]
	Codec: string
	Conditions: {
		Condition: any
		IsRequired: any
		Property: any
		Value: any
	}[]
	Type: string
}

interface DirectPlayProfiles {
	AudioCodec: string
	Container: string
	Type: string
	VideoCodec: string
}

interface TranscodingProfiles {
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
	VideoCodec: string
}

interface Device {
	AppName: string
	AppVersion: string
	DateLastActivity: string
	IconUrl: string
	Id: string
	LastUserId: string
	LastUserName: string
	Name: string
}
