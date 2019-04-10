import * as _ from 'lodash'
import * as utils from '../utils'
import * as media from '../adapters/media'
import * as torrent from './torrent'
import * as http from '../adapters/http'
import * as scraper from './scraper'

const CONFIG = {
	limit: 5,
	throttle: 1000,
}

export const client = new http.Http({
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
				// if (_.inRange(resolved.body.error_code, 1, 5)) {
				// 	let token = await syncToken()
				// 	// return retry({ query: { token } } as GotJSONOptions)
				// }
				if (resolved.body.torrent_results) {
					resolved.body = resolved.body.torrent_results
				}
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

export class Rarbg extends scraper.Scraper<Query, Result> {
	sorts = ['last', 'seeders']

	async getResults(slug: string, sort: string) {
		let query = { sort, search_string: slug } as Query

		// if (this.item.ids.imdb) query.search_imdb = this.item.ids.imdb
		// else if (this.item.ids.tmdb) query.search_themoviedb = this.item.ids.tmdb
		// else if (this.item.ids.tvdb) query.search_tvdb = this.item.ids.tvdb
		// else query.search_string = slug
		// if (this.item.movie && index >= this.sorts.length) {
		// 	query = { sort, search_string: slug } as Query
		// }
		// if (this.item.show) {
		// 	query.search_string = utils.filterWords(slug, utils.toSlug(this.item.show.title))
		// }

		let results = (await client.get('/pubapi_v2.php', {
			query: query as any,
			verbose: true,
		})) as Result[]
		return (results || []).map(v => {
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
