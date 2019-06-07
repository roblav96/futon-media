import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as Memoize from '@/utils/memoize'
import * as omdb from '@/adapters/omdb'
import * as pAll from 'p-all'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]
export const MAIN_TYPES = ['movie', 'show'] as MainContentType[]
export const TYPESS = ['movies', 'shows', 'seasons', 'episodes', 'people'] as ContentTypes[]
export const MAIN_TYPESS = ['movies', 'shows'] as MainContentTypes[]

export interface Item extends trakt.Extras {}
@Memoize.Class
export class Item {
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person

	get full() {
		return _.merge({}, ...TYPES.map(v => this[v])) as Full
	}
	get main() {
		if (this.movie) return this.movie
		if (this.show) return this.show
		return this.full
	}
	get type() {
		return MAIN_TYPES.find(type => !!this[type])
	}
	get ids() {
		return this.main.ids
	}
	get title() {
		return this.main.title
	}
	get slug() {
		return this.ids.slug
	}
	get trakt() {
		return this.ids.trakt
	}
	get short() {
		let episodes = this.show ? ` [${this.show.aired_episodes.toLocaleString()} eps] ` : ' '
		let short = `${this.slug}${episodes}[${this.main.votes.toLocaleString()}]`
		if (this.invalid) short += ' [INVALID]'
		else if (this.isJunk(0)) short += ' [JUNK]'
		return short
	}
	get smallests() {
		let index = this.slug.lastIndexOf(`-${this.year}`)
		let slug = (index == -1 ? this.slug : this.slug.slice(0, index)).replace(/-/g, ' ')
		let titles = this.titles.map(v => utils.toSlug(v))
		return { slug, smallest: utils.byLength([...titles, slug].filter(Boolean))[0] }
	}

	get traktId() {
		if (_.has(this.ids, 'trakt')) return this.ids.trakt.toString()
		if (_.has(this.ids, 'imdb')) return this.ids.imdb
		if (_.has(this.ids, 'slug')) return this.ids.slug
		return ''
	}
	get year() {
		if (_.isFinite(this.main.year)) return this.main.year
		if (_.has(this.movie, 'released')) return dayjs(this.movie.released).year()
		if (_.has(this.show, 'first_aired')) return dayjs(this.show.first_aired).year()
		return NaN
	}
	get released() {
		if (_.has(this.movie, 'released')) return new Date(this.movie.released)
		if (_.has(this.show, 'first_aired')) return new Date(this.show.first_aired)
		return new Date(new Date().setFullYear(this.year))
	}
	get runtime() {
		if (_.has(this.movie, 'runtime')) return this.movie.runtime
		// if (_.has(this.episode, 'runtime')) return this.episode.runtime
		if (_.has(this.show, 'runtime')) return this.show.runtime
		return 0
	}

	get isEnglish() {
		return _.has(this.main, 'language') && (this.main.language || '').includes('en')
	}
	get isReleased() {
		return this.released.valueOf() < Date.now()
	}
	get hasRuntime() {
		return this.runtime >= 10
	}
	get invalid() {
		if (!this.main.title || !this.main.year) return true
		if (!this.ids.trakt || !this.ids.slug) return true
		if (this.show && !(this.show.aired_episodes > 0)) return true
		return false
	}
	isPopular(votes = 500) {
		if (!_.has(this.main, 'votes')) return false
		let months = (Date.now() - this.released.valueOf()) / utils.duration(1, 'month')
		let penalty = 1 - _.clamp(_.ceil(months), 1, 12) / 12
		votes -= _.ceil(votes * 0.5 * penalty)
		return this.main.votes >= votes
	}
	isJunk(votes = 1000) {
		if (this.invalid || !this.isReleased || !this.hasRuntime) return true
		return !this.ids.imdb || !this.isEnglish || !this.isPopular(votes)
	}

	get isDaily() {
		if (this.movie) return false
		let genres = [/** 'drama', */ 'news', 'game-show', 'talk-show']
		return this.main.genres.filter(v => genres.includes(v)).length > 0
	}

