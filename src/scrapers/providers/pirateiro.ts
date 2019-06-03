import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://pirateiro.com',
})

export class Pirateiro extends scraper.Scraper {
	sorts = ['tamanho', 'enviado']
	slow = true
	max = 2
	concurrency = 2

	async getResults(slug: string, sort: string) {
		let category = this.item.movie ? 'c300' : 'c700'
		let $ = cheerio.load(
			await client.get(`/torrents/`, {
				query: { search: slug, orderby: sort, [category]: '1' } as Partial<Query>,
			})
		)
		let results = [] as scraper.Result[]
		$(`table.torrenttable tr`).each((i, el) => {
			if (i == 0) return
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find(`td:nth-of-type(4)`).text()),
					name: $el.find(`td:nth-of-type(1) b`).text(),
					magnet: $el.find(`td:nth-of-type(2) a[href^="magnet:?"]`).attr('href'),
					seeders: utils.parseInt($el.find(`td:nth-of-type(5)`).text()),
					stamp: utils.toStamp($el.find(`td:nth-of-type(3)`).text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	search: string
	orderby: string
}
