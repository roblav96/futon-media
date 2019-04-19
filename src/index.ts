#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'
import { tailLogs } from '@/emby/tail-logs'

async function start() {
	if (process.env.NODE_ENV == 'development') {
		tailLogs()
	}
}
setTimeout(() => start().catch(error => console.error(`start Error ->`, error)), 1000)
