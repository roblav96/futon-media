import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as path from 'path'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://eztv.io',
	cloudflare: '/search/ubuntu',
})

export class Eztv extends scraper.Scraper {
	concurrency = 1

	slugs() {
		let slugs = super.slugs()
		return slugs.filter(v => /s(\d+)e(\d+)/i.test(v))
	}

	async getResults(slug: string) {
		if (!this.item.show) return []
		let $ = cheerio.load(await client.get(`/search/${slug.replace(/\s+/g, '-')}`))
		let results = [] as scraper.Result[]
		$('table.forum_header_border tr:has(a[href^="magnet:?"])').each((i, el) => {
			try {
				let $el = $(el)
				let date = $el.find('td:nth-child(5)').text()
				let result = {
					bytes: utils.toBytes($el.find('td:nth-child(4)').text()),
					magnet: $el.find('td a[href^="magnet:?"]').attr('href'),
					name: $el.find('td:nth-child(2) a').text(),
					seeders: utils.parseInt($el.find('td:nth-child(6)').text()),
					stamp: utils.toStamp(date),
				} as scraper.Result
				let matches = Array.from(date.matchAll(/(?<num>\d+)(?<unit>\w+)/g))
				if (matches.length > 0) {
					let day = dayjs()
					for (let match of matches) {
						day = day.subtract(_.parseInt(match.groups.num), match.groups.unit as any)
					}
					result.stamp = day.valueOf()
				} else if (date.endsWith('mo')) {
					result.stamp = utils.toStamp(date.replace('mo', 'month'))
				}
				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		console.log(`results ->`, results)
		return results
	}
}