	/** season */
	get S() {
		let S = {
			/** season `aired episodes` */ a: NaN,
			/** season `episode count` */ e: NaN,
			/** season `title` */ t: '',
			/** season `number` */ n: NaN,
			/** season `0 number` */ z: '',
		}
		if (_.has(this.season, 'aired_episodes')) S.a = this.season.aired_episodes
		if (_.has(this.season, 'episode_count')) S.e = this.season.episode_count
		if (_.has(this.season, 'number')) S.n = this.season.number
		else if (_.has(this.episode, 'season')) S.n = this.episode.season
		if (_.isFinite(S.n)) S.z = utils.zeroSlug(S.n)
		if (_.has(this.season, 'title')) {
			S.t = this.season.title.replace(`Season ${S.n}`, '').trim()
		}
		return S
	}

	/** episode */
	get E() {
		let E = {
			/** episode `aired date` */ a: '',
			/** episode `title` */ t: '',
			/** episode `number` */ n: NaN,
			/** episode `0 number` */ z: '',
		}
		if (_.has(this.episode, 'first_aired')) {
			E.a = dayjs(this.episode.first_aired).format('YYYY-MM-DD')
		}
		if (_.has(this.episode, 'title')) {
			E.t = this.episode.title
			if (this.isDaily) {
				E.t = _.slice(utils.stops(E.t).split(' '), 0, 2).join(' ')
			}
		}
		if (_.has(this.episode, 'number')) {
			E.n = this.episode.number
			E.z = utils.zeroSlug(E.n)
		}
		return E
	}

	omdb: omdb.Full
	async setOmdb() {
		this.omdb = (await omdb.client.get('/', {
			query: { i: this.ids.imdb },
			silent: true,
		})) as omdb.Full
	}

	tmdb: tmdb.Full
	async setTmdb() {
		if (!this.ids.tmdb) return
		let type = this.show ? 'tv' : 'movie'
		this.tmdb = (await tmdb.client.get(`/${type}/${this.ids.tmdb}`, {
			silent: true,
		})) as tmdb.Full
		if (this.tmdb.belongs_to_collection) {
			this.tmdb.belongs_to_collection = (await tmdb.client.get(
				`/collection/${this.tmdb.belongs_to_collection.id}`,
				{ silent: true }
			)) as tmdb.Collection
		}
	}

	seasons: trakt.Season[]
	async setSeasons() {
		if (!this.show) return
		this.seasons = ((await trakt.client.get(`/shows/${this.slug}/seasons`, {
			// silent: true,
		})) as trakt.Season[]).filter(v => v.number > 0)
	}

	// episodes: trakt.Episode[]
	// async setEpisodes() {
	// 	if (!this.show) return
	// 	this.episodes = (await Promise.all(
	// 		['last_episode', 'next_episode'].map(url =>
	// 			trakt.client.get(`/shows/${this.slug}/${url}`, {
	// 				// silent: true,
	// 			})
	// 		)
	// 	)).filter(Boolean)
	// }

