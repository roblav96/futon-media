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

	let rxPostedPlaybackInfo = emby.rxLine.pipe(
		Rx.op.filter(({ level, message }) => {
			return level == 'Debug' && message.startsWith('GetPostedPlaybackInfo')
		}),
	)
	rxPostedPlaybackInfo.subscribe(async ({ message }) => {
		let { err, value } = fastParse(message.slice(message.indexOf('{')))
		if (err) return console.error(`rxPostedPlaybackInfo ->`, err.message)
		let { Id, UserId } = value as PlaybackInfo
		console.log(`rxPostedPlaybackInfo ->`, value)
		await db.put(Id, value, utils.duration(1, 'day'))
		await db.put(`${Id}:${UserId}`, value, utils.duration(1, 'day'))
	})

	// let rxPlaybackInfo = emby.rxHttp.pipe(
	// 	Rx.op.filter(({ method, parts, query }) => {
	// 		return method == 'POST' && parts.includes('playbackinfo') && !!query.ItemId
	// 	}),
	// )
	// rxPlaybackInfo.subscribe(async ({ query, ua }) => {
	// 	let Session = await sessions.byUserId(UserId)
	// 	console.log(`rxPlaybackInfo Session ->`, Session.json)
	// })
})

export class PlaybackInfo {
	static async get(ItemId: string, UserId = '') {
		;(await emby.User.get()).forEach(v => (PlaybackInfo.UserNames[v.Id] = v.Name))
		return new PlaybackInfo(await db.get(UserId ? `${ItemId}:${UserId}` : ItemId))
	}

	static UserNames = {} as Record<string, string>
	get UserName() {
		return PlaybackInfo.UserNames[this.UserId]
	}

	get UHD() {
		let UHDs = ['developer', 'robert']
		return UHDs.includes(this.UserName.toLowerCase())
	}
	get HD() {
		let HDs = ['mom']
		return HDs.includes(this.UserName.toLowerCase()) || this.UHD
	}

	get Codecs() {
		let { audio, video } = { audio: '', video: '' }
		let cpath = 'DeviceProfile.CodecProfiles'
		let cprofiles = _.get(this, cpath, []) as CodecProfiles[]
		audio += `${_.join(cprofiles.filter(v => v.Type == 'Audio').map(v => v.Codec), ',')},`
		audio += `${_.join(cprofiles.filter(v => v.Type == 'VideoAudio').map(v => v.Codec), ',')},`
		video += `${_.join(cprofiles.filter(v => v.Type == 'Video').map(v => v.Codec), ',')},`
		let dpath = 'DeviceProfile.DirectPlayProfiles'
		let dprofiles = _.get(this, dpath, []) as DirectPlayProfile[]
		audio += `${_.join(dprofiles.map(v => v.AudioCodec).filter(Boolean), ',')},`
		video += `${_.join(dprofiles.map(v => v.VideoCodec).filter(Boolean), ',')},`
		let tpath = 'DeviceProfile.TranscodingProfiles'
		let tprofiles = _.get(this, tpath, []) as TranscodingProfile[]
		audio += `${_.join(tprofiles.map(v => v.AudioCodec).filter(Boolean), ',')},`
		video += `${_.join(tprofiles.map(v => v.VideoCodec).filter(Boolean), ',')},`
		let Codecs = {
			audio: _.sortBy(_.uniq(audio.toLowerCase().split(',')).filter(Boolean)).map(v =>
				v.startsWith('-') ? utils.minify(v) : v,
			),
			video: _.sortBy(_.uniq(video.toLowerCase().split(',')).filter(Boolean)).map(v =>
				v.startsWith('-') ? utils.minify(v) : v,
			),
		}
		if (Codecs.audio.includes('ac3')) Codecs.audio.push('eac3')
		if (Codecs.audio.includes('dts') && this.HD) Codecs.audio.push('truehd')
		Codecs.audio.sort()
		return Codecs
	}
	get Channels() {
		// if (process.DEVELOPMENT) return 8
		let Channels = [2]
		let cpath = 'DeviceProfile.CodecProfiles'
		let cprofiles = _.get(this, cpath, []) as CodecProfiles[]
		cprofiles.forEach(({ Conditions, Type }) => {
			if (Type != 'VideoAudio' || !_.isArray(Conditions)) return
			let Condition = Conditions.find(({ Property }) => Property == 'AudioChannels')
			Condition && Condition.Value && Channels.push(_.parseInt(Condition.Value))
		})
		let tpath = 'DeviceProfile.TranscodingProfiles'
		let tprofiles = _.get(this, tpath, []) as TranscodingProfile[]
		tprofiles.forEach(({ MaxAudioChannels }) => {
			MaxAudioChannels && Channels.push(_.parseInt(MaxAudioChannels))
		})
		// if (Channels.length == 1) return 8
		return _.max(Channels)
	}
	get Quality(): emby.Quality {
		// if (process.DEVELOPMENT) return 'UHD'
		if (this.Channels > 2 && this.UHD) return 'UHD'
		if (this.Channels > 2 && this.HD) return 'HD'
		return 'SD'
	}
	get Bitrate() {
		return this.MaxStreamingBitrate || this.DeviceProfile.MaxStreamingBitrate || NaN
	}

	constructor(PlaybackInfo: PlaybackInfo) {
		_.merge(this, PlaybackInfo)
	}
}

export type Quality = 'SD' | 'HD' | 'UHD'

export interface PlaybackInfo {
	AllowAudioStreamCopy: boolean
	AllowVideoStreamCopy: boolean
	AudioStreamIndex: number
	AutoOpenLiveStream: boolean
	DeviceProfile: DeviceProfile
	DirectPlayProtocols: string[]
	EnableDirectPlay: boolean
	EnableDirectStream: boolean
	EnableTranscoding: boolean
	Id: string
	IsPlayback: boolean
	MaxAudioChannels: number
	MaxStreamingBitrate: number
	MediaSourceId: string
	StartTimeTicks: number
	SubtitleStreamIndex: number
	UserId: string
}

export interface DeviceProfile {
	CodecProfiles: CodecProfiles[]
	ContainerProfiles: any[]
	DirectPlayProfiles: DirectPlayProfile[]
	EnableAlbumArtInDidl: boolean
	EnableSingleAlbumArtLimit: boolean
	EnableSingleSubtitleLimit: boolean
	IgnoreTranscodeByteRangeRequests: boolean
	MaxAlbumArtHeight: number
	MaxAlbumArtWidth: number
	MaxStreamingBitrate: number
	MusicStreamingTranscodingBitrate: number
	Name: string
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
	TranscodingProfiles: TranscodingProfile[]
	XmlRootAttributes: any[]
}

export interface CodecProfiles {
	ApplyConditions: any[]
	Codec: string
	Conditions: {
		Condition: string
		IsRequired: boolean
		Property: string
		Value: string
	}[]
	Type: string
}

export interface DirectPlayProfile {
	AudioCodec: string
	Container: string
	Type: string
	VideoCodec: string
}

export interface TranscodingProfile {
	AudioCodec: string
	BreakOnNonKeyFrames: boolean
	Container: string
	Context: string
	CopyTimestamps: boolean
	EnableMpegtsM2TsMode: boolean
	EstimateContentLength: boolean
	ManifestSubtitles: string
	MaxAudioChannels: string
	MinSegments: number
	Protocol: string
	SegmentLength: number
	TranscodeSeekInfo: string
	Type: string
	VideoCodec: string
}
