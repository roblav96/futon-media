import * as _ from 'lodash'
import * as http from '@/adapters/http'

export const HOST = process.env.EMBY_API_HOST || '127.0.0.1'
export const DOMAIN = `${process.DEVELOPMENT ? 'http' : 'https'}://${HOST}`
export const PORT = _.parseInt(process.env.EMBY_API_PORT) || 8096
export const STRM_PORT = PORT + 3

export const client = new http.Http({
	baseUrl: `${DOMAIN}:${PORT}/emby`,
	query: { api_key: process.env.EMBY_API_KEY },
})

export * from '@/emby/emby/defaults'
export * from '@/emby/emby/library'
export * from '@/emby/emby/sessions'
export * from '@/emby/emby/socket'
export * from '@/emby/emby/tail'
export * from '@/emby/emby/users'

export interface SystemInfo {
	CachePath: string
	CanLaunchWebBrowser: boolean
	CanSelfRestart: boolean
	CanSelfUpdate: boolean
	CompletedInstallations: any[]
	HardwareAccelerationRequiresPremiere: boolean
	HasPendingRestart: boolean
	HasUpdateAvailable: boolean
	HttpServerPortNumber: number
	HttpsPortNumber: number
	Id: string
	InternalMetadataPath: string
	IsShuttingDown: boolean
	ItemsByNamePath: string
	LocalAddress: string
	LogPath: string
	OperatingSystem: string
	OperatingSystemDisplayName: string
	ProgramDataPath: string
	ServerName: string
	SupportsAutoRunAtStartup: boolean
	SupportsHttps: boolean
	SupportsLibraryMonitor: boolean
	SystemUpdateLevel: string
	TranscodingTempPath: string
	Version: string
	WanAddress: string
	WebSocketPortNumber: number
}

export interface SystemLog {
	DateCreated: string
	DateModified: string
	Name: string
	Size: number
}
