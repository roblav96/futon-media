import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as pForever from 'p-forever'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://eztv.io/api',
	query: { limit: 100, page: 1 } as Partial<Query>,
})

export class Eztv extends scraper.Scraper {
	sorts = ['']

	slugs() {
		return [this.item.ids.imdb.replace(/\D/g, '')]
	}

	async getResults(imdb_id: string) {
		if (!this.item.show) {
			return []
		}
		let results = [] as Result[]
		await pForever(async page => {
			page > 1 && (await utils.pRandom(1000))
			let response = (await client.get('/get-torrents', {
				query: { imdb_id, page } as Partial<Query>,
				memoize: process.DEVELOPMENT,
			})) as Response
			let torrents = (response.torrents || []).filter(v => {
				let season = _.parseInt(v.season)
				let episode = _.parseInt(v.episode)
				if (_.isFinite(this.item.E.n) && season && episode) {
					return this.item.S.n == season && this.item.E.n == episode
				} else if (_.isFinite(this.item.S.n) && season) {
					return this.item.S.n == season
				} else return true
			})
			results.push(...torrents)
			return response.torrents_count > page * 100 ? ++page : pForever.end
		}, 1)
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
