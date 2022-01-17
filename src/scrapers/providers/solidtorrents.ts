import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://solidtorrents.net',
	// query: { category: '1', subcat: '2' } as Partial<Query>,
})

export class SolidTorrents extends scraper.Scraper {
	sorts = ['size', 'seeders']
	concurrency = 1

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(await client.get('/search', { query: { q: slug, sort } }))
		let results = [] as scraper.Result[]
		$('div.search-result').each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('div.stats div:has(img[alt="Size"])').text()),
					name: $el.find('h5').text().trim(),
					magnet: $el.find('a[href^="magnet:?"]').attr('href'),
					seeders: utils.parseInt($el.find('div.stats div:has(img[alt="Seeder"])').text()),
					stamp: dayjs($el.find('div.stats div:has(img[alt="Date"])').text()).valueOf(),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	category: string
	q: string
	sort: string
	subcat: string
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
