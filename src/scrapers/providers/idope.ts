import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://idope.se',
	cloudflare: '/torrent-list/ubuntu/',
})

export class iDope extends scraper.Scraper {
	sorts = ['-2', '-1']

	async getResults(slug: string, sort: string) {
		let c = this.item.movie ? '1' : '3'
		let $ = cheerio.load(
			await client.get(`/torrent-list/${slug}/`, {
				query: { c, o: sort } as Partial<Query>,
			})
		)
		let results = [] as scraper.Result[]
		$('.resultdiv').each((i, el) => {
			try {
				let $el = $(el)
				let infos = $el.find('.hideinfohash')
				let result = {
					bytes: utils.toBytes($el.find('.resultdivbottonlength').text()),
					name: utils.trim(infos.last().text()),
					seeders: utils.parseInt($el.find('.resultdivbottonseed').text()),
					stamp: utils.toStamp($el.find('.resultdivbottontime').text()),
				} as scraper.Result
				result.magnet = `magnet:?xt=urn:btih:${infos.first().text()}&dn=${result.name}`
				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	page: number
	q: string
	x: number
	y: number
}
