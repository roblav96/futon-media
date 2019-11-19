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
	// await library.deleteMissingItems()
})

export const library = {
	async refresh() {
		await library.unrefresh()
		await emby.client.post('/Library/Refresh', {
			retries: [],
			silent: true,
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
			await utils.pTimeout(300)
		}
	},

	folders: {
		movies: { Location: '', ItemId: '' },
		shows: { Location: '', ItemId: '' },
	},
	async setFolders() {
		let Folders = (await emby.client.get('/Library/VirtualFolders', {
			silent: true,
		})) as VirtualFolder[]
		let movies = Folders.find(v => v.CollectionType == 'movies')
		library.folders.movies = { Location: movies.Locations[0], ItemId: movies.ItemId }
		let shows = Folders.find(v => v.CollectionType == 'tvshows')
		library.folders.shows = { Location: shows.Locations[0], ItemId: shows.ItemId }
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
		const DELAY = utils.duration(1, 'month') / utils.duration(1, 'second')
		if (Configuration.LibraryMonitorDelay != DELAY) {
			Configuration.LibraryMonitorDelay = DELAY
			await emby.client.post('/System/Configuration', {
				body: Configuration,
				query: { api_key: process.env.EMBY_ADMIN_TOKEN },
				silent: true,
			})
			console.warn(`Configuration.LibraryMonitorDelay ->`, Configuration.LibraryMonitorDelay)
		}
	},

	async deleteMissingItems() {
		let Items = await library.Items({ IsMissing: true })
		if (Items.length == 0) return
		console.warn(`MissingItems ->`, Items.map(v => `${v.SeriesName} ${v.SeasonName} ${v.Name}`))
		// let Ids = Items.map(v => v.Id)
		// await emby.client.delete('/Items', { query: { Ids: Ids.join() } })
		// await library.refresh()
	},

	async Items(
		query = {} as Partial<{
			AnyProviderIdEquals: string[]
			EnableImages: boolean
			EnableImageTypes: string[]
			ExcludeItemIds: string[]
			Fields: string[]
			Filters: string
			HasOverview: boolean
			Ids: string[]
			ImageTypeLimit: number
			IncludeItemTypes: string[]
			IsMissing: boolean
			IsVirtualUnaired: boolean
			Limit: number
			MinDateLastSaved: string
			MinIndexNumber: number
			ParentId: string
			Path: string
			Recursive: boolean
			SortBy: string
			SortOrder: string
			StartIndex: number
		}>,
	) {
		if (!_.isBoolean(query.EnableImages)) query.EnableImages = false
		if (!_.isArray(query.Ids)) {
			if (!_.isBoolean(query.Recursive)) query.Recursive = true
			if (!_.isString(query.Path) && !_.isArray(query.IncludeItemTypes)) {
				query.IncludeItemTypes = ['Movie', 'Series', 'Episode', 'Person']
			}
		}
		if (!_.isArray(query.Fields) || !_.isEmpty(query.Fields)) {
			query.Fields = (query.Fields || []).concat([
				// 'DateCreated',
				// 'MediaStreams',
				// 'Overview',
				// 'ParentId',
				// 'PremiereDate',
				'ProductionYear',
				'ProviderIds',
				// 'RunTimeTicks',
				// 'SortName',
			])
		}
		query.Fields.push('Path')
		query.Fields.sort()
		return ((await emby.client.get('/Items', {
			query: _.mapValues(query, v => (_.isArray(v) ? _.uniq(v).join() : v)) as any,
			// profile: process.DEVELOPMENT,
			silent: true,
		})).Items || []) as emby.Item[]
	},
	// async byProviderIds(ids: Partial<trakt.IDs & emby.ProviderIds>, query = {} as any) {
	// 	let AnyProviderIdEquals = Object.entries(utils.compact(ids)).map(
	// 		([k, v]) => `${k.toLowerCase()}.${v}`,
	// 	)
	// 	return (await library.Items(_.merge({ AnyProviderIdEquals }, query)))[0]
	// },

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
				let seasons = (await trakt.client.get(`/shows/${item.id}/seasons`, {
					silent: true,
				})) as trakt.Season[]
				item.use({ season: seasons.find(v => v.number == indexes.season) })
			}
			if (!item.episode && Item.Type == 'Episode') {
				let url = `/shows/${item.id}/seasons/${indexes.season}/episodes/${indexes.episode}`
				let episode = (await trakt.client.get(url, {
					silent: true,
				})) as trakt.Episode
				item.use({ episode })
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
	toTitle(Item: emby.Item) {
		let name = Item.Name
		if (Item.Type == 'Movie') name += ` (${Item.ProductionYear})`
		if (Item.Type == 'Season') name = `${Item.SeriesName} ${Item.Name}`
		if (Item.Type == 'Episode') {
			let base = path.basename(Item.Path).slice(0, -5)
			name = `${Item.SeriesName} ${base.split(' ').pop()}`
		}
		return `[${Item.Type[0]}] ${name}`
	},

	toStrmPath(query: StrmQuery, full = false) {
		let file = `/${query.slug} (${query.year})`
		let dir = library.folders[`${query.type}s` as media.MainContentTypes].Location
		if (query.imdb) file += ` [imdbid=${query.imdb}]`
		if (query.tmdb) file += ` [tmdbid=${query.tmdb}]`
		if (query.tvdb) file += ` [tvdbid=${query.tvdb}]`
		// if (query.trakt) file += ` [traktid=${query.trakt}]`
		if (query.type == 'movie') {
			file += `/${query.slug}`
		}
		if (full == false) {
			return query.type == 'movie' ? `${dir}${file}.strm` : `${dir}${file}`
		}
		if (query.type == 'show') {
			file += `/Season ${query.season}`
			file += `/${query.slug} `
			file += `S${utils.zeroSlug(query.season)}`
			file += `E${utils.zeroSlug(query.episode)}`
		}
		return `${dir}${file}.strm`
	},
	toStrmQuery(item: media.Item) {
		let query = {
			slug: item.ids.slug,
			trakt: item.ids.trakt,
			type: item.type,
			year: item.year,
		} as StrmQuery
		if (item.ids.imdb) query.imdb = item.ids.imdb
		if (item.ids.tmdb) query.tmdb = item.ids.tmdb
		if (item.ids.tvdb) query.tvdb = item.ids.tvdb
		if (item.episode) {
			query.season = item.episode.season
			query.episode = item.episode.number
		}
		return query
	},
	toStrmUrl(query: StrmQuery) {
		return `${process.env.EMBY_WAN_ADDRESS}/strm?${qs.stringify(query)}`
	},
	itemStrmPath(item: media.Item, full?: boolean) {
		return library.toStrmPath(library.toStrmQuery(item), full)
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
			let Update = await library.toStrmFile(item)
			// if (Update.UpdateType == 'Created') {
			if (true) {
				let xml = await emby.toMovieNfo(item)
				console.log('xml ->\n\n', xml)
				await fs.outputFile(Update.Path.replace('.strm', '.xml'), xml)
			}
			Updates.push(Update)
		}
		if (item.show) {
			item = new media.Item(item.result)
			await utils.pRandom(100)
			let seasons = (await trakt.client.get(`/shows/${item.id}/seasons`, {
				silent: true,
			})) as trakt.Season[]
			seasons = seasons.filter(
				v => v.number > 0 && v.episode_count > 0 && v.aired_episodes > 0,
			)
			for (let season of seasons) {
				item.use({ season })
				for (let i = 1; i <= item.season.episode_count; i++) {
					item.use({ episode: { number: i, season: season.number } as trakt.Episode })
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

		let TotalRecordCount = (await emby.client.get('/Items', {
			query: { IncludeItemTypes: 'Movie,Episode', Limit: '0', Recursive: 'true' },
			silent: true,
		})).TotalRecordCount as number

		let Updates = (await pAll(items.map(v => () => library.add(v)), { concurrency: 1 })).flat()
		console.log(`addAll Updates ->`, Updates.length)

		let Creations = Updates.filter(v => v.UpdateType == 'Created')
		if (Creations.length > 0) {
			console.info(`addAll Creations ->`, Creations.length)

			let FolderIds = Object.values(library.folders).map(v => v.ItemId)
			let CreationPaths = Creations.map(v => v.Path).sort()
			let rxRefreshProgress = emby.rxSocket.pipe(
				Rx.op.filter(({ MessageType, Data }) => {
					return MessageType == 'RefreshProgress' && FolderIds.includes(Data.ItemId)
				}),
				Rx.op.debounceTime(900),
				Rx.op.concatMap(async () => {
					let Items = await library.Items({
						Fields: [],
						IncludeItemTypes: ['Movie', 'Episode'],
						Limit: 999999,
						SortBy: 'DateCreated',
						SortOrder: 'Ascending',
						StartIndex: TotalRecordCount,
					})
					return _.difference(CreationPaths, Items.map(v => v.Path))
				}),
				Rx.op.filter(difference => {
					console.log(`CreationPaths difference ->`, difference.length)
					return difference.length == 0
				}),
				Rx.op.take(1),
			)

			await Promise.all([library.refresh(), rxRefreshProgress.toPromise()])
		}

		console.info(Date.now() - t, `addAll ${Updates.length} Updates ->`, 'DONE')
		return Updates
	},
}

export interface StrmQuery {
	episode: number
	imdb: string
	season: number
	slug: string
	tmdb: number
	trakt: number
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
