import * as _ from 'lodash'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as scraper from '@/scrapers/scraper'
import * as trackerslist from '@/scrapers/trackers-list'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'

export function filter(result: scraper.Result) {
	try {
		if (!result.magnet || !result.magnet.startsWith('magnet:')) {
			console.warn(`!result.magnet ->`, result)
			return false
		}
		result.magnet = utils.clean(result.magnet)
		result.hash = magneturi.decode(result.magnet).infoHash.toLowerCase()

		result.name = result.name || (qs.parse(result.magnet).dn as string)
		if (!result.name) {
			console.warn(`!result.name ->`, result)
			return false
		}
		// result.name = utils.toSlug(result.name, { toName: true })
		console.log(
			`result.name ->`,
			result.name,
			`\n     toSlug ->`,
			utils.toSlug(result.name)
		)

		return true
	} catch (error) {
		console.error(`filter Error ->`, error, `\nresult ->`, result)
		return false
	}
}
