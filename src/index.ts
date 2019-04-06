#!/usr/bin/env node

setInterval(Function, 1 << 30)
require('dotenv').config()
import 'node-env-dev'
import './devtools'
console.log(new Date().toLocaleTimeString())

import * as _ from 'lodash'
import * as prompts from 'prompts'
import * as getItem from './menus/get-item'
import * as scraper from './adapters/scraper'
import { Rarbg } from './scrapers/rarbg'

async function start() {
	console.log(`start`)
	// let item = await getItem.menu()
	// console.log(`item ->`, item)
	// let scraper = new Rarbg(item)
}
start().catch(error => console.error(`catch Error ->`, error))
