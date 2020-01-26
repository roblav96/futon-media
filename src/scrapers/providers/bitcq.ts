import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://bitcq.com',
	cloudflare: '/search?q=ubuntu',
})

export class BitCq extends scraper.Scraper {
	enabled = false

	async getResults(slug: string) {
		let $ = cheerio.load(
			await client.get('/search', { query: { q: slug } as Partial<Query> })
		)
		let results = [] as scraper.Result[]
		$('...').each((i, el) => {
			try {
				let $el = $(el)
				results.push({

				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	q: string
}
