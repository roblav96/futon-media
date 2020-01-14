import * as _ from 'lodash'
import * as emby from '@/emby/emby'

process.nextTick(async () => {
	try {
		let Users = await emby.User.get()
		for (let User of Users) {
			let DisplayPreferences = await User.getDisplayPreferences()
			_.merge(DisplayPreferences, emby.defaults.DisplayPreferences)
			await User.setDisplayPreferences(DisplayPreferences)
			_.merge(User.Configuration, emby.defaults.Configuration)
			await User.setConfiguration(User.Configuration)
			if (!User.Policy.IsAdministrator) {
				_.merge(User.Policy, emby.defaults.Policy)
				await User.setPolicy(User.Policy)
			}
		}
		console.info(`users-sync ->`, 'DONE')
	} catch (error) {
		console.error(`users-sync -> %O`, error)
	} finally {
		process.exit(0)
	}
})
