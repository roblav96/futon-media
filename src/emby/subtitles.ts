import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as Rx from '@/shims/rxjs'
import * as utils from '@/utils/utils'

process.nextTick(() => {
	let rxSubtitles = emby.rxItem.pipe(
		Rx.op.filter(({ Item }) => ['Movie', 'Episode'].includes(Item.Type)),
	)
	rxSubtitles.subscribe(async ({ ItemId, Session }) => {
		let Item = (await emby.library.Items({
			Fields: ['MediaStreams'],
			Ids: [ItemId],
		}))[0]
		if (Item.MediaStreams.find(v => v.Type == 'Subtitle')) return
		console.warn(`[${Session.short}] rxSubtitles ->`, emby.library.toTitle(Item))
		for (let query of [
			{ IsPerfectMatch: 'false', IsForced: 'true' },
			{ IsPerfectMatch: 'false' },
		]) {
			let Subtitles = (await emby.client.get(`/Items/${ItemId}/RemoteSearch/Subtitles/eng`, {
				query,
				silent: true,
			})) as emby.RemoteSubtitle[]
			Subtitles = _.orderBy(Subtitles.filter(v => v.Format == 'srt'), 'DownloadCount', 'desc')
			if (_.isEmpty(Subtitles)) continue
			await emby.client.post(`/Items/${ItemId}/RemoteSearch/Subtitles/${Subtitles[0].Id}`, {
				silent: true,
			})
		}
	})
})
