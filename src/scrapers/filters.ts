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

export function torrents(parsed: parser.Parser, item: media.Item) {
	let skipping = item.skips.find(v => parsed.slug.includes(` ${v} `))
	if (skipping) {
		parsed.filter = `⛔ skipping '${skipping}'`
		return false
	}

	let collision = item.collisions.find(v => parsed.slug.includes(` ${v} `))
	if (collision) {
		parsed.filter = `⛔ collision '${collision}'`
		return false
	}

	if (!item.aliases.find(v => parsed.slug.includes(` ${v} `))) {
		parsed.filter = `⛔ !aliases`
		return false
	}

	if (item.movie) {
		if (!_.isEmpty(parsed.seasons) && !_.isEmpty(parsed.episodes)) {
			// parsed.filter = `⛔ seasons '${parsed.seasons}' episodes '${parsed.episodes}'`
			return false
		}
		if (!_.isEmpty(parsed.seasons) && _.isEmpty(parsed.episodes)) {
			// parsed.filter = `⛔ seasons '${parsed.seasons}'`
			return false
		}
		if (!item.collection.name) {
			if (!item.years.find(v => parsed.years.includes(v))) {
				parsed.filter = `⛔ !years '${parsed.years}'`
				return false
			}
			if (parsed.years.length >= 2) {
				parsed.filter = `⛔ years >= 2 '${parsed.years}'`
				return false
			}
			if (parsed.packs >= 2) {
				parsed.filter = `⛔ packs >= 2 '${parsed.packs}'`
				return false
			}
		}
		if (item.collection.name) {
			if (parsed.packs > item.collection.years.length) {
				parsed.filter = `⛔ collection packs > ${item.collection.years.length}`
				return false
			}
			if (parsed.years.length == 1 && !item.years.includes(_.first(parsed.years))) {
				parsed.filter = `⛔ collection years == 1 && !item years`
				return false
			}
			if (parsed.years.length == 0 && parsed.packs == 0) {
				parsed.filter = `⛔ collection years == 0`
				return false
			}
			if (
				parsed.years.length > 0 &&
				!item.collection.years.find(v => parsed.years.includes(v))
			) {
				parsed.filter = `⛔ collection !years '${parsed.years}'`
				return false
			}
			let slugs = utils.allSlugs(item.collection.name)
			if (parsed.packs >= 2 && !slugs.find(v => parsed.slug.includes(` ${v} `))) {
				parsed.filter = `⛔ collection !name`
				return false
			}
		}
		parsed.filter = `✅ return true`
		return true
	}

	if (item.show) {
		if (item.isDaily && item.E.a) {
			let aired = utils.allSlugs(item.E.a).find(v => parsed.slug.includes(` ${v} `))
			if (aired) {
				parsed.filter = `✅ aired '${aired}'`
				return true
			}
		}
		if (item.S.t) {
			let titles = utils.allTitles([item.S.t], { parts: 'all', uncamel: true })
			titles = titles.filter(v => v.includes(' '))
			let title = titles.find(v => parsed.slug.includes(` ${v} `))
			if (title) {
				parsed.filter = `✅ season title '${title}'`
				return true
			}
		}
		if (item.E.t) {
			let titles = utils.allTitles([item.E.t], { parts: 'all', uncamel: true })
			titles = titles.filter(v => v.includes(' '))
			let title = titles.find(v => parsed.slug.includes(` ${v} `))
			if (title) {
				parsed.filter = `✅ episode title '${title}'`
				return true
			}
		}

		let years = [...item.years]
		if (item.E.a) years.push(dayjs(item.E.a).year())
		if (parsed.years.length > 0) {
			let year = years.find(v => parsed.years.includes(v))
			if (year) {
				parsed.filter = `✅ year '${year}'`
				return true
			}
			parsed.filter = `⛔ years >= 1 '${parsed.years}'`
			return false
		}

		if (!_.isEmpty(parsed.seasons) && !_.isEmpty(parsed.episodes)) {
			if (parsed.seasons.includes(item.S.n) && parsed.episodes.includes(item.E.n)) {
				parsed.filter = `✅ seasons '${parsed.seasons}' episodes '${parsed.episodes}'`
				return true
			}
			parsed.filter = `⛔ seasons '${parsed.seasons}' episodes '${parsed.episodes}'`
			return false
		}
		if (!_.isEmpty(parsed.seasons) && _.isEmpty(parsed.episodes)) {
			if (parsed.seasons.includes(item.S.n)) {
				parsed.filter = `✅ seasons '${parsed.seasons}'`
				return true
			}
			parsed.filter = `⛔ seasons '${parsed.seasons}'`
			return false
		}

		if (
			item.seasons.filter(v => v.aired_episodes > 0).length == 1 &&
			_.isEmpty(parsed.seasons) &&
			_.isEmpty(parsed.episodes)
		) {
			parsed.filter = `✅ seasons.length == 1`
			return true
		}

		parsed.filter = `⛔ return false`
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
