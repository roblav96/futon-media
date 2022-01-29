import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'
import * as dayjs from 'dayjs'

export const client = scraper.Scraper.http({
	baseUrl: 'https://eztv.re/api',
	headers: { 'content-type': 'application/json' },
	query: { limit: 100 } as Partial<Query>,
	cloudflare: '/get-torrents?limit=1',
})

export class Eztv extends scraper.Scraper {
	concurrency = 1
	max = 1

	slugs() {
		return this.item.ids.imdb ? [this.item.ids.imdb.replace(/\D/g, '')] : []
	}

	async getResults(imdb_id: string) {
		if (!this.item.show) return []
		let results = [] as Result[]
		for (let page = 1; ; page++) {
			let response = (await client.get('/get-torrents', {
				query: { imdb_id, page } as Partial<Query>,
			})) as Response
			results = results.concat(response.torrents || [])
			if (response.page * response.limit > response.torrents_count) {
				break
			}
		}
		results = results.filter((v) => {
			let season = _.parseInt(v.season)
			let episode = _.parseInt(v.episode)
			if (this.item.ep.a && utils.includes(v.title, this.item.ep.a)) {
				return true
			}
			if (this.item.ep.t && utils.accuracies(v.title, this.item.ep.t)) {
				return true
			}
			if (this.item.se.n && season && this.item.ep.n && episode) {
				return this.item.se.n == season && this.item.ep.n == episode
			}
			if (this.item.se.n && season && this.item.se.n == season) {
				return true
			}
		})
		return results.map((v) => {
			return {
				bytes: _.parseInt(v.size_bytes),
				magnet: v.magnet_url,
				name: v.title,
				seeders: v.seeds,
				stamp: dayjs(v.date_released_unix * 1000).valueOf(),
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
