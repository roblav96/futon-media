import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://extratorrent.ag',
	query: { order: 'desc' } as Partial<Query>,
})

export class ExtraTorrentAg extends scraper.Scraper {
	sorts = ['size', 'added']
	max = 3

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get('/search/', { query: { search: slug, srt: sort } as Partial<Query> })
		)
		let results = [] as scraper.Result[]
		$('tr[class^="tl"]').each((i, el) => {
			try {
				let $el = $(el)
				let result = {
					bytes: utils.toBytes($el.find('td:nth-last-of-type(4)').text()),
					name: $el.find('td.tli a').text(),
					magnet: _.trim($el.find('td a[href^="magnet:?"]').attr('href')),
					seeders: utils.parseInt($el.find('td.sy').text()),
					stamp: NaN,
				} as scraper.Result
				let added = $el.find('td:nth-last-of-type(5)').text()
				if (!added.includes(' ')) return results.push(result)
				let [a, b] = added.split(' ') as any[]
				let day = dayjs()
				if (!isNaN(a[0]) && !isNaN(b[0])) {
					day = day.subtract(a[0], a[1])
					result.stamp = day.subtract(b[0], b[1]).valueOf()
				} else if (!isNaN(a) && b) {
					result.stamp = day.subtract(a, b).valueOf()
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
