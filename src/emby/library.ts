import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as socket from '@/emby/socket'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const rxLibraryChanged = socket.filter<LibraryChanged>('LibraryChanged')
export const rxRefreshProgress = socket.filter<RefreshProgress>('RefreshProgress')
export const rxScheduledTasksInfo = socket.filter<ScheduledTasksInfo>('ScheduledTasksInfo')
export const rxScheduledTaskEnded = socket.filter<ScheduledTaskEnded>('ScheduledTaskEnded')

// rxLibraryChanged.subscribe(LibraryChanged => {
// 	console.warn(`LibraryChanged ->`, LibraryChanged)
// })

export const library = {
	qualities: ['1080p', '4K'] as Quality[],
	async refresh() {
		await emby.client.post(`/Library/Refresh`)
	},
	async toStrm(item: media.Item) {
		let file = path.normalize(process.env.EMBY_LIBRARY || process.cwd())
		file += `/${item.type}s`

		let title = utils.toSlug(item.main.title, { toName: true })
		if (item.movie) {
			file += `/${title} (${item.year})/${title} (${item.year})`
		}
		if (item.show) {
			file += `/${title} (${item.year})`
			file += `/Season ${item.S.n}`
			file += `/${title} S${item.S.z}E${item.E.z}`
		}
		file += `.strm`

		let query = {
			type: item.type,
			traktId: item.traktId,
			title: utils.toSlug(item.main.title, { toName: true, separator: '-', lowercase: true }),
		} as StrmQuery
		item.episode && (query = { ...query, s: item.S.n, e: item.E.n })

		await fs.outputFile(file, `${emby.DOMAIN}:${emby.STRM_PORT}/strm?${qs.stringify(query)}`)
	},
	async add(item: media.Item) {
		if (item.movie) {
			await library.toStrm(item)
		}
		if (item.show) {
			await utils.pRandom(1000)
			let seasons = (await trakt.client.get(
				`/shows/${item.traktId}/seasons`
			)) as trakt.Season[]
			for (let season of seasons.filter(v => v.number > 0)) {
				item.use({ season })
				for (let i = 1; i <= item.S.a; i++) {
					item.use({ episode: { number: i, season: season.number } })
					await library.toStrm(item)
				}
			}
		}
	},
}

export type Quality = '1080p' | '4K'

export interface StrmQuery {
	e: number
	quality: Quality
	s: number
	title: string
	traktId: string
	type: media.MainContentType
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
	IndexNumber: number
	ParentBackdropImageTags: string[]
	ParentBackdropItemId: string
	ParentIndexNumber: number
	ParentLogoImageTag: string
	ParentLogoItemId: string
	ParentThumbImageTag: string
	ParentThumbItemId: string
	SeasonId: string
	SeasonName: string
	SeriesId: string
	SeriesName: string
	SeriesPrimaryImageTag: string
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
