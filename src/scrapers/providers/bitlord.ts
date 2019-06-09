import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.bitlordsearch.com',
})

export class Bitlord extends scraper.Scraper {
	concurrency = 1

	async getResults(slug: string) {
		let $ = cheerio.load(await client.get('/search', { query: { q: slug } as Partial<Query> }))
		let results = [] as scraper.Result[]
		$('.table-torrents tr.bls-row:has(a[href^="magnet:?"])').each((i, el) => {
			try {
				let $el = $(el)
				let age = $el.find('td.age').text()
				if (age.startsWith('a ')) age = age.replace('a ', '1 ')
				results.push({
					bytes: utils.parseInt($el.find('td.size').text()) * 1000 ** 2,
					magnet: $el.find('td.actions a[href^="magnet:?"]').attr('href'),
					name: $el.find('td.name .title').text(),
					seeders: utils.parseInt($el.find('td.seeds').text()),
					stamp: utils.toStamp(age.replace('ago', '').trim()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	q: string
}

// export const client = scraper.Scraper.http({
// 	baseUrl: 'https://www.bitlordsearch.com',
// 	form: {
// 		'filters[adult]': 'false',
// 		'filters[category]': '3',
// 		'filters[risky]': 'false',
// 		'filters[time]': '4',
// 		'limit': '10',
// 		'offset': '0',
// 	} as Partial<Query>,
// })

// export class Bitlord extends scraper.Scraper {
// 	sorts = ['size', 'added']
// 	concurrency = 1

// 	async getResults(slug: string, sort: string) {
// 		let response = await client.post('/get_list', {
// 			debug: true,
// 			form: {
// 				'filters[field]': sort,
// 				'filters[sort]': sort == 'size' ? 'desc' : 'asc',
// 				'query': slug,
// 			} as Partial<Query>,
// 		})
// 		return (((response && response.content) || []) as Result[]).map(v => {
// 			return {
// 				bytes: _.parseInt(v.size) * 1024,
// 				magnet: v.magnet,
// 				name: v.name,
// 				seeders: v.seeds,
// 				stamp: v.age * 1000,
// 			} as scraper.Result
// 		})
// 	}
// }

// interface Query {
// 	'filters[adult]': string
// 	'filters[category]': string
// 	'filters[field]': string
// 	'filters[risky]': string
// 	'filters[sort]': string
// 	'filters[time]': string
// 	'limit': string
// 	'offset': string
// 	'query': string
// }

// interface Result {
// 	age: number
// 	category: {
// 		id: number
// 		title: string
// 	}
// 	comments: number
// 	encrypted_id: string
// 	id: number
// 	is_verified: true
// 	link: string
// 	magnet: string
// 	name: string
// 	peers: number
// 	seeds: number
// 	size: string
// 	source: string
// 	tv_show: null
// }
