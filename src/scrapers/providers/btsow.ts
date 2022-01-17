import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import * as uastring from 'ua-string'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://btsow.rest',
	headers: { 'user-agent': uastring },
})

export class Btsow extends scraper.Scraper {
	async getResults(slug: string) {
		let $ = cheerio.load(await client.get(`/search/${slug}`))
		let results = [] as scraper.Result[]
		$('div.row:has(a[href*="/detail/hash/"])').each((i, el) => {
			try {
				let $el = $(el)
				let link = $el.find('a[href*="/detail/hash/"]')
				let title = link.attr('title') || link.text()
				results.push({
					bytes: utils.toBytes($el.find('div.size').text()),
					name: title,
					magnet: `magnet:?xt=urn:btih:${link.attr('href').split('/').pop()}&dn=${title}`,
					seeders: 1,
					stamp: dayjs($el.find('div.date').text()).valueOf(),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}
