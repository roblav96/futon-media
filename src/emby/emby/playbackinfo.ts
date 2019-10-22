import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as fastParse from 'fast-json-parse'
import * as flatten from 'flat'
import * as media from '@/media/media'
import * as mocks from '@/mocks/mocks'
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
		await db.put(UserId, value, utils.duration(1, 'day'))
		await db.put(`${Id}:${UserId}`, value, utils.duration(1, 'day'))
	})

	// console.log(`PLAYBACK_INFO ->`, mocks.PLAYBACK_INFO)
	// console.log(`PLAYBACK_INFO flatten ->`, _.mapValues(mocks.PLAYBACK_INFO, v => flatten(v)))

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
	static async setUserNames() {
		;(await emby.User.get()).forEach(v => (PlaybackInfo.UserNames[v.Id] = v.Name))
	}
	static async get(ItemId: string, UserId = '') {
		let value = (await db.get(UserId ? `${ItemId}:${UserId}` : ItemId)) as PlaybackInfo
		return value ? new PlaybackInfo(value) : value
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
		return this.UHD || HDs.includes(this.UserName.toLowerCase())
	}
	get SD() {
		return !this.UHD && !this.HD
	}
	get Quality(): emby.Quality {
		if (this.AudioChannels > 2 && this.UHD) return 'UHD'
		if (this.AudioChannels > 2 && this.HD) return 'HD'
		return 'SD'
	}

	get Bitrate() {
		return this.MaxStreamingBitrate || this.DeviceProfile.MaxStreamingBitrate
	}

	get AudioChannels() {
		let Channels = [2]
		for (let [k, v] of Object.entries(this.flat)) {
			if (k.endsWith('channels')) {
				Channels.push(_.parseInt(v as string))
			}
			if (k.endsWith('.property') && _.isString(v) && v.toLowerCase() == 'audiochannels') {
				Channels.push(_.parseInt(this.flat[k.replace('.property', '.value')] as string))
			}
		}
		// if (Channels.length == 1) return 8
		return _.max(Channels)
	}

	get AudioCodecs() {
		let AudioCodecs = [] as string[]
		for (let [k, v] of Object.entries(this.flat)) {
			if (!_.isString(v)) continue
			v = v.toLowerCase()
			if (k.endsWith('.audiocodec')) {
				AudioCodecs.push(...v.split(','))
			}
			if (k.endsWith('.type') && (v == 'audio' || v == 'videoaudio')) {
				AudioCodecs.push(this.flat[k.replace('.type', '.codec')] as string)
			}
		}
		return _.sortBy(_.uniq(AudioCodecs.filter(Boolean)))
	}
	get VideoCodecs() {
		let VideoCodecs = [] as string[]
		for (let [k, v] of Object.entries(this.flat)) {
			if (!_.isString(v)) continue
			v = v.toLowerCase()
			if (k.endsWith('.videocodec')) {
				VideoCodecs.push(...v.split(','))
			}
			if (k.endsWith('.type') && v == 'video') {
				VideoCodecs.push(this.flat[k.replace('.type', '.codec')] as string)
			}
		}
		return _.sortBy(_.uniq(VideoCodecs.filter(Boolean)))
	}

	flat: Record<string, boolean | number | string>
	constructor(PlaybackInfo: PlaybackInfo) {
		_.merge(this, PlaybackInfo)
		Object.defineProperty(this, 'flat', {
			value: _.mapKeys(flatten(PlaybackInfo), (v, k: string) => k.toLowerCase()),
		})
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
	CodecProfiles: CodecProfile[]
	ContainerProfiles: ContainerProfile[]
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

export interface CodecProfile {
	ApplyConditions: any[]
	Codec: string
	Conditions: {
		Condition: string
		IsRequired: boolean
		Property: string
		Value: string
	}[]
	Container: string
	Type: string
}

export interface ContainerProfile {
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
