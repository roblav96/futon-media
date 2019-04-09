import * as _ from 'lodash'
import * as memoize from 'mem'
import * as trakt from './trakt'
import * as tmdb from './tmdb'
import * as utils from '../utils'
import * as Memoize from '../memoize'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]

export interface Item extends trakt.Extras {}
@Memoize.Class
export class Item {
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person

	// @Memoize.Desc
	get type() {
		return _.findLast(TYPES, type => !!this[type])
	}
	// _full = memoize(() => {
	// 	return _.merge({}, ...TYPES.map(v => this[v])) as Full
	// })
	// @Memoize.Desc
	get full() {
		return _.merge({}, ...TYPES.map(v => this[v])) as Full
		// return this._full()
	}
	// @Memoize.Desc
	get ids() {
		return this[this.type].ids
	}

	// @Memoize.Desc
	get s00() {
		let n = this.season.number || this.episode.season
		return { n, z: utils.zeroSlug(n) }
	}
	// @Memoize.Desc
	get e00() {
		let n = this.episode.number
		return { n, z: utils.zeroSlug(n) }
	}

	_count = 0
	// @Memoize.Desc
	get count() {
		this._count++
		return this._count
	}

	constructor(result: PartialDeep<trakt.Result & tmdb.Result>) {
		this.use(result)
	}

	use(result: PartialDeep<trakt.Result & tmdb.Result>) {
		let picked = _.pick(result, TYPES)
		_.merge(this, picked)
		for (let [rkey, rvalue] of Object.entries(_.omit(result, TYPES))) {
			let ikey = trakt.RESULT_ITEM[rkey]
			if (ikey) {
				this[ikey] = rvalue
			}
		}
		Memoize.clear(this)
		return this
	}
}
console.log(`Item ->`)
console.dir(Item)

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person
