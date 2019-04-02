import * as puppeteer from 'puppeteer'

let browser: puppeteer.Browser
;(async function() {
	browser = await puppeteer.launch()
})()

export async function getHTML(url: string) {
	console.time(`getHTML`)
	let page = await browser.newPage()
	await page.goto(url)
	let content = await page.content()
	await browser.close()
	console.timeEnd(`getHTML`)
	return content
}
