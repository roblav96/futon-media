import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as isIp from 'is-ip'
import * as media from '@/media/media'
import * as omdb from '@/adapters/omdb'
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
	// await library.missingItems()
	// console.log(`IsMissing: true ->`, await library.Items({ IsMissing: true }))
	// console.log(`HasOverview: false ->`, await library.Items({ HasOverview: false }))
	// console.log(`BoxSets ->`, await library.Items({ IncludeItemTypes: ['BoxSet'] }))
	// let Series = await library.Items({ Fields: ['Status'], IncludeItemTypes: ['Series'] })
	// console.log(`Status ->`, _.uniq(Series.map(v => v.Status)))
})

export const library = {
	async refresh() {
		// await library.unrefresh()
		await emby.client.post('/Library/Refresh', { silent: true })
	},
	async unrefresh() {
		let Tasks = (await emby.client.get('/ScheduledTasks', {
			silent: true,
		})) as ScheduledTasksInfo[]
		let { Id, State } = Tasks.find(v => v.Key == 'RefreshLibrary')
		if (State != 'Idle') {
			await emby.client.delete(`/ScheduledTasks/Running/${Id}`, { silent: true })
			await utils.pTimeout(300)
		}
	},

	folders: {
		movies: { Location: '', ItemId: '' },
		shows: { Location: '', ItemId: '' },
	},
	getFolder(type: media.MainContentType) {
		return library.folders[`${type}s` as media.MainContentTypes].Location
	},
	async setFolders() {
		let Folders = (await emby.client.get('/Library/VirtualFolders', {
			silent: true,
		})) as VirtualFolder[]
		for (let Folder of Folders) {
			if (Folder.LibraryOptions.EnablePhotos) {
				Folder.LibraryOptions.EnablePhotos = false
				await emby.client.post('/Library/VirtualFolders/LibraryOptions', {
					body: { Id: Folder.ItemId, LibraryOptions: Folder.LibraryOptions },
				})
			}
		}
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

	// async missingItems() {
	// 	let Items = await library.Items({ IsMissing: true })
	// 	if (Items.length == 0) return
	// 	console.warn(
	// 		`MissingItems ->`,
	// 		Items.map(v => `${v.SeriesName} ${v.SeasonName} ${v.Name}`),
	// 	)
	// 	// let Ids = Items.map(v => v.Id)
	// 	// await emby.client.delete('/Items', { query: { Ids: Ids.join() } })
	// 	// await library.refresh()
	// },

	toTitle(Item: emby.Item) {
		let name = Item.Name
		if (['Movie', 'Series'].includes(Item.Type)) name += ` (${Item.ProductionYear})`
		if (Item.Type == 'Season') name = `${Item.SeriesName} ${Item.Name}`
		if (Item.Type == 'Episode') {
			let base = path.basename(Item.Path).slice(0, -5)
			name = `${Item.SeriesName} ${base.split(' ').pop()}`
		}
		return `[${Item.Type[0]}] ${name}`
	},

	async Items(
		query = {} as Partial<{
			AnyProviderIdEquals: string[]
			EnableImages: boolean
			EnableImageTypes: string[]
			ExcludeItemIds: string[]
			ExcludeItemTypes: string[]
			ExcludeLocationTypes: string[]
			Fields: string[]
			Filters: string
			HasOverview: boolean
			Ids: string[]
			ImageTypeLimit: number
			IncludeItemTypes: string[]
			IsMissing: boolean
			IsUnaired: boolean
			IsVirtualUnaired: boolean
			Limit: number
			LocationTypes: string[]
			MinDateLastSaved: string
			MinIndexNumber: number
			ParentId: string
			ParentIndexNumber: number
			Path: string
			Recursive: boolean
			SeriesStatus: string
			SortBy: string
			SortOrder: string
			StartIndex: number
		}>,
	) {
		if (!_.isBoolean(query.EnableImages)) {
			query.EnableImages = false
		}
		if (!_.isArray(query.Ids)) {
			if (!_.isBoolean(query.Recursive)) {
				query.Recursive = true
			}
			if (!_.isArray(query.IncludeItemTypes) && !_.isArray(query.AnyProviderIdEquals)) {
				query.IncludeItemTypes = ['Movie', 'Series', 'Season', 'Episode']
			}
		}
		if (!_.isArray(query.Fields) || !_.isEmpty(query.Fields)) {
			query.Fields = (query.Fields || []).concat([
				// 'DateCreated',
				// 'ImageTags',
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
		return ((
			await emby.client.get('/Items', {
				query: _.mapValues(query, v => (_.isArray(v) ? _.uniq(v).join() : v)) as any,
				// profile: process.DEVELOPMENT,
				silent: true,
			})
		).Items || []) as emby.Item[]
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
	async Item(ItemId: string) {
		return (await emby.client.get(`/Users/${process.env.EMBY_SERVER_ID}/Items/${ItemId}`, {
			silent: true,
		})) as Item
	},

	async item(Item: emby.Item, main = false) {
		let ids = Item.Path ? library.pathProviderIds(Item.Path) : (Item.ProviderIds as never)
		if (_.isEmpty(ids)) return
		ids = utils.sortKeys(_.mapKeys(ids, (v, k) => k.toLowerCase())) as any
		let type = Item.Type.toLowerCase() as media.ContentType
		if (['Series', 'Season', 'Episode'].includes(Item.Type)) type = 'show'
		for (let key in ids) {
			let results = (await trakt.client.get(`/search/${key}/${ids[key]}`, {
				query: { type },
				memoize: true,
				silent: true,
			})) as trakt.Result[]
			let result = results.find(v => trakt.toFull(v).ids[key] == ids[key])
			if (!result) continue
			let item = new media.Item(result)
			if (['Movie', 'Person'].includes(Item.Type) || main == true) return item
			let numbers = library.pathNumbers(Item.Path)
			if (!item.season && ['Season', 'Episode'].includes(Item.Type)) {
				let seasons = (await trakt.client.get(`/shows/${item.id}/seasons`, {
					memoize: true,
					silent: true,
				})) as trakt.Season[]
				item.use({ season: seasons.find(v => v.number == numbers.season) })
			}
			if (!item.episode && Item.Type == 'Episode') {
				let episode = (await trakt.client.get(
					`/shows/${item.id}/seasons/${numbers.season}/episodes/${numbers.episode}`,
					{ memoize: true, silent: true },
				)) as trakt.Episode
				item.use({ episode })
			}
			return item
		}
	},
	pathProviderIds(Path: string) {
		let matches = Array.from(Path.matchAll(/\[(?<key>\w{4})id=(?<value>(tt)?\d*)\]/g))
		return _.fromPairs(
			matches.map(match => {
				return [match.groups.key, match.groups.value]
			}),
		) as Record<string, string>
	},
	pathNumbers(Path: string) {
		let match = Path.match(/\bS(?<season>\d+)E(?<episode>\d+)\b/)
		if (!match) match = Path.match(/\bSeason (?<season>\d+)\b/)
		let groups = _.get(match, 'groups', {}) as Record<string, string>
		return { episode: _.parseInt(groups.episode), season: _.parseInt(groups.season) }
	},
	async reset(item: media.Item, ItemId: string) {
		await library.toStrmFile(item, true)
		await emby.client.post(`/Items/${ItemId}/Refresh`, {
			query: {
				ImageRefreshMode: 'Default',
				MetadataRefreshMode: 'Default',
				Recursive: 'true',
				ReplaceAllImages: 'false',
				ReplaceAllMetadata: 'false',
			},
			// silent: true,
		})
	},

	toPath(item: media.Item) {
		let folder = library.getFolder(item.type)
		let title = utils.title(item.title)
		let file = `${title} (${item.year})`
		if (item.ids.imdb) file += ` [imdbid=${item.ids.imdb}]`
		if (item.ids.tmdb) file += ` [tmdbid=${item.ids.tmdb}]`
		if (item.ids.tvdb) file += ` [tvdbid=${item.ids.tvdb}]`
		if (item.movie) {
			return `${folder}/${file}/${title} (${item.year}).strm`
		}
		if (item.episode) {
			file += `/Season ${item.episode.season}`
			file += `/${title} `
			file += `S${utils.zeroSlug(item.episode.season)}`
			file += `E${utils.zeroSlug(item.episode.number)}`
			return `${folder}/${file}.strm`
		}
		if (item.season) {
			return `${folder}/${file}/Season ${item.season.number}`
		}
		return `${folder}/${file}`
	},
	async toStrmFile(item: media.Item, force = false) {
		let Path = library.toPath(item)
		let Updated = { Path, UpdateType: 'Modified' } as emby.MediaUpdated
		if (force == false && (await fs.pathExists(Path))) return Updated
		Updated.UpdateType = 'Created'
		if (Path.endsWith('.strm')) {
			let query = qs.stringify({
				file: Path.replace(library.getFolder(item.type), ''),
				type: item.type,
			} as StrmQuery)
			await fs.outputFile(Path, `${process.env.EMBY_WAN_ADDRESS}/strm?${query}`)
		}
		return Updated
	},
	async add(item: media.Item) {
		let Updates = [] as emby.MediaUpdated[]
		if (item.movie) {
			Updates.push(await library.toStrmFile(new media.Item({ movie: item.result.movie })))
		}
		if (item.show) {
			Updates.push(await library.toStrmFile(new media.Item({ show: item.result.show })))
			let seasons = (await trakt.client.get(`/shows/${item.id}/seasons`, {
				delay: 300,
				memoize: true,
				silent: true,
			})) as trakt.Season[]
			seasons = seasons.filter(
				v => v.number > 0 && v.episode_count > 0 && v.aired_episodes > 0,
			)
			for (let season of seasons) {
				Updates.push(
					await library.toStrmFile(new media.Item({ show: item.result.show, season })),
				)
				for (let i = 1; i <= season.episode_count; i++) {
					Updates.push(
						await library.toStrmFile(
							new media.Item({
								show: item.result.show,
								season,
								episode: { number: i, season: season.number } as trakt.Episode,
							}),
						),
					)
				}
			}
		}
		return Updates
	},

	pSetTagsQueue: new pQueue({ concurrency: 1 }),
	setTagsQueue(item: media.Item, ItemId: string) {
		return library.pSetTagsQueue.add(() => library.setTags(item, ItemId))
	},
	async setTags(item: media.Item, ItemId: string) {
		let tags = utils.sortKeys({
			...(await omdb.toTags(item)),
			'⭕ Trakt Rating': _.round(item.main.rating, 1).toFixed(1),
			'⭕ Trakt Votes': item.main.votes.toLocaleString(),
		})
		await emby.client.post(`/Items/${ItemId}`, {
			body: _.merge(
				await library.Item(ItemId),
				utils.compact({
					CommunityRating: Number.parseFloat(tags['🍿 IMDb Rating']),
					CriticRating: Number.parseFloat(tags['🍎 Rotten Tomatoes']),
					Tags: _.map(tags, (v, k) => `${k.split(' ')[0]} ${v} - ${k.slice(2).trim()}`),
				} as Item),
			),
			silent: true,
		})
	},

	pAddQueue: new pQueue({ concurrency: 1 }),
	addQueue(items: media.Item[], Session?: emby.Session) {
		return library.pAddQueue.add(() => library.addAll(items, Session))
	},
	async addAll(items: media.Item[], Session?: emby.Session) {
		let t = Date.now()
		let MinDateLastSaved = new Date().toISOString()

		let Updates = (
			await pAll(
				items.map(v => () => library.add(v)),
				{ concurrency: 1 },
			)
		).flat()
		console.log(`library addAll Updates ->`, Updates.length)
		if (_.isEmpty(Updates)) return []

		let Creations = Updates.filter(v => v.UpdateType == 'Created')
		let CreatedPaths = Creations.map(v => v.Path)
		let created = items.filter(v => CreatedPaths.includes(library.toPath(v)))
		if (Session && !_.isEmpty(created)) {
			await Session.Message(
				`🍿 Adding to library 🔶 ${created.map(v => v.message).join(` 🔶 `)}`,
			)
		}

		let CreatedStrmPaths = CreatedPaths.filter(v => v.endsWith('.strm'))
		if (CreatedStrmPaths.length > 0) {
			console.info(`library addAll CreatedStrmPaths ->`, CreatedStrmPaths.length)

			let rxFFProbe = emby.rxLine.pipe(
				Rx.op.filter(({ message }) => {
					if (!message.startsWith('Running FFProbeProvider for ')) return false
					let Path = message.replace('Running FFProbeProvider for ', '')
					_.remove(CreatedStrmPaths, v => v == Path)
					return CreatedStrmPaths.length == 0
				}),
				Rx.op.take(1),
			)

			// await emby.client.post('/Library/Media/Updated', {
			// 	body: { Updates: Creations },
			// 	silent: true,
			// })

			for (let type of media.MAIN_TYPESS) {
				let folder = library.folders[type]
				if (CreatedStrmPaths.find(v => v.startsWith(folder.Location))) {
					await emby.client.post(`/Items/${folder.ItemId}/Refresh`, {
						query: {
							ImageRefreshMode: 'Default',
							MetadataRefreshMode: 'Default',
							Recursive: 'true',
							ReplaceAllImages: 'false',
							ReplaceAllMetadata: 'false',
						},
						// silent: true,
					})
				}
			}

			// await library.unrefresh()
			// await library.refresh()

			await rxFFProbe.toPromise()

			for (let i = 0; i < 5; i++) {
				if (_.isEmpty(created)) break
				await utils.pTimeout(1000)
				let Items = await library.Items({
					Fields: [],
					IncludeItemTypes: ['Movie', 'Series'],
					MinDateLastSaved,
				})
				_.remove(created, item => {
					let Item = Items.find(v => v.Path == library.toPath(item))
					if (Item) {
						library.setTagsQueue(item, Item.Id)
						return true
					}
				})
				// if (!_.isEmpty(created)) {
				// 	console.warn(
				// 		`library addAll !isEmpty ->`,
				// 		created.map(v => v.short),
				// 		created.length,
				// 	)
				// }
			}
			created.forEach(v => console.error(`library addAll created !Item -> %O`, v.short))
		}

		console.info(Date.now() - t, `library addAll '${Updates.length}' ->`, 'DONE')
		return CreatedPaths
	},
}

export interface StrmQuery {
	file: string
	type: media.MainContentType
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
	LocationType: string
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
	Status: string
	Studios: {
		Id: number
		Name: string
	}[]
	Taglines: string[]
	Tags: string[]
	TagItems: {
		Id: number
		Name: string
	}[]
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
