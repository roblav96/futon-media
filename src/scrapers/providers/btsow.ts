import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://btspread.com',
})

export class Btsow extends scraper.Scraper {
	async getResults(slug: string) {
		let $ = cheerio.load(await client.get(`/search/${slug}`))
		let results = [] as scraper.Result[]
		$('.data-list > .row:has(a)').each((i, el) => {
			try {
				let $el = $(el)
				let link = $el.find('a')
				let href = link.attr('href')
				let title = link.attr('title')
				results.push({
					bytes: utils.toBytes($el.find('.size').text()),
					name: title,
					magnet: `magnet:?xt=urn:btih:${href.split('/').pop()}&dn=${title}`,
					seeders: 1,
					stamp: utils.toStamp($el.find('.date').text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	q: string
}
