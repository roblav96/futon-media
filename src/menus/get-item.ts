import * as _ from 'lodash'
import * as prompts from 'prompts'
import * as trakt from '../adapters/trakt'
import * as media from '../adapters/media'
import pDebounce from 'p-debounce'

export async function menu() {
	let item = (await prompts.prompts.autocomplete({
		message: `Search Movies and TV Shows`,
		suggest: pDebounce(async (query: string) => {
			query = query.trim()
			if (query.length < 2) return []
			let response = (await trakt.http.get('/search/movie,show,episode', {
				query: { query },
			})) as trakt.Result[]
			let items = response
				.map(v => new media.Item(v))
				.sort((a, b) => b.full.votes - a.full.votes)
				.slice(0, 10)
			return items.map(item => ({
				title: `${item.full.title}, ${item.full.year}`,
				value: item,
			}))
		}, 100) as any,
	} as prompts.PromptObject)) as media.Item
	if (!item) throw new Error('Unselected media item')

	if (item.type == 'show') {
		let seasons = (await trakt.http.get(`/shows/${item.show.ids.slug}/seasons`)) as trakt.Season[]
		seasons = seasons.filter(v => v.number > 0)
		let season = (await prompts.prompts.autocomplete({
			message: `Season`,
			suggest: function(query: string) {
				let choices = seasons.map(season => ({ title: season.title, value: season }))
				if (!query) return choices
				return choices.filter(v => v.title.endsWith(query))
			} as any,
		} as prompts.PromptObject)) as trakt.Season
		if (!season) throw new Error('Unselected show season')
		item.useTrakt({ season })

		let episodes = (await trakt.http.get(
			`/shows/${item.show.ids.slug}/seasons/${item.season.number}/episodes`
		)) as trakt.Episode[]
		episodes = episodes.filter(v => v.number > 0)
		let episode = (await prompts.prompts.autocomplete({
			message: `Episode`,
			suggest: function(query: string) {
				let choices = episodes.map(episode => ({
					title: `${episode.number} ${episode.title}`,
					value: episode,
				}))
				if (!query) return choices
				return choices.filter(v => v.title.startsWith(query))
			} as any,
		} as prompts.PromptObject)) as trakt.Episode
		if (!episode) throw new Error('Unselected show episode')
		item.useTrakt({ episode })
	}

	return item
}
