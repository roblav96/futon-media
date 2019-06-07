import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as qs from 'query-string'
import * as scraper from '@/scrapers/scraper'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.digbt.org',
	headers: { 'cookie': process.env.CF_DIGBIT, 'user-agent': process.env.CF_UA },
	query: { c: 'video', u: 'None' },
	beforeRequest: {
		append: [
			async options => {
				options.headers.referer = options.url
			},
		],
	},
	debug: true,
})

export class Digbt extends scraper.Scraper {
	sorts = ['length', 'time']
	concurrency = 1

	async getResults(slug: string, sort: string) {
		if (!process.env.CF_DIGBIT) {
			console.warn(`${this.constructor.name} ->`, '!process.env.CF_DIGBIT')
			return []
		}
		let $ = cheerio.load(
			await client.get(`/search/${slug}-${sort}-1/`, {
				query: { s: sort } as Partial<Query>,
			})
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
					seeders: _.max([utils.parseInt(downloads), 3]),
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
