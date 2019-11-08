import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as path from 'path'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.limetorrents.info',
	cloudflare: '/search/all/ubuntu/',
})

export class LimeTorrents extends scraper.Scraper {
	sorts = ['size', 'seeds']
	max = 3

	async getResults(slug: string, sort: string) {
		let type = this.item.show ? 'tv' : `${this.item.type}s`
		let $ = cheerio.load(await client.get(`/search/${type}/${slug}/${sort}/1/`))
		let results = [] as scraper.Result[]
		$('.table2 tr').each((i, el) => {
			if (i == 0) return
			try {
				let $el = $(el)
				let result = {
					bytes: utils.toBytes($el.find('td:nth-child(3)').text()),
					name: $el.find('.tt-name a:nth-child(2)').text(),
					seeders: utils.parseInt($el.find('.tdseed').text()),
				} as scraper.Result

				let url = $el.find('.tt-name a:nth-child(1)').attr('href')
				let hash = path.basename(url).split('.')[0]
				result.magnet = `magnet:?xt=urn:btih:${hash.toLowerCase()}&dn=${result.name}`

				let date = $el.find('td:nth-child(2)').text()
				date = date.replace(/\W/g, ' ').toLowerCase()
				date = _.trim(date.split('in')[0].replace('ago', ''))
				let day: dayjs.Dayjs
				if (date.includes('yesterday')) {
					day = dayjs().subtract(1, 'day')
				} else if (date.startsWith('last')) {
					day = dayjs().subtract(1, date.replace('last', '').trim() as any)
				}
				result.stamp = day ? day.valueOf() : utils.toStamp(date)

				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}
