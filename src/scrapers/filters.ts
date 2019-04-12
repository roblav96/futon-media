import * as _ from 'lodash'
import * as qs from 'query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export function junk(result: scraper.Result) {
	if (!result.magnet || !result.magnet.startsWith('magnet:')) {
		console.warn(`junk !result.magnet ->`, result)
		return false
	}
	if (!result.name && !qs.parse(result.magnet).dn) {
		console.warn(`junk !result.name ->`, result)
		return false
	}
	return true
}
