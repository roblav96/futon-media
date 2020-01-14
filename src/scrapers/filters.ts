import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as dicts from '@/utils/dicts'
import * as execa from 'execa'
import * as media from '@/media/media'
import * as parser from '@/scrapers/parser'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'

export function torrents(torrent: torrent.Torrent, item: media.Item) {
	let skips = item.skips.find(v => torrent.slug.includes(` ${v} `))
	if (skips) {
		torrent.filter = `⛔ skips '${skips}'`
		return false
	}

	let released = item.released.valueOf() - utils.duration(1, 'day')
	if (torrent.stamp < released) {
		let date = dayjs(released).format('MMM DD YYYY')
		torrent.filter = `⛔ released '${torrent.date}' < '${date}'`
		return false
	}

	let bytes = utils.toBytes(`${item.runtime * 2} MB`)
	if (torrent.boosts().bytes < bytes) {
		let size = utils.fromBytes(torrent.boosts().bytes)
		torrent.filter = `⛔ runtime '${size}' < '${utils.fromBytes(bytes)}'`
		return false
	}

	// let aliases = item.aliases
	// if (item.titles.find(v => v.includes(' '))) {
	// 	aliases = aliases.filter(v => v.includes(' '))
	// }
	if (!item.aliases.find(v => torrent.slug.includes(` ${v} `))) {
		torrent.filter = `⛔ !aliases`
		return false
	}

	let collision = item.collisions.find(v => torrent.slug.includes(` ${v} `))
	if (collision) {
		torrent.filter = `⛔ collision '${collision}'`
		return false
	}

	if (item.movie) {
		if (!_.isEmpty(torrent.seasons) && !_.isEmpty(torrent.episodes)) {
			torrent.filter = `⛔ seasons '${torrent.seasons}' episodes '${torrent.episodes}'`
			return false
		}
		if (!_.isEmpty(torrent.seasons) && _.isEmpty(torrent.episodes)) {
			torrent.filter = `⛔ seasons '${torrent.seasons}'`
			return false
		}
		if (!item.collection.name) {
			if (!item.years.find(v => torrent.years.includes(v))) {
				torrent.filter = `⛔ !years '${torrent.years}'`
				return false
			}
			if (torrent.years.length >= 2) {
				torrent.filter = `⛔ years >= 2 '${torrent.years}'`
				return false
			}
			if (torrent.packs >= 2) {
				torrent.filter = `⛔ packs >= 2 '${torrent.packs}'`
				return false
			}
		}
		if (item.collection.name) {
			if (torrent.packs > item.collection.parts.length) {
				torrent.filter = `⛔ collection packs > '${item.collection.parts.length}'`
				return false
			}
			if (torrent.years.length == 1 && !item.years.includes(_.first(torrent.years))) {
				torrent.filter = `⛔ collection years == 1 && !item years`
				return false
			}
			if (torrent.years.length == 0 && torrent.packs == 0) {
				torrent.filter = `⛔ collection years == 0`
				return false
			}
			if (
				torrent.years.length > 0 &&
				!item.collection.parts.find(v => torrent.years.includes(v.year))
			) {
				torrent.filter = `⛔ collection !years '${torrent.years}'`
				return false
			}
			let slugs = utils.allSlugs(item.collection.name)
			if (torrent.packs >= 2 && !slugs.find(v => torrent.slug.includes(` ${v} `))) {
				torrent.filter = `⛔ collection !name`
				return false
			}
		}
		torrent.filter = `✅ return true`
		return true
	}

	if (item.show) {
		if (item.isDaily && item.ep.a) {
			let aired = utils.allSlugs(item.ep.a).find(v => torrent.slug.includes(` ${v} `))
			if (aired) {
				torrent.filter = `✅ aired '${aired}'`
				return true
			}
		}
		if (item.se.t) {
			let titles = utils.allTitles([item.se.t], { parts: 'all', uncamel: true })
			if (item.se.t.includes(' ')) titles = titles.filter(v => v.includes(' '))
			let title = titles.find(v => torrent.slug.includes(` ${v} `))
			if (title) {
				torrent.filter = `✅ season title '${title}'`
				return true
			}
		}
		if (item.ep.t) {
			let titles = utils.allTitles([item.ep.t], { parts: 'all', uncamel: true })
			if (item.ep.t.includes(' ')) titles = titles.filter(v => v.includes(' '))
			let title = titles.find(v => torrent.slug.includes(` ${v} `))
			if (title) {
				torrent.filter = `✅ episode title '${title}'`
				return true
			}
		}

		if (!_.isEmpty(torrent.seasons) && !_.isEmpty(torrent.episodes)) {
			if (torrent.seasons.includes(item.se.n) && torrent.episodes.includes(item.ep.n)) {
				torrent.filter = `✅ seasons '${torrent.seasons}' episodes '${torrent.episodes}'`
				return true
			}
			torrent.filter = `⛔ seasons '${torrent.seasons}' episodes '${torrent.episodes}'`
			return false
		}
		if (!_.isEmpty(torrent.seasons) && _.isEmpty(torrent.episodes)) {
			if (torrent.seasons.includes(item.se.n)) {
				torrent.filter = `✅ seasons '${torrent.seasons}'`
				return true
			}
			torrent.filter = `⛔ seasons '${torrent.seasons}'`
			return false
		}
		if (item.single && _.isEmpty(torrent.seasons) && !_.isEmpty(torrent.episodes)) {
			if (torrent.episodes.includes(item.ep.n)) {
				torrent.filter = `✅ episodes '${torrent.episodes}'`
				return true
			}
			torrent.filter = `⛔ episodes '${torrent.episodes}'`
			return false
		}

		if (!_.isEmpty(torrent.years)) {
			let years = [...item.years, item.se.y, item.ep.y]
			let year = years.filter(Boolean).find(v => torrent.years.includes(v))
			if (year) {
				torrent.filter = `✅ year '${year}'`
				return true
			}
			torrent.filter = `⛔ years >= 1 '${torrent.years}'`
			return false
		}

		if (item.single && _.isEmpty(torrent.seasons) && _.isEmpty(torrent.episodes)) {
			torrent.filter = `✅ seasons.length == 1`
			return true
		}

		torrent.filter = `⛔ return false`
		return false

		// if (
		// 	torrent.parsed.seasons.includes(item.S.n) &&
		// 	torrent.parsed.episodes.includes(item.E.n)
		// ) {
		// 	torrent.filter = `✋ parsed seasons '${torrent.parsed.seasons}' parsed episodes '${torrent.parsed.episodes}'`
		// 	return false
		// }
		// if (torrent.parsed.seasons.includes(item.S.n) && _.isEmpty(torrent.parsed.episodes)) {
		// 	torrent.filter = `✋ parsed seasons '${torrent.parsed.seasons}'`
		// 	return false
		// }

		// if (!_.isEmpty(torrent.seasons) && !_.isEmpty(torrent.episodes)) {
		// 	torrent.filter = `⛔ seasons '${torrent.seasons}' episodes '${torrent.episodes}'`
		// 	return false
		// }
		// if (!_.isEmpty(torrent.seasons) && _.isEmpty(torrent.episodes)) {
		// 	torrent.filter = `⛔ seasons '${torrent.seasons}'`
		// 	return false
		// }

		// if (torrent.seasons.includes(item.S.n)) {
		// 	if (!torrent.episodes.includes(item.E.n)) {
		// 		console.log(`⛔ episodes '${torrent.episodes}' ->`, torrent.slug, torrent.json())
		// 		return false
		// 	}
		// 	console.info(`✅ seasons '${torrent.seasons}' ->`, torrent.slug, torrent.json())
		// 	return true
		// }

		// if (torrent.episodes.length > 0) {
		// 	if (torrent.episodes.includes(item.E.n)) {
		// 		console.info(`✅ episodes '${torrent.episodes}' ->`, torrent.slug, torrent.json())
		// 		return true
		// 	}
		// 	console.log(`⛔ episodes '${torrent.episodes}' ->`, torrent.slug, torrent.json())
		// 	return false
		// }
		// if (torrent.seasons.length > 0) {
		// 	if (torrent.seasons.includes(item.S.n)) {
		// 		console.info(`✅ seasons '${torrent.seasons}' ->`, torrent.slug, torrent.json())
		// 		return true
		// 	}
		// 	console.log(`⛔ seasons '${torrent.seasons}' ->`, torrent.slug, torrent.json())
		// 	return false
		// }

		// let stragglers = [`${item.S.n}${item.E.z}`, item.E.z, item.E.n]
		// let straggler = stragglers.find(v => torrent.slug.includes(` ${v} `))
		// if (straggler) {
		// 	console.warn(`straggler '${straggler}' ->`, torrent.slug, torrent.json())
		// 	return true
		// }
	}

	// if (item.movie && torrent.packs) return true
	// let collision = item.collisions.find(v => utils.contains(torrent.name, v))
	// if (collision) {
	// 	return console.log(`⛔ collision '${collision}' ->`, torrent.short)
	// }
	// if (item.movie) return true

	// if (item.show) {
	// 	try {
	// 		// // console.time(`${torrent.filename}`)
	// 		// // let parsed = execa.sync('/usr/local/bin/guessit', [`"${torrent.filename}"`])
	// 		// let parsed = filenameParse(torrent.filename, true)
	// 		// // if (parsed.seasons.length >= 2) {
	// 		// // console.timeEnd(`${torrent.filename}`)
	// 		// console.log(`${torrent.filename} ->`, parsed)
	// 		// // }

	// 		let match = item.matches.find(v => utils.accuracy(torrent.name, v))
	// 		if (match) return true

	// 		let s00e00s = item.s00e00
	// 			.map(v => torrent.name.match(v))
	// 			.filter(v => v && v.length == 3)
	// 		let s00e00 = s00e00s.find(v => {
	// 			if (_.isEqual([item.S.n, item.E.n], [v[1], v[2]].map(utils.parseInt))) return true
	// 			throw new Error(`'${v[0].trim()}'`)
	// 		})
	// 		if (s00e00) return true

	// 		// if (torrent.packs != undefined) {
	// 		// 	torrent.packs = 1
	// 		// 	if (regex.nthseason(item, name)) return true
	// 		// 	if (regex.season(item, name)) return true

	// 		// 	let seasons0to = regex.seasons0to(item, name)
	// 		// 	if (_.isFinite(seasons0to)) {
	// 		// 		torrent.packs = seasons0to
	// 		// 		return true
	// 		// 	}
	// 		// }

	// 		let e00s = item.e00.map(v => name.match(v)).filter(v => v && v.length == 2)
	// 		let e00 = e00s.find(v => {
	// 			if (_.isEqual([item.E.n], [v[1]].map(utils.parseInt))) return true
	// 			throw new Error(`'${v[0].trim()}'`)
	// 		})
	// 		if (e00) return true

	// 		let straggler = item.stragglers.find(v => utils.accuracy(name, v))
	// 		if (straggler) return true

	// 		return console.log(`⛔ return false ->`, torrent.short)
	// 	} catch (error) {
	// 		// console.error(`⛔ catch show ${torrent.short} -> %O`, error)
	// 		return console.log(`⛔ catch show ${error.message} ->`, torrent.short)
	// 	}
	// }
}

