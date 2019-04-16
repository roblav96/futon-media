import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as ConfigStore from 'configstore'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	baseUrl: 'https://snowfl.com',
})

const nonce = (value = Math.random().toString(36)) => value.slice(-8)
const storage = new ConfigStore(
	`${pkgup.sync({ cwd: __dirname }).pkg.name}/${path.basename(__filename)}`
)
let TOKEN = (storage.get('TOKEN') || '') as string
let STAMP = (storage.get('STAMP') || 0) as number

async function syncToken() {
	let html = (await client.get('/b.min.js', {
		query: { v: nonce() } as Partial<Query>,
		verbose: true,
	})) as string
	let index = html.search(/\"\w{35}\"/i)
	let token = html.slice(index + 1, index + 36)
	if (!token) {
		throw new Error('snowfl token not found')
	}
	TOKEN = token
	storage.set('TOKEN', TOKEN)
	let future = dayjs().add(1, 'hour')
	STAMP = future.valueOf()
	storage.set('STAMP', STAMP)
}

export class Snowfl extends scraper.Scraper {
	sorts = ['SIZE', 'DATE', 'SEED']

	async getResults(slug: string, sort: string) {
		;(!TOKEN || Date.now() > STAMP) && (await syncToken())
		let url = `/${TOKEN}/${slug}/${nonce()}/0/${sort}/NONE/0`
		let response = ((await client.get(url, {
			query: { _: Date.now() } as Partial<Query>,
			verbose: true,
			memoize: process.env.NODE_ENV == 'development',
		})) || []) as Result[]
		let results = response.filter(v => !!v.magnet)
		return results.map(v => {
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
// 	let $ = cheerio.load(await http.client.get(result.url, { verbose: true }))
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
// 		verbose: true,
// 	})) as MagnetResponse
// 	result.magnet = response && response.url
// }
