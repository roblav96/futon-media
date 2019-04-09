import * as _ from 'lodash'
import * as tmdb from './adapters/tmdb'
import * as trakt from './adapters/trakt'

export const MOVIE = {
	movie: {
		adult: false,
		backdrop_path: '/1R2ihQztuRTIqN3pFBR1yrBMd7w.jpg',
		belongs_to_collection: {
			backdrop_path: '/z5A5W3WYJc3UVEWljSGwdjDgQ0j.jpg',
			id: 9485,
			name: 'The Fast and the Furious Collection',
			poster_path: '/uv63yAGg1zETAs1XQsOQpava87l.jpg',
		},
		budget: 85000000,
		certification: 'PG-13',
		comment_count: 5,
		country: 'us',
		genres: [
			{
				id: 28,
				name: 'Action',
			},
			{
				id: 80,
				name: 'Crime',
			},
			{
				id: 18,
				name: 'Drama',
			},
			{
				id: 53,
				name: 'Thriller',
			},
		],
		homepage: 'http://www.fastandfuriousmovie.net',
		id: 13804,
		ids: {
			imdb: 'tt1013752',
			slug: 'fast-furious-2009',
			tmdb: 13804,
			trakt: 8202,
		},
		imdb_id: 'tt1013752',
		language: 'en',
		original_language: 'en',
		original_title: 'Fast & Furious',
		overview:
			"When a crime brings them back to L.A., fugitive ex-con Dom Toretto reignites his feud with agent Brian O'Conner. But as they are forced to confront a shared enemy, Dom and Brian must give in to an uncertain new trust if they hope to outmaneuver him. And the two men will find the best way to get revenge: push the limits of what's possible behind the wheel.",
		popularity: 2.155,
		poster_path: '/ft8IqAGFs3V7i87z0t0EVRUjK1p.jpg',
		production_countries: [
			{
				iso_3166_1: 'US',
				name: 'United States of America',
			},
		],
		rating: 7.11981,
		release_date: '2009-04-02',
		released: '2009-04-03',
		revenue: 363164265,
		runtime: 107,
		spoken_languages: [
			{
				iso_639_1: 'en',
				name: 'English',
			},
		],
		status: 'Released',
		tagline: 'New Model. Original Parts.',
		title: 'Fast & Furious',
		trailer: 'http://youtube.com/watch?v=9c3-mpDxX-A',
		updated_at: '2019-03-16T09:18:18.000Z',
		video: false,
		vote_average: 6.5,
		vote_count: 3748,
		votes: 8472,
		year: 2009,
	},
	score: 495.50922,
} as trakt.Result & tmdb.Result

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
} as trakt.Result

export const EPISODE = TV
export const SEASON = _.omit(TV, 'episode')
export const SHOW = _.omit(TV, 'episode', 'season')
