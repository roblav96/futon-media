import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://torrentgalaxy.org',
	query: { order: 'desc', nox: '1', lang: '1' },
})

export class TorrentGalaxy extends scraper.Scraper {
	sorts = ['size', 'id']

	async getResults(slug: string, sort: string) {
		let parent_cat = this.item.movie ? 'Movies' : 'TV'
		let $ = cheerio.load(
			await client.get('/torrents.php', { query: { search: slug, sort, parent_cat } }),
		)
		let results = [] as scraper.Result[]
		$('div.tgxtablerow:has(a[href^="magnet:?"])').each((i, el) => {
			try {
				let $el = $(el)
				let seeders = $el.find('div.tgxtablecell:nth-last-of-type(2)').text()
				let date = $el.find('div.tgxtablecell:nth-last-of-type(1)').text()
				let stamp = date.includes('ago') && utils.toStamp(date.replace('Hrs', 'H'))
				if (date.includes(':')) stamp = dayjs(date, 'DD/MM/YY HH:mm').valueOf()
				results.push({
					bytes: utils.toBytes($el.find('div.tgxtablecell:nth-last-of-type(5)').text()),
					name: $el.find('div a[href^="/torrent/"]').attr('title'),
					magnet: $el.find('div a[href^="magnet:?"]').attr('href'),
					seeders: utils.parseInt(seeders.split('/')[0]),
					stamp,
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	parent_cat: string
	search: string
	sort: string
}
