import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	memoize: process.env.NODE_ENV == 'development',
	baseUrl: 'https://solidtorrents.net/api/v1',
	query: {
		category: 'Video',
	} as Partial<Query>,
})

export class SolidTorrents extends scraper.Scraper {
	sorts = ['size', 'date', 'seeders']
	async getResults(slug: string, sort: string) {
		let response = (await client.get('/search', {
			query: { sort, q: slug } as Partial<Query>,
			verbose: true,
			memoize: process.env.NODE_ENV == 'development',
		})) as Response
		return (response.results || []).map(v => {
			return {
				bytes: v.size,
				magnet: v.magnet,
				name: v.title,
				seeders: v.swarm.seeders,
				stamp: new Date(v.imported).valueOf(),
			} as scraper.Result
		})
	}
}

interface Query {
	sort: string
	category: string
	q: string
}

interface Response {
	hits: number
	results: Result[]
	took: number
}

interface Result {
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
