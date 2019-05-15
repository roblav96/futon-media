import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as isIp from 'is-ip'
import * as media from '@/media/media'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import db from '@/adapters/db'

process.nextTick(async () => {
	// process.DEVELOPMENT && (await db.flush('UserId:*'))

	await library.setLibraryMonitorDelay()

	let rxItem = emby.rxHttp.pipe(
		Rx.op.filter(({ query }) => _.isString(query.ItemId)),
		Rx.op.map(({ query }) => ({ ItemId: query.ItemId, UserId: query.UserId })),
		Rx.op.debounceTime(100),
		Rx.op.distinctUntilChanged((a, b) => utils.hash(a) == utils.hash(b))
	)
	rxItem.subscribe(async ({ ItemId, UserId }) => {
		let Item = await library.Item(ItemId)
		if (!Item || !['Movie', 'Series', 'Person'].includes(Item.Type)) return
		if (Item.Type == 'Person') {
			let fulls = ((await tmdb.client.get('/search/person', {
				query: { query: Item.Name },
			})) as tmdb.Paginated<tmdb.Full>).results
			fulls.sort((a, b) => b.popularity - a.popularity)
			if (fulls.length == 0) return
			let id = fulls[0].id
			let results = (await trakt.client.get(`/search/tmdb/${id}`, {
				query: { type: 'person' },
			})) as trakt.Result[]
			let result = results.find(v => trakt.toFull(v).ids.tmdb == id)
			let items = (await library.itemsOf(result.person)).map(v => new media.Item(v))
			items = items.filter(v => !v.isJunk)
			console.log(`rxItem ${Item.Type} '${Item.Name}' ->`, items.map(v => v.title).sort())
			for (let item of items) {
				await emby.library.add(item)
			}
		}
		if (Item.Type == 'Movie' || Item.Type == 'Series') {
			let item = await library.item(Item)
			console.log(`rxItem ${Item.Type} ->`, item.title)
			await emby.library.add(item)
			if (UserId) {
				let entry = (await db.entries()).find(([k, v]) => v == UserId)
				if (_.isArray(entry)) await db.del(entry[0])
				await db.put(`UserId:${item.traktId}`, UserId, utils.duration(1, 'day'))
			}
		}
		await emby.library.refresh()
	})

	// let rxRefreshingLibrary = emby.socket.filter<ScheduledTasksInfo[]>('ScheduledTasksInfo').pipe(
	// 	Rx.op.map(tasks => tasks.find(v => v.Key == 'RefreshLibrary')),
	// 	Rx.op.filter(Boolean)
	// )
	// rxRefreshingLibrary.subscribe(({ State }) => {
	// 	if (State == 'Running') library.isRefreshing = true
	// 	if (State == 'Idle') {
	// 		library.isRefreshing = false
	// 		if (library.needsRefresh) {
	// 			library.needsRefresh = false
	// 			library.refresh()
	// 		}
	// 	}
	// })
	// let rxRefreshedLibrary = emby.socket
	// 	.filter<ScheduledTaskEnded>('ScheduledTaskEnded')
	// 	.pipe(Rx.op.filter(({ Key, Status }) => Key == 'RefreshLibrary'))
	// rxRefreshedLibrary.subscribe(task => {
	// 	library.isRefreshing = false
	// 	if (library.needsRefresh) {
	// 		library.needsRefresh = false
	// 		library.refresh()
	// 	}
	// })
})

