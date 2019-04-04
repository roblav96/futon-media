import * as _ from 'lodash'
import * as media from './media'
import * as http from './http'

export abstract class Scraper<Query extends object = any, Result = any> {
	// abstract url: string
	// abstract sorts: string[]

	get slugs() {
		let slugs = [`${this.item.full.ids.slug.replace(/[-]/g, ' ')}`]
		
		return slugs
	}

	constructor(public item: media.Item) {
		// console.log(`item ->`, item)
	}

	// abstract query(sort: string): Query
	// abstract results(response: any): Result[]
}

// export async function scrape(query: string) {
// 	let url = `https://theredbear.cc/searchZ?q=${query}`
// 	console.time(`content`)
// 	let content = await http.get(url)
// 	console.timeEnd(`content`)
// 	// let content = await puppeteer.getHTML(url)
// 	// console.log(`content ->`, content)
// }
