#!/usr/bin/env node

setInterval(Function, 1 << 30)
require('dotenv').config()
import 'node-env-dev'
import './devtools'
console.log(new Date().toLocaleTimeString())

import * as _ from 'lodash'
import * as items from './items'
import * as getItem from './menus/get-item'
import * as media from './adapters/media'
import * as scraper from './adapters/scraper'
import { Rarbg } from './scrapers/rarbg'

async function start() {
	// let item = items.EPISODE
	let item = await getItem.menu()
	console.log(`item ->`, item)
	let scraper = new Rarbg(item)
}
start().catch(error => console.error(`start Error ->`, error))
