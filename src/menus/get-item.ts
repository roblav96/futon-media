import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as prompts from 'prompts'
import * as tmdb from '../adapters/tmdb'
import * as trakt from '../adapters/trakt'
import * as media from '../adapters/media'
import * as utils from '../utils'
import pDebounce from 'p-debounce'

export async function menu() {
	let item = (await prompts.prompts.autocomplete({
		message: 'Search',
		suggest: pDebounce(async (query: string) => {
			query = query.trim()
			if (query.length < 2) {
				return []
			}
			let response = (await tmdb.client.get('/search/multi', {
				query: { query },
			})) as tmdb.Paginated<tmdb.Full>
			let items = response.results
				.filter(v => ['movie', 'tv'].includes(v.media_type))
				.map(v => new media.Item(tmdb.toResult(v) as media.Result))
				.sort((a, b) => b.popularity - a.popularity)
			// .slice(0, 5)
			return items.map(item => ({
				title: `${item.full.title || item.full.name}, ${dayjs(
					item.full.release_date || item.full.first_air_date
				).year()}`,
				value: item,
			}))
		}, 100) as any,
	} as prompts.PromptObject)) as media.Item
	if (!item) {
		throw new Error('Unselected media item')
	}

	// if (item.type == 'movie') {
	// 	let result = await trakt.client.get(`/search/tmdb/${item.movie.id}`)
	// 	console.log(`result ->`, result)
	// }

	if (item.type == 'show') {
		let { seasons } = (await tmdb.client.get(`/tv/${item.show.id}`)) as tmdb.Show
		seasons = seasons.filter(v => v.season_number > 0)
		let season = (await prompts.prompts.autocomplete({
			message: `Season`,
			suggest: function(query: string) {
				query = utils.minify(query)
				let choices = seasons.map(v => ({ title: v.name, value: v }))
				if (!query) return choices
				return choices.filter(v => utils.minify(v.title).includes(query))
			} as any,
		} as prompts.PromptObject)) as tmdb.Season
		if (!season) {
			throw new Error('Unselected show season')
		}
		item.use({ season } as media.Result)

		let { episodes } = (await tmdb.client.get(
			`/tv/${item.show.id}/season/${item.season.season_number}`
		)) as tmdb.Season
		episodes = episodes.filter(v => v.episode_number > 0)
		let episode = (await prompts.prompts.autocomplete({
			message: `Episode`,
			suggest: function(query: string) {
				query = utils.minify(query)
				let choices = episodes.map(v => ({
					title: `${v.episode_number} ${v.name}`,
					value: v,
				}))
				if (!query) return choices
				return choices.filter(v => utils.minify(v.title).includes(query))
			} as any,
		} as prompts.PromptObject)) as tmdb.Episode
		if (!episode) {
			throw new Error('Unselected show episode')
		}
		item.use({ episode } as media.Result)
	}

	return item
}
