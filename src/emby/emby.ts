import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as pAll from 'p-all'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as media from '@/media/media'

export const client = new http.Http({
	baseUrl: `${process.env.EMBY_API_URL}/emby`,
	query: {
		api_key: process.env.EMBY_API_KEY,
	},
})

export async function ensureStrm() {}

export function toStrmPath(item: media.Item, quality = '' as Quality) {
	let title = utils.toSlug(item.main.title, { toName: true })
	let file = path.normalize(process.env.EMBY_LIBRARY || process.cwd())
	file += `/${item.movie ? 'movies' : 'shows'}`
	if (item.movie) {
		let year = item.main.year || new Date(item.main.released).getFullYear()
		title += ` (${year})`
		file += `/${title}/${title}`
		// file += `/${item.ids.slug}/${item.ids.slug}`
	} else if (item.episode) {
		let year = item.main.year || new Date(item.main.first_aired).getFullYear()
		title += ` (${year})`
		file += `/${title}`
		// file += `/Season ${item.S.n}`
		file += `/s${item.S.z}e${item.E.z}`
		// file += `/${item.main.title} - S${item.S.z}E${item.E.z}`
		// file += `/${item.ids.slug}/${item.ids.slug}-S${item.S.z}E${item.E.z}`
	} else throw new Error(`Incomplete item -> ${item.title}`)
	quality && (file += ` - ${quality}`)
	file += `.strm`
	return file
}

export async function getAllSessions() {
	let Sessions = (await client.get(`/Sessions`)) as Session[]
	return Sessions.sort(
		(a, b) => new Date(b.LastActivityDate).valueOf() - new Date(a.LastActivityDate).valueOf()
	)
}

export async function addLinks(item: media.Item, links: string[]) {
	// let base = path.join(process.cwd(), 'dist')
	let base = process.env.EMBY_LIBRARY || process.cwd()

	let dir = item.movie ? 'movies' : 'shows'
	if (!(await fs.pathExists(path.join(base, dir)))) {
		throw new Error(`!fs.pathExists(${path.join(base, dir)})`)
	}
	dir += `/${item.ids.slug}`
	item.season && (dir += `/s${item.S.z}`)
	let cwd = path.join(base, dir)
	await fs.ensureDir(cwd)

	await pAll(
		links.map((link, index) => () => {
			let name = `${item.ids.slug}`
			if (item.season) {
				name += `-s${item.S.z}`
				name += `e${utils.zeroSlug(index + 1)}`
			}
			name += `.strm`
			return fs.outputFile(path.join(cwd, name), link)
		})
	)
}

export async function refreshLibrary() {
	await client.post(`/Library/Refresh`)
}

export async function sendMessage(sessionId: string, data: string | Error) {
	if (!sessionId) return
	let body = { Text: data, TimeoutMs: 5000 }
	if (_.isError(data)) {
		body.Text = `❌ Error: ${data.message}`
		body.TimeoutMs *= 2
	}
	await client.post(`/Sessions/${sessionId}/Message`, { body }).catch(_.noop)
}

export type Quality = '480p' | '720p' | '1080p' | '4K'

export interface Session {
	AdditionalUsers: any[]
	AppIconUrl: string
	ApplicationVersion: string
	Capabilities: {
		DeviceProfile: {
			CodecProfiles: {
				ApplyConditions: any
				Codec: any
				Conditions: any
				Type: any
			}[]
			ContainerProfiles: any[]
			DirectPlayProfiles: {
				AudioCodec: any
				Container: any
				Type: any
				VideoCodec: any
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
				Conditions: any
				Container: any
				MimeType: any
				Type: any
			}[]
			SubtitleProfiles: {
				Format: any
				Method: any
			}[]
			SupportedMediaTypes: string
			TimelineOffsetSeconds: number
			TranscodingProfiles: {
				AudioCodec: any
				BreakOnNonKeyFrames: any
				Container: any
				Context: any
				CopyTimestamps: any
				EnableMpegtsM2TsMode: any
				EstimateContentLength: any
				MaxAudioChannels: any
				MinSegments: any
				Protocol: any
				SegmentLength: any
				TranscodeSeekInfo: any
				Type: any
				VideoCodec: any
			}[]
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
	PlayState: {
		CanSeek: boolean
		IsMuted: boolean
		IsPaused: boolean
		RepeatMode: string
		MediaSourceId: string
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

export interface Item {
	BackdropImageTags: string[]
	CanDelete: boolean
	CanDownload: boolean
	Chapters: any[]
	CommunityRating: number
	CriticRating: number
	DateCreated: string
	DisplayPreferencesId: string
	Etag: string
	ExternalUrls: {
		Name: string
		Url: string
	}[]
	GenreItems: {
		Id: number
		Name: string
	}[]
	Genres: string[]
	HasSubtitles: boolean
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
	LockData: boolean
	LockedFields: any[]
	MediaSources: {
		Container: string
		Formats: any[]
		Id: string
		IsInfiniteStream: boolean
		IsRemote: boolean
		MediaStreams: {
			Codec: any
			DisplayLanguage: any
			DisplayTitle: any
			Index: any
			IsDefault: any
			IsExternal: any
			IsForced: any
			IsInterlaced: any
			IsTextSubtitleStream: any
			Language: any
			Path: any
			SupportsExternalStream: any
			Type: any
		}[]
		Name: string
		Path: string
		Protocol: string
		ReadAtNativeFramerate: boolean
		RequiredHttpHeaders: {}
		RequiresClosing: boolean
		RequiresLooping: boolean
		RequiresOpening: boolean
		Size: number
		SupportsDirectPlay: boolean
		SupportsDirectStream: boolean
		SupportsProbing: boolean
		SupportsTranscoding: boolean
		Type: string
	}[]
	MediaStreams: {
		Codec: string
		DisplayLanguage: string
		DisplayTitle: string
		Index: number
		IsDefault: boolean
		IsExternal: boolean
		IsForced: boolean
		IsInterlaced: boolean
		IsTextSubtitleStream: boolean
		Language: string
		Path: string
		SupportsExternalStream: boolean
		Type: string
	}[]
	MediaType: string
	Name: string
	OfficialRating: string
	OriginalTitle: string
	Overview: string
	ParentId: string
	Path: string
	People: {
		Id: string
		Name: string
		PrimaryImageTag: string
		Role: string
		Type: string
	}[]
	PlayAccess: string
	PremiereDate: string
	PrimaryImageAspectRatio: number
	ProductionLocations: string[]
	ProductionYear: number
	ProviderIds: {
		Imdb: string
		Tmdb: string
		TmdbCollection: string
	}
	RemoteTrailers: {
		Name: string
		Url: string
	}[]
	ServerId: string
	SortName: string
	Studios: {
		Id: number
		Name: string
	}[]
	Taglines: string[]
	Tags: any[]
	Type: string
	UserData: {
		IsFavorite: boolean
		Key: string
		PlayCount: number
		PlaybackPositionTicks: number
		Played: boolean
	}
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
