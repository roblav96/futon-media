import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.digbt.org',
	cloudflare: '/search/ubuntu/',
	query: { c: 'video' },
})

export class Digbt extends scraper.Scraper {
	sorts = ['length', 'time']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get(`/search/${slug}-${sort}-1/`, { query: { s: sort } as Partial<Query> })
		)
		let results = [] as scraper.Result[]
		$('tr td.x-item').each((i, el) => {
			try {
				let $el = $(el)
				let tail = $el.find('div.tail').text()
				let size = tail.match(/size:\s([\d.]*)\s(\w{2})/i)
				let downloads = tail.match(/downloads:\s([\d.]*)\s/i).pop()
				let ctime = $el.find('div span.ctime').text()
				results.push({
					bytes: utils.toBytes(size.slice(-2).join(' ')),
					name: $el.find('div a').attr('title'),
					magnet: $el.find('div.tail a[href^="magnet:?"]').attr('href'),
					seeders: utils.parseInt(downloads) || NaN,
					stamp: utils.toStamp(ctime.replace('ago', '').trim()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	s: string
}
