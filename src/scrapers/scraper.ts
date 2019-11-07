import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as fastParse from 'fast-json-parse'
import * as filters from '@/scrapers/filters'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import fastStringify from 'fast-safe-stringify'
import { UPLOADERS } from '@/utils/dicts'

let providers = [] as typeof Scraper[]
process.nextTick(async () => {
	// https://ibit.to/
	// (await import('@/scrapers/providers/bitlord')).Bitlord,
	// (await import('@/scrapers/providers/bittorrentsearchweb')).BitTorrentSearchWeb,
	// (await import('@/scrapers/providers/bt4g')).Bt4g,
	// (await import('@/scrapers/providers/btbit')).BtBit,
	// (await import('@/scrapers/providers/demonoid')).Demonoid,
	// (await import('@/scrapers/providers/digbt')).Digbt,
	// (await import('@/scrapers/providers/extratorrent-si')).ExtraTorrentSi,
	// (await import('@/scrapers/providers/gaia-popcorn-time')).GaiaPopcornTime,
	// (await import('@/scrapers/providers/glotorrents')).GloTorrents,
	// (await import('@/scrapers/providers/idope')).iDope,
	// (await import('@/scrapers/providers/katcr')).Katcr,
	// (await import('@/scrapers/providers/kickasstorrents')).KickassTorrents,
	// (await import('@/scrapers/providers/skytorrents')).SkyTorrents,
	// (await import('@/scrapers/providers/torrentgalaxy')).TorrentGalaxy,
	// (await import('@/scrapers/providers/yourbittorrent2')).YourBittorrent2,
	// (await import('@/scrapers/providers/zooqle')).Zooqle,
	providers = [
		// (await import('@/scrapers/providers/bitsnoop')).BitSnoop,
		// (await import('@/scrapers/providers/btdb')).Btdb,
		// (await import('@/scrapers/providers/btsow')).Btsow,
		// (await import('@/scrapers/providers/extratorrent-cm')).ExtraTorrentCm,
		(await import('@/scrapers/providers/eztv')).Eztv,
		// (await import('@/scrapers/providers/limetorrents')).LimeTorrents,
		// (await import('@/scrapers/providers/magnet4you')).Magnet4You,
		// (await import('@/scrapers/providers/magnetdl')).MagnetDl,
		// (await import('@/scrapers/providers/orion')).Orion,
		// (await import('@/scrapers/providers/pirateiro')).Pirateiro,
		// (await import('@/scrapers/providers/rarbg')).Rarbg,
		// (await import('@/scrapers/providers/snowfl')).Snowfl,
		// (await import('@/scrapers/providers/solidtorrents')).SolidTorrents,
		// (await import('@/scrapers/providers/thepiratebay')).ThePirateBay,
		// (await import('@/scrapers/providers/torrentdownload')).TorrentDownload,
		// (await import('@/scrapers/providers/torrentz2')).Torrentz2,
		// (await import('@/scrapers/providers/yts')).Yts,
	]
})

