import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	baseUrl: 'https://btdb.eu',
})

export class Btdb extends scraper.Scraper {
	sorts = ['length', 'time', 'popular']
	async getResults(slug: string, sort: string) {
		await utils.pRandom(500)
		let $ = cheerio.load(
			await client.get(`/`, {
				query: { search: slug, sort } as Partial<Query>,
				verbose: true,
				memoize: process.env.NODE_ENV == 'development',
			})
		)
		let results = [] as scraper.Result[]
		$(`li[class$="item"]`).each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find(`div[class$="info"] span:nth-of-type(1)`).text()),
					name: $el.find(`h2[class$="title"] a[href*="/torrent/"]`).attr('title'),
					magnet: $el.find(`div[class$="info"] a[href^="magnet:"]`).attr('href'),
					seeders: utils.parseInt(
						$el.find(`div[class$="info"] span:nth-of-type(4)`).text()
					),
					stamp: utils.toStamp($el.find(`div[class$="info"] span:nth-of-type(3)`).text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} Error ->`, error)
			}
		})
		return results
	}
}

interface Query {
	search: string
	sort: string
}
