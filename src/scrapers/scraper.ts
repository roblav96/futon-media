import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as fastParse from 'fast-json-parse'
import * as filters from '@/scrapers/filters'
import * as http from '@/adapters/http'
import * as magneturi from 'magnet-uri'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import fastStringify from 'fast-safe-stringify'

export async function scrapeAll(item: ConstructorParameters<typeof Scraper>[0], hd = true) {
	console.warn(`scrapeAll ->`, item.short)
	let t = Date.now()
	await item.setAll()
	console.warn(Date.now() - t, `scrapeAll item.setAll`)

	// console.log(`item ->`, item)
	console.log(`item.titles ->`, item.titles)
	console.log(`item.years ->`, item.years)
	console.log(`item.slugs ->`, item.slugs)
	console.log(`item.queries ->`, item.queries)
	console.log(`item.aliases ->`, item.aliases)
	console.log(`item.collisions ->`, item.collisions)
	// if (process.DEVELOPMENT) throw new Error(`DEV`)

	/**
		TODO:
		- PopcornTime | tv-v2.api-fetch.website | plugin.video.gaia
		- PopcornTime | api.apidomain.info | tv-futon-media.paw
		- ____ | ____
	*/
	// (await import('@/scrapers/providers/digbt')).Digbt,
	// (await import('@/scrapers/providers/katcr')).Katcr,
	// (await import('@/scrapers/providers/torrentgalaxy')).TorrentGalaxy,
	// (await import('@/scrapers/providers/yourbittorrent2')).YourBittorrent2,
	let providers = [
		(await import('@/scrapers/providers/bitlord')).Bitlord,
		(await import('@/scrapers/providers/bitsnoop')).BitSnoop,
		(await import('@/scrapers/providers/btbit')).BtBit,
		(await import('@/scrapers/providers/btdb')).Btdb,
		(await import('@/scrapers/providers/extratorrent-ag')).ExtraTorrentAg,
		(await import('@/scrapers/providers/extratorrent-si')).ExtraTorrentSi,
		(await import('@/scrapers/providers/eztv')).Eztv,
		(await import('@/scrapers/providers/glotorrents')).GloTorrents,
		(await import('@/scrapers/providers/idope')).iDope,
		(await import('@/scrapers/providers/katli')).Katli,
		(await import('@/scrapers/providers/limetorrents')).LimeTorrents,
		(await import('@/scrapers/providers/magnet4you')).Magnet4You,
		(await import('@/scrapers/providers/magnetdl')).MagnetDl,
		(await import('@/scrapers/providers/orion')).Orion,
		(await import('@/scrapers/providers/pirateiro')).Pirateiro,
		(await import('@/scrapers/providers/rarbg')).Rarbg,
		(await import('@/scrapers/providers/skytorrents')).SkyTorrents,
		(await import('@/scrapers/providers/snowfl')).Snowfl,
		(await import('@/scrapers/providers/solidtorrents')).SolidTorrents,
		(await import('@/scrapers/providers/thepiratebay')).ThePirateBay,
		(await import('@/scrapers/providers/yts')).Yts,
		(await import('@/scrapers/providers/zooqle')).Zooqle,
	] as typeof Scraper[]

	let torrents = (await pAll(providers.map(scraper => () => new scraper(item).scrape()))).flat()

	torrents = _.uniqWith(torrents, (from, to) => {
		if (to.hash != from.hash) return false
		let accuracies = utils.accuracies(to.name, from.name)
		if (accuracies.length > 0) to.name += ` ${accuracies.join(' ')}`
		to.providers = _.uniq(to.providers.concat(from.providers))
		to.slugs = _.uniq(to.slugs.concat(from.slugs))
		to.bytes = _.ceil(_.mean([to.bytes, from.bytes]))
		to.seeders = _.ceil(_.mean([to.seeders, from.seeders]))
		to.stamp = _.ceil(_.min([to.stamp, from.stamp]))
		return true
	})

	console.time(`torrents.filter`)
	torrents = torrents.filter(v => filters.torrents(v, item))
	console.timeEnd(`torrents.filter`)

	let cacheds = await debrids.cached(torrents.map(v => v.hash))
	torrents.forEach(({ split }, i) => {
		let v = torrents[i]
		v.cached = cacheds[i] || []
		let name = ` ${v.name} `
		if (v.providers.includes('Yts')) v.boost *= 1.5
		let bads = ['720p', '480p', '360p', 'avi']
		if (bads.find(def => name.includes(` ${def} `))) v.boost *= 0.5
		if (!hd) return
		if (utils.equals(v.name, item.slug) && v.providers.length == 1) v.boost *= 0.5
		if (utils.equals(v.name, item.smallests.slug) && v.providers.length == 1) v.boost *= 0.5
		let bits = ['8bit', '8 bit', '10bit', '10 bit']
		if (bits.find(bit => name.includes(` ${bit} `))) v.boost *= 0.5
		if (split.includes('fgt')) v.boost *= 1.5
		;[
			'bdremux',
			'ctrlhd',
			'dimension',
			'epsilon',
			'esir',
			'exkinoray',
			'grym',
			'kralimarko',
			'memento',
			'publichd',
			'rartv',
			'remux',
			'rovers',
			'sigma',
			'sparks',
			'trollhd',
		].forEach(vv => name.includes(` ${vv} `) && (v.boost *= 1.25))
	})
	torrents.sort((a, b) => b.boosts(item.S.e).bytes - a.boosts(item.S.e).bytes)

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	static http(config: http.Config) {
		_.defaults(config, {
			headers: { 'content-type': 'text/html' },
			memoize: true,
			retries: [],
			silent: true,
			timeout: 10000,
		} as http.Config)
		return new http.Http(config)
	}

	sorts = [] as string[]
	max = Infinity
	concurrency = 3

	slugs() {
		let slugs = _.clone(this.item.slugs)
		if (this.item.movie) return slugs
		let queries = this.item.queries.map(v => `${slugs[0]} ${v}`)
		return slugs.concat(queries)
		// let seasons = this.item.seasons.filter(v => v.aired_episodes > 0)
		// return slugs.slice(seasons.length > 1 ? 1 : 0).concat(queries)
	}

	constructor(public item: media.Item) {}

	async scrape() {
		let t = Date.now()
		let ctor = this.constructor.name

		// if (this.sorts.length >= 2) {
		// 	if (this.item.isDaily && ctor != 'Rarbg') {
		// 		let sorts = _.clone(this.sorts)
		// 		this.sorts[0] = sorts[1]
		// 		this.sorts[1] = sorts[0]
		// 		if (this.slow) this.sorts = [this.sorts[0]]
		// 	}
		// }
		if (this.item.isDaily) this.sorts.reverse()

		let combos = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs().forEach((slug, i) => {
			if (this.sorts.length == 0) return combos.push([slug] as any)
			let sorts = i == 0 ? this.sorts : [this.sorts[0]]
			sorts.forEach(sort => combos.push([slug, sort]))
		})
		combos = combos.slice(0, this.max)

		// console.log(ctor, combos.length, ...combos)
		// return []

		let results = (await pAll(
			combos.map(([slug, sort], index) => async () => {
				if (index > 0) await utils.pRandom(1000)
				return (await this.getResults(slug, sort).catch(error => {
					console.error(`${ctor} getResults -> %O`, error)
					return [] as Result[]
				})).map(result => ({
					providers: [ctor],
					slugs: [slug],
					...result,
				}))
			}),
			{ concurrency: this.concurrency }
		)).flat() as Result[]

		results = _.uniqWith(results, (a, b) => a.magnet == b.magnet).filter(
			v => v && filters.results(v, this.item)
			// v => v && v.bytes > 0 && v.seeders >= 0 && filters.results(v, this.item)
		)

		let jsons = combos.map(v => v.map(vv => (vv.startsWith('{') ? fastParse(vv).value : vv)))
		console.log(Date.now() - t, ctor, results.length, combos.length, fastStringify(jsons))

		return results.map(v => new torrent.Torrent(v))
	}
}

export interface Result {
	bytes: number
	magnet: string
	name: string
	providers: string[]
	seeders: number
	slugs: string[]
	stamp: number
}

export interface MagnetQuery {
	dn: string
	tr: string[]
	xt: string
}
