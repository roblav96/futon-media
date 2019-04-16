import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as filters from '@/scrapers/filters'
import * as trackers from '@/scrapers/trackers-list'
import * as torrent from '@/scrapers/torrent'
import * as debrid from '@/debrids/debrid'

export async function scrapeAll(...[item]: ConstructorParameters<typeof Scraper>) {
	// console.log(`results ->`, results.splice(0).map(scraper.toJSON))
	// (await import('./providers/btbit')).BtBit, // (await import('./providers/snowfl')).Snowfl,
	let providers = [
		// (await import('./providers/btdb')).Btdb,
		// (await import('./providers/extratorrent')).ExtraTorrent,
		// (await import('./providers/eztv')).Eztv,
		// (await import('./providers/magnet4you')).Magnet4You,
		// (await import('./providers/magnetdl')).MagnetDl,
		// (await import('./providers/orion')).Orion,
		// (await import('./providers/pirateiro')).Pirateiro,
		(await import('@/scrapers/providers/rarbg')).Rarbg,
		(await import('@/scrapers/providers/solidtorrents')).SolidTorrents,
		// (await import('./providers/yts')).Yts,
	] as typeof Scraper[]

	let torrents = (await pAll(
		providers.map(scraper => () => new scraper(item).getTorrents())
	)).flat()

	torrents = _.uniqWith(torrents, (from, to) => {
		if (to.hash != from.hash) {
			return false
		}
		to.providers = _.uniq(to.providers.concat(from.providers))
		to.slugs = _.uniq(to.slugs.concat(from.slugs))
		!to.bytes && from.bytes && (to.bytes = from.bytes)
		!to.stamp && from.stamp && (to.stamp = from.stamp)
		!to.seeders && from.seeders && (to.seeders = from.seeders)
		return true
	})

	// let cached = await debrid.getCached(torrents.map(v => v.hash))
	// torrents.forEach((v, i) => (v.cached = cached[i]))

	torrents.sort((a, b) => b.bytes - a.bytes)

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	sorts = ['']
	concurrency = 3

	slugs() {
		let slugs = [] as string[]
		this.item.S.n && slugs.push(`${this.item.title} s${this.item.S.z}`)
		this.item.S.n && slugs.push(`${this.item.title} season ${this.item.S.n}`)
		this.item.E.n && slugs.push(`${this.item.title} s${this.item.S.z}e${this.item.E.z}`)
		slugs.length == 0 && slugs.unshift(this.item.title)
		return slugs.map(v => utils.toSlug(v))
	}

	constructor(public item: media.Item) {}

	async getTorrents() {
		let combinations = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs().forEach((slug, i) => {
			i == 0 && this.sorts.forEach(sort => combinations.push([slug, sort]))
			i > 0 && combinations.push([slug, this.sorts[0]])
		})

		/** get results with slug and sorts query combinations */
		let results = (await pAll(
			combinations.map(([slug, sort], index) => async () => {
				index > 0 && (await utils.pRandom(500))
				return (await this.getResults(slug, sort).catch(error => {
					console.error(`${this.constructor.name} Error ->`, error)
					return [] as Result[]
				})).map(result => ({
					providers: [this.constructor.name],
					slugs: [slug],
					...result,
				}))
			}),
			{ concurrency: this.concurrency }
		)).flat() as Result[]

		// console.warn(`${this.constructor.name} -> DONE`)
		return results.filter(v => filters.results(v, this.item)).map(v => new torrent.Torrent(v))
	}
}

export function toJSON(result: Result) {
	return {
		..._.omit(result, 'magnet', 'hash'),
		bytes: utils.fromBytes(result.bytes),
		stamp: dayjs(result.stamp).fromNow() + ', ' + dayjs(result.stamp).format('MMM DD YYYY'),
	}
}

export interface Result {
	bytes: number
	hash: string
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
