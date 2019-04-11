import * as _ from 'lodash'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'

export const MOVIE = {
	movie: {
		adult: false,
		backdrop_path: '/6P3c80EOm7BodndGBUAJHHsHKrp.jpg',
		belongs_to_collection: {
			backdrop_path: '/2KjtWUBiksmN8LsUouaZnxocu5N.jpg',
			id: 422834,
			name: 'Ant-Man Collection',
			poster_path: '/tdKbDECJQ3JmYaMubNaKFM1mgcY.jpg',
		},
		budget: 140000000,
		certification: 'PG-13',
		comment_count: 73,
		country: 'us',
		genres: [
			{
				id: 28,
				name: 'Action',
			},
			{
				id: 12,
				name: 'Adventure',
			},
			{
				id: 878,
				name: 'Science Fiction',
			},
			{
				id: 35,
				name: 'Comedy',
			},
			{
				id: 10751,
				name: 'Family',
			},
			'family',
		],
		homepage: 'https://www.marvel.com/movies/ant-man-and-the-wasp',
		id: 363088,
		ids: {
			imdb: 'tt5095030',
			slug: 'ant-man-and-the-wasp-2018',
			tmdb: 363088,
			trakt: 223262,
		},
		imdb_id: 'tt5095030',
		language: 'en',
		original_language: 'en',
		original_title: 'Ant-Man and the Wasp',
		overview:
			'Just when his time under house arrest is about to end, Scott Lang once again puts his freedom at risk to help Hope van Dyne and Dr. Hank Pym dive into the quantum realm and try to accomplish, against time and any chance of success, a very dangerous rescue mission.',
		popularity: 53.049,
		poster_path: '/rv1AWImgx386ULjcf62VYaW8zSt.jpg',
		production_countries: [
			{
				iso_3166_1: 'US',
				name: 'United States of America',
			},
		],
		rating: 7.52238,
		release_date: '2018-07-04',
		released: '2018-07-06',
		revenue: 622379576,
		runtime: 119,
		spoken_languages: [
			{
				iso_639_1: 'en',
				name: 'English',
			},
		],
		status: 'Released',
		tagline: 'Real heroes. Not actual size.',
		title: 'Ant-Man and the Wasp',
		trailer: 'http://youtube.com/watch?v=8_rTIAOohas',
		updated_at: '2019-04-06T09:27:17.000Z',
		video: false,
		vote_average: 7,
		vote_count: 5444,
		votes: 16111,
		year: 2018,
	},
	score: 829.3768,
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
