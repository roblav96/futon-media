import * as _ from 'lodash'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as scraper from './scraper'
import * as torrent from './torrent'
import * as utils from '../utils'

export function filter(result: scraper.Result) {
	try {
		if (!result.magnet || !result.magnet.startsWith('magnet:')) {
			console.error(`!result.magnet ->`, result)
			return false
		}
		let magnet = (qs.parseUrl(utils.clean(result.magnet)).query as any) as torrent.MagnetQuery
		result.name = result.name || magnet.dn
		if (!result.name) {
			console.error(`!result.name ->`, result)
			return false
		}
		if (utils.isForeign(result.name)) {
			console.warn(`isForeign ->`, result.name)
			return false
		}
		if (result.name.includes('<span class')) {
			console.warn(`includes <span class ->`, result.name)
			return false
		}
		result.name = utils.toSlug(result.name, true)
	} catch (error) {
		console.error(`scraper filter Error ->`, error, result)
		return false
	}
	return true
}
