import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://bt4g.com',
	cloudflare: '/search/ubuntu',
})

export class Bt4g extends scraper.Scraper {
	sorts = ['/bysize', '']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(await client.get(`/search/${slug}${sort}/1`))
		let results = [] as scraper.Result[]
		$('.row > .col > div:has(a[href^="/magnet/"])').each((i, el) => {
			try {
				let $el = $(el)
				let link = $el.find('h5 a')
				let title = link.attr('title') || link.text()
				let href = link.attr('href')
				let category = $el.find('span:nth-last-of-type(6)').text()
				if (category != 'Video') return
				results.push({
					bytes: utils.toBytes($el.find('span:nth-last-of-type(3) b').text()),
					name: title,
					magnet: `magnet:?xt=urn:btih:${href.split('/').pop()}&dn=${title}`,
					seeders: utils.parseInt($el.find('span:nth-last-of-type(2) b').text()),
					stamp: utils.toStamp($el.find('span:nth-last-of-type(5) b').text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}
