import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	baseUrl: 'https://extratorrent.si/search',
	query: {
		order: 'desc',
	} as Partial<Query>,
})

export class ExtraTorrent extends scraper.Scraper {
	sorts = ['size', 'seeds', 'added']
	async getResults(slug: string, sort: string) {
		await utils.pRandom(500)
		let $ = cheerio.load(
			await client.get('/', {
				query: { search: slug, srt: sort } as Partial<Query>,
				verbose: true,
				memoize: process.env.NODE_ENV == 'development',
			})
		)
		let results = [] as scraper.Result[]
		$('.tl tr').each((i, tr) => {
			try {
				let $tr = $(tr)
				if (!$tr.attr('class')) return
				let added = $tr.find('.tli + td').text()
				let result = {
					bytes: utils.toBytes($tr.find('.tli + td + td').text()),
					name: $tr.find('.tli > a').text(),
					seeders: utils.parseInt($tr.find('.sn').text()),
					stamp: new Date(added).valueOf(),
				} as scraper.Result
				if (added.startsWith('Today')) {
					result.stamp = dayjs(added.replace('Today-', ''), 'hh:mm').valueOf()
				} else if (added.startsWith('Y-day')) {
					result.stamp = dayjs()
						.subtract(1, 'day')
						.valueOf()
				}
				$tr.find('a').each((ii, a) => {
					let href = _.get(a, 'attribs.href', '') as string
					if (href.startsWith('magnet:')) result.magnet = href
				})
				results.push(result)
			} catch (error) {
				console.error(`${this.constructor.name} Error ->`, error)
			}
		})
		return results
	}
}

interface Query {
	order: string
	search: string
	srt: string
}
