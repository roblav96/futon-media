import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	// if (process.env.NODE_ENV == 'development') await db.flush()
})

export const client = scraper.Scraper.http({
	baseUrl: 'https://torrentapi.org',
	delay: 1000,
	headers: { 'content-type': 'application/json' },
	query: {
		app_id: 'Jackett',
		format: 'json_extended',
		limit: 100,
		mode: 'search',
		ranked: 0,
	} as Partial<Query>,
	beforeRequest: {
		append: [
			async (options) => {
				if (options.query['get_token']) {
					_.unset(options, 'memoize')
					options.query = _.pick(options.query, ['app_id', 'get_token'])
					return
				}
				options.query['token'] = await db.get<string>('token')
				if (!options.query['token']) {
					let { token } = await client.get('/pubapi_v2.php', {
						query: { get_token: 'get_token' },
					})
					options.query['token'] = token
					await db.put('token', token, utils.duration(10, 'minute'))
				}
			},
		],
	},
})

export class Rarbg extends scraper.Scraper {
	sorts = ['last']
	concurrency = 1

	slugs() {
		let query = { category: this.item.movie ? 'movies' : 'tv' } as Query
		if (this.item.ids.imdb) query.search_imdb = this.item.ids.imdb
		else if (this.item.ids.tmdb) query.search_themoviedb = this.item.ids.tmdb
		else if (this.item.ids.tvdb) query.search_tvdb = this.item.ids.tvdb
		if (this.item.movie) return [JSON.stringify(query)]
		let queries = this.item.queries.map((v) => ({ ...query, search_string: v } as Query))
		return [query].concat(queries).map((v) => JSON.stringify(v))
	}

	async getResults(slug: string, sort: string) {
		let response = (await client.get('/pubapi_v2.php', {
			query: Object.assign({ sort } as Query, JSON.parse(slug)),
		})) as Response
		return (response.torrent_results || []).map((v) => {
			return {
				bytes: v.size,
				magnet: v.download,
				name: v.title,
				seeders: v.seeders,
				stamp: new Date(v.pubdate).valueOf(),
			} as scraper.Result
		})
	}
}

interface Query {
	category: string
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
