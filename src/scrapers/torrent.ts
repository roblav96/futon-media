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

	get age() {
		return dayjs(this.stamp).fromNow()
	}
	get date() {
		return dayjs(this.stamp).format('MMM DD YYYY')
	}
	get size() {
		return utils.fromBytes(this.bytes)
	}
	get min() {
		let min = { realdebrid: 'RD', premiumize: 'PR' } as Record<debrid.Debrids, string>
		return { cached: this.cached.map(v => min[v]).join(' ') }
	}
	get hash() {
		return magneturi.decode(this.magnet).infoHash.toLowerCase()
	}

	constructor(result: scraper.Result) {
		let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name
		/** filter bad trackers and merge good trackers */
		magnet.tr = ((_.isString(magnet.tr) ? [magnet.tr] : magnet.tr) || []).map(tr => tr.trim())
		magnet.tr = magnet.tr.filter(tr => !trackers.BAD.includes(tr))
		magnet.tr = _.uniq(magnet.tr.concat(trackers.GOOD))
		/** re-encode magnet URL */
		this.magnet = magneturi.encode({ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr })

		_.defaults(this, result)
	}

	toJSON() {
		return {
			age: this.age,
			cached: this.cached.join(', '),
			name: this.name,
			providers: this.providers.join(', '),
			slugs: this.slugs.join(', '),
			seeders: this.seeders,
			size: this.size,
		}
	}
}
