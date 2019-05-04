import * as _ from 'lodash'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as media from '@/media/media'
import * as trackers from '@/scrapers/trackers'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export function results(result: scraper.Result, item: media.Item) {
	result.magnet = utils.clean(result.magnet)
	let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
	if (!_.isString(magnet.xt)) {
		return // console.log(`❌ !magnet.xt ->`, result)
	}
	if (magnet.xt.length != 49) {
		return // console.log(`❌ magnet.xt.length != 49 ->`, result)
	}

	result.name = result.name || magnet.dn
	if (!result.name) {
		return // console.log(`❌ !name ->`, result)
	}
	if (utils.isForeign(result.name)) {
		return // console.log(`❌ isForeign name ->`, result.name)
	}
	result.name = utils.toSlug(result.name, { toName: true, separator: '.' })
	let naccuracy = utils.accuracy(result.name, item.title)
	if (naccuracy.length > 0) {
		return // console.log(`❌ name accuracy ->`, JSON.stringify(naccuracy), result.name)
	}

	let title = item.title
	item.E.t && (title += ` ${item.E.t}`)
	let skips = ['3d', 'cam', 'camrip', 'hdcam', 'sample', 'trailer']
	skips = utils.accuracy(title, skips.join(' '))
	let skipped = utils.accuracy(result.name, skips.join(' '))
	if (skipped.length < skips.length) {
		let json = JSON.stringify(_.difference(skips, skipped))
		return // console.log(`❌ skips accuracy ->`, json, result.name)
	}

	let slug = ` ${utils.toSlug(result.name, { toName: true }).toLowerCase()} `
	if (item.movie) {
		let years = slug.split(' ').map(v => utils.parseInt(v))
		years = years.filter(v => _.inRange(v, 1950, new Date().getFullYear() + 1))
		if (_.uniq(years).length >= 2) {
			return // console.log(`❌ years.length >= 2 ->`, result.name)
		}
		return true
	}
	if (item.show) {
		try {
			result.packs = 1
			if (regex.s01e01(item, slug)) {
				result.packs = 0
				return true
			}
			if (regex.nthseason(item, slug)) return true
			if (regex.seasonone(item, slug)) return true
			let seasons1to2 = regex.seasons1to2(item, slug)
			if (_.isFinite(seasons1to2)) {
				result.packs = seasons1to2
				return true
			}
		} catch (error) {
			// console.log(`❌ ${error.message} ->`, result.name)
			return false
		}
	}

	// console.log(`❌ return false ->`, result.name)
	return false
}

export const regex = {
	/** `s01e01` `season 1 episode 1` */
	s01e01(item: media.Item, slug: string) {
		let matches = [
			slug.match(/\ss\d{1,2}e\d{1,2}\s/gi) || [],
			slug.match(/\ss(eason)?\s?\d{1,2}\se(pisode)?\s?\d{1,2}\s/gi) || [],
		].flat()
		matches = (matches || []).map(v => v.trim())
		matches = matches.map(v => {
			let [s, e] = _.split(v, 'e').map(utils.parseInt)
			return `s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`
		})
		if (matches.length == 0) return
		if (!item.episode) throw new Error(`!item.episode`)
		let target = `s${item.S.z}e${item.E.z}`
		if (matches.includes(target)) return true
		throw new Error(`${matches} !includes ${target}`)
	},
	/** `1st season` */
	nthseason(item: media.Item, slug: string) {
		let matches = slug.match(/\s\d{1,2}[a-z]{2}\sseason\s/gi)
		matches = (matches || []).map(v => v.trim())
		let seasons = matches.map(v => utils.parseInt(v))
		if (seasons.includes(item.S.n)) return true
	},
	/** `season one` */
	seasonone(item: media.Item, slug: string) {
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
	seasons1to2(item: media.Item, slug: string) {
		slug = slug.replace(/(through)|(and)|(to)/gi, ' ').replace(/\s+/g, ' ')
		let matches = [
			slug.match(/\s?s(eason(s)?)?\s?\d{1,2}\s?s?(eason)?(\s?\d{1,2}\s)+/gi) || [],
			slug.match(/\s?s(eason)?\s?\d{1,2}\s/gi) || [],
		].flat()
		matches = (matches || []).map(v => v.trim())
		matches = matches.join(' ').split(' ')
		// console.log(`[seasons1to2] ${slug} ->`, matches)
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
