import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
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
})

async function syncToken() {
	let { token } = await client.get('/pubapi_v2.php', {
		query: { get_token: 'get_token' },
	})
	client.config.query['token'] = token
	await utils.pTimeout(500)
	return token
}

export class Rarbg extends scraper.Scraper {
	sorts = ['last', 'seeders']
	concurrency = 1

	slugs() {
		let query = {} as Query
		if (this.item.ids.imdb) query.search_imdb = this.item.ids.imdb
		else if (this.item.ids.tmdb) query.search_themoviedb = this.item.ids.tmdb
		else if (this.item.ids.tvdb) query.search_tvdb = this.item.ids.tvdb

		let slugs = super.slugs()
		if (_.size(query) == 0) {
			return slugs.map(slug => JSON.stringify({ search_string: slug } as Query))
		}

		let title = utils.toSlug(this.item.title)
		let queries = slugs.map((slug, i) => {
			slug.startsWith(title) && (slug = slug.replace(title, '').trim())
			return slug ? ({ ...query, search_string: slug } as Query) : query
		})
		return queries.map(v => JSON.stringify(v))
	}

	async getResults(slug: string, sort: string) {
		let response = (await client.get('/pubapi_v2.php', {
			query: Object.assign({ sort } as Query, JSON.parse(slug)),
		})) as Response
		return (response.torrent_results || []).map(v => {
			return {
				bytes: v.size,
				magnet: v.download,
				name: v.title,
				seeders: v.seeders,
				stamp: new Date(v.pubdate).valueOf(),
				slugs: _.compact(_.values(JSON.parse(slug))),
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
