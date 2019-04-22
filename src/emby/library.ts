import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as Rx from '@/utils/rxjs'
import * as socket from '@/emby/socket'
import * as utils from '@/utils/utils'

export const rxLibrary = socket.rxSocket.pipe<socket.EmbyEvent<LibraryChanged>>(
	Rx.Op.filter(({ MessageType }) => MessageType == 'LibraryChanged')
)

export const library = {
	async refresh() {
		await emby.client.post(`/Library/Refresh`)
	},
}

export function toStrmPath(item: media.Item, quality = '' as emby.Quality) {
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
