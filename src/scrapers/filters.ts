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

export function runtime(parsed: parser.Parser, runtime: number, bytes: number) {
	runtime = utils.toBytes(`${runtime * 2} MB`)
	if (bytes < runtime) {
		parsed.filter = `⛔ runtime '${utils.fromBytes(bytes)}' < '${utils.fromBytes(runtime)}'`
		return false
	}
}

export function aliases(parsed: parser.Parser, aliases: string[]) {
	if (!aliases.find((v) => parsed.slug.includes(` ${v} `))) {
		parsed.filter = `⛔ !aliases`
		return false
	}
}

export function collisions(parsed: parser.Parser, collisions: string[]) {
	let collision = collisions.find((v) => parsed.slug.includes(` ${v} `))
	if (collision) {
		parsed.filter = `⛔ collision '${collision}'`
		return false
	}
}

export function aired(parsed: parser.Parser, aired: string) {
	aired = utils.allSlugs(aired).find((v) => parsed.slug.includes(` ${v} `))
	if (aired) {
		parsed.filter = `✅ aired '${aired}'`
		return true
	}
}

export function setitle(parsed: parser.Parser, titles: string[]) {
	let title = titles.find((v) => parsed.slug.includes(` ${v} `))
	if (title) {
		parsed.filter = `✅ season title '${title}'`
		return true
	}
}

export function eptitle(parsed: parser.Parser, titles: string[]) {
	let title = titles.find((v) => parsed.slug.includes(` ${v} `))
	if (title) {
		parsed.filter = `✅ episode title '${title}'`
		return true
	}
}

export function s00e00(parsed: parser.Parser, season: number, episode: number) {
	if (parsed.seasons.includes(season) && parsed.episodes.includes(episode)) {
		parsed.filter = `✅ seasons '${parsed.seasons}' episodes '${parsed.episodes}'`
		return true
	}
	parsed.filter = `⛔ seasons '${parsed.seasons}' episodes '${parsed.episodes}'`
	return false
}

export function s00(parsed: parser.Parser, season: number) {
	if (parsed.seasons.includes(season)) {
		parsed.filter = `✅ seasons '${parsed.seasons}'`
		return true
	}
	parsed.filter = `⛔ seasons '${parsed.seasons}'`
	return false
}

export function e00(parsed: parser.Parser, episode: number) {
	if (parsed.episodes.includes(episode)) {
		parsed.filter = `✅ episodes '${parsed.episodes}'`
		return true
	}
	parsed.filter = `⛔ episodes '${parsed.episodes}'`
	return false
}

export function torrents(torrent: torrent.Torrent, item: media.Item) {
	let skips = item.skips.find((v) => torrent.slug.includes(` ${v} `))
	if (skips) {
		torrent.filter = `⛔ skips '${skips}'`
		return false
	}

	let released = item.released.valueOf() - utils.duration(1, 'week')
	if (torrent.stamp < released) {
		let date = dayjs(released).format('MMM DD YYYY')
		torrent.filter = `⛔ released '${torrent.date}' < '${date}'`
		return false
	}

	if (runtime(torrent, item.runtime, torrent.boosts().bytes) == false) {
		return false
	}

	if (aliases(torrent, item.aliases) == false) {
		return false
	}

	// if (item.movie || utils.levens(torrent.slug, _.first(item.titles)) > 0) {
	if (collisions(torrent, item.collisions) == false) {
		return false
	}
	// }

	if (item.movie) {
		if (!_.isEmpty(torrent.seasons) || !_.isEmpty(torrent.episodes)) {
			torrent.filter = `⛔ seasons '${torrent.seasons}' episodes '${torrent.episodes}'`
			return false
		}
		if (!item.collection.name) {
			if (!item.years.find((v) => torrent.years.includes(v))) {
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
			if (torrent.years.length == 1 && !item.years.includes(torrent.years[0])) {
				torrent.filter = `⛔ collection years == 1 && !item years`
				return false
			}
			if (torrent.years.length == 0 && torrent.packs == 0) {
				torrent.filter = `⛔ collection years == 0`
				return false
			}
			if (
				torrent.years.length > 0 &&
				!item.collection.parts.find((v) => torrent.years.includes(v.year))
			) {
				torrent.filter = `⛔ collection !years '${torrent.years}'`
				return false
			}
			let slugs = utils.allSlugs(item.collection.name)
			if (torrent.packs >= 2 && !slugs.find((v) => torrent.slug.includes(` ${v} `))) {
				torrent.filter = `⛔ collection !name`
				return false
			}
		}
		torrent.filter = `✅ return`
		return true
	}

	if (item.show) {
		if (item.isDaily && aired(torrent, item.ep.a) == true) {
			return true
		}
		if (item.se.t && setitle(torrent, item.se.ts) == true) {
			return true
		}
		if (item.ep.t && item.ep.t != item.title && eptitle(torrent, item.ep.ts) == true) {
			return true
		}

		// trilogy in torrent name
		if (torrent.packs > item.seasons.length) {
			torrent.filter = `⛔ packs '${torrent.packs}' > '${item.seasons.length}' seasons`
			return false
		}

		if (!_.isEmpty(torrent.seasons) && !_.isEmpty(torrent.episodes)) {
			return s00e00(torrent, item.se.n, item.ep.n)
		}
		if (!_.isEmpty(torrent.seasons) && _.isEmpty(torrent.episodes)) {
			let levens = utils.levens(torrent.slug, _.last(utils.allParts(_.last(item.titles))))
			if (levens > 0 && !item.single && item.seasons.length == torrent.seasons.length) {
				torrent.filter = `⛔ levens '${levens}'`
				return false
			}
			return s00(torrent, item.se.n)
		}
		if (item.single && _.isEmpty(torrent.seasons) && !_.isEmpty(torrent.episodes)) {
			return e00(torrent, item.ep.n)
		}

		if (!_.isEmpty(torrent.years)) {
			let years = [...item.years, item.se.y, item.ep.y]
			let year = years.filter(Boolean).find((v) => torrent.years.includes(v))
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

		torrent.filter = `⛔ return`
		return false
	}
}