export const library = {
	qualities: ['2160p', '1080p'] as Quality[],

	folders: { movie: '', show: '' },
	async setFolders() {
		let Folders = (await emby.client.get('/Library/VirtualFolders', {
			silent: true,
		})) as VirtualFolder[]
		library.folders.movie = Folders.find(v => v.CollectionType == 'movies').Locations[0]
		library.folders.show = Folders.find(v => v.CollectionType == 'tvshows').Locations[0]
	},

	// isRefreshing: false,
	// needsRefresh: false,
	async refresh() {
		// library.needsRefresh = library.isRefreshing
		// if (library.isRefreshing) return
		// console.warn(`await emby.client.post('/Library/Refresh')`)
		await emby.client.post('/Library/Refresh')
	},

	async setLibraryMonitorDelay() {
		let Configuration = (await emby.client.get('/System/Configuration', {
			query: { api_key: emby.env.ADMIN_KEY },
			silent: true,
		})) as emby.SystemConfiguration
		if (Configuration.LibraryMonitorDelay != 1) {
			Configuration.LibraryMonitorDelay = 1
			console.warn(`Configuration.LibraryMonitorDelay ->`, Configuration.LibraryMonitorDelay)
			await emby.client.post('/System/Configuration', {
				query: { api_key: emby.env.ADMIN_KEY },
				body: Configuration,
			})
		}
	},

	async Items(query?: {
		Fields?: string[]
		Ids?: string[]
		IncludeItemTypes?: string[]
		ParentId?: string
	}) {
		query = _.defaults(query || {}, {
			Fields: [],
			IncludeItemTypes: ['Movie', 'Series' /** , 'Episode', 'Person' */],
			Recursive: 'true',
		})
		query.Fields = _.uniq(query.Fields.concat(['Path', 'ProviderIds']))
		let Items = (await emby.client.get('/Items', {
			query: _.mapValues(query, v => (_.isArray(v) ? v.join() : v)),
			silent: true,
		})).Items as emby.Item[]
		return Items.filter(v => fs.pathExistsSync(v.Path || ''))
	},

	async Item(ItemId: string) {
		return ((await emby.client.get('/Items', {
			query: { Ids: ItemId, Fields: 'Path,ProviderIds' },
			silent: true,
		})).Items as emby.Item[])[0]
	},

	async item({ Path, Type }: Item) {
		let type = Type == 'Series' ? 'show' : Type.toLowerCase()
		let ids = library.pathIds(Path)
		for (let key in ids) {
			let value = ids[key] as string
			let results = (await trakt.client.get(`/search/${key}/${value}`, {
				query: { type },
			})) as trakt.Result[]
			let result = results.find(v => trakt.toFull(v).ids[key] == value)
			if (result) return new media.Item(result)
		}
	},

	async itemsOf(person: trakt.Person) {
		if (!person) return []
		let results = [] as trakt.Result[]
		for (let type of media.MAIN_TYPESS) {
			let credits = (await trakt.client.get(`/people/${person.ids.slug}/${type}`, {
				query: { limit: 100 },
			})) as trakt.Credits
			let { cast, crew } = { cast: [], crew: [], ...credits }
			results.push(...cast.filter(v => !!v.character))
			for (let job in crew) {
				results.push(...crew[job].filter(v => !!v.job))
			}
		}
		return _.uniqWith(results, (a, b) => trakt.toFull(a).ids.slug == trakt.toFull(b).ids.slug)
	},

	pathIds(Path: string) {
		let matches = Path.match(/\[\w{4}id=(tt)?\d*\]/g)
		let pairs = matches.map(match => {
			let [key, value] = match.split('=').map(utils.minify)
			if (key.endsWith('id')) key = key.slice(0, -2)
			return [key, value]
		})
		return _.fromPairs(pairs) as Partial<{ imdb: string; tmdb: string }>
	},

	async toFile(item: media.Item) {
		if (_.values(library.folders).filter(Boolean).length != _.size(library.folders)) {
			await library.setFolders()
		}
		let dir = library.folders[item.type]
		let file = `/${item.main.title} (${item.year})`
		if (item.ids.imdb) file += ` [imdbid=${item.ids.imdb}]`
		if (item.ids.tmdb) file += ` [tmdbid=${item.ids.tmdb}]`
		if (item.movie) {
			file += `/${item.main.title} (${item.year})`
		}
		if (item.show) {
			file += `/${item.main.title} S${item.S.z}E${item.E.z}`
		}
		return `${dir}${file}.strm`
	},

	async toStrm(item: media.Item) {
		let query = {
			...item.ids,
			traktId: item.traktId,
			type: item.type,
			year: item.year,
		} as StrmQuery
		if (item.episode) {
			query = { ...query, s: item.S.n, e: item.E.n }
		}
		let host = process.DEVELOPMENT ? '127.0.0.1' : emby.env.HOST
		let url = `${emby.env.PROTO}//${host}`
		if (isIp(host)) url += `:${emby.env.STRM_PORT}`
		url += `/strm?${qs.stringify(query)}`
		await fs.outputFile(await library.toFile(item), url)
	},

	async add(item: media.Item) {
		let exists = false
		if (!item) {
			console.warn(`library add !item`)
			return exists
		}
		if (item.movie) {
			exists = await fs.pathExists(await library.toFile(item))
			await library.toStrm(item)
		}
		if (item.show) {
			exists = await fs.pathExists(path.dirname(await library.toFile(item)))
			await utils.pRandom(100)
			let seasons = (await trakt.client
				.get(`/shows/${item.traktId}/seasons`, {
					silent: true,
				})
				.catch(error => {
					console.error(`library add '${item.title}' -> %O`, error)
					return []
				})) as trakt.Season[]
			for (let season of seasons.filter(v => v.number > 0)) {
				item.use({ season })
				for (let i = 1; i <= item.S.a; i++) {
					item.use({ episode: { number: i, season: season.number } })
					await library.toStrm(item)
				}
			}
		}
		return exists
	},
}

export type Quality = '2160p' | '1080p'

export interface StrmQuery extends trakt.IDs {
	e: number
	s: number
	traktId: string
	type: media.MainContentType
	year: number
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
		TvRage: string
		Tvdb: string
		Zap2It: string
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

export interface VirtualFolder {
	CollectionType: string
	Locations: string[]
	Name: string
}

export interface View {
	Items: Item[]
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
