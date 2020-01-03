import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as http from '@/adapters/http'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: `${process.env.EMBY_LAN_ADDRESS}/emby`,
	query: { api_key: process.env.EMBY_API_KEY },
})

process.nextTick(async () => {
	let Configuration = (await emby.client.get('/System/Configuration', {
		silent: true,
	})) as emby.SystemConfiguration
	let body = {} as emby.SystemConfiguration
	let delay = utils.duration(1, 'month') / 1000
	if (Configuration.LibraryMonitorDelay != delay) {
		body.LibraryMonitorDelay = delay
	}
	if (Configuration.EnableDebugLevelLogging != true) {
		body.EnableDebugLevelLogging = true
	}
	if (!_.isEmpty(body)) {
		await emby.client.post('/System/Configuration', {
			body: _.merge(Configuration, body),
			query: { api_key: process.env.EMBY_ADMIN_TOKEN },
			silent: true,
		})
		console.warn(`EmbyServer restart required! SystemConfiguration modified ->`, body)
	}
})

export * from '@/emby/config'
export * from '@/emby/emby/defaults'
export * from '@/emby/emby/library'
export * from '@/emby/emby/metadata'
export * from '@/emby/emby/playbackinfo'
export * from '@/emby/emby/sessions'
export * from '@/emby/emby/socket'
export * from '@/emby/emby/tail'
export * from '@/emby/emby/users'

if (process.DEVELOPMENT) {
	process.nextTick(async () => ((global as any).emby = await import('@/emby/emby')))
}