export async function scrapeAll(item: media.Item, SD: boolean) {
	let t = Date.now()
	// if (process.DEVELOPMENT) SD = false

	await item.setAll()
	console.warn(Date.now() - t, `scrapeAll item.setAll ->`, item.short)

	// // console.log(`item ->`, ((global as any).item = item))
	// console.log(`item.titles ->`, item.titles)
	// console.log(`item.years ->`, item.years)
	// console.log(`item.slugs ->`, item.slugs)
	// console.log(`item.queries ->`, item.queries)
	// console.log(`item.aliases ->`, item.aliases)
	// console.log(`item.filters ->`, item.filters)
	// console.log(`item.collisions ->`, item.collisions)
	// // console.log(`item.s00e00 ->`, item.s00e00)
	// // console.log(`item.e00 ->`, item.e00)
	// // console.log(`item.matches ->`, item.matches)
	// // if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	let torrents = (await pAll(providers.map(Scraper => () => new Scraper(item).scrape()))).flat()

	torrents = _.uniqWith(torrents, (from, to) => {
		if (to.hash != from.hash) return false
		let accuracies = utils.accuracies(to.name, from.name)
		if (accuracies.length > 0) to.name += ` ${accuracies.join(' ')}`
		to.providers = _.uniq(to.providers.concat(from.providers))
		to.bytes = _.ceil(_.mean([to.bytes, from.bytes].filter(_.isFinite)))
		to.seeders = _.ceil(_.mean([to.seeders, from.seeders].filter(_.isFinite)))
		to.stamp = _.ceil(_.mean([to.stamp, from.stamp].filter(_.isFinite)))
		return true
	})

	torrents = torrents.filter(v => {
		if (!(v && v.stamp > 0 && v.bytes > 0 && v.seeders >= 0)) return
		if (utils.toBytes(`${item.runtime} MB`) > v.bytes) return
		if (item.released.valueOf() - utils.duration(1, 'day') > v.stamp) return
		return true
	})

	torrents.sort((a, b) => b.boosts(item.S.e).bytes - a.boosts(item.S.e).bytes)
	let cachedz = await debrids.cached(torrents.map(v => v.hash))
	torrents.forEach((v, i) => (v.cached = cachedz[i] || []))
	console.info(Date.now() - t, `scrapeAll ${torrents.length} ->`, torrents.map(v => v.short))
	if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	console.time(`torrents.filter`)
	torrents = torrents.filter(v => {
		try {
			return filters.torrents(v, item)
		} catch {}
	})
	console.timeEnd(`torrents.filter`)

	console.time(`torrents.cached`)
	let cacheds = await debrids.cached(torrents.map(v => v.hash))
	console.timeEnd(`torrents.cached`)

	for (let i = 0; i < torrents.length; i++) {
		let v = torrents[i]
		v.cached = cacheds[i] || []
		let name = ` ${v.name} `
		let sds = ['720p', '480p', '360p', '720', '480', '360', 'avi']
		if (sds.find(vv => name.includes(` ${vv} `))) v.boost *= 0.5
		if (name.includes(' proper ')) v.boost *= 1.25
		if (UPLOADERS.find(vv => name.includes(` ${vv} `))) v.boost *= 1.25
		if (SD) {
			let uhds = ['2160p', '2160', 'uhd', '4k']
			if (uhds.find(vv => name.includes(` ${vv} `))) v.boost *= 0.5
			if (v.providers.includes('Yts')) {
				v.boost *= 2
				let hds = ['1080p', '1080']
				if (hds.find(vv => name.includes(` ${vv} `))) v.boost *= 2
			}
			continue
		}
		let bits = ['8bit', '8 bit', '10bit', '10 bit']
		if (bits.find(vv => name.includes(` ${vv} `))) v.boost *= 0.5
		if (utils.equals(v.name, item.slug) && v.providers.length == 1) v.boost *= 0.5
		if (utils.equals(v.name, item.title) && v.providers.length == 1) v.boost *= 0.5
		if (['bdremux', 'remux'].find(vv => name.includes(` ${vv} `))) v.boost *= 1.25
		if (name.includes(' fgt ')) v.boost *= 1.5
	}

	if (SD) torrents.sort((a, b) => b.boosts(item.S.e).seeders - a.boosts(item.S.e).seeders)
	else torrents.sort((a, b) => b.boosts(item.S.e).bytes - a.boosts(item.S.e).bytes)

	if (!process.DEVELOPMENT) console.log(Date.now() - t, `scrapeAll ->`, torrents.length)
	console.info(Date.now() - t, `scrapeAll ->`, torrents.map(v => v.short), torrents.length)
	// console.info(Date.now() - t, `scrapeAll ${torrents.length} torrents ->`, 'DONE')
	// if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	static http(config: http.Config) {
		_.defaults(config, {
			// debug: process.DEVELOPMENT,
			memoize: !process.DEVELOPMENT,
			profile: process.DEVELOPMENT,
			retries: [],
			silent: true,
			timeout: process.DEVELOPMENT ? 10000 : 5000,
		} as http.Config)
		return new http.Http(config)
	}

	sorts = [] as string[]
	max = Infinity
	concurrency = 3

	slugs() {
		if (this.item.movie) return this.item.slugs
		let queries = this.item.queries.map(v => `${this.item.slugs[0]} ${v}`)
		return this.item.slugs.concat(queries)
	}

	constructor(public item: media.Item) {}

	async scrape() {
		let t = Date.now()
		let ctor = this.constructor.name

		let combos = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs().forEach((slug, i) => {
			if (this.sorts.length == 0) return combos.push([slug] as any)
			combos.push([slug, this.sorts[0]])
		})
		combos = combos.slice(0, this.max)

		// console.log(ctor, combos.length, ...combos)
		// return []

		let results = (await pAll(
			combos.map(([slug, sort], index) => async () => {
				if (index > 0) await utils.pRandom(300)
				return (await this.getResults(slug, sort).catch(error => {
					console.error(`${ctor} getResults -> %O`, error)
					return [] as Result[]
				})).map(result => ({ providers: [ctor], ...result } as Result))
			}),
			{ concurrency: this.concurrency },
		)).flat()

		results = _.uniqWith(results, (a, b) => a.magnet == b.magnet).filter(v => {
			return v && filters.results(v, this.item)
		})

		// let jsons = combos.map(v =>
		// 	v.map(vv => (vv && vv.startsWith('{') ? fastParse(vv).value : vv)),
		// )
		// console.info(Date.now() - t, ctor, combos.length, results.length, fastStringify(jsons))
		console.info(Date.now() - t, ctor, combos.length, results.length)

		return results.map(v => new torrent.Torrent(v))
	}
}

export interface Result {
	bytes: number
	magnet: string
	name: string
	providers: string[]
	seeders: number
	stamp: number
}

export interface MagnetQuery {
	dn: string
	tr: string[]
	xt: string
}
