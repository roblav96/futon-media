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
import * as debrid from '@/debrids/debrid'
import * as prompts from '@/prompts/prompts'

async function start() {
	let item = new media.Item(mocks.SHOWS['the-big-bang-theory'])
	// let item = await prompts.searchItem()
	// return console.log(`item ->`, item)

	let results = await scraper.scrapeAll(item)
	console.log(`results.length ->`, results.length)
	// let torrents = results.map(v => new torrent.Torrent(v))

	// let table = new Table({
	// 	style: { compact: true },
	// })
	// results.forEach(v => table.push([v.date, v.bytes, v.name]))
	// let split = table.toString().split('\n')
	// let output = split.slice(1, -1).join('\n')

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
