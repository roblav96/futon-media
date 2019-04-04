import * as _ from 'lodash'
import * as media from '../adapters/media'
import * as scrapers from '../adapters/scrapers'
import { Http } from '../adapters/http'

let APP_ID = `${process.platform} ${process.arch} ${process.version}`
let TOKEN = ''

export const http = new Http({
	baseUrl: 'https://torrentapi.org',
	query: { app_id: APP_ID },
	hooks: {
		beforeRequest: [
			options => {
				if (_.get(options, 'query.get_token') != 'get_token') {
					_.merge(options.query, {
						mode: 'search',
						format: 'json_extended',
						limit: 100,
						ranked: 0,
						token: TOKEN,
					})
				}
				return options
			},
		],
	},
})

async function syncToken() {
	let { token } = await http.get('/pubapi_v2.php', {
		query: { get_token: 'get_token' },
	})
	TOKEN = token
}
syncToken()

export class Rarbg extends scrapers.Scraper {
	async scrape() {
		let query = {
			// query: this.item.ids.slug,
		} as Query
		let response = await http.get('/pubapi_v2.php', {
			query: { get_token: 'get_token' },
		})
	}
}

interface Query {
	format: string
	limit: number
	mode: string
	ranked: number
	search_imdb: string
	search_string: string
	search_themoviedb: number
	search_tvdb: number
	sort: string
}

interface Response {
	error: string
	error_code: number
	torrent_results: Result[]
}

interface Result {
	category: string
	download: string
	episode_info: {
		imdb: string
		themoviedb: string
		tvdb: string
		tvrage: string
	}
	info_page: string
	leechers: number
	pubdate: string
	ranked: number
	seeders: number
	size: number
	title: string
}
