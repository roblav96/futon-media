import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as http from '@/adapters/http'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: `${process.env.EMBY_LAN_ADDRESS}/emby`,
	query: { api_key: process.env.EMBY_API_KEY },
})

process.nextTick(async () => {
	let SystemConfiguration = (await emby.client.get('/System/Configuration', {
		silent: true,
	})) as emby.SystemConfiguration
	let body = {} as emby.SystemConfiguration
	if (SystemConfiguration.LibraryMonitorDelay != 3600) {
		body.LibraryMonitorDelay = 3600
	}
	if (SystemConfiguration.EnableDebugLevelLogging != true) {
		body.EnableDebugLevelLogging = true
	}
	if (!_.isEmpty(body)) {
		await emby.client.post('/System/Configuration', {
			body: _.merge(SystemConfiguration, body),
			query: { api_key: process.env.EMBY_ADMIN_TOKEN },
			silent: true,
		})
		throw new Error(`EmbyServer restart required!`)
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
// export * from '@/emby/emby/tshark'
export * from '@/emby/emby/users'

if (process.env.NODE_ENV == 'development') {
	process.nextTick(async () => ((global as any).emby = await import('@/emby/emby')))
}
