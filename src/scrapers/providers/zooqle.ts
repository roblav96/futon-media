import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://zooqle.com',
	cloudflare: '/search?q=ubuntu',
	query: { sd: 'd', v: 't' } as Partial<Query>,
})

export class Zooqle extends scraper.Scraper {
	sorts = ['sz', 'dt']

	async getResults(slug: string, sort: string) {
		let q = `${slug} category:${this.item.movie ? 'Movies' : 'TV'}`
		let $ = cheerio.load(
			await client.get('/search', { query: { q, s: sort } as Partial<Query> })
		)
		let results = [] as scraper.Result[]
		$('table tr').each((i, el) => {
			if (i == 0) return
			try {
				let $el = $(el)
				let bytes = $el.find('td:nth-child(4)').text()
				let stamp = $el.find('td:nth-child(5)').text()
				results.push({
					bytes: !_.isFinite(utils.parseInt(bytes)) ? NaN : utils.toBytes(bytes),
					magnet: $el.find('td a[href^="magnet:?"]').attr('href'),
					name: $el.find('td:nth-child(2) a').text(),
					seeders: utils.parseInt($el.find('td:nth-child(6) .prog-l').text()),
					stamp: !stamp || stamp.includes('long') ? NaN : utils.toStamp(stamp),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	q: string
	s: string
	sd: string
	v: string
}