	aliases: string[]
	async setAliases() {
		let aliases = [] as string[]

		let response = (await trakt.client.get(`/${this.type}s/${this.slug}/aliases`, {
			// silent: true,
		})) as trakt.Alias[]
		let trakts = (response || []).filter(v => ['gb', 'us'].includes(v.country))
		aliases.push(...trakts.map(v => v.title))

		if (this.ids.tmdb) {
			let { titles } = (await tmdb.client
				.get(`/${this.movie ? 'movie' : 'tv'}/${this.ids.tmdb}/alternative_titles`, {
					silent: true,
				})
				.catch(() => ({ titles: [] }))) as tmdb.AlternativeTitles
			let tmdbs = (titles || []).filter(v => ['GB', 'US'].includes(v.iso_3166_1))
			aliases.push(...tmdbs.map(v => v.title))
		}

		aliases = _.uniq(aliases.map(v => utils.clean(v)))
		console.log(`setAliases '${this.slug}' aliases ->`, utils.byLength(aliases))

		// let { slug, smallest } = this.smallests
		// let skips = '3d disc disc1 disc2 edition extended imax part part1 part2 special untitled'
		// skips = utils.accuracies(this.title, skips).join(' ')
		_.remove(aliases, alias => {
			if (utils.isForeign(alias)) return true
			// if (utils.accuracies(alias, skips).length < skips.split(' ').length) return true
			// if (utils.contains(alias, this.year.toString())) return true
			// if (utils.minify(alias).length < utils.minify(smallest).length) return true
			// if (alias.split(' ').length == 1) return true
			// if (alias.split(this.title).length > 2) return true
			// if (utils.accuracy(this.title, alias).length <= 1) return true
			// if (!utils.startsWith(alias, this.title)) return true
			// // if (!utils.equals(alias.split(' ').shift(), this.title.split(' ').shift())) return true
			// // if (alias.length > this.title.length && !utils.includes(alias, this.title)) return true
		})

		aliases.push(...this.titles)
		aliases.push(this.smallests.slug)
		aliases.push(this.collection.name)

		aliases = aliases.filter(Boolean)
		aliases = aliases.map(v => utils.unsquash(v)).flat()
		aliases = utils.byLength(aliases)
		aliases = aliases.map(v => [v, ...this.toYears(v)]).flat()

		this.aliases = _.uniq(aliases)
		// console.log(`setAliases '${this.slug}' aliases ->`, this.aliases)
	}

	collisions: string[]
	async setCollisions() {
		let titles = [...this.titles, this.collection.name].filter(Boolean)
		let title = utils.byLength(titles)[0].toLowerCase()
		let simple = utils.simplify(title)
		let stops = utils.stops(simple)
		let query = (stops.includes(' ') && stops) || (simple.includes(' ') && simple) || title
		let squashes = utils.unsquash(query)
		let queries = _.uniq([query, utils.clean(query), ...squashes, utils.unisolate(squashes)])

		let results = (await pAll(
			queries.map(query => async () =>
				(await trakt.client.get(`/search/${this.type}`, {
					query: { query, fields: 'title,translations,aliases', limit: 100 },
					// silent: true,
				})) as trakt.Result[]
			),
			{ concurrency: 1 }
		)).flat()

		let items = results.map(v => new Item(v)).filter(v => v.trakt != this.trakt)
		items = _.sortBy(_.uniqBy(items, 'slug'), ['slug'])
		// console.log(`setCollisions '${this.slug}' items ->`, items.map(v => v.short))

		let collisions = [] as string[]
		let votes = _.ceil(this.main.votes * 0.01)
		for (let item of items) {
			if (
				this.collection.fulls.find(v => v.id == item.ids.tmdb) ||
				(utils.equals(item.title, title) && item.main.votes > votes) ||
				(utils.equals(item.smallests.slug, title) && item.main.votes > votes)
				// (this.title.includes(' ') && utils.contains(item.title, title))
				// (this.title.includes(' ') &&
				// 	(utils.startsWith(item.title, title) || utils.endsWith(item.title, title)))
			) {
				await item.setAliases()
				collisions.push(...item.aliases)
			} else {
				let aliases = [item.title, item.smallests.slug]
				aliases = aliases.map(v => utils.unsquash(v)).flat()
				aliases = aliases.map(v => [v, ...item.toYears(v)]).flat()
				collisions.push(...aliases)
			}
		}

		_.remove(collisions, collision => {
			if (this.aliases.find(v => utils.equals(v, collision))) return true
			if (this.aliases.find(v => utils.contains(v, collision))) return true
		})

		this.collisions = _.uniq(collisions)
		// console.log(`setCollisions '${this.slug}' collisions ->`, this.collisions)
	}

	async setAll() {
		await Promise.all([this.setOmdb(), this.setSeasons(), this.setTmdb()])
		Memoize.clear(this)
		await this.setAliases()
		await this.setCollisions()
		Memoize.clear(this)
	}

