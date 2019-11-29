import * as _ from 'lodash'
import * as getStream from 'get-stream'
import * as Json from '@/shims/json'
import * as media from '@/media/media'
import * as pEvent from 'p-event'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as utils from '@/utils/utils'
import * as xmljs from 'xml-js'
import * as yauzl from 'yauzl'
import axios from 'axios'
import { Db } from '@/adapters/db'
import { Http } from '@/adapters/http'
import { Readable } from 'stream'

const db = new Db(__filename)
process.nextTick(async () => {
	// if (process.DEVELOPMENT) await db.flush()
	await refresh(true)
	schedule.scheduleJob('0 * * * *', () =>
		refresh().catch(error => console.error(`tvdb refresh -> %O`, error)),
	)
})

async function refresh(first = false) {
	let token = (await db.get('token')) as string
	if (token && first == true) return
	let response = (await client.post('https://api.thetvdb.com/login', {
		body: { apikey: process.env.TVDB_KEY },
		retries: [500, 503],
		silent: true,
	})) as { token: string }
	await db.put('token', response.token)
	client.config.headers['authorization'] = `Bearer ${response.token}`
}

export const client = new Http({
	baseUrl: 'https://api.thetvdb.com',
	headers: { 'accept-language': 'en' },
})

export async function getAll(tvdbid: string) {
	let t = Date.now()

	let response = await client.request({
		url: `https://thetvdb.com/api/${process.env.TVDB_KEY}/series/${tvdbid}/all/en.zip`,
		// memoize: true,
	})
	console.log(`response ->`, response)
	let stringified = Json.stringify(response)
	console.log('stringified ->', stringified)
	let parsed = Json.parse(stringified)
	console.log('parsed ->', parsed)

	// let zipfile = (await new Promise((resolve, reject) =>
	// 	yauzl.fromBuffer(response.data, (error, zipfile) =>
	// 		error ? reject(error) : resolve(zipfile),
	// 	),
	// )) as yauzl.ZipFile
	// let iterator = pEvent.iterator(zipfile, 'entry', {
	// 	resolutionEvents: ['end'],
	// }) as AsyncIterableIterator<yauzl.Entry>
	// for await (let entry of iterator) {
	// 	// if (!entry.fileName.includes('en')) continue
	// 	let readable = (await new Promise((resolve, reject) =>
	// 		zipfile.openReadStream(entry, (error, readable) =>
	// 			error ? reject(error) : resolve(readable),
	// 		),
	// 	)) as Readable
	// 	let json = fastParse(
	// 		xmljs.xml2json(await getStream(readable), {
	// 			compact: true,
	// 			nativeType: true,
	// 			// ignoreText: true,
	// 			// textKey: '_text',
	// 		}),
	// 	).value
	// 	console.log(`${entry.fileName} json ->`, json)
	// }

	console.log(Date.now() - t, `tvdb.getAll`)
}
