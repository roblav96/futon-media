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
	split: string[]
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
	get minify() {
		let magnet = (qs.parseUrl(this.magnet).query as any) as scraper.MagnetQuery
		let minify = qs.stringify({ xt: magnet.xt, dn: magnet.dn }, { encode: false, sort: false })
		return `magnet:?${minify}`
	}

	boost = 1
	boosts(episodes?: number) {
		let bytes = this.bytes
		if (_.isFinite(episodes) && this.packs) {
			bytes = this.bytes / (episodes * this.packs)
		}
		return {
			bytes: _.ceil(bytes * this.boost),
			seeders: _.ceil(this.seeders * this.boost),
		}
	}

	get short() {
		return `[${this.boost.toFixed(2)}] [${this.size}] [${this.seeders}] ${
			this.cached.length > 0 ? `[${this.cached.map(v => v[0].toUpperCase())}] ` : ''
		}${this.name} (${this.providers})`
	}
	get json() {
		return utils.compact({
			age: this.age,
			cached: this.cached.join(', '),
			magnet: this.minify,
			name: this.name,
			packs: this.packs,
			providers: this.providers.join(', '),
			seeders: this.seeders,
			size: this.size,
		})
	}

	constructor(result: scraper.Result) {
		let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name
		magnet.tr = trackers.GOOD
		result.magnet = `magnet:?${qs.stringify(
			{ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr },
			{ encode: false, sort: false }
		)}`

		_.merge(this, result)
		this.split = utils.toSlug(result.name, { toName: true, lowercase: true }).split(' ')
		this.hash = magneturi.decode(result.magnet).infoHash.toLowerCase()
	}
}
