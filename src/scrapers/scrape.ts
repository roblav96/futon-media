import * as _ from 'lodash'
import * as mocks from '@/dev/mocks'
import * as utils from '@/utils/utils'
import * as media from '@/media/media'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as debrid from '@/debrids/debrid'
import * as emby from '@/emby/emby'
import { searchItem } from '@/prompts/search-item'
import { selectTorrent } from '@/prompts/select-torrent'

export async function scrape() {
	// let item = new media.Item(mocks.MOVIES['the-lego-movie-2014'])
	// let item = new media.Item(mocks.EPISODES['the-planets-2017'])
	let item = await searchItem()
	// return console.log(`item ->`, item)

	let torrents = await scraper.scrapeAll(item)
	console.log(`torrents ->`, torrents.map(v => v.toJSON()))
	console.log(`torrents.length ->`, torrents.length)
	// torrents = torrents.filter(v => v.cached.length > 0)

	let torrent = await selectTorrent(torrents)
	console.log(`torrent ->`, torrent)

	return

	let service = torrent.cached[0] || (debrid.entries[0][0] as debrid.Debrids)
	let links = await debrid.debrids[service].links(torrent.magnet)
	console.log(`links ->`, links)
	if (links.length == 0) {
		return console.warn(`links.length == 0`)
	}
	await emby.addLinks(item, links)
	await emby.refreshLibrary()
}
