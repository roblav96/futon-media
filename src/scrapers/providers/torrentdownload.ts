import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as Json from '@/shims/json'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'
import * as xmljs from 'xml-js'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.torrentdownload.info',
	cloudflare: '/search?q=ubuntu',
})

export class TorrentDownload extends scraper.Scraper {
	sorts = ['searchs', 'search']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(await client.get(`/${sort}`, { query: { q: slug } }))
		let results = [] as scraper.Result[]
		$('table.table2 > tbody > tr:has(span.smallish)').each((i, el) => {
			try {
				let $el = $(el)
				let category = $el.find('div.tt-name > span.smallish').text()
				let types = this.item.movie ? ['Movie'] : ['TV', 'Television']
				if (!types.find((v) => category.includes(v))) return
				let link = $el.find('div.tt-name > a[href^="/"]')
				let hash = link.attr('href').split('/')[1]
				let title = link.text()
				let age = $el.find('td:nth-of-type(2)').text()
				age = age.replace('ago', '').trim()
				age = age.replace(/^Last/, '1')
				let stamp = utils.toStamp(age)
				if (age.includes('Yesterday')) {
					stamp = dayjs().subtract(1, 'day').valueOf()
				}
				results.push({
					bytes: utils.toBytes($el.find('td:nth-of-type(3)').text()),
					name: title,
					magnet: `magnet:?xt=urn:btih:${hash}&dn=${title}`,
					seeders: utils.parseInt($el.find('td.tdseed').text()),
					stamp,
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}

	// sorts = ['feed_s', 'feed']
	// async getResults(slug: string, sort: string) {
	// 	let response = await client.get(`/${sort}`, { query: { q: slug } })
	// 	let xml = xmljs.xml2js(response, { compact: true, textKey: 'value' }) as any
	// 	return ([_.get(xml, 'rss.channel.item', [])].flat() as XmlItem[]).map((v) => {
	// 		let regex =
	// 			/Size: (?<size>.*).*Seeds: (?<seeds>.*).*,.*Peers: (?<peers>.*).*Hash: (?<hash>.*)/g
	// 		let group = Array.from(v.description.value.matchAll(regex))[0].groups
	// 		return {
	// 			bytes: utils.toBytes(group.size.trim()),
	// 			magnet: `magnet:?xt=urn:btih:${group.hash}&dn=${v.title.value}`,
	// 			name: v.title.value,
	// 			seeders: utils.parseInt(group.seeds.trim()) || 1,
	// 			stamp: dayjs(v.pubDate.value).valueOf(),
	// 		} as scraper.Result
	// 	})
	// }
}

interface Query {
	q: string
}

interface XmlItem {
	category: {}
	description: {
		value: string
	}
	guid: {
		value: string
	}
	link: {
		value: string
	}
	pubDate: {
		value: string
	}
	title: {
		value: string
	}
}
