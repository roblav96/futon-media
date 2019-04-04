import memoize from 'fast-memoize'
import * as _ from 'lodash'
import * as trakt from './trakt'
import * as tmdb from './tmdb'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]

console.log(`memoize ->`, memoize)
let cached = memoize(function(n: number) {
	return Date.now() * n
})

export interface Item extends trakt.Extras {}
export class Item {
	type: ContentType
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person

	get ids() {
		return this[this.type].ids as trakt.IDs
	}
	get full() {
		return _.merge({}, ...TYPES.filter(v => this[v]).map(v => this[v])) as Full
	}

	get slugs() {
		let title = this.full.ids.slug.replace(/[-]/g, ' ')
		if (this.movie) title += ` ${this.movie.year}`
		return [title]
	}

	constructor(result: Partial<trakt.Result>) {
		this.useTrakt(result)
	}

	useTrakt(result: Partial<trakt.Result>) {
		let picked = _.pick(result, TYPES)
		_.merge(this, picked)
		this.type = result.type || (Object.keys(picked).pop() as any)
		for (let [rkey, rvalue] of Object.entries(_.omit(result, TYPES))) {
			let ikey = trakt.RESULT_ITEM[rkey]
			if (ikey) this[ikey] = rvalue
		}
		return this
	}

	useTMDB(value: Partial<tmdb.Full>) {
		return this
	}
}

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person
