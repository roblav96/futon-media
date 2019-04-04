import * as _ from 'lodash'
import * as qs from 'query-string'
import * as media from '../adapters/media'
import * as utils from '../utils'
import { Http, GotJSONOptions } from '../adapters/http'
import { Scraper } from '../adapters/scraper'

export const client = new Http({
	mutableDefaults: true,
	baseUrl: 'https://torrentapi.org',
	query: {
		app_id: `${process.platform}_${process.arch}_${process.version}`,
	},
	hooks: {
		beforeRequest: [
			async options => {
				if (options.path.includes('get_token')) {
					return
				}
				if (!client.got.defaults.options.query['token']) {
					let token = await syncToken()
					// options.path += `&token=${token}`
				}
				options.path += `&${qs.stringify({
					mode: 'search',
					format: 'json_extended',
					limit: 100,
					ranked: 0,
				})}`
			},
		],
		afterResponse: [
			async (response, retry) => {
				if (_.inRange(_.get(response.body, 'error_code'), 1, 5)) {
					let token = await syncToken()
					return retry({ query: { token } } as GotJSONOptions)
				}
				if (_.has(response, 'body.torrent_results')) {
					response.body = response.body['torrent_results']
				}
				return response
			},
		],
	},
})

async function syncToken() {
	let { token } = await client.get('/pubapi_v2.php', {
		query: { get_token: 'get_token' },
	})
	client.got.defaults.options.query['token'] = token
	return token
}

export class Rarbg extends Scraper {
	async scrape() {
		let query = {
			search_string: utils.toSlug(this.item.full.title),
		} as Query
		let response = await client.get('/pubapi_v2.php', { query })
		console.log(`response ->`, response)
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
