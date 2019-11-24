import * as _ from 'lodash'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as schedule from 'node-schedule'
import { Db } from '@/adapters/db'
import { Http } from '@/adapters/http'

const db = new Db(__filename)
process.nextTick(async () => {
	// if (process.DEVELOPMENT) await db.flush()
	refresh(true)
})

const job = schedule.scheduleJob('0 * * * *', () =>
	refresh().catch(error => console.error(`tvdb refresh -> %O`, error)),
)

async function refresh(first = false) {
	let token = await db.get('token') as string
	if (token && first == true) return

}

export const client = new Http({
	baseUrl: 'https://api.thetvdb.com',
	query: { api_key: process.env.TMDB_KEY },
})
