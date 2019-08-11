import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as isIp from 'is-ip'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as Rx from '@/shims/rxjs'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import db from '@/adapters/db'
import pQueue from 'p-queue'

process.nextTick(async () => {
	// process.DEVELOPMENT && (await db.flush('UserId:*'))

	// let ansi = await import('ansi-colors')
	// let names = (await library.Items({ IncludeItemTypes: ['Movie', 'Series'] })).map(v => v.Name)
	// names = _.uniq(names).sort(utils.alphabetically)
	// names = names.filter(v => v.split(' ').length == 1)
	// // names = names.filter(v => !utils.isAscii(v))
	// names.forEach(v =>
	// 	console.log(
	// 		ansi.bold(v),
	// 		// `\n${v.replace(/[^a-z0-9\s]{2,}/gi,'')}`,
	// 		`\n${utils.toSlug(v)}`,
	// 		`\n${utils.toSlug(v, { squash: true })}`,
	// 		`\n${utils.simplify(v)}`,
	// 		`\n${utils.stops(v)}`
	// 	)
	// )

	await library.setFolders()
	// await library.setCollections()
	await library.setLibraryMonitorDelay()

	let rxItem = emby.rxHttp.pipe(
		Rx.op.filter(({ parts }) => !parts.includes('favoriteitems')),
		Rx.op.filter(({ query }) => [query.ItemId, query.UserId].filter(Boolean).length == 2),
		Rx.op.map(({ query }) => ({ ItemId: query.ItemId, UserId: query.UserId })),
		Rx.op.debounceTime(100),
		Rx.op.switchMap(async ({ ItemId, UserId }) => {
			let Item = await library.byItemId(ItemId)
			if (Item && Item.SeriesId) ItemId = Item.SeriesId
			return { ItemId, UserId, Item }
		}),
		Rx.op.filter(({ Item }) => !!Item)
	)

	let rxLibrary = rxItem.pipe(
		Rx.op.filter(({ Item }) => {
			return ['Movie', 'Series', 'Season', 'Episode', 'Person'].includes(Item.Type)
		}),
		Rx.op.distinctUntilChanged((a, b) => {
			let keys = ['ItemId', 'UserId']
			return utils.hash(_.pick(a, keys)) == utils.hash(_.pick(b, keys))
		})
	)
	rxLibrary.subscribe(async ({ Item, ItemId, UserId }) => {
		let who = await emby.sessions.byWho(UserId)
		if (Item.Type == 'Person') {
			if (!Item.ProviderIds.Imdb) {
				if (!Item.ProviderIds.Tmdb) {
					if (!Item.Name) return console.warn(`${who}rxItem !Item.Name ->`, Item)
					let results = ((await tmdb.client.get('/search/person', {
						query: { query: Item.Name },
					})) as tmdb.Paginated<tmdb.Person>).results
					results.sort((a, b) => b.popularity - a.popularity)
					if (!results[0]) return console.warn(`${who}rxItem !Item.Tmdb ->`, Item)
					Item.ProviderIds.Tmdb = results[0].id.toString()
				}
				let externals = (await tmdb.client.get(
					`/person/${Item.ProviderIds.Tmdb}/external_ids`
				)) as tmdb.ExternalIds
				Item.ProviderIds.Imdb = externals.imdb_id
			}
			let person = (await trakt.client.get(
				`/people/${Item.ProviderIds.Imdb}`
			)) as trakt.Person
			let items = (await trakt.resultsFor(person)).map(v => new media.Item(v))
			items = items.filter(v => !v.isJunk())
			items.sort((a, b) => b.main.votes - a.main.votes)
			console.info(`${who}rxItem ${Item.Type} '${Item.Name}' ->`, items.map(v => v.short))
			library.addQueue(items)
		}
		if (['Movie', 'Series', 'Season', 'Episode'].includes(Item.Type)) {
			let item = await library.item(Item.Path, Item.Type)
			console.info(`${who}rxItem ${Item.Type} ->`, item.short)
			library.addQueue([item])
			if (UserId) {
				let entry = (await db.entries()).find(([k, v]) => v == UserId)
				if (_.isArray(entry)) await db.del(entry[0])
				await db.put(`UserId:${item.ids.trakt}`, UserId, utils.duration(1, 'day'))
			}
		}
	})

	let rxSubtitles = rxItem.pipe(
		Rx.op.filter(({ Item }) => {
			return ['Movie', 'Episode'].includes(Item.Type)
		}),
		Rx.op.distinctUntilChanged((a, b) => a.Item.Id == b.Item.Id)
	)
	rxSubtitles.subscribe(async ({ Item }) => {
		let subs = (await emby.client.get(`/Items/${Item.Id}/RemoteSearch/Subtitles/eng`, {
			query: { IsPerfectMatch: 'false', IsForced: 'true' },
			silent: true,
		})) as RemoteSubtitle[]
		if (subs && subs[0]) {
			await emby.client.post(`/Items/${Item.Id}/RemoteSearch/Subtitles/${subs[0].Id}`)
		}
	})

	// let rxRefresh = rxItem.pipe(
	// 	Rx.op.filter(({ Item }) => {
	// 		return ['Series', 'Season', 'Episode'].includes(Item.Type)
	// 	}),
	// 	Rx.op.distinctUntilChanged((a, b) => a.ItemId == b.ItemId)
	// )
	// rxRefresh.subscribe(async ({ Item, ItemId, UserId }) => {
	// 	await emby.client.post(`/Items/${ItemId}/Refresh`, {
	// 		query: {
	// 			ImageRefreshMode: 'FullRefresh',
	// 			MetadataRefreshMode: 'FullRefresh',
	// 			Recursive: 'true',
	// 			ReplaceAllImages: 'false',
	// 			ReplaceAllMetadata: 'false',
	// 		},
	// 		silent: true,
	// 	})
	// })
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

	folders: { movies: '', shows: '' },
	async setFolders() {
		let Folders = (await emby.client.get('/Library/VirtualFolders', {
			silent: true,
		})) as VirtualFolder[]
		library.folders.movies = Folders.find(v => v.CollectionType == 'movies').Locations[0]
		library.folders.shows = Folders.find(v => v.CollectionType == 'tvshows').Locations[0]
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
		if (Configuration.LibraryMonitorDelay != 3600) {
			Configuration.LibraryMonitorDelay = 3600
			console.info(`Configuration.LibraryMonitorDelay ->`, Configuration.LibraryMonitorDelay)
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
		}>
	) {
		if (!query.Ids && !query.Recursive) query.Recursive = true
		if (!query.Ids && !query.Path && !query.IncludeItemTypes) {
			query.IncludeItemTypes = ['Movie', 'Series', 'Person']
		}
		query.Fields = (query.Fields || []).concat(['ParentId', 'Path', 'ProviderIds'])
		return ((await emby.client.get('/Items', {
			query: _.mapValues(query, v => (_.isArray(v) ? _.uniq(v).join() : v)) as any,
			silent: true,
		})).Items || []) as emby.Item[]
	},
	async byItemId(ItemId: string) {
		return (await library.Items({ Ids: [ItemId] }))[0]
	},
	async byPath(Path: string) {
		return (await library.Items({ Path }))[0]
	},
	async byProviderIds(ids: Partial<trakt.IDs & emby.ProviderIds>) {
		let AnyProviderIdEquals = Object.entries(ids).map(([k, v]) => `${k.toLowerCase()}.${v}`)
		return (await library.Items({ AnyProviderIdEquals }))[0]
	},

	async item(Path: string, Type: string) {
		let type = ['Series', 'Season', 'Episode'].includes(Type) ? 'show' : Type.toLowerCase()
		let ids = utils.sortKeys(library.pathIds(Path))
		for (let key in ids) {
			let results = (await trakt.client.get(`/search/${key}/${ids[key]}`, {
				query: { type },
				silent: true,
			})) as trakt.Result[]
			let result = results.find(v => trakt.toFull(v).ids[key] == ids[key])
			if (result) return new media.Item(result)
		}
	},

	async refreshItem(ItemId: string) {
		let Item = await library.byItemId(ItemId)
	},

	pathIds(Path: string) {
		let matches = Path.match(/\[\w{4}id=(tt)?\d*\]/g)
		let pairs = matches.map(match => {
			let [key, value] = match.split('=').map(utils.minify)
			if (key.endsWith('id')) key = key.slice(0, -2)
			return [key, value]
		})
		return _.fromPairs(pairs) as trakt.IDs
	},

	toStrmPath(item: media.Item, full = false) {
		let title = utils.toSlug(item.title, { title: true })
		let dir = library.folders[`${item.type}s`]
		let file = `/${title} (${item.year})`

		if (item.ids.imdb) file += ` [imdbid=${item.ids.imdb}]`
		if (item.ids.tmdb) file += ` [tmdbid=${item.ids.tmdb}]`
		if (item.ids.tvdb) file += ` [tvdbid=${item.ids.tvdb}]`

		if (item.movie) {
			file += `/${title} (${item.year})`
		}
		if (full == false) {
			let Path = `${dir}${file}`
			return item.movie ? `${Path}.strm` : Path
		}
		if (item.show) {
			file += `/Season ${item.S.n}`
			file += `/${title} S${item.S.z}E${item.E.z}`
		}
		return `${dir}${file}.strm`
	},

	toStrmQuery(item: media.Item) {
		let query = {
			...item.ids,
			type: item.type,
			year: item.year,
		} as StrmQuery
		if (item.S.n) query.s = item.S.n
		if (item.E.n) query.e = item.E.n
		return query
	},

	toStrmUrl(item: media.Item) {
		let query = library.toStrmQuery(item)
		return `${process.env.EMBY_WAN_ADDRESS}/strm?${qs.stringify(query)}`
	},

	async toStrmFile(item: media.Item) {
		let Path = library.toStrmPath(item, true)
		let Updated = { Path, UpdateType: 'Modified' } as emby.MediaUpdated
		if (await fs.pathExists(Path)) return Updated
		Updated.UpdateType = 'Created'
		await fs.outputFile(Path, library.toStrmUrl(item))
		return Updated
	},

	async add(item: media.Item) {
		let Updates = [] as emby.MediaUpdated[]
		if (item.movie) {
			Updates.push(await library.toStrmFile(item))
		}
		if (item.show) {
			await utils.pRandom(100)
			let seasons = (await trakt.client
				.get(`/shows/${item.ids.trakt}/seasons`, { silent: true })
				.catch(error => {
					console.error(`library add '${item.short}' -> %O`, error)
					return []
				})) as trakt.Season[]
			seasons = seasons.filter(v => v.number > 0 && v.aired_episodes > 0)
			for (let season of seasons) {
				item.use({ season })
				for (let i = 1; i <= item.S.e; i++) {
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

		let Updates = (await pAll(items.map(v => () => library.add(v)), { concurrency: 1 })).flat()
		Updates.sort((a, b) => utils.alphabetically(a.UpdateType, b.UpdateType))
		console.log(`addAll Updates ->`, Updates.length)

		let Creations = Updates.filter(v => v.UpdateType == 'Created')
		if (Creations.length > 0) {
			console.log(`addAll Creations ->`, Creations.length)
			await library.unrefresh()
			await emby.client.post('/Library/Media/Updated', {
				body: { Updates: Creations },
				retries: [],
				silent: true,
				timeout: utils.duration(1, 'minute'),
			})
			await library.refresh()
		}

		let t = Date.now()
		let pItems = items.map(item => () => library.byPath(library.toStrmPath(item)))
		let Items = [] as emby.Item[]
		while (pItems.length > 0) {
			if (Date.now() > t + utils.duration(1, 'minute')) {
				throw new Error(`addAll duration > 1 minute`)
			}
			// console.log(`addAll while pItems ->`, pItems.length)
			for (let i = pItems.length; i--; ) {
				if (i < pItems.length - 1) await utils.pRandom(300)
				let pItem = pItems[i]
				let Item = await pItem()
				if (!Item) continue
				Items.push(Item)
				pItems.splice(i, 1)
			}
			if (pItems.length > 0) await utils.pRandom(1000)
		}

		// if (Creations.length > 0) await library.unrefresh()
		for (let Item of Items) {
			let Creation = Creations.find(v => v.Path.startsWith(Item.Path))
			if (!Creation) continue
			console.log(`Creation Item ->`, Item.Name)
			await emby.client.post(`/Items/${Item.Id}/Refresh`, {
				query: {
					ImageRefreshMode: 'Default',
					MetadataRefreshMode: 'Default',
					Recursive: 'true',
					ReplaceAllImages: 'false',
					ReplaceAllMetadata: 'false',
				},
				silent: true,
			})
			// await utils.pRandom(1000)
			while (true) {
				await utils.pRandom(300)
				let Created = await library.byItemId(Item.Id)
				if (Created.Name != Item.Name) {
					console.log(`Creation Created ->`, Created.Name)
					break
				}
			}
		}

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

export type Quality = 'SD' | 'HD' | 'UHD'

export interface StrmQuery extends trakt.IDs {
	e: number
	s: number
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
	TvRage: string
	Tvdb: string
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
	ProviderIds: ProviderIds
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
