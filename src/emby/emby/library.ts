import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'

process.nextTick(() => {
	let rxItems = emby.rxHttp.pipe(
		Rx.op.filter(({ query }) => _.isString(query.ItemId)),
		Rx.op.map(({ query }) => query.ItemId),
		Rx.op.groupBy(ItemId => ItemId)
	)
	rxItems.subscribe(subs => {
		subs.pipe(Rx.op.debounceTime(100)).subscribe(async ItemId => {
			let Item = await library.Item(ItemId)
			if (!Item) return
			if (Item.Type == 'Person') {
				let persons = (await trakt.client.get(`/search/person`, {
					query: { query: Item.Name, fields: 'name', limit: 100 },
				})) as trakt.Result[]
				let levens = persons.map(person => ({
					...person.person,
					leven: utils.leven(Item.Name, person.person.ids.slug),
				}))
				levens.sort((a, b) => a.leven - b.leven)
				let slug = levens[0].ids.slug
				let results = await library.itemsOf(slug)
				let items = results.map(v => new media.Item(v))
				items = items.filter(v => !v.isJunk())
				items.sort((a, b) => b.main.votes - a.main.votes)
				console.log(`rxItems '${Item.Name}' ->`, items.map(v => v.title).sort())
				for (let item of items) {
					await emby.library.add(item)
				}
			} else if (['Movie', 'Series'].includes(Item.Type)) {
				let item = await library.item(ItemId)
				console.log(`rxItems ->`, item.title)
				await emby.library.add(item)
			}
			await emby.library.refresh()
		})
	})
})

export const library = {
	qualities: ['2160p', '1080p'] as Quality[],

	async refresh(wait = false) {
		let proms = [] as Promise<any>[]
		if (wait == true) {
			let rxTask = emby.socket.filter<ScheduledTasksInfo[]>('ScheduledTasksInfo').pipe(
				Rx.op.filter(Tasks => Tasks.find(v => v.Key == 'RefreshLibrary').State == 'Idle'),
				Rx.op.take(1)
			)
			proms.push(rxTask.toPromise())
		}
		proms.push(emby.client.post('/Library/Refresh'))
		await Promise.all(proms)
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
			query: { Ids: ItemId, Fields: 'ProviderIds' },
			silent: true,
		})).Items as emby.Item[])[0]
	},

	async item(ItemId: string) {
		let Item = await library.Item(ItemId)
		if (!Item) return
		let pairs = _.toPairs(Item.ProviderIds).map(pair => pair.map(v => v.toLowerCase()))
		pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))[0]
		for (let [provider, id] of pairs) {
			let results = (await trakt.client.get(`/search/${provider}/${id}`)) as trakt.Result[]
			let result = results.length == 1 && results[0]
			!result && (result = results.find(v => v[v.type].ids[provider].toString() == id))
			if (result) return new media.Item(result)
		}
	},

	async itemsOf(slug: string) {
		let movies = (await trakt.client.get(`/people/${slug}/movies`, {
			query: { limit: 100 },
		})).cast as trakt.Result[]
		let shows = (await trakt.client.get(`/people/${slug}/shows`, {
			query: { limit: 100 },
		})).cast as trakt.Result[]
		return movies.concat(shows).filter(v => !!v.character)
	},

	async toStrm(item: media.Item) {
		let file = path.normalize(process.env.EMBY_LIBRARY_PATH || process.cwd())
		file += `/${item.type}s`

		file += `/${item.ids.slug}`
		item.ids.imdb && (file += ` [imdbid=${item.ids.imdb}]`)
		item.ids.tmdb && (file += ` [tmdbid=${item.ids.tmdb}]`)
		if (item.movie) {
			file += `/${item.ids.slug}`
		}
		if (item.show) {
			file += `/Season ${item.S.n}`
			file += `/S${item.S.z}E${item.E.z}`
		}

		// let title = item.main.title
		// if (item.movie) {
		// 	file += `/${title} (${item.year})/${title} (${item.year})`
		// }
		// if (item.show) {
		// 	file += `/${title} (${item.year})`
		// 	file += `/Season ${item.S.n}`
		// 	file += `/${title} - S${item.S.z}E${item.E.z}`
		// }

		// if (item.movie) file += `/${item.ids.slug}/${item.ids.slug}`
		// if (item.show) file += `/${item.ids.slug}/s${item.S.z}e${item.E.z}`

		let query = {
			...item.ids,
			traktId: item.traktId,
			type: item.type,
			year: item.year,
		} as StrmQuery
		if (item.episode) {
			query = { ...query, s: item.S.n, e: item.E.n }
		}

		let url = `http://localhost:${emby.STRM_PORT}`
		url += `/strm?${qs.stringify(query)}`
		console.log(`file ->`, file)
		await fs.outputFile(`${file}.strm`, url)
	},

	async add(item: media.Item) {
		// if (!item.year) return console.warn(`library add !year ->`, item.main.title)
		if (item.movie) {
			await library.toStrm(item)
		}
		if (item.show) {
			await utils.pRandom(100)
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

export interface View {
	Items: Item[]
	TotalRecordCount: number
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

export interface ScheduledTasksInfo {
	Category: string
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
