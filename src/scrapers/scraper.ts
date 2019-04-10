import * as _ from 'lodash'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as http from '../adapters/http'
import * as media from '../adapters/media'
import * as torrent from './torrent'
import * as filters from './filters'
import * as trackers from './trackers'
import * as utils from '../utils'
import * as Memoize from '../memoize'

export async function scrape(...[item, rigorous]: ConstructorParameters<typeof Scraper>) {
	let providers = [
		// (await import('./rarbg')).Rarbg,
		// (await import('./solidtorrents')).SolidTorrents,
		// (await import('./ytsam')).YtsAm,
		(await import('./eztv')).Eztv,
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
	results = _.orderBy(results, 'bytes', 'desc')

	return results
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
@Memoize.Class
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
			this.rigorous && slugs.push(title)
			if (this.item.season) {
				slugs.push(`${title} s${this.item.s00.z}`)
				this.rigorous && slugs.push(`${title} season ${this.item.s00.n}`)
				if (this.rigorous && this.item.episode) {
					slugs.push(`${title} s${this.item.s00.z}e${this.item.e00.z}`)
				}
			}
		}
		return slugs.map(v => utils.toSlug(v))
	}

	constructor(public item: media.Item, public rigorous = false) {}

	async start() {
		let combs = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs.forEach(slug => this.sorts.forEach(sort => combs.push([slug, sort])))
		let results = (await pAll(
			combs.map(([slug, sort]) => async () =>
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
