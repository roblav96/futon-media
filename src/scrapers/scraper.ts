import * as _ from 'lodash'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as filters from '@/scrapers/filters'
import * as utils from '@/utils/utils'

export async function scrapeAll(...[item, rigorous]: ConstructorParameters<typeof Scraper>) {
	let providers = [
		(await import('./providers/rarbg')).Rarbg,
		// (await import('./providers/solidtorrents')).SolidTorrents,
		// (await import('./providers/ytsam')).YtsAm,
		// (await import('./providers/eztv')).Eztv,
	] as typeof Scraper[]

	let results = (await pAll(
		providers.map(scraper => () => new scraper(item, rigorous).start())
	)).flat()
	results = results.filter(filters.filter)
	results = _.uniqWith(results, (from, to) => {
		if (to.hash != from.hash) {
			return false
		}
		to.providers = _.uniq(to.providers.concat(from.providers))
		to.slugs = _.uniq(to.slugs.concat(from.slugs))
		if (!to.bytes && from.bytes) to.bytes = from.bytes
		if (!to.date && from.date) to.date = from.date
		if (!to.seeders && from.seeders) to.seeders = from.seeders
		return true
	})
	// results = _.orderBy(results, 'bytes', 'desc')

	return results
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	sorts = ['']
	concurrency = 1

	get slugs() {
		let slugs = [] as string[]
		if (this.item.movie) {
			slugs.push(`${this.item.movie.title} ${this.item.movie.year}`)
			if (this.rigorous && this.item.movie.belongs_to_collection) {
				let collection = this.item.movie.belongs_to_collection.name.split(' ')
				slugs.push(collection.slice(0, -1).join(' '))
			}
		}
		if (this.item.show) {
			let title = this.item.show.title
			if ((!this.item.S.n && !this.item.E.n) || this.rigorous) {
				slugs.push(title)
			}
			if (this.item.S.n) {
				slugs.push(`${title} s${this.item.S.z}`)
				this.rigorous && slugs.push(`${title} season ${this.item.S.n}`)
			}
			this.item.E.n && slugs.push(`${title} s${this.item.S.z}e${this.item.E.z}`)
		}
		return slugs.map(v => utils.toSlug(v))
	}

	constructor(public item: media.Item, public rigorous = false) {}

	async start() {
		let combinations = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs.forEach(slug => this.sorts.forEach(sort => combinations.push([slug, sort])))
		let results = (await pAll(
			combinations.map(([slug, sort]) => async () =>
				(await this.getResults(slug, sort)).map(result => ({
					providers: [this.constructor.name],
					slugs: [slug],
					...result,
				}))
			),
			{ concurrency: this.concurrency }
		)).flat()

		let seeders = results.map(v => v.seeders)
		let range = { min: _.min(seeders), max: _.max(seeders) }
		results.forEach(result => {
			result.score = _.round(utils.slider(result.seeders, range.min, range.max))
		})

		return results
	}
}

export interface Result {
	bytes: number
	date: number
	hash: string
	magnet: string
	name: string
	providers: string[]
	seeders: number
	score: number
	slugs: string[]
}

export interface MagnetQuery {
	dn: string
	tr: string[]
	xt: string
}
