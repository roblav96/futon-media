import * as _ from 'lodash'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import { oc } from 'ts-optchain'

const CONFIG = {
	throttle: 100,
}

export const client = new http.Http({
	baseUrl: 'https://eztv.io/api',
	query: { page: 0, limit: 100 } as Partial<Query>,
	afterResponse: {
		append: [
			async (options, resolved) => {
				await utils.pTimeout(CONFIG.throttle)
			},
		],
	},
})

export class Eztv extends scraper.Scraper {
	get slugs() {
		return [this.item.ids.imdb]
	}
	async getResults(slug: string, sort: string) {
		if (!this.item.show) {
			return []
		}
		let response = (await client.get('/get-torrents', {
			query: { imdb_id: slug.replace(/[\D]/g, '') } as Partial<Query>,
			verbose: true,
		})) as Response
		let results = oc(response).torrents([])
		results = results.filter(v => {
			let { s, e } = { s: _.parseInt(v.season), e: _.parseInt(v.episode) }
			let good = this.item.episode ? this.item.episode.number == e : true
			return good && this.item.season.number == s
		})
		return results.map(v => {
			let title = v.title.replace('EZTV', '')
			let magnet = magneturi.decode(v.magnet_url)
			magnet.dn = magnet.dn && (magnet.dn as string).replace('[eztv]', '')
			!magnet.dn && (magnet.dn = title.replace(/[\s]/g, '.'))
			return {
				bytes: _.parseInt(v.size_bytes),
				date: new Date(v.date_released_unix * 1000).valueOf(),
				magnet: magneturi.encode(magnet),
				name: title,
				seeders: v.seeds,
			} as scraper.Result
		})
	}
}

export interface Query {
	imdb_id: string
	limit: number
	page: number
}

export interface Response {
	imdb_id: string
	limit: number
	page: number
	torrents: Result[]
	torrents_count: number
}

export interface Result {
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
