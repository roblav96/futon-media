#!/usr/bin/env node

require('dotenv').config()
import 'node-env-dev'
import './devtools'
console.log(new Date().toLocaleTimeString())

import * as _ from 'lodash'
import * as prompts from 'prompts'
import { Http } from './adapters/http'
// import * as getItem from './menus/get-item'
// import * as scraper from './adapters/scraper'
// import * as utils from './utils'
// import { Rarbg } from './scrapers/rarbg'

async function start() {
	let http = new Http({
		baseUrl: 'https://httpbin.org/',
	})
	let response = await http.get(`/status/400`, {
		query: {},
		verbose: true,
	})
	console.info(`response ->`, response)
	// let item = await getItem.menu()
	// let scraper = new Rarbg(item)
}
start().catch(error => console.error(`catch Error ->`, error))
