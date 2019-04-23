import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { findBestMatch } from 'string-similarity'

let limit = process.DEVELOPMENT ? 10 : 25
const STATIC_SCHEMAS = [
	[`My Watchlist`, `/sync/watchlist/<%= types %>`],
	[`My Collection`, `/sync/collection/<%= types %>`],
	[`Anticipated`, `/<%= types %>/anticipated`],
	[`Popular`, `/<%= types %>/popular`],
	[`Trending`, `/<%= types %>/trending`],
	[`Most Played Weekly`, `/<%= types %>/played/weekly`, { query: { limit } }],
	[`Most Played Monthly`, `/<%= types %>/played/monthly`, { query: { limit } }],
	[`Most Played Yearly`, `/<%= types %>/played/yearly`, { query: { limit } }],
	[`Most Played All Time`, `/<%= types %>/played/all`, { query: { limit } }],
	[`Most Watched Weekly`, `/<%= types %>/watched/weekly`, { query: { limit } }],
	[`Most Watched Monthly`, `/<%= types %>/watched/monthly`, { query: { limit } }],
	[`Most Watched Yearly`, `/<%= types %>/watched/yearly`, { query: { limit } }],
	[`Most Watched All Time`, `/<%= types %>/watched/all`, { query: { limit } }],
	[`Most Collected Weekly`, `/<%= types %>/collected/weekly`, { query: { limit } }],
	[`Most Collected Monthly`, `/<%= types %>/collected/monthly`, { query: { limit } }],
	[`Most Collected Yearly`, `/<%= types %>/collected/yearly`, { query: { limit } }],
	[`Most Collected All Time`, `/<%= types %>/collected/all`, { query: { limit } }],
	[`Recommendations`, `/recommendations/<%= types %>`, { query: { limit } }],
] as [string, string, http.Config?][]

export interface PlaylistSchema {
	config: http.Config
	count: number
	created: number
	likes: number
	name: string
	types: media.MainContentTypes
	updated: number
	url: string
}

async function allSchemas() {
	let schemas = STATIC_SCHEMAS.map(schema =>
		media.MAIN_TYPESS.map(types => {
			return {
				config: schema[2],
				name: schema[0],
				types,
				url: _.template(schema[1])({ types }),
			} as PlaylistSchema
		})
	).flat()

	let lists = (await Promise.all(
		['popular', 'trending'].map(async ltype => {
			await utils.pRandom(500)
			let lresponse = (await trakt.client.get(`/lists/${ltype}`, {
				query: { extended: '' },
			})) as trakt.ResponseList[]
			return lresponse.map(v => v.list)
		})
	)).flat()

	let limit = process.DEVELOPMENT ? 10 : 999
	let likedlists = (await trakt.client.get(`/users/likes/lists`, {
		query: { limit, extended: '' },
	})) as trakt.ResponseList[]
	lists.push(...likedlists.map(v => v.list))

	lists = _.uniqWith(lists, (from, to) => from.ids.trakt == to.ids.trakt)

	let lschemas = lists.map(list => {
		let best = findBestMatch(`${list.name} ${list.description}`, ['movies', 'tv shows'])
		return {
			count: list.item_count,
			created: new Date(list.created_at).valueOf(),
			likes: list.likes,
			name: list.name,
			types: media.MAIN_TYPESS[best.bestMatchIndex],
			updated: new Date(list.updated_at).valueOf(),
			url: `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`,
		} as PlaylistSchema
	})
	lschemas.sort((a, b) => b.likes - a.likes)

	return schemas.concat(lschemas)
}

export async function syncPlaylists() {
	let schemas = await allSchemas()
	let chunks = utils.chunks(schemas, 10)
	console.log(`chunks ->`, chunks)
	return

	let lists = (await trakt.client.get(`/lists/trending`, {
		memoize: process.DEVELOPMENT,
	})) as trakt.ResponseList[]
	let list = lists.map(v => v.list).find(v => v.ids.slug == 'rotten-tomatoes-best-of-2018')
	list = list || lists[0].list
	let results = (await trakt.client.get(
		`/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`,
		{ memoize: process.DEVELOPMENT }
	)) as trakt.Result[]
	results.splice(10)
	for (let result of results) {
		let item = new media.Item(result)
		let { file, url } = emby.library.strmFile(item)
		await fs.outputFile(file, url)
	}
	await emby.library.refresh()
	console.log(`syncPlaylists -> DONE`)
}

process.nextTick(() => {
	if (process.DEVELOPMENT) {
		syncPlaylists()
	}
	if (!process.DEVELOPMENT) {
		schedule.scheduleJob(`0 0 * * *`, syncPlaylists)
	}
})
