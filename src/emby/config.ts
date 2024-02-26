import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as normalize from 'normalize-url'
import * as os from 'os'
import * as path from 'path'
import * as Url from 'url-parse'
import validator from 'validator'

export async function config(silent: boolean) {
	if (!process.env.EMBY_API_KEY) {
		throw new Error(
			`Undefined EMBY_API_KEY -> https://github.com/MediaBrowser/Emby/wiki/Api-Key-Authentication#managing-api-keys`,
		)
	}

	let Info: SystemInfo
	let ports = _.uniq([process.env.EMBY_HTTP_PORT, '18096', '8096']).filter(Boolean)
	for (let port of ports) {
		try {
			Info = await http.client.get(`http://127.0.0.1:${port}/emby/System/Info`, {
				query: { api_key: process.env.EMBY_API_KEY },
				silent: true,
			})
			break
		} catch {}
	}
	if (!Info) throw new Error(`!SystemInfo -> Could not find emby server on any ports '${ports}'`)
	console.log('Info ->', Info)

	let wanip = new Url(Info.WanAddress).hostname
	if (validator.isIP(wanip)) {
		let addresses = Object.values(os.networkInterfaces()).map((v) => v.map((vv) => vv.address))
		let ips = addresses.flat().filter(Boolean)
		if (!ips.includes(wanip)) {
			throw new Error(`Info.WanAddress -> '${wanip}' != '${ips}'`)
		}
	}

	_.defaults(process.env, {
		EMBY_DATA_PATH: Info.ProgramDataPath,
		EMBY_HTTP_PORT: `${Info.HttpServerPortNumber}`,
		EMBY_LAN_ADDRESS: `http://127.0.0.1:${Info.HttpServerPortNumber}`,
		EMBY_PROXY_PORT: `${Info.HttpServerPortNumber + 3}`,
		EMBY_SERVER_ID: Info.Id,
		EMBY_WAN_ADDRESS: Info.WanAddress,
	} as Env)

	process.env.EMBY_DATA_PATH = path.normalize(process.env.EMBY_DATA_PATH)
	process.env.EMBY_LAN_ADDRESS = normalize(process.env.EMBY_LAN_ADDRESS)
	process.env.EMBY_WAN_ADDRESS = normalize(process.env.EMBY_WAN_ADDRESS)

	if (!silent) {
		console.info(
			`emby config ->`,
			Object.fromEntries(
				Object.entries(process.env).filter(
					([k]) => k.startsWith('EMBY_') && !k.includes('ADMIN') && !k.includes('KEY'),
				),
			),
		)
	}
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
