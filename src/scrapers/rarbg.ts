import * as _ from 'lodash'
import * as qs from 'query-string'
import * as media from '../adapters/media'
import * as utils from '../utils'
import { Http } from '../adapters/http'
import { Scraper } from '../adapters/scraper'

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

export class Rarbg extends Scraper {
	async scrape() {
		console.log(`this.slugs ->`, this.slugs)
		// let results = (await client.get('/pubapi_v2.php', {
		// 	query: {
		// 		search_string: utils.toSlug(this.item.full.title),
		// 	} as Partial<Query>,
		// })) as Result[]
	}

	cancel() {}
}

interface Query {
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

interface Response {
	error: string
	error_code: number
	torrent_results: Result[]
}

interface Result {
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
