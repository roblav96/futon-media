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

	let staticSchemas = STATIC_SCHEMAS.map(schema =>
		media.MAIN_TYPESS.map((type, i) => {
			return {
				limit: schema[2],
				name: `${['Mov', 'TV'][i]} ${schema[0]}`,
				type: media.MAIN_TYPES[i],
				url: _.template(schema[1])({ type }),
			} as CollectionSchema
		})
	).flat()
	schemas.push(...staticSchemas)

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

	let listSchemas = _.uniqWith(lists, (a, b) => a.ids.trakt == b.ids.trakt).map(list => {
		return {
			name: utils.toSlug(list.name, { toName: true }),
			url: `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`,
		} as CollectionSchema
	})
	schemas.push(...listSchemas)

	return schemas.map(schema => ({
		...schema,
		name: _.trim(schema.name),
	}))
}

async function syncCollections() {
	let schemas = await buildSchemas()
	console.warn(`syncCollections ->`, schemas.length)

	// if (process.DEVELOPMENT) schemas.splice(12)
	// console.log(`schemas ->`, schemas.map(v => v.name).sort())
	// throw new Error(`DEV`)

	let slugs = [] as string[]
	for (let schema of schemas) {
		await utils.pRandom(100)
		let results = (await trakt.client
			.get(schema.url, {
				query: schema.limit ? { limit: schema.limit } : {},
			})
			.catch(error => {
				console.error(`trakt get ${schema.url} -> %O`, error)
				return []
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
			let slug = `${item.type}:${item.ids.slug}`
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
			let ids = _.mapValues(item.ids, v => (_.isFinite(v) ? v.toString() : v))
			let Item = Items.find(({ ProviderIds }) => {
				if (ids.imdb && ProviderIds.Imdb && ids.imdb == ProviderIds.Imdb) return true
				if (ids.tmdb && ProviderIds.Tmdb && ids.tmdb == ProviderIds.Tmdb) return true
				if (ids.tvdb && ProviderIds.Tvdb && ids.tvdb == ProviderIds.Tvdb) return true
			})
			Item ? Ids.push(Item.Id) : console.warn(`!Item ->`, item.main.title)
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
				console.log(`Ids difference ->`, Ids)
				await emby.client.post(`/Collections/${Collection.Id}/Items`, {
					query: { Ids: Ids.join() },
				})
			}
		}
	}

	await emby.library.refresh()
	console.warn(`syncCollections -> DONE`)
}

interface CollectionSchema {
	items: media.Item[]
	limit: number
	name: string
	type: media.MainContentType
	url: string
}
