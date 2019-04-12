import * as _ from 'lodash'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as scraper from '@/scrapers/scraper'

export interface Torrent extends scraper.Result {}
export class Torrent {
	cached = [] as Debrid[]
	files = [] as File[]

	get hash() {
		return magneturi.decode(this.magnet).infoHash.toLowerCase()
	}

	// let magnet = (qs.parseUrl(utils.clean(result.magnet)).query as any) as torrent.MagnetQuery
	// magnet.xt = magnet.xt.toLowerCase()
	// magnet.dn = result.name
	// magnet.tr = (magnet.tr || []).filter(
	// 	tr => trackerslist.bad.filter(v => v.startsWith(tr)).length == 0
	// )
	// magnet.tr = _.uniq(magnet.tr.concat(trackerslist.good))
	// _.unset(result, 'magnet')
	// Object.defineProperty(result, 'magnet', {
	// 	value: magneturi.encode({ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr }),
	// })

	constructor(result: scraper.Result) {
		result.magnet = utils.clean(result.magnet)
		result.name = result.name || (qs.parse(result.magnet).dn as string)
		result.name = utils.toSlug(result.name, { toName: true, separator: '.' })
		
		_.merge(this, result)
	}
}

export type Debrid = 'realdebrid' | 'premiumize'

export interface File {
	accuracy: string[]
	bytes: number
	leven: number
	name: string
	path: string
	slug: string
	url: string
}

export interface MagnetQuery {
	dn: string
	tr: string[]
	xt: string
}
