import * as _ from 'lodash'
import * as media from '@/media/media'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'

export const SKIPS = [
	// ...utils.NSFWS,
	'3d',
	// 'avi',
	// 'bonus',
	'cam',
	'camhd',
	'camrip',
	// 'enhanced',
	// 'extras',
	// 'french',
	'hdcam',
	// 'latino',
	// 'protected',
	'sample',
	'trailer',
]

export function results(result: scraper.Result, item: media.Item) {
	result.magnet = utils.clean(result.magnet)
	let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
	if (!_.isString(magnet.xt)) return console.log(`⛔ !magnet.xt ->`, result.name)
	if (magnet.xt.length != 49) return console.log(`⛔ magnet.xt != 49 ->`, result.name)

	result.name = result.name || magnet.dn
	if (!result.name) return console.log(`⛔ !result.name ->`, result.name)
	result.name = utils.toSlug(utils.stripForeign(result.name))

	let skips = utils.accuracies(item.titles.join(' '), SKIPS.join(' '))
	let skipped = utils.accuracies(result.name, skips.join(' '))
	if (skips.length - skipped.length >= 1) {
		return console.log(`⛔ skipped '${_.difference(skips, skipped)}' ->`, result.name)
	}

	return true
}

export function torrents(torrent: torrent.Torrent, item: media.Item) {
	let nsfws = utils.accuracies(item.titles.join(' '), utils.NSFWS.join(' '))
	let nsfwed = utils.accuracies(torrent.name, nsfws.join(' '))
	if (nsfws.length - nsfwed.length >= 2) {
		return // console.log(`❌ nsfw '${_.difference(nsfws, nsfwed)}' ->`, torrent.name)
	}

	let collision = item.collisions.find(v => utils.contains(torrent.name, v))
	if (collision) return // console.log(`❌ collisions '${collision}' ->`, torrent.name)

	// let filters = item.filters.concat(item.collection.name ? [item.collection.name] : [])
	let packed = false
	if (!item.filters.find(v => utils.contains(torrent.name, v))) {
		if (!item.collection.name || !utils.contains(torrent.name, item.collection.name)) {
			return // console.log(`❌ aliases ->`, torrent.name)
		}
		packed = true
	}
	let name = ` ${torrent.name} `

	if (item.movie) {
		if (torrent.packs == undefined) return true
		try {
			let titles = item.titles.join(' ')

			let extras = utils.accuracies(`${titles} 1080 1920 2160`, name)
			let years = extras.filter(v => v.length == 4 && /\d{4}/.test(v)).map(v => _.parseInt(v))
			years = _.uniq(years.filter(v => _.inRange(v, 1900, new Date().getFullYear() + 1)))

			if (name.includes(' duology ')) torrent.packs = 2
			else if (name.includes(' trilogy ')) torrent.packs = 3
			else if (name.includes(' triology ')) torrent.packs = 3
			else if (name.includes(' quadriology ')) torrent.packs = 4
			else if (name.includes(' pentalogy ')) torrent.packs = 5
			else if (name.includes(' hexalogy ')) torrent.packs = 6
			else if (name.includes(' heptalogy ')) torrent.packs = 7
			else if (name.includes(' octalogy ')) torrent.packs = 8
			else if (name.includes(' ennealogy ')) torrent.packs = 9
			else if (name.includes(' decalogy ')) torrent.packs = 10
			else if (
				packed == true ||
				years.length >= 2 ||
				utils.accuracies(titles, 'collection').find(v => name.includes(` ${v} `))
			) {
				torrent.packs = item.collection.name ? item.collection.fulls.length : years.length
			}

			return true
		} catch (error) {
			return // console.log(`❌ movie ${error.message} ->`, torrent.name)
		}
	}

	if (item.show) {
		try {
			let match = item.matches.find(v => utils.accuracy(name, v))
			if (match) return true

			let s00e00s = item.s00e00.map(v => name.match(v)).filter(v => v && v.length == 3)
			let s00e00 = s00e00s.find(v => {
				if (_.isEqual([item.S.n, item.E.n], [v[1], v[2]].map(utils.parseInt))) return true
				throw new Error(`'${v[0].trim()}'`)
			})
			if (s00e00) return true

			let e00s = item.e00.map(v => name.match(v)).filter(v => v && v.length == 2)
			let e00 = e00s.find(v => {
				if (_.isEqual([item.E.n], [v[1]].map(utils.parseInt))) return true
				throw new Error(`'${v[0].trim()}'`)
			})
			if (e00) return true

			if (torrent.packs != undefined) {
				torrent.packs = 1
				if (regex.nthseason(item, name)) return true
				if (regex.season(item, name)) return true
				if (item.seasons.filter(v => v.aired_episodes > 0).length == 1) return true

				let seasons0to = regex.seasons0to(item, name)
				if (_.isFinite(seasons0to)) {
					torrent.packs = seasons0to
					return true
				}
			}

			let straggler = item.stragglers.find(v => utils.accuracy(name, v))
			if (straggler) return true

			return // console.log(`⛔ show return false ->`, torrent.name)
		} catch (error) {
			return // console.log(`⛔ show ${error.message} ->`, torrent.name)
		}
	}
}

export const regex = {
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
