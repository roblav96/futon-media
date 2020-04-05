import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://extratorrent.si',
	cloudflare: '/search/?search=ubuntu',
	query: { order: 'desc' } as Partial<Query>,
})

export class ExtraTorrentSi extends scraper.Scraper {
	sorts = ['size', 'added']
	max = 3

	async getResults(slug: string, sort: string) {
		let s_cat = this.item.movie ? '4' : '8'
		let $ = cheerio.load(
			await client.get('/search/', {
				query: { search: slug, srt: sort, s_cat } as Partial<Query>,
			}),
		)
		let results = [] as scraper.Result[]
		$('.tl tr').each((i, el) => {
			try {
				let $el = $(el)
				if (!$el.attr('class')) return
				let result = {
					bytes: utils.toBytes($el.find('.tli + td + td').text()),
					name: $el.find('.tli > a').text(),
					magnet: _.trim($el.find('a[href^="magnet:?"]').attr('href')),
					seeders: utils.parseInt($el.find('.sn').text()),
				} as scraper.Result
				let added = $el.find('.tli + td').text()
				let day = dayjs(new Date(added))
				if (added.startsWith('Today')) {
					day = dayjs(added.replace('Today-', ''), 'hh:mm')
				} else if (added.startsWith('Y-day')) {
					day = dayjs().subtract(1, 'day')
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

interface Query {
	order: string
	s_cat: string
	search: string
	srt: string
}
