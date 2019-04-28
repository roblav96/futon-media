import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import * as pAll from 'p-all'

process.nextTick(() => {
	let job = schedule.scheduleJob('0 0 * * *', () => syncPlaylists())
	if (process.DEVELOPMENT) {
		// job.invoke()
	}
})

const LIMIT = process.DEVELOPMENT ? 10 : 25

const STATIC_SCHEMAS = [
	[`My Watchlist`, `/sync/watchlist/<%= type %>`, { query: { limit: 999 } }],
	[`My Collection`, `/sync/collection/<%= type %>`, { query: { limit: 999 } }],
	[`Recommendations`, `/recommendations/<%= type %>`],
	[`Anticipated`, `/<%= type %>/anticipated`],
	[`Popular`, `/<%= type %>/popular`],
	[`Trending`, `/<%= type %>/trending`],
	[`Most Played Weekly`, `/<%= type %>/played/weekly`],
	[`Most Played Monthly`, `/<%= type %>/played/monthly`],
	[`Most Played Yearly`, `/<%= type %>/played/yearly`],
	[`Most Played All Time`, `/<%= type %>/played/all`],
	[`Most Watched Weekly`, `/<%= type %>/watched/weekly`],
	[`Most Watched Monthly`, `/<%= type %>/watched/monthly`],
	[`Most Watched Yearly`, `/<%= type %>/watched/yearly`],
	[`Most Watched All Time`, `/<%= type %>/watched/all`],
	[`Most Collected Weekly`, `/<%= type %>/collected/weekly`],
	[`Most Collected Monthly`, `/<%= type %>/collected/monthly`],
	[`Most Collected Yearly`, `/<%= type %>/collected/yearly`],
	[`Most Collected All Time`, `/<%= type %>/collected/all`],
] as [string, string, http.Config?][]

async function allSchemas() {
	let schemas = STATIC_SCHEMAS.map(schema =>
		media.MAIN_TYPESS.map((type, i) => {
			return {
				config: schema[2],
				name: `${['Movies', 'TV Shows'][i]}: ${schema[0]}`,
				type: media.MAIN_TYPES[i],
				url: _.template(schema[1])({ type }),
			} as PlaylistSchema
		})
	).flat()

	let lists = (await Promise.all(
		['popular', 'trending'].map(async ltype => {
			await utils.pRandom(1000)
			let lresponse = (await trakt.client.get(`/lists/${ltype}`, {
				query: { limit: LIMIT, extended: '' },
			})) as trakt.ResponseList[]
			return lresponse.map(v => v.list)
		})
	)).flat()

	let likedlists = (await trakt.client.get(`/users/likes/lists`, {
		query: { limit: 999, extended: '' },
	})) as trakt.ResponseList[]
	lists.push(...likedlists.map(v => v.list))

	lists = _.uniqWith(lists, (from, to) => from.ids.trakt == to.ids.trakt)
	lists.sort((a, b) => b.likes - a.likes)

	let lschemas = lists.map(list => {
		return {
			name: _.startCase(utils.toSlug(list.name, { toName: true })),
			url: `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`,
		} as PlaylistSchema
	})

	return schemas.concat(lschemas)
}

export async function syncPlaylists() {
	let schemas = await allSchemas()
	if (process.DEVELOPMENT) schemas.splice(2)
	let traktIds = [] as string[]
	for (let schema of schemas) {
		await utils.pRandom(1000)
		process.DEVELOPMENT && console.log(`schema ->`, schema.url)
		_.defaultsDeep(schema, {
			config: { query: { limit: LIMIT, extended: '' } } as http.Config,
		})
		let results = (await trakt.client.get(schema.url, schema.config)) as trakt.Result[]
		let items = results.map(v => {
			if (schema.type) {
				!v[schema.type] && (v = { [schema.type]: v } as any)
				!v.type && (v.type = schema.type)
			}
			return new media.Item(v)
		})
		for (let item of items) {
			if (!traktIds.includes(item.traktId)) {
				traktIds.push(item.traktId)
				await emby.library.add(item)
			}
		}
	}
	await emby.library.refresh()
	console.warn(`syncPlaylists -> DONE`)
}

export interface PlaylistSchema {
	config: http.Config
	name: string
	type: media.MainContentType
	url: string
}
