import '@/mocks/mocks'
import * as _ from 'lodash'
import * as http from '@/adapters/http'

export const env = {
	ADMIN_ID: process.env.EMBY_ADMIN_USER_ID,
	ADMIN_KEY: process.env.EMBY_ADMIN_USER_TOKEN,
	HOST: process.env.EMBY_HOST,
	KEY: process.env.EMBY_API_KEY,
	PORT: _.parseInt(process.env.EMBY_PORT),
	PROTO: process.env.EMBY_PROTO,
	PROXY_PORT: process.env.EMBY_PROXY_PORT,
	STRM_PORT: process.env.EMBY_STRM_PORT,
	URL: `${process.env.EMBY_PROTO}//${process.env.EMBY_HOST}:${process.env.EMBY_PORT}`,
}

export const client = new http.Http({
	baseUrl: `${env.URL}/emby`,
	query: { api_key: env.KEY },
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
