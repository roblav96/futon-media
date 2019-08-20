import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://torrentz2.eu',
})

export class Torrentz2 extends scraper.Scraper {
	sorts = ['searchS', 'searchA', 'search']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get(`/${sort}`, {
				query: { f: `title: ${slug}`, safe: '1' },
			})
		)
		let results = [] as scraper.Result[]
		$('.list p:has(a[href$="magnetlink"])').each((i, el) => {
			try {
				let $el = $(el)
				let $head = $el.prev()
				let title = _.trim($head.find('a').text())
				let href = $el.find('a[href$="magnetlink"]').attr('href')
				let date = new Date($el.find('span:nth-of-type(4) b').text())
				let years = new Date().getFullYear() - date.getFullYear()
				let popularity = utils.parseInt($el.find('span:nth-of-type(5) b').text())
				results.push({
					bytes: utils.toBytes($el.find('span:nth-of-type(3) b').text()),
					name: title,
					magnet: `magnet:?xt=urn:btih:${href.split('/')[1]}&dn=${title}`,
					seeders: _.ceil(popularity / 100 / Math.max(1, years)),
					stamp: date.valueOf(),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}
