import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as path from 'path'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'http://bitsnoop.me',
})

export class BitSnoop extends scraper.Scraper {
	concurrency = 1

	async getResults(slug: string) {
		let $ = cheerio.load(await client.get('/search', { query: { q: slug } }))
		let results = [] as scraper.Result[]
		$('.rtable tr.row').each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('td:nth-child(2)').text()),
					magnet: $el.find(`td a[href^="magnet:"]`).attr('href'),
					name: $el.find('.rtitle').text(),
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
