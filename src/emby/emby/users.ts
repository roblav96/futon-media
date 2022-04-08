import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as schedule from 'node-schedule'
import * as utils from '@/utils/utils'

export class User {
	static async get() {
		return ((await emby.client.get('/Users', { silent: true })) as User[]).map(
			(v) => new User(v),
		)
	}
	static async byUserId(UserId: string) {
		return new User(await emby.client.get(`/Users/${UserId}`, { silent: true }))
	}

	get Stamp() {
		return new Date(this.LastActivityDate).valueOf()
	}

	constructor(User: User) {
		_.merge(this, User)
	}

	async getDisplayPreferences(client = 'emby' as 'emby' | 'ATV') {
		return (await emby.client.get(`/DisplayPreferences/usersettings`, {
			query: { client, userId: this.Id },
		})) as UserDisplayPreferences
	}
	async setDisplayPreferences(DisplayPreferences: UserDisplayPreferences) {
		if (!process.env.EMBY_ADMIN_TOKEN) throw new Error(`Missing EMBY_ADMIN_TOKEN`)
		await emby.client.post(`/DisplayPreferences/usersettings`, {
			query: { client: 'emby', userId: this.Id, api_key: process.env.EMBY_ADMIN_TOKEN },
			body: DisplayPreferences,
		})
	}
	async setConfiguration(Configuration: UserConfiguration) {
		if (!process.env.EMBY_ADMIN_TOKEN) throw new Error(`Missing EMBY_ADMIN_TOKEN`)
		await emby.client.post(`/Users/${this.Id}/Configuration`, {
			query: { api_key: process.env.EMBY_ADMIN_TOKEN },
			body: Configuration,
		})
	}
	async setPolicy(Policy: UserPolicy) {
		if (!process.env.EMBY_ADMIN_TOKEN) throw new Error(`Missing EMBY_ADMIN_TOKEN`)
		await emby.client.post(`/Users/${this.Id}/Policy`, {
			query: { api_key: process.env.EMBY_ADMIN_TOKEN },
			body: Policy,
		})
	}

	async Latest() {
		return (await emby.client.get(`/Users/${this.Id}/Items/Latest`, {
			query: { Limit: 5 },
		})) as emby.Item[]
	}

	async Views() {
		return (await emby.client.get(`/Users/${this.Id}/Views`)) as emby.View[]
	}
}

export interface User {
	Configuration: UserConfiguration
	ConnectLinkType: string
	ConnectUserName: string
	HasConfiguredEasyPassword: boolean
	HasConfiguredPassword: boolean
	HasPassword: boolean
	Id: string
	LastActivityDate: string
	LastLoginDate: string
	Name: string
	Policy: UserPolicy
	PrimaryImageAspectRatio: number
	PrimaryImageTag: string
	ServerId: string
}

export interface UserConfiguration {
	AudioLanguagePreference: string
	DisplayCollectionsView: boolean
	DisplayMissingEpisodes: boolean
	EnableLocalPassword: boolean
	EnableNextEpisodeAutoPlay: boolean
	GroupedFolders: string[]
	HidePlayedInLatest: boolean
	LatestItemsExcludes: string[]
	MyMediaExcludes: string[]
	OrderedViews: string[]
	PlayDefaultAudioTrack: boolean
	RememberAudioSelections: boolean
	RememberSubtitleSelections: boolean
	SubtitleLanguagePreference: string
	SubtitleMode: string
}

export interface UserPolicy {
	AccessSchedules: any[]
	AuthenticationProviderId: string
	BlockedTags: any[]
	BlockUnratedItems: any[]
	DisablePremiumFeatures: boolean
	EnableAllChannels: boolean
	EnableAllDevices: boolean
	EnableAllFolders: boolean
	EnableAudioPlaybackTranscoding: boolean
	EnableContentDeletion: boolean
	EnableContentDeletionFromFolders: any[]
	EnableContentDownloading: boolean
	EnabledChannels: any[]
	EnabledDevices: any[]
	EnabledFolders: any[]
	EnableLiveTvAccess: boolean
	EnableLiveTvManagement: boolean
	EnableMediaConversion: boolean
	EnableMediaPlayback: boolean
	EnablePlaybackRemuxing: boolean
	EnablePublicSharing: boolean
	EnableRemoteAccess: boolean
	EnableRemoteControlOfOtherUsers: boolean
	EnableSharedDeviceControl: boolean
	EnableSubtitleDownloading: boolean
	EnableSubtitleManagement: boolean
	EnableSyncTranscoding: boolean
	EnableUserPreferenceAccess: boolean
	EnableVideoPlaybackTranscoding: boolean
	ExcludedSubFolders: any[]
	InvalidLoginAttemptCount: number
	IsAdministrator: boolean
	IsDisabled: boolean
	IsHidden: boolean
	IsHiddenRemotely: boolean
	IsTagBlockingModeInclusive: boolean
	RemoteClientBitrateLimit: number
	SimultaneousStreamLimit: number
}

export interface UserDisplayPreferences {
	Client: string
	CustomPrefs: Partial<{
		[key: string]: string
		'dashboardTheme': string
		'enableLogoAsTitle': string
		'enableNextVideoInfoOverlay': string
		'homesection0': string
		'homesection1': string
		'homesection2': string
		'homesection3': string
		'homesection4': string
		'homesection5': string
		'homesection6': string
		'skipBackLength': string
		'skipForwardLength': string
		'stillwatchingms': string
		'subtitleeditor-language': string
		'tvhome': string
	}>
	Id: string
	PrimaryImageHeight: number
	PrimaryImageWidth: number
	RememberIndexing: boolean
	RememberSorting: boolean
	ScrollDirection: string
	ShowBackdrop: boolean
	ShowSidebar: boolean
	SortBy: string
	SortOrder: string
}
