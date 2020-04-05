import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.dnoid.to',
	cloudflare: '/files/?search=ubuntu',
	query: { incldead: '3', order: 'desc', to: 'on' } as Partial<Query>,
})

export class Demonoid extends scraper.Scraper {
	async getResults(slug: string) {
		let category = this.item.movie ? '8' : '12'
		let $ = cheerio.load(
			await client.get('/files/', {
				query: { category, search: slug } as Partial<Query>,
			}),
		)
		let results = [] as scraper.Result[]
		$('table.ttable_headinner tr:has(td[class^="tone_"])').each((i, el) => {
			try {
				let $el = $(el)
				let result = {} as scraper.Result
				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	category: string
	incldead: string
	order: string
	search: string
	sort: string
	to: string
}
