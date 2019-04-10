#!/usr/bin/env node

setInterval(Function, 1 << 30)
require('dotenv').config()
import 'node-env-dev'
import './devtools'

import * as _ from 'lodash'
import * as memoize from 'mem'
import * as items from './items'
import * as getItem from './menus/get-item'
import * as media from './adapters/media'
import * as scraper from './scrapers/scraper'
import * as Memoize from './memoize'

async function start() {
	let item = new media.Item(items.MOVIE)
	// let item = new media.Item(items.EPISODE)
	// let item = await getItem.menu()
	// console.log(`item ->`, item)
	let results = await scraper.scrape(item)
	// console.log(`results ->`, results)
}
start().catch(error => console.error(`start Error ->`, error))
