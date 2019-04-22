import * as http from '@/adapters/http'

export const client = new http.Http({
	baseUrl: `${process.env.EMBY_API_URL}/emby`,
	query: {
		api_key: process.env.EMBY_API_KEY,
	},
})

export * from '@/emby/library'
export * from '@/emby/playback'
export * from '@/emby/playlists'
export * from '@/emby/sessions'
export * from '@/emby/socket'
export * from '@/emby/strm-files'
export * from '@/emby/tail-logs'
