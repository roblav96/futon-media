import * as _ from 'lodash'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as media from '@/media/media'
import * as trackers from '@/scrapers/trackers-list'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export function results(result: scraper.Result, item: media.Item) {
	return true
	/** clean and check for magnet URL */
	result.magnet = utils.clean(result.magnet)
	let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
	if (!magnet.xt) {
		console.warn(`!magnet.xt ->`, scraper.toJSON(result))
		return false
	}
	magnet.xt = magnet.xt.toLowerCase()

	/** check and repair name then slugify */
	result.name = result.name || magnet.dn
	if (!result.name) {
		console.warn(`!result.name ->`, scraper.toJSON(result))
		return false
	}
	result.name = utils.toSlug(result.name, { toName: true, separator: '.' })
	magnet.dn = result.name
	if (utils.accuracy(item.title, result.name).length > 0) {
		console.warn(`accuracy ->`, scraper.toJSON(result))
		return false
	}

	let junkwords = 'cam'
	console.log(`utils.accuracy(result.name, junkwords) ->`, utils.accuracy(result.name, junkwords))
	if (utils.accuracy(result.name, junkwords).length > 0) {
		console.warn(`accuracy ->`, scraper.toJSON(result))
		return false
	}

	/** filter bad trackers and merge good trackers */
	magnet.tr = ((_.isString(magnet.tr) ? [magnet.tr] : magnet.tr) || []).map(tr => tr.trim())
	magnet.tr = magnet.tr.filter(tr => !trackers.BAD.includes(tr))
	magnet.tr = _.uniq(magnet.tr.concat(trackers.GOOD))
	/** re-encode magnet URL */
	result.magnet = magneturi.encode({ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr })
	result.hash = magneturi.decode(result.magnet).infoHash.toLowerCase()

	return true
}
