#!/usr/bin/env node

setInterval(Function, 1 << 30)
import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'
import * as _ from 'lodash'
import * as Table from 'cli-table3'
import * as mocks from '@/dev/mocks'
import * as media from '@/media/media'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as prompts from '@/prompts/prompts'

async function start() {
	let item = new media.Item(mocks.MOVIES['the-lego-movie-2014'])
	// let item = await prompts.searchItem()
	// return console.log(`item ->`, item)

	let torrents = await scraper.scrapeAll(item)
	// console.log(`torrents ->`, torrents)
	console.log(`torrents.length ->`, torrents.length)

	let widths = [8, 10, 15]
	let swidth = process.stdout.columns - _.sum(widths) - widths.length * 2
	let table = new Table({
		colAligns: ['left'].concat(widths.map(v => 'right')) as any[],
		colWidths: [swidth + 1].concat(widths),
		style: { compact: true },
	})
	torrents.forEach(v => table.push([v.name, v.ttycache, v.size, v.age] as any))
	let split = table.toString().split('\n')
	let output = split.slice(1, -1).join('\n')
	process.stdout.write(`${output}\n\n`)

	// let data = results.map(v => [v.name, v.bytes])
	// console.log(`data ->`, data[0])
	// return
	// console.log(`table.toString() ->`, `\n${output}`)
	// console.log(`process.stdout.columns ->`, process.stdout.columns)
	// console.log(`results ->`, results)
	// let hashes = results.map(v => v.hash)
	// let cache = await debrid.premiumize.check(hashes)
	// console.log(`cache ->`, cache)
	// let torrents = results.map(v => new torrent.Torrent(v))
	// console.log(`torrents ->`, torrents)
	// console.log(`torrents.length ->`, torrents.length)
}
start().catch(error => console.error(`start Error ->`, error))
