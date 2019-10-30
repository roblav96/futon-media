import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://extratorrent.cm',
	cloudflare: '/search/?search=ubuntu',
})

export class ExtraTorrentCm extends scraper.Scraper {
	async getResults(slug: string, sort: string) {
		let category = this.item.show ? 'tv' : `${this.item.type}s`
		let $ = cheerio.load(
			await client.get('/search/', { query: { search: slug, category } as Partial<Query> }),
		)
		let results = [] as scraper.Result[]
		$('tr[class^="tl"]').each((i, el) => {
			try {
				let $el = $(el)
				let result = {
					bytes: utils.toBytes($el.find('td:nth-last-of-type(4)').text()),
					name: $el.find('td.tli > a').text(),
					magnet: _.trim($el.find('td a[href^="magnet:?"]').attr('href')),
					seeders: utils.parseInt($el.find('td.sy').text()),
				} as scraper.Result
				let added = $el.find('td:nth-last-of-type(5)').text()
				if (added.endsWith('min.')) added.replace('min.', 'minutes')
				result.stamp = utils.toStamp(added)
				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	search: string
	category: string
}
