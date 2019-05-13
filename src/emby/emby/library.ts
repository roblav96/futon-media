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
import db from '@/adapters/db'

process.nextTick(() => {
	process.DEVELOPMENT && db.flush('UserId:*')
	let rxItems = emby.rxHttp.pipe(
		Rx.op.filter(({ query }) => _.isString(query.ItemId)),
		Rx.op.map(({ query }) => ({ ItemId: query.ItemId, UserId: query.UserId })),
		Rx.op.debounceTime(1000),
		Rx.op.distinctUntilKeyChanged('UserId')
	)
	rxItems.subscribe(async ({ ItemId, UserId }) => {
		let Item = await library.Item(ItemId)
		if (!Item || !['Movie', 'Series', 'Person'].includes(Item.Type)) return
		if (Item.Type == 'Person') {
			let persons = (await trakt.client.get(`/search/person`, {
				query: { query: Item.Name, fields: 'name', limit: 100 },
			})) as trakt.Result[]
			persons = persons.filter(v => utils.same(v.person.name, Item.Name))
			let sizes = persons.map(person => ({
				...person.person,
				size: _.values(person.person).filter(Boolean).length,
			}))
			sizes.sort((a, b) => b.size - a.size)
			let slug = sizes[0].ids.slug
			let results = await library.itemsOf(slug)
			let items = results.map(v => new media.Item(v))
			items = items.filter(v => !v.isJunk)
			console.log(`rxItems ${Item.Type} ${Item.Name} ->`, items.map(v => v.title).sort())
			for (let item of items) {
				await emby.library.add(item)
			}
		}
		if (Item.Type == 'Movie' || Item.Type == 'Series') {
			let item = await library.item(Item)
			let [key, value] = (await db.entries()).find(([key, value]) => value == UserId)
			if (key) await db.del(key)
			await db.put(`UserId:${item.traktId}`, UserId, utils.duration(1, 'day'))
			console.log(`rxItems ${Item.Type} ->`, item.title)
			await emby.library.add(item)
		}
		await emby.library.refresh()
	})
})

export const library = {
	folders: { movie: '', show: '' },
	qualities: ['2160p', '1080p'] as Quality[],

	async setFolders() {
		let Folders = (await emby.client.get('/Library/VirtualFolders')) as VirtualFolder[]
		library.folders.movie = Folders.find(v => v.CollectionType == 'movies').Locations[0]
		library.folders.show = Folders.find(v => v.CollectionType == 'tvshows').Locations[0]
	},

	async refresh(wait = false) {
		let proms = [] as Promise<any>[]
		if (wait == true) {
			let rxTask = emby.socket.filter<ScheduledTaskEnded>('ScheduledTaskEnded').pipe(
				Rx.op.filter(({ Key, Status }) => Key == 'RefreshLibrary' && Status == 'Completed'),
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
			query: { Ids: ItemId, Fields: 'Path,ProviderIds' },
			silent: true,
		})).Items as emby.Item[])[0]
	},

	async item({ Path, Type }: Item) {
		let type = Type == 'Series' ? 'show' : Type.toLowerCase()
		let matches = Path.match(/\[\w{4}id=(tt)?\d*\]/g)
		for (let match of matches) {
			let [key, value] = match.split('=')
			let results = (await trakt.client.get(
				`/search/${key.slice(1, 5)}/${value.slice(0, -1)}`
			)) as trakt.Result[]
			let result = results.find(v => !!v[type])
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

	async toFile(item: media.Item) {
		if (_.values(library.folders).filter(Boolean).length != _.size(library.folders)) {
			await library.setFolders()
		}
		let file = library.folders[item.type]
		file += `/${item.ids.slug}`
		item.ids.imdb && (file += ` [imdbid=${item.ids.imdb}]`)
		item.ids.tmdb && (file += ` [tmdbid=${item.ids.tmdb}]`)
		if (item.movie) file += `/${item.ids.slug}`
		if (item.show) file += `/s${item.S.z}e${item.E.z}`
		return `${file}.strm`
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
		let url = emby.DOMAIN
		process.DEVELOPMENT && (url += `:${emby.STRM_PORT}`)
		url += `/strm?${qs.stringify(query)}`
		await fs.outputFile(await library.toFile(item), url)
	},

	async add(item: media.Item) {
		let exists = await fs.pathExists(await library.toFile(item))
		if (item.movie) {
			await library.toStrm(item)
		}
		if (item.show) {
			await utils.pRandom(100)
			let seasons = (await trakt.client.get(`/shows/${item.traktId}/seasons`, {
				silent: true,
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
