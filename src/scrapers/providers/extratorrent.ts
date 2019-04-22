import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	baseUrl: 'https://extratorrent.si/search',
	query: {
		order: 'desc',
	} as Partial<Query>,
})

export class ExtraTorrent extends scraper.Scraper {
	sorts = ['size', 'added', 'seeds']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get('/', {
				query: { search: slug, srt: sort } as Partial<Query>,
				verbose: true,
				memoize: process.env.NODE_ENV == 'development',
			})
		)
		let results = [] as scraper.Result[]
		$(`.tl tr`).each((i, el) => {
			try {
				let $el = $(el)
				if (!$el.attr('class')) return
				let added = $el.find(`.tli + td`).text()
				let result = {
					bytes: utils.toBytes($el.find(`.tli + td + td`).text()),
					name: $el.find(`.tli > a`).text(),
					magnet: _.trim($el.find(`a[href^="magnet:"]`).attr('href')),
					seeders: utils.parseInt($el.find(`.sn`).text()),
					stamp: new Date(added).valueOf(),
				} as scraper.Result
				if (added.startsWith('Today')) {
					result.stamp = dayjs(added.replace('Today-', ''), 'hh:mm').valueOf()
				} else if (added.startsWith('Y-day')) {
					result.stamp = dayjs()
						.subtract(1, 'day')
						.valueOf()
				}
				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	order: string
	search: string
	srt: string
}
