import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://glodls.to',
	cloudflare: '/search_results.php?search=ubuntu',
	query: { order: 'desc', incldead: '0', inclexternal: '0', lang: '0' } as Partial<Query>,
})

export class GloTorrents extends scraper.Scraper {
	sorts = ['size', 'id']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(
			await client.get('/search_results.php', {
				query: { search: slug, sort, cat: this.item.movie ? '1' : '41' } as Partial<Query>,
			})
		)
		let results = [] as scraper.Result[]
		$('.t-row').each((i, el) => {
			if (el.children.length <= 1) return
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('td:nth-of-type(5)').text()),
					name: $el.find('td[nowrap] a b').text(),
					magnet: $el.find('td a[href^="magnet:?"]').attr('href'),
					seeders: utils.parseInt($el.find('td:nth-of-type(6)').text()),
					stamp: NaN,
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		console.log(`results ->`, results)
		return results
	}
}

interface Query {
	cat: string
	search: string
	sort: string
}
