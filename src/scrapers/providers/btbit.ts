import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'http://en.btbit.org',
	headers: { 'cookie': process.env.CF_BTBIT, 'user-agent': process.env.CF_UA },
	beforeRequest: {
		append: [
			async options => {
				options.headers.referer = options.url
			},
		],
	},
})

export class BtBit extends scraper.Scraper {
	sorts = ['2', '1']
	slow = true
	concurrency = 1

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(await client.get(`/list/${slug}/1-${sort}-2.html`))
		let results = [] as scraper.Result[]
		$('.rs:has(a[href^="magnet:?"])').each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('.sbar span:nth-of-type(4) b').text()),
					name: _.trim($el.find('.title').text()),
					magnet: $el.find('.sbar a[href^="magnet:?"]').attr('href'),
					seeders: _.ceil(
						utils.parseInt($el.find('.sbar span:nth-of-type(6) b').text()) / 100
					),
					stamp: new Date($el.find('.sbar span:nth-of-type(3) b').text()).valueOf(),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}
