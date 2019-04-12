#!/usr/bin/env node

setInterval(Function, 1 << 30)
import 'dotenv/config'
import 'node-env-dev'
import './dev/devtools'
import * as _ from 'lodash'
import * as media from './media/media'
import * as scraper from './scrapers/scraper'
import * as torrent from './scrapers/torrent'
import { realdebrid } from './debrids/realdebrid'
import { MOVIE, SHOW, SEASON, EPISODE } from './dev/items'
import { searchItem } from './prompts/search-item'

async function start() {
	let item = new media.Item(SEASON)
	// let item = await searchItem()
	// console.log(`item ->`, item)
	let results = await scraper.scrapeAll(item)
	let hashes = results.map(v => v.hash)
	let cache = await realdebrid.checkCache(hashes)
	console.log(`cache ->`, cache)
	// let torrents = results.map(v => new torrent.Torrent(v))
	// console.log(`torrents ->`, torrents)
	// console.log(`torrents.length ->`, torrents.length)
}
start().catch(error => console.error(`start Error ->`, error))
