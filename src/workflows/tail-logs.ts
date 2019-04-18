import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as qs from 'query-string'
import * as httpie from 'httpie'
import { Tail } from 'tail'
import * as utils from '@/utils/utils'
import * as emby from '@/adapters/emby'
import { LINE } from '@/dev/mocks'

export async function tail() {
	return onLine(LINE)
	let { LogPath } = await emby.client.get('/System/Info', { verbose: true })
	let stream = new Tail(path.join(LogPath, 'embyserver.txt'), {
		follow: true,
		separator: /\n\d{4}-\d{2}-\d{2}\s/,
		useWatchFile: true,
	})
	stream.on('line', onLine)
	stream.on('error', error => console.error(`tail Error ->`, error))
}

function onLine(line: string) {
	line = _.trim(line)
	if (!line.match(/Info HttpServer: HTTP [GP]/)) return
	let fullurl = (line.match(/\b\s(http.*)\.\s\b/) || [])[1] as string
	if (!fullurl) return
	let { url, query } = qs.parseUrl(fullurl)
	let split = url.split('/')
	if (split.pop() != 'PlaybackInfo') return
	console.log(`line ->`, line)
	onPlaybackInfo({ ...query, ItemId: split.pop() } as any).catch(function(error) {
		console.error(`onPlaybackInfo Error ->`, error)
	})
}

async function onPlaybackInfo({ ItemId, MediaSourceId, UserId }: Record<string, string>) {
	console.warn(`PlaybackInfo ->`)
	console.log(`ItemId ->`, ItemId)
	console.log(`MediaSourceId ->`, MediaSourceId)
	console.log(`UserId ->`, UserId)

	let eitem = await emby.client.get(`/Users/${UserId}/Items/${ItemId}`, {
		debug: true,
		// verbose: true,
	})
	console.log(`eitem ->`, eitem)

	// let response = await httpie.get(`${process.env.EMBY_API_URL}/emby/Users/${UserId}/Items/${ItemId}?api_key=${process.env.EMBY_API_KEY}`)
	// console.log(`response ->`, response)

	// let response = await ky.get(`Users/${UserId}/Items/${ItemId}`, {
	// 	prefixUrl: `${process.env.EMBY_API_URL}/emby/`,
	// 	searchParams: {
	// 		api_key: process.env.EMBY_API_KEY,
	// 	},
	// }).json()
	// console.log(`response ->`, response)
}
