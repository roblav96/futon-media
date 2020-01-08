import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as media from '@/media/media'
import * as Memoize from '@/utils/memoize'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'
import { filenameParse, ParsedFilename } from '@ctrl/video-filename-parser'

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

	get parsed() {
		let parsed = [filenameParse(this.filename, true), filenameParse(this.filename)]
		if (this.item.movie) parsed.reverse()
		return _.defaultsDeep(parsed[0], parsed[1]) as ParsedFilename
	}
	get years() {
		let years = [_.parseInt(this.parsed.year), ...this.name.split(' ').map(v => _.parseInt(v))]
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
		if (
			this.years.length >= 2 ||
			'boxset collection complete saga'.split(' ').find(v => this.name.includes(` ${v} `))
		) {
			if (this.item.collection.years.length > 0) {
				if (this.years.length >= 2) {
					return this.item.collection.years.filter(v =>
						_.inRange(v, _.first(this.years), _.last(this.years) + 1),
					).length
				}
				return this.item.collection.years.length
			}
			return this.years.length
		}
		return 1
	}

	get s00e00() {
		let regexes = [
			/ s(?<season>\d{1,2})e(?<episode>\d{1,2}) /i,
			/ s(?<season>\d{1,2}) e(?<episode>\d{1,2}) /i,
			/ s (?<season>\d{1,2}) e (?<episode>\d{1,2}) /i,
			/ se(?<season>\d{1,2})ep(?<episode>\d{1,2}) /i,
			/ se(?<season>\d{1,2}) ep(?<episode>\d{1,2}) /i,
			/ se (?<season>\d{1,2}) ep (?<episode>\d{1,2}) /i,
			/ season(?<season>\d{1,2})episode(?<episode>\d{1,2}) /i,
			/ season(?<season>\d{1,2}) episode(?<episode>\d{1,2}) /i,
			/ season (?<season>\d{1,2}) episode (?<episode>\d{1,2}) /i,
			/ (?<season>\d{1,2})x(?<episode>\d{1,2}) /i,
			/ (?<season>\d{1,2}) x (?<episode>\d{1,2}) /i,
			/ series (?<season>\d{1,2}) (?<episode>\d{1,2})of/i,
		]
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
			/ (?<episode>\d{1,2})of/i,
			/ (?<episode>\d{1,2}) of/i,
			/ ch(?<episode>\d{1,2})/i,
			/ ch (?<episode>\d{1,2})/i,
			/ chapter (?<episode>\d{1,2})/i,
		]
		let matches = regexes.map(v => Array.from(this.name.matchAll(v))).flat()
		return _.uniq(
			matches.map(v => _.parseInt(_.get(v, 'groups.episode'))).filter(Boolean),
		).sort()
	}

	get seasons() {
		let seasons = [...this.parsed.seasons, ...this.s00e00.seasons]

		{
			let matches = Array.from(this.name.matchAll(/ (?<season>\d{1,2})[a-z]{2} season /gi))
			seasons.push(...matches.map(v => _.parseInt(_.get(v, 'groups.season'))).filter(Boolean))
		}

		{
			let numbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
			let matches = Array.from(
				this.name.matchAll(new RegExp(` s(eason)? (?<season>${numbers.join('|')}) `, 'gi')),
			)
			let indexes = matches.map(v => numbers.indexOf(_.get(v, 'groups.season')) + 1)
			seasons.push(...indexes.filter(v => v > 0))
		}

		{
			let name = utils.excludes(this.name, ['and', 'through', 'to'])
			let split = name.split(' ')
			name = split.filter(v => _.inRange(utils.parseInt(v), 1000, 9999)).join(' ')
			let regexes = [
				/ s(eason)?\s?(?<season>\d{1,2}) /gi,
				/ s(eason(s)?)?\s?\d{1,2}\s?s?(eason)?(\s?(?<season>\d{1,2}) )+/gi,
			]
			let matches = regexes.map(v => Array.from(name.matchAll(v))).flat()
			let ints = matches.map(v => _.parseInt(_.get(v, 'groups.season')))
			ints = ints.filter(v => _.inRange(v, 1, 100))
			let [min, max] = [_.min(ints), _.max(ints)]
			seasons.push(..._.range(min, max + 1))
		}

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
		let size = this.item.movie ? this.packs : this.seasons.length
		let boost = `[${this.boost.toFixed(2)} x${size > 0 ? ` ${size}` : ''}]`
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
			filename: this.filename,
			// magnet: `magnet:?${minify}`, // this.magnet,
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
