import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as magneturi from 'magnet-uri'
import * as qs from 'query-string'
import * as scraper from '@/scrapers/scraper'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'

export interface Torrent extends scraper.Result {}
export class Torrent {
	cached = [] as debrids.Debrids[]

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
		let min = { realdebrid: 'RD', premiumize: 'PR' } as Record<debrids.Debrids, string>
		return { cached: this.cached.map(v => min[v]).join(' ') }
	}
	get hash() {
		return magneturi.decode(this.magnet).infoHash.toLowerCase()
	}
	get pbytes() {
		return 
	}

	constructor(result: scraper.Result) {
		let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name

		magnet.tr = ((_.isString(magnet.tr) ? [magnet.tr] : magnet.tr) || []).map(tr => tr.trim())
		magnet.tr = magnet.tr.filter(tr => !trackers.BAD.includes(tr))
		magnet.tr = _.uniq(magnet.tr.concat(trackers.GOOD))

		this.magnet = magneturi.encode({ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr })

		_.defaults(this, result)
	}

	toJSON() {
		let json = ({
			age: this.age,
			cached: this.cached.join(', '),
			hash: this.hash,
			name: this.name,
			providers: this.providers.join(', '),
			seeders: this.seeders,
			size: this.size,
			slugs: this.slugs.join(', '),
		} as any) as Torrent
		_.isFinite(this.packs) && (json.packs = this.packs)
		utils.defineValue(json, 'magnet', this.magnet)
		return json
	}
}
