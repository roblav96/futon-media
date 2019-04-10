import * as _ from 'lodash'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as scraper from './scraper'
import * as trackers from './trackers'
import * as torrent from './torrent'
import * as utils from '../utils'

export function filter(result: scraper.Result) {
	try {
		if (!result.magnet || !result.magnet.startsWith('magnet:')) {
			console.warn(`filter !result.magnet ->`, result)
			return false
		}
		let magnet = (qs.parseUrl(utils.clean(result.magnet)).query as any) as torrent.MagnetQuery

		result.name = result.name || magnet.dn
		if (!result.name) {
			console.warn(`filter !result.name ->`, result)
			return false
		}
		result.name = utils.toSlug(result.name, true)

		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name.replace(/[\s]/g, '.')
		magnet.tr = (magnet.tr || []).filter(
			tr => trackers.bad.filter(v => v.startsWith(tr)).length == 0
		)
		magnet.tr = _.uniq(magnet.tr.concat(trackers.good))
		_.unset(result, 'magnet')
		Object.defineProperty(result, 'magnet', {
			value: magneturi.encode({ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr }),
		})
		result.hash = magneturi.decode(result.magnet).infoHash.toLowerCase()

		return true
	} catch (error) {
		console.error(`filter Error ->`, error, result)
		return false
	}
}
