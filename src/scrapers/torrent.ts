import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as media from '@/media/media'
import * as Memoize from '@/utils/memoize'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'
import { filenameParse } from '@ctrl/video-filename-parser'

export interface Torrent extends scraper.Result {}
@Memoize.Class
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
	get titles() {
		return this.item.aliases.join(' ')
	}

	get parsed() {
		return filenameParse(this.filename, true)
	}
	get s00e00() {
		let regexes = [
			` s(?<season>\\d+)e(?<episode>\\d+) `,
			` s(?<season>\\d+) e(?<episode>\\d+) `,
			` s (?<season>\\d+) e (?<episode>\\d+) `,
			` se(?<season>\\d+)ep(?<episode>\\d+) `,
			` se(?<season>\\d+) ep(?<episode>\\d+) `,
			` se (?<season>\\d+) ep (?<episode>\\d+) `,
			` season(?<season>\\d+)episode(?<episode>\\d+) `,
			` season(?<season>\\d+) episode(?<episode>\\d+) `,
			` season (?<season>\\d+) episode (?<episode>\\d+) `,
			` (?<season>\\d+)x(?<episode>\\d+) `,
			` (?<season>\\d+) x (?<episode>\\d+) `,
			` series (?<season>\\d+) (?<episode>\\d+)of`,
			//
		].map(v => new RegExp(v, 'i'))
		let matches = regexes.map(v => Array.from(this.name.matchAll(v))).flat()
		return {
			seasons: _.uniq(
				matches.map(v => _.parseInt(_.get(v, 'groups.season'))).filter(Boolean),
			).sort(),
			episodes: _.uniq(
				matches.map(v => _.parseInt(_.get(v, 'groups.episode'))).filter(Boolean),
			).sort(),
		}
	}
	get e00() {
		let regexes = [
			` (?<episode>\\d+)of`,
			` (?<episode>\\d+) of`,
			` ch(?<episode>\\d+)`,
			` ch (?<episode>\\d+)`,
			` chapter (?<episode>\\d+)`,
			//
		].map(v => new RegExp(v, 'i'))
		let matches = regexes.map(v => Array.from(this.name.matchAll(v))).flat()
		return _.uniq(
			matches.map(v => _.parseInt(_.get(v, 'groups.episode'))).filter(Boolean),
		).sort()
	}
	get seasons() {
		let seasons = [...this.parsed.seasons, ...this.s00e00.seasons]

		let nthseason = this.name.match(/ \d{1,2}[a-z]{2} season /gi)
		seasons.push(...(nthseason || []).map(v => utils.parseInt(v)))

		let numbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
		let nmatches = this.name.match(new RegExp(` s(eason)? (${numbers.join('|')}) `, 'gi')) || []
		let indexes = nmatches.map(v => v.split(' ').map(vv => numbers.indexOf(vv) + 1)).flat()
		seasons.push(...indexes.filter(v => v > 0))

		let name = utils.excludes(this.name, ['and', 'through', 'to'])
		let matches = [
			name.match(/ s(eason(s)?)?\s?\d{1,2}\s?s?(eason)?(\s?\d{1,2} )+/gi) || [],
			name.match(/ s(eason)?\s?\d{1,2} /gi) || [],
		].flat()
		matches = matches.join(' ').split(' ')
		let ints = matches.map(v => utils.parseInt(v)).filter(v => _.inRange(v, 1, 100))
		let [min, max] = [_.min(ints), _.max(ints)]
		seasons.push(..._.range(min, max + 1))

		return _.uniq(seasons).sort()
	}
	get episodes() {
		let episodes = [...this.parsed.episodeNumbers, ...this.s00e00.episodes, ...this.e00]
		return _.uniq(episodes).sort()
	}

	boost = 1
	get boosts() {
		let bytes = this.bytes
		if (this.item.movie && this.packs > 1) {
			bytes = this.bytes / this.packs
		}
		if (this.item.show && this.seasons.length > 0) {
			bytes = this.bytes / (this.item.S.e * this.seasons.length)
		}
		return {
			bytes: _.ceil(bytes * this.boost),
			seeders: _.ceil(this.seeders * this.boost * this.providers.length),
		}
	}

	get short() {
		let flags = { R: 'R🔵', P: 'P🔴' }
		let boost = `[${this.boost.toFixed(2)} x${this.packs > 0 ? ` ${this.packs}` : ''}]`
		return `${boost} [${this.size}] [${this.seeders}] ${
			this.cached.length > 0 ? `[${this.cached.map(v => flags[v[0].toUpperCase()])}] ` : ''
		}${this.name.trim()} [${this.age}] [${this.providers.length + ' x ' + this.providers}]`
	}
	get json() {
		let magnet = (qs.parseUrl(this.magnet).query as any) as scraper.MagnetQuery
		let minify = qs.stringify(
			{ xt: magnet.xt, dn: magnet.dn.replace(/\s+/g, '+') },
			{ encode: false, sort: false },
		)
		return utils.compact({
			age: this.age,
			boost: this.boost,
			cached: this.cached.join(', '),
			episodes: this.episodes,
			magnet: `magnet:?${minify}`, // this.magnet,
			name: this.name,
			packs: this.packs,
			parsed: this.parsed,
			providers: this.providers.join(', '),
			seasons: this.seasons,
			seeders: this.seeders,
			size: this.size,
			years: this.years,
		})
	}

	get years() {
		let words = utils.accuracies(`${this.titles} 1080 1920 2160`, this.name)
		let years = words.map(v => _.parseInt(v))
		return _.uniq(years.filter(v => _.inRange(v, 1921, new Date().getFullYear() + 1))).sort()
	}
	get packs() {
		if (this.name.includes(' duology ')) return 2
		if (this.name.includes(' dilogy ')) return 2
		if (this.name.includes(' trilogy ')) return 3
		if (this.name.includes(' triology ')) return 3
		if (this.name.includes(' quadrilogy ')) return 4
		if (this.name.includes(' quadriology ')) return 4
		if (this.name.includes(' tetralogy ')) return 4
		if (this.name.includes(' pentalogy ')) return 5
		if (this.name.includes(' hexalogie ')) return 6
		if (this.name.includes(' hexalogy ')) return 6
		if (this.name.includes(' heptalogy ')) return 7
		if (this.name.includes(' octalogy ')) return 8
		if (this.name.includes(' ennealogy ')) return 9
		if (this.name.includes(' decalogy ')) return 10
		let words = utils.accuracies(this.titles, 'boxset collection complete saga')
		if (
			this.years.length >= 2 ||
			words.find(v => this.name.includes(` ${v} `)) ||
			(this.item.collection.name && utils.contains(this.name, this.item.collection.name))
		) {
			if (this.item.collection.years.length > 0 && this.years.length >= 2) {
				return this.item.collection.years.filter(v =>
					_.inRange(v, _.first(this.years), _.last(this.years)),
				).length
			} else if (this.item.collection.years.length > 0) {
				return this.item.collection.years.length
			} else {
				return this.years.length
			}
		}
		return 0
	}

	constructor(result: scraper.Result, public item: media.Item) {
		let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name
		magnet.tr = trackers.TRACKERS
		result.magnet = `magnet:?${qs.stringify(
			{ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr },
			{ encode: false, sort: false },
		)}`
		_.merge(this, result)
		this.name = ` ${result.name} `
		this.hash = magnet.xt.split(':').pop()
	}
}
