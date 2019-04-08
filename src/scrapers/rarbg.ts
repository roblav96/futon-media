import * as _ from 'lodash'
import * as utils from '../utils'
import * as media from '../adapters/media'
import * as scraper from '../adapters/scraper'
import { Http } from '../adapters/http'

export const client = new Http({
	baseUrl: 'https://torrentapi.org',
	query: {
		app_id: `${process.platform}_${process.arch}_${process.version}`,
	},
	beforeRequest: {
		append: [
			async options => {
				if (options.query['get_token']) {
					return
				}
				if (!client.config.query['token']) {
					let token = await syncToken()
					options.query['token'] = token
				}
				_.defaults(options.query, {
					mode: 'search',
					format: 'json_extended',
					limit: 100,
					ranked: 0,
				})
			},
		],
	},
	afterResponse: {
		append: [
			async (options, resolved) => {
				if (_.inRange(resolved.body.error_code, 1, 5)) {
					let token = await syncToken()
					// return retry({ query: { token } } as GotJSONOptions)
				}
				if (resolved.body.torrent_results) {
					resolved.body = resolved.body.torrent_results
				}
			},
		],
	},
})

async function syncToken() {
	let { token } = await client.get('/pubapi_v2.php', {
		query: { get_token: 'get_token' },
	})
	client.config.query['token'] = token
	return utils.pTimeout(1000, token)
}

export class Rarbg extends scraper.Scraper {
	async scrape() {
		let torrents = [] as scraper.Torrent[]
		for (let sort of ['last', 'seeders']) {
			
			let query = {sort} as Query
			
			let results = (await client.get('/pubapi_v2.php', {
				query: {
					search_string: utils.toSlug(this.item.full.title),
				} as Partial<Query>,
			})) as Result[]
		}
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
		imdb: string
		themoviedb: string
		tvdb: string
		tvrage: string
	}
}
