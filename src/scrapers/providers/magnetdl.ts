import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.magnetdl.com',
})

export class MagnetDl extends scraper.Scraper {
	sorts = ['size', 'age', 'se']

	async getResults(slug: string, sort: string) {
		let category = this.item.movie ? 'Movie' : 'TV'
		let url = `/${slug.charAt(0)}/${slug.replace(/\s+/g, '-')}/${sort}/desc/`
		let $ = cheerio.load(await client.get(url.toLowerCase()))
		let results = [] as scraper.Result[]
		$(`tr:has(td[class="m"])`).each((i, el) => {
			try {
				let $el = $(el)
				if ($el.find(`td[class^="t"]`).text() != category) {
					return
				}
				results.push({
					bytes: utils.toBytes($el.find(`td:nth-child(6)`).text()),
					name: $el.find(`td[class="n"] a`).attr('title'),
					magnet: $el.find(`td[class="m"] a`).attr('href'),
					seeders: utils.parseInt($el.find(`td[class="s"]`).text()),
					stamp: utils.toStamp($el.find(`td:nth-child(3)`).text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}
