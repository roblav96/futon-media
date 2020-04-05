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
	// if (process.DEVELOPMENT) setTimeout(() => syncCollections(), 1000)
	if (!process.DEVELOPMENT) schedule.scheduleJob(`0 6 * * *`, () => syncCollections())
})

const SCHEMAS = [
	{ name: 'Watchlist', url: '/sync/watchlist/${type}', all: true },
	{ name: 'Collection', url: '/sync/collection/${type}', all: true },
	{ name: 'Recommendations', url: '/recommendations/${type}' },
	{ name: 'Popular', url: '/${type}/popular' },
	{ name: 'Trending', url: '/${type}/trending' },
	{ name: 'Most Played Weekly', url: '/${type}/played/weekly' },
	{ name: 'Most Played Monthly', url: '/${type}/played/monthly' },
	{ name: 'Most Played Yearly', url: '/${type}/played/yearly' },
	{ name: 'Most Played All Time', url: '/${type}/played/all' },
	{ name: 'Most Watched Weekly', url: '/${type}/watched/weekly' },
	{ name: 'Most Watched Monthly', url: '/${type}/watched/monthly' },
	{ name: 'Most Watched Yearly', url: '/${type}/watched/yearly' },
	{ name: 'Most Watched All Time', url: '/${type}/watched/all' },
	{ name: 'Most Collected Weekly', url: '/${type}/collected/weekly' },
	{ name: 'Most Collected Monthly', url: '/${type}/collected/monthly' },
	{ name: 'Most Collected Yearly', url: '/${type}/collected/yearly' },
	{ name: 'Most Collected All Time', url: '/${type}/collected/all' },
] as CollectionSchema[]

async function syncCollections() {
	let authorization = await trakt.authorization()
	let t = Date.now()

	let schemas = [] as CollectionSchema[]
	for (let SCHEMA of SCHEMAS) {
		for (let type of media.MAIN_TYPES) {
			schemas.push({
				all: !!SCHEMA.all,
				limit: type == 'movie' ? 90 : 50,
				name: `${_.capitalize(type)}s ${SCHEMA.name}`,
				type: type,
				url: _.template(SCHEMA.url)({ type: `${type}s` }),
			})
		}
	}

	let lists = [] as trakt.List[]
	for (let { url, limit } of [
		{ url: '/lists/popular', limit: 90 },
		{ url: '/lists/trending', limit: 90 },
		{ url: '/users/likes/lists', limit: 999 },
	]) {
		let response = (await trakt.client.get(url, {
			headers: { authorization },
			query: { limit, extended: '' },
			memoize: process.DEVELOPMENT,
			silent: true,
		})) as trakt.ResponseList[]
		lists.push(...response.map((v) => v.list))
	}
	lists.sort((a, b) => b.likes - a.likes)
	lists = _.uniqWith(lists, (a, b) => {
		if (a.ids.trakt == b.ids.trakt) return true
		if (utils.equals(a.name, b.name)) return true
	})
	schemas.push(
		...lists.map((list) => {
			return {
				name: utils.title(list.name),
				url: `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`,
			} as CollectionSchema
		}),
	)

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
		schemas = schemas.filter((v) => utils.startsWith(v.name, 'movies most'))
		// console.log(`schemas ->`, schemas)
		// console.log(`schemas.length ->`, schemas.length)
	}

	if (!process.DEVELOPMENT) console.log(`████  syncCollections  ████ schemas ->`, schemas.length)
	else console.log(`syncCollections schemas ->`, schemas.map((v) => v.name).sort())

	// if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	for (let schema of schemas) {
		let results = [] as trakt.Result[]
		try {
			results = await trakt.client.get(schema.url, {
				headers: { authorization },
				query: schema.limit ? { limit: schema.limit } : {},
				silent: true,
			})
		} catch (error) {
			console.error(`schema '${schema.name}' ${schema.url} -> %O`, error)
		}
		results = results.map((result) =>
			!result[schema.type] && schema.type ? ({ [schema.type]: result } as any) : result,
		)
		results = trakt.uniqWith(results.filter((v) => !v.season && !v.episode && !v.person))
		let items = results.map((v) => new media.Item(v)).filter((v) => !v.junk)
		items = items.filter((v) => (schema.all ? v.isPopular(1) : v.isPopular(1000)))
		if (items.length == 0) {
			console.warn(`schema '${schema.name}' ->`, 'items.length == 0')
			continue
		}
		if (process.DEVELOPMENT) console.log(`schema '${schema.name}' ->`, items.length)

		await emby.library.addAll(items, { silent: true })
		let Items = await emby.library.Items({ Fields: [], IncludeItemTypes: ['Movie', 'Series'] })
		let Ids = items.map((item) => Items.find((v) => v.Path == emby.library.toPath(item)).Id)

		let Collections = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })
		let Collection = Collections.find((v) => v.Name == schema.name)
		if (Collection) {
			await emby.client.post(`/Collections/${Collection.Id}/Items`, {
				query: { Ids: Ids.join() },
				silent: true,
			})
		} else {
			await emby.client.post('/Collections', {
				query: { Ids: Ids.join(), Name: schema.name },
				silent: true,
			})
		}
	}

	let Collections = await emby.library.Items({
		Fields: ['DisplayOrder'],
		IncludeItemTypes: ['BoxSet'],
	})
	for (let Collection of Collections) {
		if (Collection.DisplayOrder == 'SortName') continue
		await emby.client.post(`/Items/${Collection.Id}`, {
			body: _.merge(await emby.library.Item(Collection.Id), {
				DisplayOrder: 'SortName',
			} as emby.Item),
			silent: true,
		})
	}

	await emby.library.refresh()
	console.info(Date.now() - t, `syncCollections ${schemas.length} schemas ->`, 'DONE')
}

export interface CollectionSchema {
	all: boolean
	limit: number
	name: string
	type: media.MainContentType
	url: string
}

// async function toCollections(items: media.Item[], Items: emby.Item[]) {
// 	let Collections = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })
// 	let tmcolids = _.uniq(Items.map(v => v.ProviderIds.TmdbCollection).filter(Boolean))
// 	for (let tmcolid of tmcolids) {
// 		let { name, parts } = (await tmdb.client.get(`/collection/${tmcolid}`)) as tmdb.Collection
// 		console.log(`Collection ->`, name)
// 		let cresults = await pAll(
// 			parts.map(v => () => tmdb.toTrakt(v)),
// 			{ concurrency: 1 },
// 		)
// 		let citems = cresults.map(v => new media.Item(v)).filter(v => !v.junk && v.isPopular(1000))
// 		throw new Error(`emby.library.addAll doesn't return emby.Item[]`)
// 		let Ids = (await emby.library.addAll(citems)).map(v => v.Id).join()
// 		let Collection = Collections.find(v => v.Name == name)
// 		if (Collection) {
// 			await emby.client.post(`/Collections/${Collection.Id}/Items`, { query: { Ids } })
// 		} else {
// 			await emby.client.post('/Collections', { query: { Ids, Name: name } })
// 		}
// 	}
// }
