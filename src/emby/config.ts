import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as normalize from 'normalize-url'
import * as Url from 'url-parse'
import lang from '@/lang/en-US'

export async function setup() {
	if (!process.env.EMBY_API_KEY) throw new Error(lang['!process.env.EMBY_API_KEY'])
	if (!process.env.EMBY_REMOTE_WAN) throw new Error(lang['!process.env.EMBY_REMOTE_WAN'])

	process.env.EMBY_REMOTE_WAN = normalize(process.env.EMBY_REMOTE_WAN)
	if (process.env.PROXY_PORT) return

	let Info = (await http.client.get(`${process.env.EMBY_REMOTE_WAN}/emby/System/Info`, {
		query: { api_key: process.env.EMBY_API_KEY },
		silent: true,
	})) as SystemInfo
	process.env.PROXY_PORT = `${Info.HttpServerPortNumber + 3}`

	// let url = Url(process.env.EMBY_REMOTE_WAN)
	// let port = _.parseInt(url.port) || (url.protocol == 'https:' && 443) || 80
	// process.env.PROXY_PORT = `${port + 3}`
}

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

export interface SystemConfiguration {
	AutoRunWebApp: boolean
	CachePath: string
	CertificatePath: string
	CollapseVideoFolders: boolean
	DisplaySpecialsWithinSeasons: boolean
	EnableAutomaticRestart: boolean
	EnableAutoUpdate: boolean
	EnableCaseSensitiveItemIds: boolean
	EnableDashboardResponseCaching: boolean
	EnableDebugLevelLogging: boolean
	EnableExternalContentInSuggestions: boolean
	EnableHttps: boolean
	EnableOriginalTrackTitles: boolean
	EnableRemoteAccess: boolean
	EnableUPnP: boolean
	HttpServerPortNumber: number
	HttpsPortNumber: number
	ImageExtractionTimeoutMs: number
	ImageSavingConvention: string
	IsBehindProxy: boolean
	IsPortAuthorized: boolean
	IsRemoteIPFilterBlacklist: boolean
	IsStartupWizardCompleted: boolean
	LibraryMonitorDelay: number
	LocalNetworkAddresses: string
	LocalNetworkSubnets: string
	LogAllQueryTimes: boolean
	LogFileRetentionDays: number
	MetadataCountryCode: string
	MetadataNetworkPath: string
	MetadataPath: string
	PathSubstitutions: string
	PreferredMetadataLanguage: string
	PublicHttpsPort: number
	PublicPort: number
	RemoteClientBitrateLimit: number
	RemoteIPFilter: string
	RequireHttps: boolean
	RunAtStartup: boolean
	SaveMetadataHidden: boolean
	SchemaVersion: number
	ServerName: string
	SkipDeserializationForBasicTypes: boolean
	SortRemoveCharacters: {
		string: string[]
	}
	SortRemoveWords: {
		string: string[]
	}
	SortReplaceCharacters: {
		string: string[]
	}
	SubtitlePermissionsUpgraded: boolean
	UICulture: string
	UninstalledPlugins: {
		string: string[]
	}
	WanDdns: string
}

export interface SystemXml {
	ServerConfiguration: SystemConfiguration
}

export interface SystemLog {
	DateCreated: string
	DateModified: string
	Name: string
	Size: number
}
