import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as execa from 'execa'
import * as filters from '@/scrapers/filters'
import * as http from '@/adapters/http'
import * as Json from '@/shims/json'
import * as magnetlink from '@/shims/magnet-link'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as ss from 'simple-statistics'
import * as torrent from '@/scrapers/torrent'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'
import pQueue from 'p-queue'
import safeStringify from 'safe-stable-stringify'
import { LANGS, UPLOADERS } from '@/utils/dicts'

let providers = [] as typeof Scraper[]
process.nextTick(async () => {
	// if (process.env.NODE_ENV == 'development') return console.warn(`DEVELOPMENT`)
	// https://ibit.to/
	// ████  https://www.putlockers.cr/  ████
	// (await import('@/scrapers/providers/bitlord')).Bitlord,
	// (await import('@/scrapers/providers/bitsnoop')).BitSnoop,
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
	// (await import('@/scrapers/providers/pirateiro')).Pirateiro,
	// (await import('@/scrapers/providers/skytorrents')).SkyTorrents,
	// (await import('@/scrapers/providers/torrentgalaxy')).TorrentGalaxy,
	// (await import('@/scrapers/providers/yourbittorrent2')).YourBittorrent2,
	// (await import('@/scrapers/providers/zooqle')).Zooqle,
	providers = [
		// (await import('@/scrapers/providers/bitcq')).BitCq,
		// (await import('@/scrapers/providers/btbot')).BtBot,
		// (await import('@/scrapers/providers/btdb')).Btdb,
		// (await import('@/scrapers/providers/btsow')).Btsow,
		// (await import('@/scrapers/providers/extratorrent-cm')).ExtraTorrentCm,
		// (await import('@/scrapers/providers/eztv')).Eztv,
		(await import('@/scrapers/providers/limetorrents')).LimeTorrents,
		// (await import('@/scrapers/providers/magnet4you')).Magnet4You,
		// (await import('@/scrapers/providers/magnetdl')).MagnetDl,
		(await import('@/scrapers/providers/orion')).Orion,
		(await import('@/scrapers/providers/rarbg')).Rarbg,
		// (await import('@/scrapers/providers/snowfl')).Snowfl,
		// (await import('@/scrapers/providers/solidtorrents')).SolidTorrents,
		// (await import('@/scrapers/providers/thepiratebay')).ThePirateBay,
		// (await import('@/scrapers/providers/torrentdownload')).TorrentDownload,
		// (await import('@/scrapers/providers/torrentz2')).Torrentz2,
		(await import('@/scrapers/providers/yts')).Yts,
	]
})

