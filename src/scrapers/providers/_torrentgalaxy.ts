import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://torrentgalaxy.org',
})

export class TorrentGalaxy extends scraper.Scraper {
	/** size, date, seeders */
	sorts = ['size', 'id', 'seeders']
	concurrency = 1

	async getResults(slug: string, sort: string) {
		let cats = ['c3', 'c45', 'c46', 'c42', 'c4', 'c1']
		if (this.item.show) cats = ['c28', 'c41', 'c5', 'c6', 'c7', 'c9']
		let qcats = _.fromPairs(cats.map(k => [k, '1']))
		let $ = cheerio.load(
			await client.get('/torrents.php', {
				query: { ...qcats, search: slug, sort, order: 'desc' },
			})
		)
		let results = [] as scraper.Result[]
		$('div[class="tgxtablerow clickable-row click"]').each((i, el) => {
			try {
				let $el = $(el)
				results.push({
					bytes: utils.toBytes($el.find('div span[style^="border-radius"]').text()),
					name: $el.find('div a[href^="/torrent/"]').attr('title'),
					magnet: $el.find('div a[href^="magnet:?"]').attr('href'),
					seeders: utils.parseInt(
						$el.find('div span[title="Seeders/Leechers"] font b').text()
					),
					stamp: utils.toStamp($el.find('div.tgxtablecell:last-of-type').text()),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error)
			}
		})
		return results
	}
}

interface Query {
	search: string
	sort: string
}
