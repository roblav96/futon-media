import * as _ from 'lodash'
import * as rx from 'rxjs'
import * as http from './http'
import * as media from './media'
import * as utils from '../utils'
import { Rarbg } from '../scrapers/rarbg'

export abstract class Scraper<Query = any, Result = any> {
	// abstract sorts: string[]
	// abstract query(sort: string): Query
	// abstract results(response: any): Result[]

	static scrapers = [Rarbg]

	get ids() {
		return this.item.show ? this.item.show.ids : this.item.ids
	}

	get queries() {
		let queries = [] as string[]
		if (this.item.movie) {
			queries.push(`${this.item.movie.title} ${this.item.movie.year}`)
			if (this.item.movie.belongs_to_collection) {
				let collection = this.item.movie.belongs_to_collection.name.split(' ')
				queries.push(collection.slice(0, -1).join(' '))
			}
		}
		if (this.item.show) {
			let title = this.item.show.title
			queries.push(title)
			this.item.s00 && queries.push(`${title} s${this.item.s00.z}`)
			if (this.item.s00) {
				queries.push(`${title} s${this.item.s00.z}`)
				if (this.item.e00) {
					queries.push(`${title} s${this.item.s00.z}e${this.item.e00.z}`)
				}
			}
		}
		return queries.map(utils.toSlug)
	}

	constructor(public item: media.Item) {
		// this.scrape()
	}

	// abstract async scrape(): Promise<Torrent[]>
}

export type Debrid = 'realdebrid' | 'premiumize'

export interface Torrent {
	bytes: number
	cached: Debrid[]
	date: number
	files: File[]
	hash: string
	magnet: string
	name: string
	providers: string[]
	seeders: number
}

export interface File {
	accuracy: string[]
	bytes: number
	leven: number
	name: string
	path: string
	slug: string
	url: string
}

export interface MagnetQuery {
	dn: string
	tr: string[]
	xt: string
}

// export async function scrape(query: string) {
// 	let url = `https://theredbear.cc/searchZ?q=${query}`
// 	console.time(`content`)
// 	let content = await http.get(url)
// 	console.timeEnd(`content`)
// 	// let content = await puppeteer.getHTML(url)
// 	// console.log(`content ->`, content)
// }
