import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as execa from 'execa'
import * as filters from '@/scrapers/filters'
import * as http from '@/adapters/http'
import * as Json from '@/shims/json'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import safeStringify from 'safe-stable-stringify'
import { UPLOADERS } from '@/utils/dicts'

let providers = [] as typeof Scraper[]
process.nextTick(async () => {
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
		(await import('@/scrapers/providers/btdb')).Btdb,
		(await import('@/scrapers/providers/btsow')).Btsow,
		(await import('@/scrapers/providers/extratorrent-cm')).ExtraTorrentCm,
		(await import('@/scrapers/providers/eztv')).Eztv,
		(await import('@/scrapers/providers/limetorrents')).LimeTorrents,
		// (await import('@/scrapers/providers/magnet4you')).Magnet4You,
		// (await import('@/scrapers/providers/magnetdl')).MagnetDl,
		// (await import('@/scrapers/providers/orion')).Orion,
		(await import('@/scrapers/providers/rarbg')).Rarbg,
		// (await import('@/scrapers/providers/snowfl')).Snowfl,
		// (await import('@/scrapers/providers/solidtorrents')).SolidTorrents,
		// (await import('@/scrapers/providers/thepiratebay')).ThePirateBay,
		(await import('@/scrapers/providers/torrentdownload')).TorrentDownload,
		(await import('@/scrapers/providers/torrentz2')).Torrentz2,
		(await import('@/scrapers/providers/yts')).Yts,
	]
})

export async function scrapeAll(item: media.Item, isHD: boolean) {
	let t = Date.now()

	await item.setAll()
	// console.warn(Date.now() - t, `scrapeAll item.setAll ->`, item.short)

	if (process.DEVELOPMENT) (global as any).item = item
	console.log(`item.titles ->`, item.titles)
	console.log(`item.years ->`, item.years)
	console.log(`item.slugs ->`, item.slugs)
	console.log(`item.queries ->`, item.queries)
	console.log(`item.aliases ->`, item.aliases)
	console.log(`item.collisions ->`, item.collisions)
	// console.log(`item.seasons ->`, item.seasons)
	// console.log(`item.s00e00 ->`, item.s00e00)
	// console.log(`item.e00 ->`, item.e00)
	// console.log(`item.matches ->`, item.matches)
	// if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	let torrents = (
		await pAll(providers.map(Scraper => () => new Scraper(item).scrape(isHD)))
	).flat()

	torrents = _.uniqWith(torrents, (from, to) => {
		if (to.hash != from.hash) return false
		let accuracies = utils.accuracies(to.name, from.name)
		if (accuracies.length > 0) to.name = ` ${utils.trim(`${to.name} ${accuracies.join(' ')}`)} `
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

	if (isHD) torrents.sort((a, b) => b.bytes - a.bytes)
	else torrents.sort((a, b) => b.seeders - a.seeders)

	if (process.DEVELOPMENT) {
		console.log(
			Date.now() - t,
			`scrapeAll results ->`,
			torrents.map(v => v.short),
			// torrents.map(v => v.json),
			torrents.length,
		)
	}

	// torrents.sort((a, b) => b.boosts(item.S.e).bytes - a.boosts(item.S.e).bytes)
	// // let cachedz = await debrids.cached(torrents.map(v => v.hash))
	// // torrents.forEach((v, i) => (v.cached = cachedz[i] || []))
	// console.info(Date.now() - t, `scrapeAll ${torrents.length} ->`, torrents.map(v => v.short))
	// if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	// let parsed = execa.sync('/usr/local/bin/guessit', ['-j', ...torrents.map(v => v.filename)])
	// console.log(`parsed ->`, parsed.stdout)
	// let parseds = torrents.map(v => filenameParse(v.name, true))
	// console.log('parseds ->', parseds)

	// console.profile(`torrents.filter`)
	console.time(`torrents.filter`)
	torrents = torrents.filter(v => {
		try {
			return filters.torrents(v, item)
		} catch (error) {
			console.error(`torrents.filter -> %O`, error)
		}
		// try {
		// 	return filters.torrents(v, item)
		// } catch {}
	})
	console.timeEnd(`torrents.filter`)
	// console.profileEnd(`torrents.filter`)

	console.time(`torrents.cached`)
	let cacheds = await debrids.cached(torrents.map(v => v.hash))
	console.timeEnd(`torrents.cached`)

	for (let i = 0; i < torrents.length; i++) {
		let v = torrents[i]
		v.cached = cacheds[i] || []
		v.boost = 1 + v.providers.length * 0.05
		if (v.providers.includes('Rarbg')) v.boost *= 1.25
		v.booster(UPLOADERS, 1.25)
		v.booster(['proper'], 1.25)
		v.booster(['french', 'hindi', 'ita', 'rus'], 0.5)
		v.booster(['720p', '480p', '360p', '720', '480', '360', 'avi'], 0.5)
		if (!isHD) {
			v.booster(['bdrip', 'bluray'], 1.25)
			v.booster(['2160p', '2160', 'uhd', '4k'], 0.5)
			if (v.providers.includes('Yts')) {
				v.boost *= 2
				v.booster(['1080p', '1080'], 2)
			}
			continue
		}
		v.booster(['fgt'], 1.25)
		v.booster(['bdremux', 'remux'], 1.25)
		v.booster(['atmos', 'dts', 'true hd', 'truehd'], 1.25)
		v.booster(['8bit', '8 bit', '10bit', '10 bit'], 0.5)
		if (utils.equals(v.name, item.ids.slug) && v.providers.length == 1) v.boost *= 0.5
		if (utils.equals(v.name, item.title) && v.providers.length == 1) v.boost *= 0.5
	}

	if (isHD) torrents.sort((a, b) => b.boosts.bytes - a.boosts.bytes)
	else torrents.sort((a, b) => b.boosts.seeders - a.boosts.seeders)

	if (process.DEVELOPMENT) {
		console.info(
			Date.now() - t,
			`scrapeAll torrents ->`,
			torrents.map(v => v.short),
			// torrents.map(v => v.json),
			torrents.length,
		)
	} else console.log(Date.now() - t, `scrapeAll ->`, torrents.length)

	if (process.DEVELOPMENT) (global as any).torrents = torrents

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	static http(config: http.Config) {
		_.defaults(config, {
			// debug: process.DEVELOPMENT,
			memoize: true,
			// profile: process.DEVELOPMENT,
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

		let results = (
			await pAll(
				combos.map(([slug, sort], index) => async () => {
					if (index > 0) await utils.pRandom(300)
					return (
						await this.getResults(slug, sort).catch(error => {
							console.error(`${ctor} getResults -> %O`, error)
							return [] as Result[]
						})
					).map(result => ({ providers: [ctor], ...result } as Result))
				}),
				{ concurrency: this.concurrency },
			)
		).flat()

		results = _.uniqWith(results, (a, b) => a.magnet == b.magnet).filter(v => {
			return !!v && filters.results(v, this.item)
		})

		// let jsons = combos.map(v =>
		// 	v.map(vv => (vv && vv.startsWith('{') ? Json.parse(vv).value : vv)),
		// )
		// console.info(Date.now() - t, ctor, combos.length, results.length, safeStringify(jsons))
		console.info(Date.now() - t, ctor, combos.length, results.length)

		return results.map(v => new torrent.Torrent(v, this.item))
	}
}

export interface Result {
	bytes: number
	filename: string
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
