import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	baseUrl: 'http://en.btbit.org',
})

export class BtBit extends scraper.Scraper {
	/** size, popularity, created */
	sorts = ['2', '3', '1']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get(`/list/${slug}/1-${sort}-2.html`, {
				verbose: true,
				memoize: process.env.NODE_ENV == 'development',
			})
		)
		let results = [] as scraper.Result[]
		$(`.rs`).each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find(`.sbar span:nth-of-type(4) b`).text()),
					name: _.trim($el.find(`.title`).text()),
					magnet: $el.find(`.sbar a[href^="magnet:"]`).attr('href'),
					seeders: utils.parseInt($el.find(`.sbar span:nth-of-type(6) b`).text()),
					stamp: new Date($el.find(`.sbar span:nth-of-type(3) b`).text()).valueOf(),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} Error ->`, error)
			}
		})
		return results
	}
}
