import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as qs from 'query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://kat.li',
})

export class Katli extends scraper.Scraper {
	sorts = ['size', 'time_add', 'seeders']

	async getResults(slug: string, sort: string) {
		let type = this.item.show ? 'tv' : `${this.item.type}s`
		let $ = cheerio.load(
			await client.get(`/usearch/${slug} category:${type}/`, {
				query: { field: sort, sorder: 'desc' },
			})
		)
		let results = [] as scraper.Result[]
		$('table[class="data"] tr[id]').each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('td:nth-child(2)').text()),
					name: $el.find('td:nth-child(1) > div > div > a[class="cellMainLink"]').text(),
					magnet: qs.parseUrl(
						$el.find('td:nth-child(1) > div > a[data-nop=""]').attr('href')
					).query.url,
					seeders: utils.parseInt($el.find('td:nth-child(4)').text()),
					stamp: utils.toStamp($el.find('td:nth-child(3)').text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}
