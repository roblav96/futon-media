import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.skytorrents.lol',
	query: { type: 'video' },
})

export class SkyTorrents extends scraper.Scraper {
	sorts = process.DEVELOPMENT ? ['size'] : ['size', 'seeders', 'created']
	concurrency = 1

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get('/', {
				query: { query: slug, sort, category: this.item.type },
			})
		)
		let results = [] as scraper.Result[]
		$('tr.result').each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('td:nth-child(2)').text()),
					name: $el.find('td a:nth-of-type(1)').text(),
					magnet: $el.find('a[href^="magnet:?xt"]').attr('href'),
					seeders: utils.parseInt($el.find('td:nth-child(5)').text()),
					stamp: utils.toStamp($el.find('td:nth-child(4)').text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}
