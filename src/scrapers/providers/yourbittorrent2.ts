import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as qs from 'query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://yourbittorrent2.com',
})

export class YourBittorrent2 extends scraper.Scraper {
	concurrency = 1

	async getResults(slug: string) {
		let c = this.item.show ? 'television' : this.item.type
		let $ = cheerio.load(
			await client.get('/', { query: { c, q: slug } as Partial<Query> })
		)
		let results = [] as scraper.Result[]
		$('table tr:has(a[href^="magnet:?"])').each((i, el) => {
			try {
				let $el = $(el)
				let result = {
					bytes: utils.toBytes($el.find('td:nth-child(4)').text()),
					magnet: $el.find('td a[href^="magnet:?"]').attr('href'),
					name: $el.find('td[colspan="2"] a').text(),
					seeders: utils.parseInt($el.find('td:nth-child(6)').text()),
				} as scraper.Result

				let date = $el.find('td:nth-child(5)').text()
				let day = dayjs(date)
				if (date.includes('today')) {
					day = dayjs().startOf('day')
				} else if (date.includes('yesterday')) {
					day = dayjs().subtract(1, 'day')
				}
				result.stamp = day.valueOf()

				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	c: string
	q: string
}
