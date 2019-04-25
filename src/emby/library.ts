import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as socket from '@/emby/socket'
import * as utils from '@/utils/utils'

export const rxLibraryChanged = socket.rxSocket.pipe(
	Rx.Op.filter(({ MessageType }) => MessageType == 'LibraryChanged'),
	Rx.Op.map(({ Data }) => Data as LibraryChanged)
)
export const rxRefreshProgress = socket.rxSocket.pipe(
	Rx.Op.filter(({ MessageType }) => MessageType == 'RefreshProgress'),
	Rx.Op.map(({ Data }) => Data as RefreshProgress)
)
export const rxScheduledTasksInfo = socket.rxSocket.pipe(
	Rx.Op.filter(({ MessageType }) => MessageType == 'ScheduledTasksInfo'),
	Rx.Op.map(({ Data }) => Data as ScheduledTasksInfo)
)
export const rxScheduledTaskEnded = socket.rxSocket.pipe(
	Rx.Op.filter(({ MessageType }) => MessageType == 'ScheduledTaskEnded'),
	Rx.Op.map(({ Data }) => Data as ScheduledTaskEnded)
)

export const library = {
	async refresh() {
		await emby.client.post(`/Library/Refresh`)
	},
	strmFile(item: media.Item) {
		let file = path.normalize(process.env.EMBY_LIBRARY || process.cwd())
		file += `/${item.type}s`
		let title = item.main.title
		_.isFinite(item.year) && (title += ` (${item.year})`)
		if (item.movie) {
			file += `/${title}/${title}`
		} else if (_.isFinite(item.E.n)) {
			file += `/${title}`
			file += `/Season ${item.S.n}`
			file += `/${item.main.title} S${item.S.z}E${item.E.z}`
		} else {
			throw new Error(`toStrm !item -> ${item.title}`)
		}
		let url = `${emby.DOMAIN}:${emby.STRM_PORT}/strm`
		let query = {
			type: item.type,
			traktId: item.traktId,
			title: utils.toSlug(item.main.title, { separator: '-' }),
		}
		item.episode && Object.assign(query, { s: item.S.n, e: item.E.n })
		url += `?${qs.stringify(query)}`
		return { file: path.normalize(`${file}.strm`), url }
	},
}

export async function addLinks(item: media.Item, links: string[]) {
	// let base = path.join(process.cwd(), 'dist')
	let base = path.normalize(process.env.EMBY_LIBRARY || process.cwd())

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

export type Quality = '480p' | '720p' | '1080p' | '4K'

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

export interface LibraryChanged {
	CollectionFolders: any[]
	FoldersAddedTo: any[]
	FoldersRemovedFrom: any[]
	IsEmpty: boolean
	ItemsAdded: any[]
	ItemsRemoved: any[]
	ItemsUpdated: string[]
}

export interface RefreshProgress {
	ItemId: string
	Progress: string
}

export interface ScheduledTasksInfo {
	Category: string
	Description: string
	Id: string
	IsHidden: boolean
	Key: string
	Name: string
	State: string
	Triggers: any[]
}

export interface ScheduledTaskEnded {
	EndTimeUtc: string
	Id: string
	Key: string
	Name: string
	StartTimeUtc: string
	Status: string
}