	get titles() {
		let titles = [this.title]
		if (_.has(this.omdb, 'Title')) titles.push(this.omdb.Title)
		if (_.has(this.tmdb, 'name')) titles.push(this.tmdb.name)
		return utils.byLength(utils.unique(titles.filter(Boolean)))
	}
	get years() {
		let years = [this.year]
		if (_.has(this.omdb, 'Year')) years.push(_.parseInt(this.omdb.Year))
		if (_.has(this.tmdb, 'release_date')) years.push(dayjs(this.tmdb.release_date).year())
		if (_.has(this.tmdb, 'first_air_date')) years.push(dayjs(this.tmdb.first_air_date).year())
		return _.uniq(years.filter(Boolean)).sort()
	}
	toYears(slug: string) {
		return this.years.filter(year => !slug.endsWith(`${year}`)).map(year => `${slug} ${year}`)
	}
	get collection() {
		let collection = { name: '', fulls: [] as tmdb.Movie[], titles: [] as string[] }
		if (!_.has(this.tmdb, 'belongs_to_collection.name')) return collection
		let name = this.tmdb.belongs_to_collection.name
		collection.name = name.slice(0, name.lastIndexOf(' '))
		collection.fulls = this.tmdb.belongs_to_collection.parts
		collection.titles = this.tmdb.belongs_to_collection.parts.map(v => v.title)
		return collection
	}
	get slugs() {
		let slugs = _.flatten(
			this.titles.map(title => {
				let squashes = utils.unsquash(title)
				if (squashes.length == 1) return squashes
				squashes[0] = utils.unisolate(squashes)
				let simple = utils.simplify(title)
				if (!simple.includes(' ')) return squashes
				if (!utils.stops(simple).includes(' ')) return squashes
				return [utils.toSlug(simple)]
			})
		)
		if (this.isDaily) {
			return [utils.byLength(_.uniq([...slugs, ...this.aliases]))[0]]
		}
		if (this.movie) {
			slugs = slugs.map(v => this.toYears(v)).flat()
			if (!this.isPopular(1000)) {
				let title = this.titles[0]
				let semi = title.lastIndexOf(': ')
				if (semi >= 0) title = title.slice(semi)
				slugs.push(utils.toSlug(title))
				this.collection.name && slugs.push(utils.toSlug(this.collection.name))
			}
			slugs = slugs.filter(v => utils.commons(v))
		}
		return _.uniq(slugs)
	}
	get queries() {
		let queries = [] as string[]
		if (this.movie) return queries
		if (this.isDaily) {
			this.E.t && queries.push(this.E.t)
			this.E.a && queries.push(this.E.a)
		}
		this.E.n && queries.push(`s${this.S.z}e${this.E.z}`)
		this.S.t && queries.push(this.S.t)
		let next = this.seasons.find(v => v.number == this.S.n + 1)
		let eps = [this.S.a, this.S.e].filter(v => _.isFinite(v))
		let packed = (next && next.episode_count > 0) || (eps.length == 2 && eps[0] == eps[1])
		if (packed) {
			this.S.n && queries.push(`s${this.S.z}`)
			this.S.n && queries.push(`season ${this.S.n}`)
		}
		return _.uniq(queries)
	}
	get tests() {
		let tests = [] as string[]
		this.S.t && tests.push(this.S.t)
		this.S.n && tests.push(`s${this.S.z}`)
		this.S.n && tests.push(`season ${this.S.n}`)
		this.E.t && tests.push(this.E.t)
		this.E.a && tests.push(this.E.a)
		this.E.n && tests.push(`s${this.S.z}e${this.E.z}`)
		return tests
	}

	constructor(result: PartialDeep<trakt.Result & tmdb.Result>) {
		this.use(result)
	}

	use(result: PartialDeep<trakt.Result & tmdb.Result>) {
		let picked = _.pick(result, TYPES)
		_.merge(this, picked)
		for (let [rkey, rvalue] of Object.entries(_.omit(result, TYPES))) {
			let ikey = trakt.RESULT_ITEM[rkey]
			if (ikey) this[ikey] = rvalue
		}
		Memoize.clear(this)
		return this
	}
}

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type MainContentType = 'movie' | 'show'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type MainContentTypes = 'movies' | 'shows'
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person
