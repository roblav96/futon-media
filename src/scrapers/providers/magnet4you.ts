import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://magnet4you.me',
	cloudflare: '/search.php?s=ubuntu',
})

export class Magnet4You extends scraper.Scraper {
	sorts = ['size', 'seed']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get(`/search.php`, { query: { s: slug, sort } as Partial<Query> }),
		)
		let results = [] as scraper.Result[]
		$(`div[id^="profile"]:has(a[href^="magnet:?"])`).each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find(`td:nth-of-type(3)`).text()),
					name: $el.find(`td:nth-of-type(1) a:nth-of-type(2)`).text(),
					magnet: $el.find(`td:nth-of-type(1) a[href^="magnet:?"]`).attr('href'),
					seeders: utils.parseInt($el.find(`td:nth-of-type(5)`).text()),
					stamp: utils.toStamp($el.find(`td:nth-of-type(2)`).text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	s: string
	sort: string
	start: string
}
