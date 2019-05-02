import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

process.nextTick(() => {
	// process.DEVELOPMENT && syncPlaylists()
	if (!process.DEVELOPMENT) {
		schedule.scheduleJob('0 0 * * *', () => syncPlaylists())
	}
})

const STATIC_SCHEMAS = [
	['Watchlist', '/sync/watchlist/<%= type %>', 999],
	['Collection', '/sync/collection/<%= type %>', 999],
	['Recommendations', '/recommendations/<%= type %>'],
	['Anticipated', '/<%= type %>/anticipated'],
	['Popular', '/<%= type %>/popular'],
	['Trending', '/<%= type %>/trending'],
	['Most Played Weekly', '/<%= type %>/played/weekly'],
	['Most Played Monthly', '/<%= type %>/played/monthly'],
	['Most Played Yearly', '/<%= type %>/played/yearly'],
	['Most Played All Time', '/<%= type %>/played/all'],
	['Most Watched Weekly', '/<%= type %>/watched/weekly'],
	['Most Watched Monthly', '/<%= type %>/watched/monthly'],
	['Most Watched Yearly', '/<%= type %>/watched/yearly'],
	['Most Watched All Time', '/<%= type %>/watched/all'],
	['Most Collected Weekly', '/<%= type %>/collected/weekly'],
	['Most Collected Monthly', '/<%= type %>/collected/monthly'],
	['Most Collected Yearly', '/<%= type %>/collected/yearly'],
	['Most Collected All Time', '/<%= type %>/collected/all'],
] as [string, string, number][]

async function allSchemas() {
	let schemas = [] as PlaylistSchema[]

	let staticSchemas = STATIC_SCHEMAS.map(schema =>
		media.MAIN_TYPESS.map((type, i) => {
			return {
				limit: schema[2] || 50,
				name: `${['M', 'T'][i]}: ${schema[0]}`,
				type: media.MAIN_TYPES[i],
				url: _.template(schema[1])({ type }),
			} as PlaylistSchema
		})
	).flat()
	schemas.push(...staticSchemas)

	let lists = [] as trakt.List[]
	for (let type of ['popular', 'trending']) {
		await utils.pRandom(100)
		let response = (await trakt.client.get(`/lists/${type}`, {
			query: { limit: 25, extended: '' },
		})) as trakt.ResponseList[]
		lists.push(...response.map(v => v.list))
	}

	await utils.pRandom(100)
	let liked = (await trakt.client.get('/users/likes/lists', {
		query: { limit: 999, extended: '' },
	})) as trakt.ResponseList[]
	lists.push(...liked.map(v => v.list))

	let listSchemas = _.uniqWith(lists, (a, b) => a.ids.trakt == b.ids.trakt).map(list => {
		return {
			name: utils.toSlug(list.name, { toName: true }),
			url: `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`,
		} as PlaylistSchema
	})
	schemas.push(...listSchemas)

	return schemas.map(schema => ({
		...schema,
		name: _.trim(schema.name),
	}))
}

async function syncPlaylists() {
	let schemas = await allSchemas()
	if (process.DEVELOPMENT) schemas.splice(12)
	console.log(`schemas ->`, schemas)

	let traktIds = new Set<string>()
	for (let schema of schemas) {
		console.log(`schema ->`, schema.url)

		await utils.pRandom(100)
		let results = (await trakt.client.get(schema.url, {
			query: schema.limit ? { limit: schema.limit } : {},
		})) as trakt.Result[]
		schema.items = results.map(v => {
			if (schema.type) {
				!v[schema.type] && (v = { [schema.type]: v } as any)
				!v.type && (v.type = schema.type)
			}
			return new media.Item(v)
		})
		schema.items = schema.items.filter(v => v.isEnglish && v.isReleased && v.isPopular)

		for (let item of schema.items) {
			if (!traktIds.has(item.traktId)) {
				traktIds.add(item.traktId)
				await emby.library.add(item)
			}
		}
	}

	await emby.library.refresh(true)

	let Items = await emby.library.Items()
	let Collections = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })

	for (let schema of schemas) {
		let Ids = [] as string[]
		for (let item of schema.items) {
			let Item = Items.find(({ ProviderIds }) => {
				if (item.ids.imdb && ProviderIds.Imdb) {
					return item.ids.imdb == ProviderIds.Imdb
				}
				if (item.ids.tmdb && ProviderIds.Tmdb) {
					return item.ids.tmdb.toString() == ProviderIds.Tmdb
				}
				if (item.ids.tvdb && ProviderIds.Tvdb) {
					return item.ids.tvdb.toString() == ProviderIds.Tvdb
				}
			})
			Item ? Ids.push(Item.Id) : console.warn(`!Item item ->`, item.title)
		}
		let Collection = Collections.find(v => v.Name == schema.name)
		if (!Collection) {
			await emby.client.post('/Collections', {
				query: { Ids: Ids.join(), Name: schema.name },
			})
		} else {
			let CollectionItems = await emby.library.Items({ ParentId: Collection.Id })
			Ids = _.difference(CollectionItems.map(v => v.Id), Ids)
			if (Ids.length > 0) {
				await emby.client.post(`/Collections/${Collection.Id}/Items`, {
					query: { Ids: Ids.join() },
				})
			}
		}
	}

	await emby.library.refresh(true)

	Collections = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })
	for (let Collection of Collections) {
		let file = path.join(Collection.Path, 'collection.xml')
		if (await fs.pathExists(file)) {
			let xml = (await fs.readFile(file)).toString()
			await fs.outputFile(file, xml.replace('PremiereDate', 'SortName'))
		}
	}

	await emby.library.refresh()
	console.warn(`syncPlaylists -> DONE`)
}

export interface PlaylistSchema {
	items: media.Item[]
	limit: number
	name: string
	type: media.MainContentType
	url: string
}
