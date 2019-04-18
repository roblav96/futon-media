#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'
import * as _ from 'lodash'
import * as prompts from 'prompts'
import * as utils from '@/utils/utils'
import { scrape } from '@/workflows/scrape'
import { playlists } from '@/workflows/playlists'
import { listen } from '@/workflows/websocket'
import { watch } from '@/workflows/tail-logs'

async function start() {
	if (process.env.NODE_ENV == 'development') {
		return
		// return await scrape()
		return await playlists()
	}

	let workflow = ((await prompts.prompts.select({
		message: 'Select workflow',
		initial: 1,
		choices: [
			{ title: 'Search movies and tv shows', value: scrape },
			{ title: 'Create playlist via Trakt list', value: playlists },
		] as any[],
	} as prompts.PromptObject)) as any) as Function
	if (!workflow) {
		throw new Error('Unselected workflow')
	}
	await workflow()
}
setTimeout(() => {
	// listen()
	watch().catch(error => console.error(`tail Error ->`, error))
	start().catch(error => console.error(`start Error ->`, error))
}, 1000)
