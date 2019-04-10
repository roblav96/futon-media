import * as _ from 'lodash'
import * as pAll from 'p-all'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as http from '../adapters/http'
import * as media from '../adapters/media'
import * as torrent from './torrent'
import * as utils from '../utils'
import * as Memoize from '../memoize'

export async function scrape(...[item, rigorous]: ConstructorParameters<typeof Scraper>) {
	let scrapers = [
		(await import('./rarbg')).Rarbg,
		// (await import('./solidtorrents')).SolidTorrents,
	] as typeof Scraper[]
	let results = (await pAll(
		scrapers.map(scraper => () => new scraper(item, rigorous).scrape())
	)).flat()
	results = results.filter(result => {
		// if (utils.accuracy(item.slugs, result.name).length > 0) {
		// 	console.warn(
		// 		`accuracy.length ->`,
		// 		result.name,
		// 		utils.accuracy(slugIds.mSlug, result.name)
		// 	)
		// 	return false
		// }
		result.hash = magneturi.decode(result.magnet).infoHash.toLowerCase()
		return
	})
	results = _.uniqWith(results, (from, to) => {
		if (from.hash != to.hash) {
			return false
		}
	})
	return results
}

export interface Scraper {
	sorts: string[]
	getResults(slug: string, sort: string): Promise<Result[]>
}
@Memoize.Class
export class Scraper<Query = any, Result = any> {
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

	async scrape() {
		let combs = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs.forEach(slug => this.sorts.forEach(sort => combs.push([slug, sort])))
		let results = (await pAll(combs.map(args => () => this.getResults(...args)), {
			concurrency: this.concurrency,
		})).flat()
		results.forEach(result => {
			result.providers = [this.constructor.name]
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
}
