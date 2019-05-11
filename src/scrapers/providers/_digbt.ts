// import * as _ from 'lodash'
// import * as cheerio from 'cheerio'
// import * as Cloudscraper from 'cloudscraper'
// import * as http from '@/adapters/http'
// import * as puppeteer from 'puppeteer'
// import * as qs from 'query-string'
// import * as scraper from '@/scrapers/scraper'
// import * as Url from 'url-parse'
// import * as utils from '@/utils/utils'

// export const client = scraper.Scraper.http({
// 	baseUrl: 'https://www.digbt.org',
// })

// export class Digbt extends scraper.Scraper {
// 	/** size, date, seeders */
// 	sorts = ['size' /** , 'id', 'seeders' */]
// 	concurrency = 1

// 	slugs() {
// 		return super.slugs().slice(0, 1)
// 	}

// 	async getResults(slug: string, sort: string) {
// 		let url = `https://www.digbt.org/search/${encodeURI(slug)}-length-1/`
// 		console.log(`Digbt getResults ->`, url)
// 		let response = await cloudscrape(url)
// 		let results = [] as scraper.Result[]
// 		return results
// 	}
// }

// const cloudscraper = Cloudscraper.defaults({
// 	onCaptcha,
// 	headers: { 'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)' },
// })

// async function onCaptcha(options, response: http.HttpieResponse) {
// 	console.log(`alternative options ->`, options)
// 	console.log(`alternative response ->`, response)
// 	throw new Error(`DEV`)
// }

// export async function cloudscrape(url: string) {
// 	try {
// 		let response = await cloudscraper({ method: 'GET', url })
// 		console.log(`response ->`, response)
// 	} catch (error) {
// 		console.error(`cloudscraper -> %O`, error)
// 	}
// 	// url = 'https://browserleaks.com/ip'
// 	// let browser = await puppeteer.launch()
// 	// console.log(`userAgent 1 ->`, await browser.userAgent())
// 	// let page = await browser.newPage()
// 	// await page.setUserAgent('Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)')
// 	// console.log(`userAgent 2 ->`, await browser.userAgent())
// 	// await page.goto(url)
// 	// console.log(`userAgent 3 ->`, await browser.userAgent())
// 	// // await page.waitForNavigation()
// 	// await page.screenshot({ path: `${new Url(url).hostname}.png` })
// 	// console.log(`userAgent 4 ->`, await browser.userAgent())
// 	// await browser.close()
// }

// interface Query {
// 	search: string
// 	sort: string
// }
