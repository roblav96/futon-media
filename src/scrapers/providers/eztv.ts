import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	baseUrl: 'https://eztv.io/api',
	query: {
		limit: 100,
		page: 0,
	} as Partial<Query>,
})

export class Eztv extends scraper.Scraper {
	slugs() {
		return [this.item.ids.imdb]
	}

	async getResults(slug: string, sort: string) {
		if (!this.item.show) {
			return []
		}
		let response = (await client.get('/get-torrents', {
			query: { imdb_id: slug.replace(/\D/g, '') } as Partial<Query>,
			verbose: true,
			memoize: process.env.NODE_ENV == 'development',
		})) as Response
		let results = (response.torrents || []).filter(v => {
			let { s, e } = { s: _.parseInt(v.season), e: _.parseInt(v.episode) }
			if (this.item.episode) {
				return this.item.S.n == s && this.item.E.n == e
			} else if (this.item.season) {
				return this.item.S.n == s
			} else return true
		})
		return results.map(v => {
			return {
				bytes: _.parseInt(v.size_bytes),
				magnet: v.magnet_url,
				name: v.title,
				seeders: v.seeds,
				stamp: new Date(v.date_released_unix * 1000).valueOf(),
			} as scraper.Result
		})
	}
}

interface Query {
	imdb_id: string
	limit: number
	page: number
}

interface Response {
	imdb_id: string
	limit: number
	page: number
	torrents: Result[]
	torrents_count: number
}

interface Result {
	date_released_unix: number
	episode: string
	episode_url: string
	filename: string
	hash: string
	id: number
	imdb_id: string
	large_screenshot: string
	magnet_url: string
	peers: number
	season: string
	seeds: number
	size_bytes: string
	small_screenshot: string
	title: string
	torrent_url: string
}
