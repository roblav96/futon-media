import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as isIp from 'is-ip'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import pQueue from 'p-queue'

process.nextTick(async () => {
	await library.setFolders()
	// await library.setCollections()
	await library.setLibraryMonitorDelay()
})

export const library = {
	async refresh() {
		await emby.client.post('/Library/Refresh', {
			retries: [],
			timeout: utils.duration(1, 'minute'),
		})
	},
	async unrefresh() {
		let Tasks = (await emby.client.get('/ScheduledTasks', {
			silent: true,
		})) as ScheduledTasksInfo[]
		let { Id, State } = Tasks.find(v => v.Key == 'RefreshLibrary')
		if (State != 'Idle') {
			await emby.client.delete(`/ScheduledTasks/Running/${Id}`)
			await utils.pTimeout(1000)
		}
	},

	folders: { movies: { Location: '', ItemId: '' }, shows: { Location: '', ItemId: '' } },
	async setFolders() {
		let Folders = (await emby.client.get('/Library/VirtualFolders', {
			silent: true,
		})) as VirtualFolder[]
		let movies = Folders.find(v => v.CollectionType == 'movies')
		library.folders.movies = { Location: movies.Locations[0], ItemId: movies.ItemId }
		let tvshows = Folders.find(v => v.CollectionType == 'tvshows')
		library.folders.shows = { Location: tvshows.Locations[0], ItemId: tvshows.ItemId }
	},

	// async setCollections() {
	// 	let Roots = await library.Items({ IncludeItemTypes: ['Folder'] })
	// 	let Root = Roots.find(v => v.ParentId == '1' && v.Name == 'collections')
	// 	let Folders = await library.Items({
	// 		IncludeItemTypes: ['BoxSet'],
	// 		ParentId: Root.Id,
	// 	})
	// 	if (Folders.length > 0) return
	// 	for (let Name of ['Movie Collections', 'Movie Lists', 'TV Show Lists']) {
	// 		await emby.client.post('/Collections', { query: { Name } })
	// 	}
	// },

	async setLibraryMonitorDelay() {
		if (!process.env.EMBY_ADMIN_TOKEN) return
		let Configuration = (await emby.client.get('/System/Configuration', {
			silent: true,
		})) as emby.SystemConfiguration
		if (Configuration.LibraryMonitorDelay != 1) {
			Configuration.LibraryMonitorDelay = 1
			console.warn(`Configuration.LibraryMonitorDelay ->`, Configuration.LibraryMonitorDelay)
			await emby.client.post('/System/Configuration', {
				query: { api_key: process.env.EMBY_ADMIN_TOKEN },
				body: Configuration,
				silent: true,
			})
		}
	},

	async Items(
		query = {} as Partial<{
			AnyProviderIdEquals: string[]
			Fields: string[]
			Filters: string
			Ids: string[]
			IncludeItemTypes: string[]
			ParentId: string
			Path: string
			Recursive: boolean
			SortBy: string
			SortOrder: string
		}>,
	) {
		if (!query.Ids && !query.Recursive) query.Recursive = true
		if (!query.Ids && !query.Path && !query.IncludeItemTypes) {
			query.IncludeItemTypes = ['Movie', 'Series', 'Episode', 'Person']
		}
		query.Fields = (query.Fields || []).concat([
			'DateCreated',
			'IndexNumber',
			// 'MediaSources',
			// 'MediaStreams',
			'MediaType',
			'ParentId',
			'ParentIndexNumber',
			'Path',
			'ProductionYear',
			'ProviderIds',
			// 'RunTimeTicks',
			'SeasonId',
			'SeasonName',
			'SeriesId',
			'SeriesName',
			'SortName',
			// 'SupportsLocalMetadata',
		])
		return ((await emby.client.get('/Items', {
			query: _.mapValues(query, v => (_.isArray(v) ? _.uniq(v).join() : v)) as any,
			profile: process.DEVELOPMENT,
			silent: true,
		})).Items || []) as emby.Item[]
	},
	async byItemId(ItemId: string, query = {} as any) {
		return (await library.Items(_.merge({ Ids: [ItemId] }, query)))[0]
	},
	async byPath(Path: string, query = {} as any) {
		return (await library.Items(_.merge({ Path }, query)))[0]
	},
	async byProviderIds(ids: Partial<trakt.IDs & emby.ProviderIds>, query = {} as any) {
		let AnyProviderIdEquals = Object.entries(utils.compact(ids)).map(
			([k, v]) => `${k.toLowerCase()}.${v}`,
		)
		return (await library.Items(_.merge({ AnyProviderIdEquals }, query)))[0]
	},

	async item(Item: emby.Item) {
		let ids = Item.Path ? library.pathIds(Item.Path) : (Item.ProviderIds as never)
		if (_.isEmpty(ids)) return
		ids = utils.sortKeys(_.mapKeys(ids, (v, k) => k.toLowerCase())) as any
		let type = Item.Type.toLowerCase() as media.ContentType
		if (['Series', 'Season', 'Episode'].includes(Item.Type)) type = 'show'
		for (let key in ids) {
			let results = (await trakt.client.get(`/search/${key}/${ids[key]}`, {
				query: { type },
				silent: true,
			})) as trakt.Result[]
			let result = results.find(v => trakt.toFull(v).ids[key] == ids[key])
			if (!result) continue
			let item = new media.Item(result)
			if (['Movie', 'Person'].includes(Item.Type)) return item
			let indexes = library.pathIndexes(Item.Path)
			if (!item.season && ['Season', 'Episode'].includes(Item.Type)) {
				let seasons = (await trakt.client.get(`/shows/${item.slug}/seasons`, {
					silent: true,
				})) as trakt.Season[]
				item.use({ type: 'season', season: seasons.find(v => v.number == indexes.season) })
			}
			if (!item.episode && Item.Type == 'Episode') {
				let url = `/shows/${item.slug}/seasons/${indexes.season}/episodes/${indexes.episode}`
				let episode = (await trakt.client.get(url, {
					silent: true,
				})) as trakt.Episode
				item.use({ type: 'episode', episode })
			}
			return item
		}
	},
	pathIds(Path: string) {
		let matches = Array.from(Path.matchAll(/\[(?<key>\w{4})id=(?<value>(tt)?\d*)\]/g))
		return _.fromPairs(matches.map(match => [match.groups.key, match.groups.value]))
	},
	pathIndexes(Path: string) {
		let [season, episode] = [] as number[]
		let match = Path.match(/\sS(?<season>\d+)E(?<episode>\d+)\.strm/)
		if (!match) match = Path.match(/\/Season\s(?<season>\d+)/)
		if (match && match.groups) {
			season = _.parseInt(match.groups.season)
			episode = _.parseInt(match.groups.episode)
		}
		return { season, episode }
	},

	toStrmPath(query: StrmQuery, full = false) {
		let file = `/${query.title} (${query.year})`
		let dir = library.folders[`${query.type}s` as media.MainContentTypes].Location
		if (query.imdb) file += ` [imdbid=${query.imdb}]`
		if (query.tmdb) file += ` [tmdbid=${query.tmdb}]`
		if (query.tvdb) file += ` [tvdbid=${query.tvdb}]`
		if (query.type == 'movie') {
			file += `/${query.title} (${query.year})`
		}
		if (full == false) {
			let Path = `${dir}${file}`
			return query.type == 'movie' ? `${Path}.strm` : Path
		}
		if (query.type == 'show') {
			file += `/Season ${query.season}`
			file += `/${query.title} `
			file += `S${utils.zeroSlug(query.season)}`
			file += `E${utils.zeroSlug(query.episode)}`
		}
		return `${dir}${file}.strm`
	},
	toStrmQuery(item: media.Item) {
		let query = {
			slug: item.ids.slug,
			title: utils.toSlug(item.title, { title: true }),
			type: item.type,
			year: item.year,
		} as StrmQuery
		if (item.ids.imdb) query.imdb = item.ids.imdb
		if (item.ids.tmdb) query.tmdb = item.ids.tmdb
		if (item.ids.tvdb) query.tvdb = item.ids.tvdb
		if (item.S.n) query.season = item.S.n
		if (item.E.n) query.episode = item.E.n
		return query
	},
	toStrmUrl(query: StrmQuery) {
		return `${process.env.EMBY_WAN_ADDRESS}/strm?${qs.stringify(query)}`
	},
	itemStrmPath(item: media.Item, full?: boolean) {
		return library.toStrmPath(library.toStrmQuery(item), full)
	},
	toTitle(Item: emby.Item) {
		let name = Item.Name
		if (Item.Type == 'Season') name = `${Item.SeriesName} ${Item.Name}`
		if (Item.Type == 'Episode') {
			let base = path.basename(Item.Path).slice(0, -5)
			name = `${Item.SeriesName} ${base.split(' ').pop()}`
		}
		return `[${Item.Type}] ${name}`
	},

	async toStrmFile(item: media.Item) {
		let Path = library.itemStrmPath(item, true)
		let Updated = { Path, UpdateType: 'Modified' } as emby.MediaUpdated
		if (await fs.pathExists(Path)) return Updated
		Updated.UpdateType = 'Created'
		await fs.outputFile(Path, library.toStrmUrl(library.toStrmQuery(item)))
		return Updated
	},

	async add(item: media.Item) {
		let Updates = [] as emby.MediaUpdated[]
		if (item.movie) {
			Updates.push(await library.toStrmFile(item))
		}
		if (item.show) {
			item = new media.Item(JSON.parse(JSON.stringify(item)))
			await utils.pRandom(100)
			let seasons = (await trakt.client.get(`/shows/${item.slug}/seasons`, {
				silent: true,
			})) as trakt.Season[]
			seasons = seasons.filter(v => v.number > 0 && v.episode_count > 0)
			for (let season of seasons) {
				item.use({ type: 'season', season })
				for (let i = 1; i <= item.S.e; i++) {
					item.use({
						type: 'episode',
						episode: { number: i, season: season.number } as trakt.Episode,
					})
					Updates.push(await library.toStrmFile(item))
				}
			}
		}
		return Updates
	},

	pAddQueue: new pQueue({ concurrency: 1 }),
	async addQueue(items: media.Item[]) {
		return await library.pAddQueue.add(() => library.addAll(items))
	},
	async addAll(items: media.Item[]) {
		if (items.length == 0) return []
		let t = Date.now()
		let start = dayjs(t - 100).toISOString()

		let Updates = (await pAll(items.map(v => () => library.add(v)), { concurrency: 1 })).flat()
		console.log(`addAll Updates ->`, Updates.length)

		let Creations = Updates.filter(v => v.UpdateType == 'Created')
		if (Creations.length > 0) {
			console.info(`addAll Creations ->`, Creations.length)
			// await emby.client.post('/Library/Media/Updated', {
			// 	body: { Updates: Creations },
			// 	retries: [],
			// 	// silent: true,
			// 	timeout: utils.duration(1, 'minute'),
			// })

			// for (let [key, folder] of Object.entries(library.folders)) {
			// 	if (Creations.find(v => v.Path.startsWith(folder.Location))) {
			// 		let rxRefreshProgress = emby.rxSocket.pipe(
			// 			Rx.op.filter(({ MessageType, Data }) => {
			// 				if (MessageType != 'RefreshProgress') return
			// 				return Data.ItemId == folder.ItemId && Data.Progress == '100'
			// 			}),
			// 			Rx.op.take(1),
			// 		)
			// 		await Promise.all([
			// 			rxRefreshProgress.toPromise(),
			// 			emby.client.post(`/Items/${folder.ItemId}/Refresh`, {
			// 				query: {
			// 					Recursive: 'true',
			// 					ImageRefreshMode: 'Default',
			// 					MetadataRefreshMode: 'Default',
			// 					ReplaceAllImages: 'false',
			// 					ReplaceAllMetadata: 'false',
			// 				},
			// 				retries: [],
			// 				// silent: true,
			// 				timeout: utils.duration(1, 'minute'),
			// 			}),
			// 		])
			// 	}
			// }
		}

		let Items = (await pAll(
			items.map(item => () => library.byPath(library.itemStrmPath(item))),
			{ concurrency: 1 },
		)).filter(Boolean)

		if (items.length != Items.length) {
			throw new Error(`items.length != Items.length`)
		}

		// let pItems = items.map(item => () => library.byPath(library.itemStrmPath(item)))
		// let Items = [] as emby.Item[]
		// while (pItems.length > 0) {
		// 	if (Date.now() > t + utils.duration(1, 'minute')) {
		// 		throw new Error(`addAll duration > 1 minute`)
		// 	}
		// 	// console.log(`addAll while pItems ->`, pItems.length)
		// 	for (let i = pItems.length; i--; ) {
		// 		if (i < pItems.length - 1) await utils.pRandom(300)
		// 		let pItem = pItems[i]
		// 		let Item = await pItem()
		// 		if (!Item) continue
		// 		Items.push(Item)
		// 		pItems.splice(i, 1)
		// 	}
		// 	if (pItems.length > 0) await utils.pRandom(1000)
		// }

		// if (Creations.length > 0) await library.unrefresh()
		// for (let Item of Items) {
		// 	let Creation = Creations.find(v => v.Path.startsWith(Item.Path))
		// 	if (!Creation) continue
		// 	console.log(`Creation Item ->`, `[${Item.Type}]`, Item.Name)
		// 	await emby.client.post(`/Items/${Item.Id}/Refresh`, {
		// 		query: {
		// 			ImageRefreshMode: 'Default',
		// 			MetadataRefreshMode: 'Default',
		// 			Recursive: 'true',
		// 			ReplaceAllImages: 'false',
		// 			ReplaceAllMetadata: 'false',
		// 		},
		// 		silent: true,
		// 	})
		// 	// await utils.pRandom(1000)
		// 	while (true) {
		// 		await utils.pRandom(300)
		// 		let Created = await library.byItemId(Item.Id)
		// 		if (Created.Name != Item.Name) {
		// 			console.log(`Creation Created ->`, `[${Item.Type}]`, Created.Name)
		// 			break
		// 		}
		// 	}
		// }

		// let Sessions = await emby.sessions.get()
		// for (let Session of Sessions) {
		// 	await Session.command('LibraryChanged', {
		// 		CollectionFolders: [],
		// 		FoldersAddedTo: ['4'],
		// 		FoldersRemovedFrom: [],
		// 		IsEmpty: false,
		// 		ItemsAdded: [],
		// 		ItemsRemoved: [],
		// 		ItemsUpdated: Items.map(v => v.Id),
		// 	})
		// }

		console.info(Date.now() - t, `addAll ${Items.length} Items ->`, 'DONE')
		return Items
	},
}

