import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://apibay.org',
	headers: { 'content-type': 'application/json' },
})

export class ApiBay extends scraper.Scraper {
	async getResults(slug: string) {
		let cat = this.item.movie ? '200,201,202,204,207,209,299' : '205,206,208'
		let response = (await client.get('/q.php', {
			query: { q: slug, cat } as Partial<Query>,
		})) as Result[]
		return (response || []).map((v) => {
			return {
				bytes: utils.parseInt(v.size),
				magnet: `magnet:?xt=urn:btih:${v.info_hash}&dn=${v.name}`,
				name: v.name,
				seeders: utils.parseInt(v.seeders),
				stamp: new Date(utils.parseInt(v.added) * 1000).valueOf(),
			} as scraper.Result
		})
	}
}

interface Query {
	cat: string
	q: string
}

interface Result {
	added: string
	category: string
	id: string
	imdb: string
	info_hash: string
	leechers: string
	name: string
	num_files: string
	seeders: string
	size: string
	status: string
	username: string
}
