import * as _ from 'lodash'
import * as MemoryChunkStore from 'memory-chunk-store'
import * as pEvent from 'p-event'
import * as TorrentStream from 'torrent-stream'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'

export async function discover(magnet: string) {
	let engine = TorrentStream(magnet, {
		storage: MemoryChunkStore,
		trackers: trackers.TRACKERS,
		verify: false,
	})
	await Promise.race([pEvent(engine, 'ready'), utils.pTimeout(5000)])
	engine.destroy(_.noop)
	// await new Promise(resolve => engine.destroy(resolve))
	return engine.files || []
}

// process.nextTick(async () => {
// 	await utils.pTimeout(1000)
// 	await discover(
// 		'magnet:?xt=urn:btih:96211fb036d76cc17d226985f39cfc9b688a3fd1&dn=pinky+and+the+brain+s1+s4'
// 	)
// })
