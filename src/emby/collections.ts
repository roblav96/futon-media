import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

process.nextTick(() => {
	// process.DEVELOPMENT && syncCollections()
	if (!process.DEVELOPMENT) {
		schedule.scheduleJob(`0 6 * * *`, () => syncCollections())
	}
})

const STATIC_SCHEMAS = [
	['Watchlist', '/sync/watchlist/<%= type %>', true],
	['Collection', '/sync/collection/<%= type %>', true],
	['Recommendations', '/recommendations/<%= type %>'],
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
] as [string, string, boolean][]

async function buildSchemas() {
	let schemas = [] as CollectionSchema[]

	schemas.push(
		...STATIC_SCHEMAS.map(schema =>
			media.MAIN_TYPESS.map((type, i) => {
				return {
					all: schema[2],
					limit: schema[2] ? 999 : i == 0 ? 100 : 50,
					name: `${['Movies', 'TV Shows'][i]} ${schema[0]}`,
					type: media.MAIN_TYPES[i],
					url: _.template(schema[1])({ type }),
				} as CollectionSchema
			}),
		).flat(),
	)

	let lists = [] as trakt.List[]
	for (let type of ['popular', 'trending']) {
		await utils.pRandom(100)
		let response = (await trakt.client.get(`/lists/${type}`, {
			query: { limit: 100, extended: '' },
			silent: true,
		})) as trakt.ResponseList[]
		lists.push(...response.map(v => v.list))
	}

	await utils.pRandom(100)
	let liked = (await trakt.client.get('/users/likes/lists', {
		query: { limit: 999, extended: '' },
		silent: true,
	})) as trakt.ResponseList[]
	lists.push(...liked.map(v => v.list))

	lists.sort((a, b) => b.likes - a.likes)
	lists = _.uniqWith(lists, (a, b) => {
		if (a.ids.slug == b.ids.slug) return true
		if (utils.equals(a.name, b.name)) return true
	})

	schemas.push(
		...lists.map(list => {
			return {
				name: utils.toSlug(list.name, { title: true }),
				url: `/users/${list.user.ids.slug}/lists/${list.ids.slug}/items`,
			} as CollectionSchema
		}),
	)

	schemas.forEach(schema => {
		schema.name = _.capitalize(utils.trim(schema.name))
		if (schema.name.startsWith('The ')) schema.name = schema.name.slice(4)
		schema.name = _.capitalize(utils.trim(schema.name))
	})

	return schemas
}

async function syncCollections() {
	let t = Date.now()
	let schemas = await buildSchemas()

	if (process.DEVELOPMENT) {
		// console.log(`schemas ->`, schemas.map(v => v.name))
		// let lists = [
		// 	// '007',
		// 	// '100 Greatest Sci Fi Movies',
		// 	// 'Based on a TRUE STORY',
		// 	// 'Best Mindfucks',
		// 	// 'Disney',
		// 	// 'James Bond',
		// 	// 'Latest 4K Releases',
		// 	// 'MARVEL Cinematic Universe',
		// 	// 'M Most Played Monthly',
		// 	// 'M Popular',
		// 	'Movies watchlist',
		// 	// 'Pixar Collection',
		// 	// 'Star Wars Timeline',
		// 	// 'T Most Played Monthly',
		// 	// 'T Popular',
		// 	'Tv shows watchlist',
		// 	// 'Walt Disney Animated feature films',
		// 	// 'Worlds of DC',
		// ]
		// schemas = schemas.filter(v => lists.includes(v.name))
		schemas = schemas.filter(v => v.name.endsWith('watchlist'))
		// console.log(`schemas ->`, schemas)
		// console.log(`schemas.length ->`, schemas.length)
	}

	if (!process.DEVELOPMENT) console.log(`syncCollections schemas ->`, schemas.length)
	else console.log(`syncCollections schemas ->`, _.sortBy(schemas, 'name').map(v => v.name))

	// if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	let Collections = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })

	let mIds = new Map<string, string>()
	for (let schema of schemas) {
		await utils.pRandom(100)
		let results = (await trakt.client
			.get(schema.url, { query: schema.limit ? { limit: schema.limit } : {}, silent: true })
			.catch(error => {
				console.error(`trakt get ${schema.url} -> %O`, error)
				return []
			})) as trakt.Result[]
		results = results.map(v => {
			if (!v[schema.type] && schema.type) v = { [schema.type]: v } as any
			return v
		})
		results = trakt.uniqWith(results.filter(v => !v.season && !v.episode && !v.person))
		schema.items = results.map(v => new media.Item(v))
		schema.items = schema.items.filter(v => (schema.all ? !v.isJunk(1) : !v.isJunk(1000)))
		if (schema.items.length == 0) {
			console.warn(`schema '${schema.name}' ->`, 'schema.items.length == 0')
			continue
		}
		process.DEVELOPMENT && console.log(`schema '${schema.name}' ->`, schema.items.length)

		let Items = await emby.library
			.addAll(schema.items.filter(item => !mIds.has(emby.library.itemStrmPath(item))))
			.catch(error => {
				console.error(`syncCollections addAll -> %O`, error)
				return []
			})
		Items.forEach(({ Id, Path }) => mIds.set(Path, Id))

		let Ids = schema.items
			.map(item => mIds.get(emby.library.itemStrmPath(item)))
			.filter(Boolean)
		let Collection = Collections.find(v => v.Name == schema.name)
		if (Collection) {
			await emby.client.post(`/Collections/${Collection.Id}/Items`, {
				query: { Ids: Ids.join() },
				silent: !process.DEVELOPMENT,
			})
		} else {
			await emby.client.post('/Collections', {
				query: { Ids: Ids.join(), Name: schema.name },
				silent: !process.DEVELOPMENT,
			})
		}
	}

	// await emby.library.refresh()
	console.info(Date.now() - t, `syncCollections ${mIds.size} Items ->`, 'DONE')
}

async function toCollections(items: media.Item[], Items: emby.Item[]) {
	let Collections = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })
	let tmcolids = _.uniq(Items.map(v => v.ProviderIds.TmdbCollection).filter(Boolean))
	for (let tmcolid of tmcolids) {
		let { name, parts } = (await tmdb.client.get(`/collection/${tmcolid}`)) as tmdb.Collection
		console.log(`Collection ->`, name)
		let cresults = await pAll(parts.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })
		let citems = cresults.map(v => new media.Item(v)).filter(v => !v.isJunk(1000))
		let Ids = (await emby.library.addAll(citems)).map(v => v.Id).join()
		let Collection = Collections.find(v => v.Name == name)
		if (Collection) {
			await emby.client.post(`/Collections/${Collection.Id}/Items`, { query: { Ids } })
		} else {
			await emby.client.post('/Collections', { query: { Ids, Name: name } })
		}
	}
}

export interface CollectionSchema {
	all: boolean
	items: media.Item[]
	limit: number
	name: string
	type: media.MainContentType
	url: string
}
