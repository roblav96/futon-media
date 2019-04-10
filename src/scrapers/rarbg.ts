import * as _ from 'lodash'
import * as utils from '../utils'
import * as media from '../adapters/media'
import * as torrent from './torrent'
import * as http from '../adapters/http'
import * as scraper from './scraper'
import { oc } from 'ts-optchain'

const CONFIG = {
	limit: 100,
	throttle: 300,
}

export const client = new http.Http({
	baseUrl: 'https://torrentapi.org',
	query: {
		app_id: `${process.platform}_${process.arch}_${process.version}`,
	} as Partial<Query>,
	beforeRequest: {
		append: [
			async options => {
				if (options.query['get_token']) {
					return
				}
				if (!options.query['token']) {
					let token = await syncToken()
					options.query['token'] = token
				}
				_.defaults(options.query, {
					mode: 'search',
					format: 'json_extended',
					limit: CONFIG.limit,
					ranked: 0,
				})
			},
		],
	},
	afterResponse: {
		append: [
			async (options, resolved) => {
				await utils.pTimeout(CONFIG.throttle)
			},
		],
	},
})

async function syncToken() {
	let { token } = await client.get('/pubapi_v2.php', {
		query: { get_token: 'get_token' },
	})
	client.config.query['token'] = token
	return token
}

export class Rarbg extends scraper.Scraper {
	sorts = ['last', 'seeders']
	async getResults(slug: string, sort: string) {
		let query = { sort, search_string: slug } as Query
		let response = (await client.get('/pubapi_v2.php', {
			query: query as any,
			verbose: true,
		})) as Response
		let results = oc(response).torrent_results([])
		return results.map(v => {
			return {
				bytes: v.size,
				date: new Date(v.pubdate).valueOf(),
				magnet: v.download,
				name: v.title,
				seeders: v.seeders,
			} as scraper.Result
		})
	}
}

export interface Query {
	format: string
	get_token: string
	limit: number
	mode: string
	ranked: number
	search_imdb: string
	search_string: string
	search_themoviedb: number
	search_tvdb: number
	sort: string
	token: string
}

export interface Response {
	error: string
	error_code: number
	torrent_results: Result[]
}

export interface Result {
	category: string
	download: string
	info_page: string
	leechers: number
	pubdate: string
	ranked: number
	seeders: number
	size: number
	title: string
	episode_info: {
		airdate: string
		epnum: string
		imdb: string
		seasonnum: string
		themoviedb: string
		title: string
		tvdb: string
		tvrage: string
	}
}
