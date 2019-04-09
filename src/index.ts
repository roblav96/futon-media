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
import * as scraper from './adapters/scraper'
import * as Memoize from './memoize'

async function start() {
	let movie = new media.Item(items.MOVIE)
	console.log(`movie ->`, movie)
	console.log(`movie.full.title ->`, movie.full.title)
	console.log(`movie.count ->`, movie.count)
	console.log(`movie.count ->`, movie.count)
	Memoize.clear(movie)
	console.log(`movie.count ->`, movie.count)
	console.log(`movie.count ->`, movie.count)
	let show = new media.Item(items.SHOW)
	console.log(`show ->`, show)
	console.log(`show.full.title ->`, show.full.title)
	console.log(`show.count ->`, show.count)
	console.log(`show.count ->`, show.count)
	Memoize.clear(show)
	console.log(`show.count ->`, show.count)
	console.log(`show.count ->`, show.count)
	let item = await getItem.menu()
	console.log(`item ->`, item)
	console.log(`item.type ->`, item.type)
	console.log(`item.e00 ->`, item.e00)
	console.log(`item.full.title ->`, item.full.title)
	console.log(`item.count ->`, item.count)
	console.log(`item.count ->`, item.count)
	Memoize.clear(item)
	console.log(`item.count ->`, item.count)
	console.log(`item.count ->`, item.count)
	// let torrents = await scraper.scrape(item)
	// console.log(`torrents ->`, torrents)
}
start().catch(error => console.error(`start Error ->`, error))
