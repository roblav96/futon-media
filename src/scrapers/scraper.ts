import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as filters from '@/scrapers/filters'
import * as http from '@/adapters/http'
import * as magneturi from 'magnet-uri'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'

export async function scrapeAll(...[item]: ConstructorParameters<typeof Scraper>) {
	// (await import('@/scrapers/providers/digbt')).Digbt,
	// (await import('@/scrapers/providers/pirateiro')).Pirateiro,
	// (await import('@/scrapers/providers/skytorrents')).SkyTorrents,
	// (await import('@/scrapers/providers/torrentgalaxy')).TorrentGalaxy,
	let providers = [
		(await import('@/scrapers/providers/btbit')).BtBit,
		(await import('@/scrapers/providers/btdb')).Btdb,
		(await import('@/scrapers/providers/extratorrent')).ExtraTorrent,
		(await import('@/scrapers/providers/eztv')).Eztv,
		(await import('@/scrapers/providers/magnet4you')).Magnet4You,
		(await import('@/scrapers/providers/magnetdl')).MagnetDl,
		(await import('@/scrapers/providers/orion')).Orion,
		(await import('@/scrapers/providers/rarbg')).Rarbg,
		(await import('@/scrapers/providers/snowfl')).Snowfl,
		(await import('@/scrapers/providers/solidtorrents')).SolidTorrents,
		(await import('@/scrapers/providers/thepiratebay')).ThePirateBay,
		(await import('@/scrapers/providers/yts')).Yts,
	] as typeof Scraper[]

	let torrents = (await pAll(
		providers.map(scraper => () => new scraper(item).getTorrents())
	)).flat()

	torrents = _.uniqWith(torrents, (from, to) => {
		if (to.hash != from.hash) return false
		let accuracy = utils.accuracy(to.name, from.name)
		if (accuracy.length > 0) {
			to.name += `.${accuracy.join('.')}`
		}
		to.providers = _.uniq(to.providers.concat(from.providers))
		to.slugs = _.uniq(to.slugs.concat(from.slugs))
		to.bytes = _.ceil(_.mean([to.bytes, from.bytes]))
		to.stamp = _.ceil(_.mean([to.stamp, from.stamp]))
		to.seeders = _.ceil(_.mean([to.seeders, from.seeders]))
		return true
	})

	let cached = await debrids.cached(torrents.map(v => v.hash))
	torrents.forEach((v, i) => {
		v.cached = cached[i]
		if (v.split.includes('fgt')) v.bytes = _.ceil(v.bytes * 1.25)
		if (
			v.split.includes('720p') ||
			(v.split.includes('sdr') && (v.split.includes('8bit') || v.split.includes('10bit')))
		) {
			v.seeders = _.ceil(v.seeders * 0.25)
			v.bytes = _.ceil(v.bytes * 0.75)
		}
	})

	torrents.sort((a, b) => b.bytes - a.bytes)
	if (item.show) {
		torrents.sort((a, b) => {
			let asize = a.packs ? a.bytes / (item.S.e * a.packs) : a.bytes
			let bsize = b.packs ? b.bytes / (item.S.e * b.packs) : b.bytes
			return bsize - asize
		})
	}

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	static http(config: http.Config) {
		_.defaults(config, {
			memoize: true,
			retries: [],
			silent: true,
			timeout: 10000,
		} as http.Config)
		return new http.Http(config)
	}

	sorts: string[]
	concurrency = 3

	slugs() {
		let slugs = this.item.movie ? [this.item.title] : []
		if (this.item.show && this.item.isDaily) {
			slugs.push(`${this.item.title} s${this.item.S.z}e${this.item.E.z}`)
			slugs.push(`${this.item.title} ${this.item.episode.first_aired.split('T')[0]}`)
			slugs.push(`${this.item.title} ${this.item.episode.title}`)
		} else if (this.item.show) {
			this.item.S.n && slugs.push(`${this.item.title} s${this.item.S.z}`)
			this.item.S.n && slugs.push(`${this.item.title} season ${this.item.S.n}`)
			this.item.E.n && slugs.push(`${this.item.title} s${this.item.S.z}e${this.item.E.z}`)
		}
		return slugs.map(v => utils.toSlug(v))
	}

	constructor(public item: media.Item) {}

	async getTorrents() {
		let t = Date.now()

		let combinations = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs().forEach((slug, i) => {
			let sorts = i == 0 ? this.sorts : this.sorts.slice(0, 1)
			sorts.forEach(sort => combinations.push([slug, sort]))
		})
		console.log(`${this.constructor.name} combinations ->`, combinations)

		let results = (await pAll(
			combinations.map(([slug, sort], index) => async () => {
				index > 0 && (await utils.pRandom(1000))
				return (await this.getResults(slug, sort).catch(error => {
					console.error(`${this.constructor.name} getResults -> %O`, error)
					return [] as Result[]
				})).map(result => ({
					providers: [this.constructor.name],
					slugs: [slug],
					...result,
				}))
			}),
			{ concurrency: this.concurrency }
		)).flat() as Result[]

		results = results.filter(v => filters.results(v, this.item))
		console.log(Date.now() - t, this.constructor.name, combinations.length, results.length)
		return results.map(v => new torrent.Torrent(v))
	}
}

export interface Result {
	bytes: number
	magnet: string
	name: string
	packs: number
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
