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

	get queries() {
		let title = `${this.item.full.title} ${this.item.full.year}`
		if (this.item.show) {
			title = this.item.show.title
		}
		return [title]

		// if (this.item.movie) {
		// 	title += `${this.item.movie.year}`
		// }
		// return [title]
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
	slugs: string[]
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
