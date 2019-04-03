#!/usr/bin/env node

require('dotenv').config()
import 'node-env-dev'
import './devtools'
console.log(new Date().toLocaleTimeString())

import * as _ from 'lodash'
import * as prompts from 'prompts'
import * as getItem from './menus/get-item'
import * as scrapers from './adapters/scrapers'
import { SolidTorrents } from './scrapers/solidtorrents'

async function start() {
	let item = await getItem.menu()
	console.log(`item ->`, item)
	let scraper = new SolidTorrents(item)
	// console.log(`scraper ->`, scraper)
}
start().catch(error => console.error(`catch Error ->`, error))
