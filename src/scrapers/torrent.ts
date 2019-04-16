import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as scraper from '@/scrapers/scraper'
import * as trackers from '@/scrapers/trackers-list'
import * as debrid from '@/debrids/debrid'

export interface Torrent extends scraper.Result {}
export class Torrent {
	cached = [] as debrid.Debrids[]
	files = [] as File[]

	get age() {
		return dayjs(this.stamp).fromNow()
	}
	get date() {
		return dayjs(this.stamp).format('MMM DD YYYY')
	}
	get size() {
		return utils.fromBytes(this.bytes)
	}
	get ttycache() {
		let short = { realdebrid: 'RD', premiumize: 'PR' } as Record<debrid.Debrids, string>
		return this.cached.map(v => short[v]).join(' ')
	}
	get hash() {
		return magneturi.decode(this.magnet).infoHash.toLowerCase()
	}

	constructor(result: scraper.Result) {
		let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name

		/** filter bad trackers and merge good trackers */
		magnet.tr = (magnet.tr || []).filter(
			tr => trackers.bad.filter(v => v.startsWith(tr)).length == 0
		)
		magnet.tr = _.uniq(magnet.tr.concat(trackers.good))

		/** re-encode magnet URL */
		let encoded = magneturi.encode({ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr })
		utils.defineValue(this, 'magnet', encoded)

		_.defaults(this, result)
	}

	json() {
		return {
			age: this.age,
			cached: this.cached.join(),
			hash: this.hash,
			name: this.name,
			providers: this.providers.join(),
			seeders: this.seeders,
			size: this.size,
		}
	}
}

export interface File {
	accuracy: string[]
	bytes: number
	leven: number
	name: string
	path: string
	slug: string
	url: string
}
