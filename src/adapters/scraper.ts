import * as _ from 'lodash'
import * as rx from 'rxjs'
import * as http from './http'
import * as media from './media'
import * as utils from '../utils'
import { Rarbg } from '../scrapers/rarbg'

export abstract class Scraper<Query extends object = any, Result = any> {
	static scrapers = [Rarbg]

	get slugs() {
		// let title = this.item.movie ? (this.item.movie.title + ' ' + this.item.movie.year) : ()
		return []
		
		// if (this.item.movie) {
		// 	title += `${this.item.movie.year}`
		// }
		// return [title]
	}

	constructor(public item: media.Item) {
		this.scrape()
	}

	abstract scrape(): void
	// abstract query(sort: string): Query
	// abstract results(response: any): Result[]
}

export type Debrid = 'realdebrid' | 'premiumize'

export interface Torrent {
	bytes: number
	cached: Debrid[]
	date: number
	// files: File[]
	hash: string
	hd: boolean
	magnet: string
	name: string
	providers: string[]
	sd: boolean
	seeders: number
	slugs: string[]
	uhd: boolean
}

// export async function scrape(query: string) {
// 	let url = `https://theredbear.cc/searchZ?q=${query}`
// 	console.time(`content`)
// 	let content = await http.get(url)
// 	console.timeEnd(`content`)
// 	// let content = await puppeteer.getHTML(url)
// 	// console.log(`content ->`, content)
// }