// export const regex = {
// 	/** `1st season` */
// 	nthseason(item: media.Item, slug: string) {
// 		let matches = slug.match(/ (?<season>\d{1,2})[a-z]{2} (season|chapter) /gi)
// 		matches = (matches || []).map(v => v.trim())
// 		let seasons = matches.map(v => utils.parseInt(v))
// 		if (seasons.includes(item.S.n)) return true
// 	},
// 	/** `season one` */
// 	season(item: media.Item, slug: string) {
// 		let nstrs = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
// 		let matches = slug.match(
// 			/\ss(eason)?\s(one|two|three|four|five|six|seven|eight|nine|ten)\s/gi,
// 		)
// 		matches = (matches || []).map(v => v.trim())
// 		let nstr = matches.map(v => v.split(' ').pop())[0]
// 		let index = nstrs.findIndex(v => v == nstr) + 1
// 		if (item.S.n == index) return true
// 	},
// 	/** `seasons 1 - 2` */
// 	seasons0to(item: media.Item, slug: string) {
// 		slug = slug.replace(/(through)|(and)|(to)/gi, ' ').replace(/\s+/g, ' ')
// 		let matches = [
// 			slug.match(/\s?s(eason(s)?)?\s?\d{1,2}\s?s?(eason)?(\s?\d{1,2}\s)+/gi) || [],
// 			slug.match(/\s?s(eason)?\s?\d{1,2}\s/gi) || [],
// 		].flat()
// 		matches = (matches || []).map(v => v.trim())
// 		matches = matches.join(' ').split(' ')
// 		let ints = matches.map(utils.parseInt).filter(v => _.isInteger(v) && v < 100)
// 		let { min, max } = { min: _.min(ints), max: _.max(ints) }
// 		if (item.S.n >= min && item.S.n <= max) {
// 			return max - min + 1
// 		}
// 	},
// }

// if (process.DEVELOPMENT) {
// 	process.nextTick(async () => _.defaults(global, await import('@/scrapers/filters')))
// }
