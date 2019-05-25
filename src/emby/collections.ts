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
	process.DEVELOPMENT && syncCollections()
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
					name: schema[0],
					// name: `${['M', 'T'][i]} ${schema[0]}`,
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
				name: utils.toSlug(list.name, { toName: true }),
				url: `/users/${list.user.ids.slug}/lists/${list.ids.slug}/items`,
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
	let t = Date.now()
	let schemas = await buildSchemas()

	if (process.DEVELOPMENT) {
		// console.log(`schemas ->`, schemas.map(v => v.name))
		let lists = [
			// '007',
			// '100 Greatest Sci Fi Movies',
			// 'Based on a TRUE STORY',
			// 'Best Mindfucks',
			// 'Disney',
			// 'James Bond',
			// 'Latest 4K Releases',
			// 'MARVEL Cinematic Universe',
			// 'M Most Played Monthly',
			// 'M Popular',
			// 'M Watchlist',
			// 'Pixar Collection',
			// 'Star Wars Timeline',
			// 'T Most Played Monthly',
			// 'T Popular',
			// 'T Watchlist',
			// 'Walt Disney Animated feature films',
			// 'Worlds of DC',
			'Watchlist',
		]
		schemas = schemas.filter(v => lists.includes(v.name))
		// console.log(`schemas ->`, schemas)
		// console.log(`schemas.length ->`, schemas.length)
	}
	if (!process.DEVELOPMENT) console.log(`syncCollections schemas ->`, schemas.length)
	else console.log(`syncCollections schemas ->`, schemas)

	let Roots = await emby.library.Items({ IncludeItemTypes: ['Folder'] })
	let Root = Roots.find(v => v.ParentId == '1' && v.Name == 'collections')
	let Folders = await emby.library.Items({
		IncludeItemTypes: ['BoxSet'],
		ParentId: Root.Id,
	})
	console.log(`Folders ->`, Folders)
	// let MovieCollections = Folders.find(v => v.Name == 'Movie Collections')
	let Lists = {
		movie: Folders.find(v => v.Name == 'Movie Lists'),
		show: Folders.find(v => v.Name == 'TV Show Lists'),
	} as Record<string, emby.Item>
	console.log(`Lists ->`, Lists)
	let BoxSets = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })
	console.log(`BoxSets ->`, BoxSets.map(v => v.ParentId))
	BoxSets = BoxSets.filter(v => !Folders.map(v => v.Id).includes(v.Id))
	console.log(`BoxSets ->`, BoxSets)

	let mIds = new Map<string, string>()
	for (let schema of schemas) {
		await utils.pRandom(100)
		let results = (await trakt.client
			.get(schema.url, schema.limit ? { query: { limit: schema.limit }, silent: true } : {})
			.catch(error => {
				console.error(`trakt get ${schema.url} -> %O`, error)
				return []
			})) as trakt.Result[]
		results = results.map(v => {
			if (!v[schema.type] && schema.type) v = { [schema.type]: v } as any
			return v
		})
		results = trakt.uniq(results.filter(v => v.movie || v.show))
		schema.items = results.map(v => new media.Item(v))
		_.remove(schema.items, v => (schema.all ? v.isJunk(25) : v.isJunk()))
		if (schema.items.length == 0) {
			console.warn(`schema '${schema.name}' ->`, 'schema.items.length == 0')
			continue
		}
		console.log(`schema '${schema.name}' ->`, schema.items.length)

		let Items = await emby.library
			.addAll(schema.items.filter(item => !mIds.has(emby.library.toStrmPath(item))))
			.catch(error => {
				console.error(`syncCollections addAll -> %O`, error)
				return []
			})
		Items.forEach(({ Id, Path }) => mIds.set(Path, Id))

		for (let [type, items] of Object.entries(_.groupBy(schema.items, 'type'))) {
			let Ids = items.map(item => mIds.get(emby.library.toStrmPath(item)))
			Ids = Ids.filter(Boolean)
			if (Ids.length == 0) continue
			let List = Lists[type]
			let BoxSet = BoxSets.find(
				v => v.ParentId == List.Id && utils.equals(v.Name, schema.name)
			)
			console.log(`BoxSet ->`, BoxSet)
			if (BoxSet) {
				await emby.client.post(`/Collections/${BoxSet.Id}/Items`, {
					query: { Ids: Ids.join() },
				})
			} else {
				let { Id } = (await emby.client.post('/Collections', {
					query: {
						Ids: Ids.join(),
						ParentId: List.Id,
						Name: schema.name,
						IsLocked: 'true',
					},
				})) as { Id: string }
				await emby.client.post(`/Collections/${List.Id}/Items`, { query: { Ids: Id } })
				// let Item = await emby.library.byItemId(Id)
				// Item.ParentId = List.Id
				// await emby.client.post(`/Items/${Item.Id}`, {
				// 	body: Item,
				// 	query: { api_key: emby.env.ADMIN_KEY },
				// })
			}
		}
	}

	await emby.library.refresh()
	console.log(Date.now() - t, `syncCollections ${mIds.size} Items ->`, 'DONE')
}

export interface CollectionSchema {
	all: boolean
	items: media.Item[]
	limit: number
	name: string
	type: media.MainContentType
	url: string
}