let pScrapeAllQueue = new pQueue({ concurrency: 1 })
export let scrapeAllQueue = function (...args) {
	return pScrapeAllQueue.add(() => scrapeAll(...args))
} as typeof scrapeAll
async function scrapeAll(item: media.Item, isHD: boolean) {
	let t = Date.now()

	await item.setAll()
	// console.warn(Date.now() - t, `scrapeAll item.setAll ->`, item.short)

	if (process.env.NODE_ENV == 'development') {
		;(global as any).item = item
		console.log(`item.titles ->`, item.titles)
		console.log(`item.years ->`, item.years)
		console.log(`item.slugs ->`, item.slugs)
		console.log(`item.queries ->`, item.queries)
		console.log(`item.aliases ->`, item.aliases)
		console.log(`item.collisions ->`, item.collisions)
		if (item.collection.name) console.log(`item.collection ->`, item.collection)
		// console.log(`item.seasons ->`, item.seasons)
		// if (process.env.NODE_ENV == 'development') throw new Error(`DEVELOPMENT`)
	}

	let results = _.flatten(
		await pAll(providers.map((Scraper) => () => new Scraper(item).scrape(isHD))),
	)

	results = _.uniqWith(results, (from, to) => {
		if (to.hash != from.hash) return false
		let accuracies = utils.accuracies(to.name, from.name)
		if (accuracies.length > 0) to.name += ` ${accuracies.join(' ')}`
		to.providers = _.uniq(to.providers.concat(from.providers))
		to.bytes = _.ceil(_.mean([to.bytes, from.bytes].filter(_.isFinite)))
		to.seeders = _.ceil(ss.harmonicMean([to.seeders || 1, from.seeders || 1]))
		to.stamp = _.ceil(_.min([to.stamp, from.stamp].filter(_.isFinite)))
		return true
	})
	results = results.filter((v) => !!v && v.stamp > 0 && v.bytes > 0 && v.seeders >= 0)

	let torrents = results.map((v) => new torrent.Torrent(v, item))
	if (isHD) torrents.sort((a, b) => b.boosts().bytes - a.boosts().bytes)
	else torrents.sort((a, b) => b.boosts().seeders - a.boosts().seeders)

	console.time(`torrents.filter`)
	let removed = _.remove(torrents, (torrent) => {
		try {
			return !filters.torrents(torrent, item)
		} catch (error) {
			console.error(`torrents.filter '${torrent.name}' -> %O`, error)
			return true
		}
	})
	console.timeEnd(`torrents.filter`)

	if (process.env.NODE_ENV == 'development') {
		;(global as any).removed = removed
		console.log(
			Date.now() - t,
			`scrapeAll removed ->`,
			// removed.map(v => v.short()),
			// removed.map(v => [v.short(), v.filter]),
			removed.filter((v) => v.filter).map((v) => [v.short(), v.filter]),
			// removed.map(v => v.json()),
			removed.length,
		)
	}

	console.time(`torrents.cached`)
	let cacheds = await debrids.cached(torrents.map((v) => v.hash))
	torrents.forEach((v, i) => (v.cached = cacheds[i] || []))
	console.timeEnd(`torrents.cached`)

	for (let i = 0; i < torrents.length; i++) {
		let v = torrents[i]
		v.boost = 1 + v.providers.length * 0.05
		if (v.providers.includes('Rarbg')) v.boost *= 1.25
		v.booster(UPLOADERS, 1.25)
		v.booster(['proper', 'repack'], 1.25)
		v.booster(LANGS, 0.5)
		v.booster(['360', '360p', '480', '480p', '720', '720p', 'avi'], 0.75)
		if (!isHD) {
			v.booster(['bdrip', 'bluray'], 1.25)
			v.booster(['2160', '2160p', '4k', 'uhd'], 0.75)
			if (v.providers.includes('Yts')) {
				v.boost *= 3
				v.booster(['1080', '1080p'], 2)
				v.booster(['webrip', 'web'], 0.75)
			}
			continue
		}
		v.booster(['fgt'], 1.25)
		v.booster(['bdremux', 'remux'], 1.25)
		v.booster(['atmos', 'dts', 'true hd', 'truehd'], 1.25)
		v.booster(['2160', '2160p', '4k', 'uhd'], 1.25)
		if (item.movie) {
			if (!v.slug.includes(' hdr ')) {
				v.booster(['10 bit', '10bit', '8 bit', '8bit'], 0.75)
			}
			if (utils.equals(v.slug, item.ids.slug) && v.providers.length == 1) v.boost *= 0.5
			if (utils.equals(v.slug, item.title) && v.providers.length == 1) v.boost *= 0.5
		}
	}

	if (isHD) torrents.sort((a, b) => b.boosts().bytes - a.boosts().bytes)
	else torrents.sort((a, b) => b.boosts().seeders - a.boosts().seeders)

	if (process.env.NODE_ENV == 'development') {
		;(global as any).torrents = torrents
		console.info(
			Date.now() - t,
			`scrapeAll torrents ->`,
			// torrents.map(v => v.short()),
			// torrents.map(v => [v.short(), v.filter]),
			torrents.filter((v) => v.filter).map((v) => [v.short(), v.filter]),
			// torrents.map(v => v.json()),
			torrents.length,
		)
	} else console.log(Date.now() - t, `scrapeAll ->`, torrents.length)

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	static http(config: http.Config) {
		_.defaults(config, {
			// debug: process.env.NODE_ENV == 'development',
			delay: 300,
			memoize: true,
			// profile: process.env.NODE_ENV == 'development',
			retries: [],
			silent: true,
			timeout: 10000,
		} as http.Config)
		return new http.Http(config)
	}

	sorts = [] as string[]
	max = Infinity
	concurrency = 3
	enabled = true

	slugs() {
		if (this.item.movie) return this.item.slugs
		let queries = this.item.queries.map((v) => `${this.item.slugs[0]} ${v}`)
		let slugs = this.item.slugs.concat(queries)
		return slugs
	}

	constructor(public item: media.Item) {}

	async scrape(isHD: boolean) {
		let t = Date.now()
		let ctor = this.constructor.name

		let combos = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs().forEach((slug, i) => {
			if (_.isEmpty(this.sorts)) return combos.push([slug] as any)
			combos.push([slug, isHD ? _.first(this.sorts) : _.last(this.sorts)])
		})
		combos = combos.slice(0, this.max)

		// console.log(ctor, combos.length, ...combos)
		// return []

		let results = [] as Result[]
		if (this.enabled) {
			results = _.flatten(
				await pAll(
					combos.map(([slug, sort], index) => async () => {
						return (
							await this.getResults(slug, sort).catch((error) => {
								console.error(`${ctor} getResults -> %O`, error)
								return [] as Result[]
							})
						).map((result) => ({ providers: [ctor], ...result } as Result))
					}),
					{ concurrency: this.concurrency },
				),
			)
		}

		results = results.filter((result) => {
			if (!result) return
			if (!result.magnet) return /** console.log(`⛔ !magnet ->`, result.name) */

			result.magnet = utils.clean(result.magnet)
			let magnet = qs.parseUrl(result.magnet).query as any as MagnetQuery
			if (_.isEmpty(magnet.xt)) return /** console.log(`⛔ !magnet.xt ->`, result.name) */
			if (magnet.xt.length != 41 && magnet.xt.length != 49) {
				return /** console.log(`⛔ magnet.xt.length != (41 || 49) ->`, result.name) */
			}

			result.name = result.name || magnet.dn
			if (_.isEmpty(result.name)) return /** console.log(`⛔ !result.name ->`, result.name) */
			result.name = utils.stripForeign(result.name)

			magnet.xt = magnet.xt.toLowerCase()
			magnet.dn = result.name
			magnet.tr = trackers.TRACKERS
			result.magnet = `magnet:?${qs.stringify(
				{ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr },
				{ encode: false, sort: false },
			)}`
			result.hash = magnet.xt.split(':').pop()
			if (result.hash.length != 40) {
				return /** console.log(`⛔ result.hash.length != 40 ->`, result.name) */
			}

			return true
		})
		results = _.uniqBy(results, 'hash')

		// let jsons = combos.map(v =>
		// 	v.map(vv => (vv && vv.startsWith('{') ? Json.parse(vv).value : vv)),
		// )
		// console.info(Date.now() - t, ctor, combos.length, results.length, safeStringify(jsons))
		console.info(Date.now() - t, ctor, combos.length, results.length)

		return results
		// return results.map(v => new torrent.Torrent(v, this.item))
	}
}

export interface Result {
	bytes: number
	hash: string
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