export interface StrmQuery {
	episode: number
	imdb: string
	season: number
	slug: string
	title: string
	tmdb: number
	tvdb: number
	type: media.MainContentType
	year: number
}

export interface MediaUpdated {
	Path: string
	UpdateType: 'Created' | 'Deleted' | 'Modified'
}

export interface ProviderIds {
	Imdb: string
	Tmdb: string
	TmdbCollection: string
	Tvdb: string
	TvRage: string
	Zap2It: string
}

export interface Item {
	BackdropImageTags: string[]
	CanDelete: boolean
	CanDownload: boolean
	Chapters: any[]
	CommunityRating: number
	CriticRating: number
	DateCreated: string
	DisplayOrder: string
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
	MediaSources: MediaSource[]
	MediaStreams: MediaStream[]
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
	ProviderIds: ProviderIds
	RemoteTrailers: {
		Name: string
		Url: string
	}[]
	RunTimeTicks: number
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

export interface MediaSource {
	Container: string
	Formats: any[]
	Id: string
	IsInfiniteStream: boolean
	IsRemote: boolean
	MediaStreams: MediaStream[]
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
}

export interface MediaStream {
	AspectRatio: string
	AverageFrameRate: number
	BitDepth: number
	BitRate: number
	ChannelLayout: string
	Channels: number
	Codec: string
	CodecTimeBase: string
	ColorPrimaries: string
	ColorSpace: string
	ColorTransfer: string
	DisplayLanguage: string
	DisplayTitle: string
	Height: number
	Index: number
	IsAnamorphic: boolean
	IsAVC: boolean
	IsDefault: boolean
	IsExternal: boolean
	IsForced: boolean
	IsInterlaced: boolean
	IsTextSubtitleStream: boolean
	Language: string
	Level: number
	NalLengthSize: string
	Path: string
	PixelFormat: string
	Profile: string
	Protocol: string
	RealFrameRate: number
	RefFrames: number
	SampleRate: number
	SupportsExternalStream: boolean
	TimeBase: string
	Type: string
	VideoRange: string
	Width: number
}

export interface ItemsQuery {
	AdjacentTo: string
	AiredDuringSeason: number
	Albums: string
	AnyProviderIdEquals: string
	ArtistIds: string
	ArtistType: string
	Artists: string
	AudioCodecs: string
	Containers: string
	EnableImageTypes: string
	EnableImages: boolean
	EnableUserData: boolean
	ExcludeItemIds: string
	ExcludeItemTypes: string
	ExcludeLocationTypes: string
	Fields: string
	Filters: string
	Genres: string
	GroupItemsIntoCollections: boolean
	HasImdbId: boolean
	HasOfficialRating: boolean
	HasOverview: boolean
	HasParentalRating: boolean
	HasSpecialFeature: boolean
	HasSubtitles: boolean
	HasThemeSong: boolean
	HasThemeVideo: boolean
	HasTmdbId: boolean
	HasTrailer: boolean
	HasTvdbId: boolean
	Ids: string
	ImageTypeLimit: number
	ImageTypes: string
	IncludeItemTypes: string
	Is3D: boolean
	IsFavorite: boolean
	IsHD: boolean
	IsKids: boolean
	IsLocked: boolean
	IsMissing: boolean
	IsMovie: boolean
	IsNews: boolean
	IsPlaceHolder: boolean
	IsPlayed: boolean
	IsSeries: boolean
	IsSports: boolean
	IsUnaired: boolean
	Limit: number
	LocationTypes: string
	MaxOfficialRating: string
	MaxPlayers: number
	MaxPremiereDate: string
	MediaTypes: string
	MinCommunityRating: number
	MinCriticRating: number
	MinDateLastSaved: string
	MinDateLastSavedForUser: string
	MinIndexNumber: number
	MinOfficialRating: string
	MinPlayers: number
	MinPremiereDate: string
	NameLessThan: string
	NameStartsWith: string
	NameStartsWithOrGreater: string
	OfficialRatings: string
	ParentId: string
	ParentIndexNumber: number
	Path: string
	Person: string
	PersonIds: string
	PersonTypes: string
	Recursive: boolean
	SeriesStatus: string
	SortBy: string
	SortOrder: string
	StartIndex: number
	StudioIds: string
	Studios: string
	SubtitleCodecs: string
	Tags: string
	UserId: string
	VideoCodecs: string
	VideoTypes: string
	Years: string
}

export interface VirtualFolder {
	CollectionType: string
	ItemId: string
	LibraryOptions: LibraryOptions
	Locations: string[]
	Name: string
	PrimaryImageItemId: string
	RefreshStatus: string
}

export interface LibraryOptions {
	AutomaticRefreshIntervalDays: number
	CollapseSingleItemFolders: boolean
	ContentType: string
	DisabledLocalMetadataReaders: any[]
	DisabledSubtitleFetchers: string[]
	DownloadImagesInAdvance: boolean
	EnableArchiveMediaFiles: boolean
	EnableAudioResume: boolean
	EnableAutomaticSeriesGrouping: boolean
	EnableChapterImageExtraction: boolean
	EnableEmbeddedTitles: boolean
	EnablePhotos: boolean
	EnableRealtimeMonitor: boolean
	ExtractChapterImagesDuringLibraryScan: boolean
	ForcedSubtitlesOnly: boolean
	ImportMissingEpisodes: boolean
	LocalMetadataReaderOrder: any[]
	MaxResumePct: number
	MetadataCountryCode: string
	MetadataSavers: any[]
	MinResumeDurationSeconds: number
	MinResumePct: number
	PathInfos: {
		Path: string
	}[]
	PreferredImageLanguage: string
	PreferredMetadataLanguage: string
	RequirePerfectSubtitleMatch: boolean
	SaveLocalMetadata: boolean
	SaveLocalThumbnailSets: boolean
	SaveSubtitlesWithMedia: boolean
	SeasonZeroDisplayName: string
	SkipSubtitlesIfAudioTrackMatches: boolean
	SkipSubtitlesIfEmbeddedSubtitlesPresent: boolean
	SubtitleDownloadLanguages: any[]
	SubtitleFetcherOrder: string[]
	ThumbnailImagesIntervalSeconds: number
	TypeOptions: {
		ImageFetcherOrder: string[]
		ImageFetchers: string[]
		ImageOptions: {
			Limit: number
			MinWidth: number
			Type: string
		}[]
		MetadataFetcherOrder: string[]
		MetadataFetchers: string[]
		Type: string
	}[]
}

export interface View {
	Items: emby.Item[]
	TotalRecordCount: number
}

export interface LibraryChanged {
	CollectionFolders: string[]
	FoldersAddedTo: string[]
	FoldersRemovedFrom: string[]
	IsEmpty: boolean
	ItemsAdded: string[]
	ItemsRemoved: string[]
	ItemsUpdated: string[]
}

export interface ScheduledTasksInfo {
	Category: string
	CurrentProgressPercentage: number
	Description: string
	Id: string
	IsHidden: boolean
	Key: string
	LastExecutionResult: {
		EndTimeUtc: string
		Id: string
		Key: string
		Name: string
		StartTimeUtc: string
		Status: string
	}
	Name: string
	State: string
	Triggers: {
		IntervalTicks: number
		Type: string
	}[]
}

export interface ScheduledTaskEnded {
	EndTimeUtc: string
	Id: string
	Key: string
	Name: string
	StartTimeUtc: string
	Status: string
}

export interface RefreshProgress {
	ItemId: string
	Progress: string
}

export interface RemoteSubtitle {
	Author: string
	Comment: string
	CommunityRating: number
	DateCreated: string
	DownloadCount: number
	Format: string
	Id: string
	IsForced: boolean
	IsHashMatch: boolean
	Name: string
	ProviderName: string
	ThreeLetterISOLanguageName: string
}
