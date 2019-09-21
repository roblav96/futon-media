import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://thepiratebay.org',
	cloudflare: '/search/ubuntu/0/99/0',
})

export class ThePirateBay extends scraper.Scraper {
	sorts = ['5', '3']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(await client.get(`/search/${slug}/0/${sort}/200`))
		let results = [] as scraper.Result[]
		$('table tr').each((i, el) => {
			if (i == 0) return
			try {
				let $el = $(el)
				let font = $el.find('font').text()
				let day: dayjs.Dayjs
				let date = _.last(font.match(/uploaded (.*),/i))
				if (date.includes('Y-day')) {
					day = dayjs(date.replace('Y-day', '').trim(), 'HH:mm').subtract(1, 'day')
				} else if (date.includes(':')) {
					day = dayjs(date, 'MM-DD HH:mm')
				} else {
					day = dayjs(date, 'MM-DD YYYY')
				}
				results.push({
					bytes: utils.toBytes(_.last(font.match(/size (.*),/i))),
					name: $el.find('.detLink').text(),
					magnet: $el.find('td:nth-child(2) a[title^="Download"]').attr('href'),
					seeders: utils.parseInt($el.find('td:nth-child(3)').text()),
					stamp: day.valueOf(),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}
