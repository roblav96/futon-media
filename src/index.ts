#!/usr/bin/env node

require('source-map-support').install()
require('dotenv').config()
require('node-env-dev')
console.log(`new Date ->`, new Date().toLocaleTimeString())

import * as fs from 'fs-extra'
import * as path from 'path'
import * as got from 'got'
import * as prompts from 'prompts'
import * as dts from 'dts-generate'

async function start() {
	let mainmenu = await prompts.prompts.select({
		message: 'Cloud Provider',
		initial: 0,
		choices: [{ title: 'Real Debrid', value: '' }, { title: 'Premiumize', value: '' }],
	} as prompts.PromptObject)
	console.log(`mainmenu ->`, mainmenu)
}
start().catch(error => console.error(`catch Error ->`, error))
