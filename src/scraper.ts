import * as _ from 'lodash'
import * as puppeteer from './adapters/puppeteer'
import http from './http'

export async function scrape(query: string) {
	let url = `https://theredbear.cc/searchZ?q=${query}`
	console.time(`content`)
	let content = await http.get(url)
	console.timeEnd(`content`)
	// let content = await puppeteer.getHTML(url)
	// console.log(`content ->`, content)
}
