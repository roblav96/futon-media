import * as _ from 'lodash'
import * as media from './adapters/media'

const TV = {
	episode: {
		comment_count: 8,
		first_aired: '2013-04-22T01:00:00.000Z',
		ids: {
			imdb: 'tt2178798',
			tmdb: 63082,
			trakt: 73663,
			tvdb: 4517460,
			tvrage: 1065289512,
		},
		number: 4,
		number_abs: 24,
		overview:
			"Trouble brews among the Night's Watch at Craster's. Margaery takes Joffrey out of his comfort zone. Arya meets the leader of the Brotherhood. Varys plots revenge on an old foe. Theon mournfully recalls his missteps. Daenerys deftly orchestrates her exit from Astapor.",
		rating: 8.55425,
		runtime: 53,
		season: 3,
		title: 'And Now His Watch Is Ended',
		updated_at: '2019-04-07T05:10:35.000Z',
		votes: 9954,
	},
	score: 562.5521,
	season: {
		aired_episodes: 10,
		episode_count: 10,
		first_aired: '2013-04-01T01:00:00.000Z',
		ids: {
			tmdb: 3626,
			trakt: 3965,
			tvdb: 488434,
			tvrage: null,
		},
		network: 'HBO',
		number: 3,
		overview:
			"Duplicity and treachery...nobility and honor...conquest and triumph...and, of course, dragons. In Season 3, family and loyalty are the overarching themes as many critical storylines from the first two seasons come to a brutal head. Meanwhile, the Lannisters maintain their hold on King's Landing, though stirrings in the North threaten to alter the balance of power; Robb Stark, King of the North, faces a major calamity as he tries to build on his victories; a massive army of wildlings led by Mance Rayder march for the Wall; and Daenerys Targaryen--reunited with her dragons--attempts to raise an army in her quest for the Iron Throne.",
		rating: 9.08289,
		title: 'Season 3',
		votes: 2425,
	},
	show: {
		aired_episodes: 67,
		airs: {
			day: 'Sunday',
			time: '21:00',
			timezone: 'America/New_York',
		},
		certification: 'TV-MA',
		comment_count: 296,
		country: 'us',
		first_aired: '2011-04-18T01:00:00.000Z',
		genres: ['drama', 'fantasy', 'science-fiction', 'action', 'adventure'],
		homepage: 'http://www.hbo.com/game-of-thrones',
		ids: {
			imdb: 'tt0944947',
			slug: 'game-of-thrones',
			tmdb: 1399,
			trakt: 1390,
			tvdb: 121361,
			tvrage: 24493,
		},
		language: 'en',
		network: 'HBO',
		overview:
			"Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest north. Amidst the war, a neglected military order of misfits, the Night's Watch, is all that stands between the realms of men and the icy horrors beyond.",
		rating: 9.30097,
		runtime: 60,
		status: 'returning series',
		title: 'Game of Thrones',
		trailer: 'http://youtube.com/watch?v=bjqEWgDVPe0',
		updated_at: '2019-04-06T18:28:59.000Z',
		votes: 89662,
		year: 2011,
	},
} as any

export const EPISODE = new media.Item(_.merge({}, TV, { type: 'episode' }))
export const SEASON = new media.Item(_.merge({}, _.omit(EPISODE, 'episode'), { type: 'season' }))
export const SHOW = new media.Item(_.merge({}, _.omit(SEASON, 'season'), { type: 'show' }))
