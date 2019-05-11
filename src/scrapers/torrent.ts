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
	hash: string
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

	get json() {
		let magnet = (qs.parseUrl(this.magnet).query as any) as scraper.MagnetQuery
		let minify = qs.stringify({ xt: magnet.xt, dn: magnet.dn }, { encode: false, sort: false })
		return {
			age: this.age,
			cached: this.cached.join(', '),
			hash: this.hash,
			magnet: `magnet:?${minify}`,
			name: this.name,
			packs: this.packs,
			providers: this.providers.join(', '),
			seeders: this.seeders,
			size: this.size,
			slugs: this.slugs.join(', '),
		}
	}

	constructor(result: scraper.Result) {
		let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name

		// magnet.tr = ((_.isString(magnet.tr) ? [magnet.tr] : magnet.tr) || []).map(tr => tr.trim())
		// magnet.tr = magnet.tr.filter(tr => !trackers.BAD.includes(tr))
		// magnet.tr = _.uniq(magnet.tr.concat(trackers.GOOD)).sort()

		result.magnet = `magnet:?${qs.stringify(
			{ xt: magnet.xt, dn: magnet.dn, tr: trackers.GOOD },
			{ encode: false, sort: false }
		)}`

		_.merge(this, result)
		this.hash = magneturi.decode(result.magnet).infoHash.toLowerCase()
	}
}
