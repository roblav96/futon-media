import * as _ from 'lodash'
import * as dayjs from 'dayjs'
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
	// process.DEVELOPMENT && syncCollections()
	if (!process.DEVELOPMENT) {
		schedule.scheduleJob('0 0 * * *', () => syncCollections())
	}
})

const STATIC_SCHEMAS = [
	['Watchlist', '/sync/watchlist/<%= type %>', 999],
	['Collection', '/sync/collection/<%= type %>', 999],
	['Recommendations', '/recommendations/<%= type %>', 100],
	// ['Anticipated', '/<%= type %>/anticipated', 100],
	['Popular', '/<%= type %>/popular', 100],
	['Trending', '/<%= type %>/trending', 100],
	['Most Played Weekly', '/<%= type %>/played/weekly', 100],
	['Most Played Monthly', '/<%= type %>/played/monthly', 100],
	['Most Played Yearly', '/<%= type %>/played/yearly', 100],
	['Most Played All Time', '/<%= type %>/played/all', 100],
	['Most Watched Weekly', '/<%= type %>/watched/weekly', 100],
	['Most Watched Monthly', '/<%= type %>/watched/monthly', 100],
	['Most Watched Yearly', '/<%= type %>/watched/yearly', 100],
	['Most Watched All Time', '/<%= type %>/watched/all', 100],
	['Most Collected Weekly', '/<%= type %>/collected/weekly', 100],
	['Most Collected Monthly', '/<%= type %>/collected/monthly', 100],
	['Most Collected Yearly', '/<%= type %>/collected/yearly', 100],
	['Most Collected All Time', '/<%= type %>/collected/all', 100],
] as [string, string, number][]

async function buildSchemas() {
	let schemas = [] as CollectionSchema[]

	schemas.push(
		...STATIC_SCHEMAS.map(schema =>
			media.MAIN_TYPESS.map((type, i) => {
				return {
					limit: schema[2],
					name: `${['M', 'TV'][i]} ${schema[0]}`,
					type: media.MAIN_TYPES[i],
					url: _.template(schema[1])({ type }),
				} as CollectionSchema
			})
		).flat()
	)

	let lists = [] as trakt.List[]
	for (let type of ['popular', 'trending']) {
		await utils.pRandom(100)
		let response = (await trakt.client.get(`/lists/${type}`, {
			query: { limit: 100, extended: '' },
		})) as trakt.ResponseList[]
		lists.push(...response.map(v => v.list))
	}

	await utils.pRandom(100)
	let liked = (await trakt.client.get('/users/likes/lists', {
		query: { limit: 999, extended: '' },
	})) as trakt.ResponseList[]
	lists.push(...liked.map(v => v.list))

	lists.sort((a, b) => b.likes - a.likes)
	lists = _.uniqWith(lists, (a, b) => {
		if (a.ids.trakt == b.ids.trakt) return true
		if (a.ids.slug == b.ids.slug) return true
		if (utils.minify(a.name) == utils.minify(b.name)) return true
	})

	schemas.push(
		...lists.map(list => {
			return {
				name: utils.toSlug(list.name, { toName: true }),
				url: `/users/${list.user.ids.slug}/lists/${list.ids.slug || list.ids.trakt}/items`,
			} as CollectionSchema
		})
	)

	schemas.forEach(schema => {
		schema.name = _.trim(schema.name)
		if (schema.name.startsWith('The ')) schema.name = schema.name.slice(4)
	})

	return schemas
}

async function syncCollections() {
	let schemas = await buildSchemas()
	console.log(`syncCollections ->`, schemas.length)

	// if (process.DEVELOPMENT) {
	// 	// console.log(`schemas ->`, schemas.map(v => v.name))
	// 	let lists = [
	// 		'007',
	// 		'MARVEL Cinematic Universe',
	// 		'Pixar Collection',
	// 		'TV Watchlist',
	// 		'Worlds of DC',
	// 	]
	// 	schemas = schemas.filter(v => lists.includes(v.name))
	// 	// console.log(`schemas ->`, schemas)
	// 	console.log(`schemas.length ->`, schemas.length)
	// }

	let slugs = [] as string[]
	for (let schema of schemas) {
		await utils.pRandom(100)
		let results = (await trakt.client
			.get(schema.url, schema.limit ? { query: { limit: schema.limit } } : {})
			.catch(error => {
				console.error(`trakt get ${schema.url} -> %O`, error)
				return []
			})) as trakt.Result[]
		schema.items = results.map(v => {
			!v[schema.type] && schema.type && (v = { [schema.type]: v } as any)
			return new media.Item(v)
		})
		schema.items = schema.items.filter(v => !v.isJunk)

		for (let item of schema.items) {
			let slug = `${item.type}:${item.traktId}`
			if (!slugs.includes(slug)) {
				slugs.push(slug)
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
			let Item = Items.find(({ Path }) => {
				if (Path.includes(`[imdbid=${item.ids.imdb}]`)) return true
				if (Path.includes(`[tmdbid=${item.ids.tmdb}]`)) return true
			})
			Item ? Ids.push(Item.Id) : console.warn(`!Item '${schema.name}' ->`, item.main.title)
		}
		if (Ids.length == 0) {
			console.warn(`Ids.length == 0 '${schema.name}' length ->`, schema.items.length)
			continue
		}
		let Collection = Collections.find(v => v.Name == schema.name)
		if (!Collection) {
			await emby.client.post('/Collections', {
				query: { Ids: Ids.join(), Name: schema.name },
			})
			continue
		}
		await emby.client.post(`/Collections/${Collection.Id}/Items`, {
			query: { Ids: Ids.join() },
		})
	}
	await emby.library.refresh()

	console.log(`syncCollections`, schemas.length, slugs.length, `-> DONE`)
}

interface CollectionSchema {
	items: media.Item[]
	limit: number
	name: string
	type: media.MainContentType
	url: string
}
