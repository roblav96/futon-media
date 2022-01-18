import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	// if (process.env.NODE_ENV == 'development') await db.flush()
	await getToken()
})

export const client = scraper.Scraper.http({
	baseUrl: 'https://snowfl.com',
	cloudflare: '/',
	// timeout: 5000,
})

async function getToken() {
	let token = (await db.get('token')) as string
	if (token) return token
	let html = (await client.get('/b.min.js', {
		query: { v: utils.nonce() } as Partial<Query>,
	})) as string
	token = _.first(html.match(/\b(\w{33,47})\b/))
	if (!token) throw new Error('snowfl token not found')
	await db.put('token', token, utils.duration(1, 'hour'))
	return token
}

export class Snowfl extends scraper.Scraper {
	sorts = ['SIZE', 'SEED']
	concurrency = 1
	max = 1

	async getResults(slug: string, sort: string) {
		let token = await getToken()
		let url = `/${token}/${slug}/${utils.nonce()}/0/${sort}/NONE/0`
		let response = (await client.get(url, {
			query: { _: Date.now() } as Partial<Query>,
		})) as Result[]
		response = JSON.parse((response as any) || '[]')
		let results = response.filter((v) => {
			let type = this.item.movie ? 'Mov' : 'TV'
			return !!v.age && !!v.magnet && v.type.includes(type)
		})
		return results.map((v) => {
			return {
				bytes: utils.toBytes(v.size),
				magnet: v.magnet,
				name: v.name,
				seeders: v.seeder,
				stamp: utils.toStamp(v.age),
			} as scraper.Result
		})
	}
}

interface Query {
	_: number
	v: string
}

interface MagnetResponse {
	url: string
}

interface Result {
	age: string
	leecher: number
	magnet: string
	name: string
	nsfw: boolean
	seeder: number
	site: string
	size: string
	trusted: boolean
	type: string
	url: string
}

// import * as pAll from 'p-all'
// import * as cheerio from 'cheerio'

// async function fixMagnet(result: Result) {
// 	await utils.pTimeout(_.random(3000))
// 	let $ = cheerio.load(await http.client.get(result.url))
// 	let hash = $('.infohash-box span').text()
// 	result.magnet = `magnet:?xt=urn:btih:${hash}&dn=${result.name}`
// 	// let first = $('ul.download-links-dontblock a').first()
// 	// result.magnet = first.attr('href').trim()
// }

// await pAll(
// 	response.map(v => () => {
// 		return !v.magnet && v.site == '1337x' && fixMagnet(v)
// 	}),
// 	{ concurrency: 5 }
// )

// async function fixMagnet(result: Result) {
// 	let site = encodeURIComponent(result.site)
// 	let base64 = Buffer.from(encodeURIComponent(result.url)).toString('base64')
// 	let response = (await client.get(`/${TOKEN}/${site}/${base64}`, {
// 		query: { _: Date.now() } as Partial<Query>,
// 	})) as MagnetResponse
// 	result.magnet = response && response.url
// }
