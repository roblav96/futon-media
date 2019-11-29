import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as flatten from 'flat'
import * as Json from '@/shims/json'
import * as media from '@/media/media'
import * as mocks from '@/mocks/mocks'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	// process.DEVELOPMENT && (await db.flush())

	emby.rxSocket.subscribe(async ({ MessageType }) => {
		if (MessageType != 'OnOpen') return
		let Users = await emby.User.get()
		Users.forEach(v => (PlaybackInfo.UserNames[v.Id] = v.Name))
	})

	let rxPostedPlaybackInfo = emby.rxLine.pipe(
		Rx.op.filter(({ level, message }) => {
			return level == 'Debug' && message.startsWith('GetPostedPlaybackInfo')
		}),
	)
	rxPostedPlaybackInfo.subscribe(async ({ message }) => {
		let { error, value } = Json.parse(message.slice(message.indexOf('{')))
		if (error) return console.error(`rxPostedPlaybackInfo ->`, error.message)
		let { Id, UserId } = value as PlaybackInfo
		await db.put(UserId, value)
		await db.put(Id, value, utils.duration(1, 'day'))
		await db.put(`${Id}:${UserId}`, value, utils.duration(1, 'day'))
	})

	// console.log(`PLAYBACK_INFO ->`, mocks.PLAYBACK_INFO)
	// console.log(`PLAYBACK_INFO flatten ->`, _.mapValues(mocks.PLAYBACK_INFO, v => flatten(v)))
	// console.log(`PLAYBACK_INFO ->`, _.mapValues(mocks.PLAYBACK_INFO, v => new PlaybackInfo(v)))
})

export class PlaybackInfo {
	static async get(ItemId: string, UserId = '') {
		let value = (await db.get(UserId ? `${ItemId}:${UserId}` : ItemId)) as PlaybackInfo
		return value ? new PlaybackInfo(value) : value
	}
	static async byUserId(UserId: string) {
		return new PlaybackInfo(await db.get(UserId))
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
		for (let codec of ['dts', 'dca']) {
			if (this.AudioCodecs.includes(codec)) Channels.push(6)
		}
		for (let codec of ['dtshd', 'truehd']) {
			if (this.AudioCodecs.includes(codec)) Channels.push(8)
		}
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

	get json() {
		return utils.compact({
			AudioChannels: this.AudioChannels,
			AudioCodecs: JSON.stringify(this.AudioCodecs),
			Quality: this.Quality,
			UserName: this.UserName,
			VideoCodecs: JSON.stringify(this.VideoCodecs),
		})
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
