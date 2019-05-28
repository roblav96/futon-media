import * as _ from 'lodash'
import * as media from '@/media/media'
import * as qs from 'query-string'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'

export const SKIPS = [
	'3d',
	'avi',
	// 'bonus',
	'cam',
	'camhd',
	'camrip',
	'enhanced',
	// 'extras',
	// 'french',
	'hdcam',
	'latino',
	'sample',
	'trailer',
	'xxx',
]

export function results(result: scraper.Result, item: media.Item) {
	result.magnet = utils.clean(result.magnet)
	let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
	if (!_.isString(magnet.xt)) return // console.log(`⛔ !magnet.xt ->`, result.name)
	if (magnet.xt.length != 49) return // console.log(`⛔ magnet.xt != 49 ->`, result.name)

	result.name = result.name || magnet.dn
	if (!result.name) return // console.log(`⛔ !result.name ->`, result.name)
	if (utils.isForeign(result.name)) return // console.log(`⛔ isForeign ->`, result.name)
	result.name = utils.toSlug(result.name, { toName: true, separator: '.' })

	let skips = utils.accuracy(`${item.title} ${item.E.t}`, SKIPS.join(' '))
	let skipped = utils.accuracy(result.name, _.trim(skips.join(' ')))
	if (skipped.length < skips.length) return // console.log(`⛔ skips ->`, result.name)

	let slug = utils.toSlug(result.name, { toName: true, lowercase: true })

	if (item.movie) {
		try {
			// let titles = item.titles.map(title => item.years.map(year => `${title} ${year}`)).flat()
			let titles = item.years.map(year => `${item.title} ${year}`)
			if (!item.isPopular()) titles.unshift(item.title)
			titles = _.uniq(titles.map(v => utils.toSlug(v, { toName: true })))
			if (titles.filter(v => utils.leven(slug, v) == 0).length == 0) {
				return console.log(`❌ name leven '${titles}' ->`, result.name)
			}

			let extras = utils.accuracy(`${item.title} 720 1080 1920 2160`, slug)
			let years = _.uniq(
				extras.filter(v => v.length == 4 && /\d{4}/.test(v)).map(v => _.parseInt(v))
			)
			if (years.length >= 2) {
				return console.log(`❌ years >= 2 '${years}' ->`, result.name)
			}

			return true
		} catch (error) {
			console.log(`❌ movie ${error.message} ->`, result.name)
			return false
		}
	}

	if (item.show) {
		try {
			let title = utils.toSlug(item.title)
			if (!item.isDaily && utils.leven(slug, title) > 0) {
				return console.log(`❌ name leven '${title}' ->`, result.name)
			}

			slug = ` ${utils.toSlug(result.name, { toName: true, lowercase: true })} `

			result.packs = 0
			if (item.isDaily && regex.isodate(item, slug)) return true
			if (item.E.t && utils.includes(slug, item.E.t)) return true
			if (regex.s00e00(item, slug)) return true

			result.packs = 1
			if (regex.nthseason(item, slug)) return true
			if (regex.season(item, slug)) return true

			let seasons0to = regex.seasons0to(item, slug)
			if (_.isFinite(seasons0to)) {
				result.packs = seasons0to
				return true
			}
		} catch (error) {
			console.log(`❌ show ${error.message} ->`, result.name)
			return false
		}
	}

	console.log(`❌ return false ->`, result.name)
	return false
}

export const regex = {
	/** `YYYY-MM-DD` */
	isodate(item: media.Item, slug: string) {
		let matches = slug.match(/\s\d{4}\s\d{2}\s\d{2}\s/gi)
		matches = (matches || []).map(v => utils.minify(v))
		if (matches.length == 0) return
		let target = utils.minify(item.E.a)
		if (matches.includes(target)) return true
		throw new Error(`regex '${matches}' !includes '${target}'`)
	},
	/** `s00e00` `season 1 episode 1` */
	s00e00(item: media.Item, slug: string) {
		let matches = [
			slug.match(/\ss\d{1,2}e\d{1,3}\s/gi) || [],
			slug.match(/\ss(eason)?\s?\d{1,2}\se(pisode)?\s?\d{1,3}\s/gi) || [],
		].flat()
		matches = (matches || []).map(v => v.trim())
		matches = matches.map(v => {
			let zeros = _.split(v.match(/(\d).*(\d)/gi)[0], 'e').map(utils.parseInt)
			let [s, e] = zeros.filter(Boolean)
			return `s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`
		})
		if (matches.length == 0) return
		if (!item.episode) throw new Error(`regex !item.episode`)
		let target = `s${item.S.z}e${item.E.z}`
		if (matches.includes(target)) return true
		throw new Error(`regex '${matches}' !includes '${target}'`)
	},
	/** `1st season` */
	nthseason(item: media.Item, slug: string) {
		let matches = slug.match(/\s\d{1,2}[a-z]{2}\sseason\s/gi)
		matches = (matches || []).map(v => v.trim())
		let seasons = matches.map(v => utils.parseInt(v))
		if (seasons.includes(item.S.n)) return true
	},
	/** `season one` */
	season(item: media.Item, slug: string) {
		let nstrs = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
		let matches = slug.match(
			/\ss(eason)?\s(one|two|three|four|five|six|seven|eight|nine|ten)\s/gi
		)
		matches = (matches || []).map(v => v.trim())
		let nstr = matches.map(v => v.split(' ').pop())[0]
		let index = nstrs.findIndex(v => v == nstr) + 1
		if (item.S.n == index) return true
	},
	/** `seasons 1 - 2` */
	seasons0to(item: media.Item, slug: string) {
		slug = slug.replace(/(through)|(and)|(to)/gi, ' ').replace(/\s+/g, ' ')
		let matches = [
			slug.match(/\s?s(eason(s)?)?\s?\d{1,2}\s?s?(eason)?(\s?\d{1,2}\s)+/gi) || [],
			slug.match(/\s?s(eason)?\s?\d{1,2}\s/gi) || [],
		].flat()
		matches = (matches || []).map(v => v.trim())
		matches = matches.join(' ').split(' ')
		let ints = matches.map(utils.parseInt).filter(v => _.isInteger(v) && v < 100)
		let { min, max } = { min: _.min(ints), max: _.max(ints) }
		if (item.S.n >= min && item.S.n <= max) {
			return max - min + 1
		}
	},
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/scrapers/filters')))
}
