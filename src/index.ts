#!/usr/bin/env node

require('dotenv').config()
import 'node-env-dev'
import './devtools'
console.log(new Date().toLocaleTimeString())

import * as _ from 'lodash'
import * as prompts from 'prompts'
import * as getItem from './menus/get-item'
import * as scraper from './adapters/scraper'
import * as utils from './utils'
import { Rarbg } from './scrapers/rarbg'

async function start() {
	let item = await getItem.menu()
	let scraper = new Rarbg(item)
}
start().catch(error => console.error(`catch Error ->`, error))
