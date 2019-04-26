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

	if (item.movie) return true

	let slug = ` ${utils.toSlug(result.name, { toName: true }).toLowerCase()} `
	if (item.show) {
		try {
			result.packSize = 1
			if (regex.s01e01(item, slug)) {
				result.packSize = 0
				return true
			}
			if (regex.nthseason(item, slug)) return true
			if (regex.seasons1to2(item, slug)) {
				result.packSize = regex.seasons1to2(item, slug)
				return true
			}
			if (regex.season1(item, slug)) return true
			if (regex.s01(item, slug)) return true
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
		matches = matches.map(v => {
			let [s, e] = _.split(v.trim(), 'e').map(utils.parseInt)
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
		let matches = slug.match(/\s\d{1,2}[a-z]{2}\sseason\s/gi) || ([] as string[])
		let seasons = matches.map(v => utils.parseInt(v.trim()))
		if (seasons.includes(item.S.n)) return true
	},
	/** `seasons 1 - 2` */
	seasons1to2(item: media.Item, slug: string) {
		slug = slug.replace(/(through)|(and)|(to)/gi, ' ').replace(/\s+/g, ' ')
		let matches = slug.match(/\ss(eason(s)?)?\s?\d{1,2}\s?s?(eason)?(\s?\d{1,2}\s)+/gi)
		matches = (matches || []).map(v => v.trim())
		for (let match of matches) {
			let ints = _.uniq(_.filter(_.split(match, ' ').map(utils.parseInt), v => _.isFinite(v)))
			if (item.S.n >= _.min(ints) && item.S.n <= _.max(ints)) {
				return _.max(ints) - _.min(ints)
			}
		}
	},
	/** `season 1` */
	season1(item: media.Item, slug: string) {
		let matches = slug.match(/\s(s(eason)?)?\s?\d{1,2}\s?(s(eason)?)?\s/gi) || []
		if (matches.map(v => utils.parseInt(v.trim())).includes(item.S.n)) return true
	},
	/** `s01` */
	s01(item: media.Item, slug: string) {
		let matches = slug.match(/\ss(eason)?\s?\d{1,2}\s?/gi) || []
		if (matches.map(v => utils.parseInt(v.trim())).includes(item.S.n)) return true
	},
}

if (process.env.NODE_ENV == 'development') {
	process.nextTick(async () => _.defaults(global, await import('@/scrapers/filters')))
}
