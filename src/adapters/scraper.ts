import * as _ from 'lodash'
import * as pAll from 'p-all'
import * as http from './http'
import * as media from './media'
import * as utils from '../utils'
import { Torrent } from './torrent'

export async function scrape(...args: ConstructorParameters<typeof Scraper>) {
	let { Rarbg } = await import('../scrapers/rarbg')
	let scrapers = [Rarbg]
	let torrents = await pAll(scrapers.map(scraper => () => new scraper(...args).scrape()))
	return torrents
}

export interface Scraper {
	sorts: string[]
	concurrency: number
	getTorrents(slug: string, sort: string): Promise<Torrent[]>
}
export class Scraper<Query = any, Result = any> {
	sorts = ['']
	concurrency = this.sorts.length

	get ids() {
		return this.item.show ? this.item.show.ids : this.item.ids
	}

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
		return slugs.map(utils.toSlug)
	}

	constructor(public item: media.Item, public rigorous = false) {}

	async scrape() {
		let combinations = [] as Parameters<typeof Scraper.prototype.getTorrents>[]
		this.slugs.forEach(slug => this.sorts.forEach(sort => combinations.push([slug, sort])))
		let torrents = (await pAll(combinations.map(args => () => this.getTorrents(...args)), {
			concurrency: this.concurrency,
		})).flat()
		torrents.forEach(v => {
			v.providers.push(this.constructor.name)
		})
		return torrents
	}
}
