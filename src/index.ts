#!/usr/bin/env node

require('source-map-support').install()
require('dotenv').config()
require('node-env-dev')
console.log(`new Date ->`, new Date().toLocaleTimeString())

import './devtools'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as got from 'got'
import * as prompts from 'prompts'
import * as R from 'rambdax'
import * as S from 'string-fn'
import * as dts from 'dts-generate'
import * as tmdb from './tmdb'

async function start() {
	let item = await prompts.prompts.autocomplete({
		message: 'Search Movies and TV Shows',
		suggest: (async (query: string, choices: string[]) => {
			if (query.length <= 2) return []
			let response = await tmdb.http('/3/search/multi', { query: { query } })
			let results = JSON.parse(response.body).results
			console.log(`results ->`, results)
			return []
		}) as any,
	} as prompts.PromptObject)
}
start().catch(error => console.error(`catch Error ->`, error))
