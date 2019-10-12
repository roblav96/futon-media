import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as path from 'path'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import { Scraper, Result } from '@/scrapers/scraper'

export const client = Scraper.http({
	baseUrl: 'http://bitsnoop.me',
})

export class BitSnoop extends Scraper {
	async getResults(slug: string) {
		let $ = cheerio.load(await client.get('/search', { query: { q: slug } as Partial<Query> }))
		let results = [] as Result[]
		$('.rtable tr.row:has(a[href^="magnet:?"])').each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('td:nth-child(2)').text()),
					magnet: $el.find('td a[href^="magnet:?"]').attr('href'),
					name: $el.find('.rtitle').text(),
					seeders: utils.parseInt($el.find('td:nth-child(4)').text()),
					stamp: utils.toStamp($el.find('td:nth-child(3)').text()),
				} as Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	q: string
}
