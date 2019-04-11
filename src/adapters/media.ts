import * as _ from 'lodash'
import * as memoize from 'mem'
import * as trakt from './trakt'
import * as tmdb from './tmdb'
import * as utils from '../utils'
import * as Memoize from '../memoize'
import { oc } from 'ts-optchain'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]

export interface Item extends trakt.Extras {}
@Memoize.Class
export class Item {
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person

	get type() {
		return _.findLast(TYPES, type => !!this[type])
	}
	get ids() {
		if (this.movie) return this.movie.ids
		if (this.show) return this.show.ids
		return this[this.type].ids
	}
	get full() {
		return _.merge({}, ...TYPES.map(v => this[v])) as Full
	}

	get S() {
		let n = oc(this.season).number(NaN) || oc(this.episode).season(NaN)
		return { n, z: utils.zeroSlug(n) }
	}
	get E() {
		let n = oc(this.episode).number(NaN)
		return { n, z: utils.zeroSlug(n) }
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

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person
