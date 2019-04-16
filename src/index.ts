#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'
import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as dayjs from 'dayjs'
import * as mocks from '@/dev/mocks'
import * as utils from '@/utils/utils'
import * as media from '@/media/media'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as debrid from '@/debrids/debrid'
import * as emby from '@/adapters/emby'
import { searchItem } from '@/prompts/search-item'
import { selectTorrent } from '@/prompts/select-torrent'

async function start() {
	let item = new media.Item(mocks.EPISODES['game-of-thrones'])
	// let item = await searchItem()
	// return console.log(`item ->`, item)

	let torrents = await scraper.scrapeAll(item)
	console.log(`torrents ->`, torrents .map(v => v.json()))
	return
	// torrents = torrents.filter(v => v.cached.length > 0)

	let torrent = await selectTorrent(torrents)
	console.log(`torrent ->`, torrent)

	let service = torrent.cached[0] || (debrid.entries[0][0] as debrid.Debrids)
	let links = await debrid.debrids[service].links(torrent.magnet)
	console.log(`links ->`, links)
	if (links.length == 0) {
		return console.warn(`links.length == 0`)
	}
	await emby.addLinks(item, links)
	await emby.refreshLibrary()

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
