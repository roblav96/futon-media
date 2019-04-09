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
				await utils.pTimeout(500)
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
	async scrape() {
		console.log(`this.queries ->`, this.queries)
		let torrents = [] as scraper.Torrent[]
		// for (let sort of ['last', 'seeders']) {
		for (let sort of ['seeders']) {
			let query = { sort } as Query
			if (this.ids.imdb) query.search_imdb = this.ids.imdb
			else if (this.ids.tmdb) query.search_themoviedb = this.ids.tmdb
			else if (this.ids.tvdb) query.search_tvdb = this.ids.tvdb
			else if (!query.search_string) {
				query.search_string = utils.toSlug(this.ids.slug.replace(/[-]/g, ' '))
			}
			let results = (await client.get('/pubapi_v2.php', {
				query: query as any,
				verbose: true,
			})) as Result[]
			if (_.isArray(results)) {
				torrents.push(
					...results.map(v => {
						return {
							bytes: v.size,
							date: new Date(v.pubdate).valueOf(),
							magnet: v.download,
							name: v.title,
							providers: ['Rarbg'],
							seeders: v.seeders,
						} as scraper.Torrent
					})
				)
			}
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
