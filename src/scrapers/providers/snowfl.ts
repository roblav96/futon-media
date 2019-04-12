import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

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
					limit: 100,
					ranked: 0,
				})
			},
		],
	},
	afterResponse: {
		append: [
			async (options, resolved) => {
				await utils.pTimeout(300)
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

	get slugs() {
		let queries = [] as Partial<Query>[]
		let query = {} as Query
		if (this.item.ids.imdb) query.search_imdb = this.item.ids.imdb
		else if (this.item.ids.tmdb) query.search_themoviedb = this.item.ids.tmdb
		else if (this.item.ids.tvdb) query.search_tvdb = this.item.ids.tvdb

		if (this.item.movie) {
			queries.push(query)
			if (this.rigorous && this.item.movie.belongs_to_collection) {
				let collection = this.item.movie.belongs_to_collection.name.split(' ')
				queries.push({ search_string: utils.toSlug(collection.slice(0, -1).join(' ')) })
			}
		}

		if (this.item.show) {
			if ((!this.item.S.n && !this.item.E.n) || this.rigorous) {
				queries.push(query)
			}
			if (this.item.S.n) {
				queries.push({ search_string: `s${this.item.S.z}`, ...query })
				if (this.rigorous) {
					queries.push({ search_string: `season ${this.item.S.n}`, ...query })
				}
			}
			if (this.item.E.n) {
				queries.push({ search_string: `s${this.item.S.z}e${this.item.E.z}`, ...query })
			}
		}

		return queries.map(v => JSON.stringify(v))
	}

	async getResults(query: string, sort: string) {
		let response = (await client.get('/pubapi_v2.php', {
			query: Object.assign({ sort } as Query, JSON.parse(query)),
			verbose: true,
		})) as Response
		return (response.torrent_results || []).map(v => {
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
