#!/usr/bin/env node

require('dotenv').config()
import 'node-env-dev'
import './devtools'
console.log(new Date().toLocaleTimeString())

import * as prompts from 'prompts'
import * as tmdb from './tmdb'
import * as trakt from './trakt'
import * as scraper from './scraper'
import * as media from './adapters/media'
import pDebounce from 'p-debounce'

async function start() {
	let item = (await prompts.prompts.autocomplete({
		message: 'Search Movies and TV Shows',
		suggest: pDebounce(async (query: string, choices: any[]) => {
			query = query.trim()
			if (query.length < 2) return []

			let response = (await trakt.http.get('/search/movie,show,episode', {
				query: { query },
			})) as trakt.Result[]
			let items = response
				.map(v => new media.Item(v))
				.sort((a, b) => b.full.votes - a.full.votes)
				.slice(0, 10)
			console.log(`items ->`, items.map(v => v.full))
			return items.map(item => ({
				title: `${item.full.year} ${item.full.title}`,
				value: item,
			}))
		}, 100) as any,
	} as prompts.PromptObject)) as media.Item
	if (!item) throw new Error('Unselected media item')

	// let query = await prompts.prompts.text({
	// 	initial: 'game thrones s02',
	// 	message: 'Search Movies and TV Shows',
	// } as prompts.PromptObject) as any as string
	// console.log(`query ->`, query)
	// let results = await scraper.scrape(query)
	// // console.log(`results ->`, results)
}
start().catch(error => console.error(`catch Error ->`, error))
