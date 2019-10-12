import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://bittorrentsearchweb.com',
	headers: { 'cookie': process.env.CF_BITTORRENTSEARCHWEB, 'user-agent': process.env.CF_UA },
	beforeRequest: {
		append: [
			async options => {
				options.headers.referer = options.url
			},
		],
	},
})

export class BitTorrentSearchWeb extends scraper.Scraper {
	sorts = ['2', '1']

	async getResults(slug: string, sort: string) {
		if (!process.env.CF_BITTORRENTSEARCHWEB) {
			console.warn(`${this.constructor.name} ->`, '!process.env.CF_BITTORRENTSEARCHWEB')
			return []
		}
		let $ = cheerio.load(await client.get(`/${slug}/1-${sort}-2/`))
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
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}
