import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://torrentz2.eu',
	cloudflare: '/search?f=ubuntu',
	query: { safe: '1' },
})

export class Torrentz2 extends scraper.Scraper {
	async getResults(slug: string) {
		let $ = cheerio.load(
			await client.get(`/search`, { query: { f: `title: ${slug}` } as Partial<Query> }),
		)
		let results = [] as scraper.Result[]
		$('.results dl:has(a)').each((i, el) => {
			try {
				let $el = $(el)
				let dt = $el.find('dt').text()
				let dta = $el.find('dt a')
				let title = dta.text()
				dt = dt.slice(title.length)
				if (!dt.split(' ').includes('video')) return
				results.push({
					bytes: utils.toBytes($el.find('dd span:nth-child(3)').text()),
					name: title,
					magnet: `magnet:?xt=urn:btih:${dta.attr('href').split('/')[1]}&dn=${title}`,
					seeders: _.parseInt($el.find('dd span:nth-child(4)').text()),
					stamp: _.parseInt($el.find('dd span:nth-child(2)').attr('title')) * 1000,
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	f: string
}
