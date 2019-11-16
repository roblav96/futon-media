import * as _ from 'lodash'
import * as http from '@/adapters/http'

export const client = new http.Http({
	baseUrl: `${process.env.EMBY_LAN_ADDRESS}/emby`,
	query: { api_key: process.env.EMBY_API_KEY },
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
