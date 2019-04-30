import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as schedule from 'node-schedule'
import * as utils from '@/utils/utils'
import * as dts from '@/utils/dts'

export const users = {
	async get() {
		let Users = (await emby.client.get('/Users')) as User[]
		return Users.sort((a, b) => utils.alphabetically(a.Name, b.Name))
	},
}

process.nextTick(async () => {
	let Users = await users.get()
	// console.log(`Users ->`, Users)
	// dts(Users, `Users`)
})

export class User {}

export interface User {
	Configuration: {
		DisplayCollectionsView: boolean
		DisplayMissingEpisodes: boolean
		EnableLocalPassword: boolean
		EnableNextEpisodeAutoPlay: boolean
		GroupedFolders: any[]
		HidePlayedInLatest: boolean
		LatestItemsExcludes: any[]
		MyMediaExcludes: any[]
		OrderedViews: string[]
		PlayDefaultAudioTrack: boolean
		RememberAudioSelections: boolean
		RememberSubtitleSelections: boolean
		SubtitleMode: string
	}
	HasConfiguredEasyPassword: boolean
	HasConfiguredPassword: boolean
	HasPassword: boolean
	Id: string
	LastActivityDate: string
	LastLoginDate: string
	Name: string
	Policy: {
		AccessSchedules: any[]
		AuthenticationProviderId: string
		BlockUnratedItems: any[]
		BlockedTags: any[]
		DisablePremiumFeatures: boolean
		EnableAllChannels: boolean
		EnableAllDevices: boolean
		EnableAllFolders: boolean
		EnableAudioPlaybackTranscoding: boolean
		EnableContentDeletion: boolean
		EnableContentDeletionFromFolders: any[]
		EnableContentDownloading: boolean
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
		EnabledChannels: any[]
		EnabledDevices: any[]
		EnabledFolders: any[]
		ExcludedSubFolders: any[]
		InvalidLoginAttemptCount: number
		IsAdministrator: boolean
		IsDisabled: boolean
		IsHidden: boolean
		IsHiddenRemotely: boolean
		RemoteClientBitrateLimit: number
	}
	ServerId: string
}
