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
	let providers = [
		// // // (await import('@/scrapers/providers/btbit')).BtBit,
		(await import('@/scrapers/providers/btdb')).Btdb,
		(await import('@/scrapers/providers/extratorrent')).ExtraTorrent,
		(await import('@/scrapers/providers/eztv')).Eztv,
		(await import('@/scrapers/providers/magnet4you')).Magnet4You,
		(await import('@/scrapers/providers/magnetdl')).MagnetDl,
		(await import('@/scrapers/providers/orion')).Orion,
		// // (await import('@/scrapers/providers/pirateiro')).Pirateiro,
		(await import('@/scrapers/providers/rarbg')).Rarbg,
		(await import('@/scrapers/providers/snowfl')).Snowfl,
		(await import('@/scrapers/providers/solidtorrents')).SolidTorrents,
		(await import('@/scrapers/providers/yts')).Yts,
	] as typeof Scraper[]

	let torrents = (await pAll(
		providers.map(scraper => () => new scraper(item).getTorrents())
	)).flat()

	torrents = _.uniqWith(torrents, (from, to) => {
		if (to.hash != from.hash) {
			return false
		}
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
	torrents.forEach((v, i) => (v.cached = cached[i]))

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	sorts: string[]
	concurrency = 3

	slugs() {
		let slugs = [] as string[]
		this.item.S.n && slugs.push(`${this.item.title} s${this.item.S.z}`)
		this.item.S.n && slugs.push(`${this.item.title} season ${this.item.S.n}`)
		this.item.E.n && slugs.push(`${this.item.title} s${this.item.S.z}e${this.item.E.z}`)
		slugs.length == 0 && slugs.push(this.item.title)
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

		let results = (await pAll(
			combinations.map(([slug, sort], index) => async () => {
				index > 0 && (await utils.pRandom(1000))
				return (await this.getResults(slug, sort).catch(error => {
					console.error(`${this.constructor.name} -> %O`, error)
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

		console.log(Date.now() - t, `${this.constructor.name}`, results.length)
		return results.map(v => new torrent.Torrent(v))
	}
}

export function json(result: Result) {
	return {
		..._.omit(result, 'magnet', 'hash'),
		bytes: utils.fromBytes(result.bytes),
		stamp: dayjs(result.stamp).fromNow() + ', ' + dayjs(result.stamp).format('MMM DD YYYY'),
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
