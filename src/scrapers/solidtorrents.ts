import * as _ from 'lodash'
import * as dts from 'dts-generate'
import * as utils from '../utils'
import * as media from '../adapters/media'
import * as torrent from './torrent'
import * as http from '../adapters/http'
import * as scraper from './scraper'
import { oc } from 'ts-optchain'

const CONFIG = {
	throttle: 100,
}

export const client = new http.Http({
	baseUrl: 'https://solidtorrents.net/api/v1',
	query: {
		category: 'Video',
	} as Partial<Query>,
	afterResponse: {
		append: [
			async (options, resolved) => {
				await utils.pTimeout(CONFIG.throttle)
			},
		],
	},
})

export class SolidTorrents extends scraper.Scraper {
	sorts = ['size']
	async getResults(slug: string, sort: string) {
		let query = { sort, q: slug } as Query
		let response = (await client.get('/search', {
			query: query as any,
			verbose: true,
		})) as Response
		let results = oc(response).results([])
		return results.map(v => {
			return {
				bytes: v.size,
				date: new Date(v.imported).valueOf(),
				magnet: v.magnet,
				name: v.title,
				seeders: v.swarm.seeders,
			} as scraper.Result
		})
	}
}

export interface Query {
	sort: string
	category: string
	q: string
}

export interface Result {
	category: string
	created: string
	imported: string
	infohash: string
	lastmod: string
	magnet: string
	processed: boolean
	rating: {
		average: number
		raters: number
		total: number
	}
	removed: boolean
	size: number
	swarm: {
		downloads: number
		leechers: number
		seeders: number
		verified: boolean
	}
	tags: string[]
	title: string
}

export interface Response {
	hits: number
	results: Result[]
	took: number
}
