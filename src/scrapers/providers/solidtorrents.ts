import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://solidtorrents.net/api/v1',
	headers: { 'content-type': 'application/json' },
	query: { category: 'Video' } as Partial<Query>,
})

export class SolidTorrents extends scraper.Scraper {
	sorts = ['size', 'date']

	async getResults(slug: string, sort: string) {
		let response = (await client.get('/search', {
			query: { sort, q: slug } as Partial<Query>,
		})) as Response
		return (response.results || []).map(v => {
			return {
				bytes: v.size,
				magnet: v.magnet,
				name: v.title,
				seeders: v.swarm.seeders,
				stamp: dayjs(v.imported).valueOf(),
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
