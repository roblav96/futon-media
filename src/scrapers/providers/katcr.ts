import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as path from 'path'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://katcr.co',
	cloudflare: '/katsearch/page/1/ubuntu',
})

export class Katcr extends scraper.Scraper {
	async getResults(slug: string) {
		let type = this.item.show ? `tv/subcat/41` : `${this.item.type}s/subcat/71`
		let $ = cheerio.load(await client.get(`/katsearch/category/${type}/page/1/${slug}`))
		let results = [] as scraper.Result[]
		$('table.torrents_table > tbody > tr:has(a[href^="magnet:?"])').each((i, el) => {
			try {
				let $el = $(el)
				let result = {
					bytes: utils.toBytes($el.find('td[data-title="Size"]').text()),
					magnet: $el.find('a[href^="magnet:?"]').attr('href'),
					name: $el.find('a.torrents_table__torrent_title b').text(),
					seeders: utils.parseInt($el.find('td[data-title="Seed"]').text()),
				} as scraper.Result
				let date = $el.find('td[data-title="Age"]').text()
				let day = dayjs(date)
				if (date.includes('today')) {
					day = dayjs(date.replace('today', '').trim(), 'HH:mm')
				} else if (date.includes('yesterday')) {
					day = dayjs(date.replace('yesterday', '').trim(), 'HH:mm').subtract(1, 'day')
				}
				result.stamp = day.valueOf()
				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}
