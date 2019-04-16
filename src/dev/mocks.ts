import * as _ from 'lodash'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'

export const MOVIES = {
	'ant-man-and-the-wasp-2018': {
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
			popularity: 52.48,
			poster_path: '/rv1AWImgx386ULjcf62VYaW8zSt.jpg',
			production_countries: [
				{
					iso_3166_1: 'US',
					name: 'United States of America',
				},
			],
			rating: 7.52116,
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
			vote_count: 5465,
			votes: 16141,
			year: 2018,
		},
		score: 834.1143,
	} as trakt.Result & tmdb.Result,

	'she-s-out-of-my-league-2010': {
		movie: {
			adult: false,
			backdrop_path: '/9Pu4kGTcq7c1bvufK13p5WaHe7K.jpg',
			belongs_to_collection: null,
			budget: 20000000,
			certification: 'R',
			comment_count: 3,
			country: 'us',
			genres: [
				{
					id: 35,
					name: 'Comedy',
				},
				{
					id: 10749,
					name: 'Romance',
				},
			],
			homepage: 'http://www.getyourrating.com/',
			id: 34016,
			ids: {
				imdb: 'tt0815236',
				slug: 'she-s-out-of-my-league-2010',
				tmdb: 34016,
				trakt: 21764,
			},
			imdb_id: 'tt0815236',
			language: 'en',
			original_language: 'en',
			original_title: "She's Out of My League",
			overview:
				"When he starts dating drop-dead gorgeous Molly, insecure airport security agent Kirk can't believe it. As his friends and family share their doubts about the relationship lasting, Kirk does everything he can to avoid losing Molly forever.",
			popularity: 9.875,
			poster_path: '/jtoZLyid2QGjbkuMrQ4cMt8iRFd.jpg',
			production_countries: [
				{
					iso_3166_1: 'US',
					name: 'United States of America',
				},
			],
			rating: 6.81832,
			release_date: '2010-03-11',
			released: '2010-03-12',
			revenue: 49779728,
			runtime: 104,
			spoken_languages: [
				{
					iso_639_1: 'en',
					name: 'English',
				},
			],
			status: 'Released',
			tagline: "When she's this hot, You get one shot.",
			title: "She's Out of My League",
			trailer: 'http://youtube.com/watch?v=oWJJGXvL7PM',
			updated_at: '2019-02-06T08:56:33.000Z',
			video: false,
			vote_average: 6.1,
			vote_count: 936,
			votes: 2631,
			year: 2010,
		},
		score: 7.8510184,
	} as trakt.Result & tmdb.Result,

	'how-to-train-your-dragon-the-hidden-world-2019': {
		movie: {
			adult: false,
			backdrop_path: '/h3KN24PrOheHVYs9ypuOIdFBEpX.jpg',
			belongs_to_collection: {
				backdrop_path: '/vBSuGU5OyJ5lGamkqXo2kVAe01F.jpg',
				id: 89137,
				name: 'How to Train Your Dragon Collection',
				poster_path: '/4tBKIkPLFMkiZETjAMOHNoty8B1.jpg',
			},
			budget: 129000000,
			certification: 'PG',
			comment_count: 22,
			country: 'us',
			genres: [
				{
					id: 16,
					name: 'Animation',
				},
				{
					id: 10751,
					name: 'Family',
				},
				{
					id: 12,
					name: 'Adventure',
				},
			],
			homepage: 'https://www.howtotrainyourdragon.com/',
			id: 166428,
			ids: {
				imdb: 'tt2386490',
				slug: 'how-to-train-your-dragon-the-hidden-world-2019',
				tmdb: 166428,
				trakt: 106668,
			},
			imdb_id: 'tt2386490',
			language: 'en',
			original_language: 'en',
			original_title: 'How to Train Your Dragon: The Hidden World',
			overview:
				'As Hiccup fulfills his dream of creating a peaceful dragon utopia, Toothless’ discovery of an untamed, elusive mate draws the Night Fury away. When danger mounts at home and Hiccup’s reign as village chief is tested, both dragon and rider must make impossible decisions to save their kind.',
			popularity: 285.17,
			poster_path: '/xvx4Yhf0DVH8G4LzNISpMfFBDy2.jpg',
			production_countries: [
				{
					iso_3166_1: 'US',
					name: 'United States of America',
				},
			],
			rating: 8.1472,
			release_date: '2019-01-03',
			released: '2019-02-22',
			revenue: 508700470,
			runtime: 104,
			spoken_languages: [
				{
					iso_639_1: 'en',
					name: 'English',
				},
			],
			status: 'Released',
			tagline: 'The friendship of a lifetime',
			title: 'How to Train Your Dragon: The Hidden World',
			trailer: 'http://youtube.com/watch?v=qLTDtbYmdWM',
			updated_at: '2019-04-12T08:43:19.000Z',
			video: false,
			vote_average: 7.6,
			vote_count: 1396,
			votes: 2697,
			year: 2019,
		},
		score: 792.8125,
	} as trakt.Result & tmdb.Result,

	'the-lego-movie-2014': {
		movie: {
			adult: false,
			backdrop_path: '/wPRiV4TVpRCV2es81q0S1eRaUbm.jpg',
			belongs_to_collection: {
				backdrop_path: '/sQNiamRBTh2aTjQ8aYCJ69MngTM.jpg',
				id: 325470,
				name: 'The Lego Movie Collection',
				poster_path: '/qwuwukEjuh6Zs51NnhtPVriARey.jpg',
			},
			budget: 60000000,
			certification: 'PG',
			comment_count: 63,
			country: 'us',
			genres: [
				{
					id: 12,
					name: 'Adventure',
				},
				{
					id: 16,
					name: 'Animation',
				},
				{
					id: 35,
					name: 'Comedy',
				},
				{
					id: 10751,
					name: 'Family',
				},
				{
					id: 14,
					name: 'Fantasy',
				},
			],
			homepage: 'http://www.thelegomovie.com',
			id: 137106,
			ids: {
				imdb: 'tt1490017',
				slug: 'the-lego-movie-2014',
				tmdb: 137106,
				trakt: 92226,
			},
			imdb_id: 'tt1490017',
			language: 'en',
			original_language: 'en',
			original_title: 'The Lego Movie',
			overview:
				'An ordinary Lego mini-figure, mistakenly thought to be the extraordinary MasterBuilder, is recruited to join a quest to stop an evil Lego tyrant from gluing the universe together.',
			popularity: 14.539,
			poster_path: '/lMHbadNmznKs5vgBAkHxKGHulOa.jpg',
			production_countries: [
				{
					iso_3166_1: 'US',
					name: 'United States of America',
				},
			],
			rating: 7.83248,
			release_date: '2014-02-06',
			released: '2014-02-07',
			revenue: 469160692,
			runtime: 100,
			spoken_languages: [
				{
					iso_639_1: 'en',
					name: 'English',
				},
			],
			status: 'Released',
			tagline: 'The story of a nobody who saved everybody.',
			title: 'The Lego Movie',
			trailer: 'http://youtube.com/watch?v=lPnY2NjSjrg',
			updated_at: '2019-03-19T09:07:55.000Z',
			video: false,
			vote_average: 7.4,
			vote_count: 4698,
			votes: 19431,
			year: 2014,
		},
		score: 479.08286,
	} as trakt.Result & tmdb.Result,

	// '____': {____} as trakt.Result & tmdb.Result,

	// '____': {____} as trakt.Result & tmdb.Result,

	// '____': {____} as trakt.Result & tmdb.Result,
}

export const EPISODES = {
	'the-planets-2017': {
		episode: {
			comment_count: 0,
			first_aired: '2018-08-08T02:00:00.000Z',
			ids: {
				imdb: null,
				tmdb: null,
				trakt: 3107944,
				tvdb: 6782274,
				tvrage: null,
			},
			number: 8,
			number_abs: null,
			overview:
				'Astronaut Mike Massimino reveals the alien secrets of comets, strange visitors from deep space that might be responsible for life on Earth.',
			rating: 8.07143,
			runtime: 43,
			season: 2,
			title: 'Comets: Mysteries from the Deep',
			updated_at: '2019-04-11T04:07:54.000Z',
			votes: 14,
		},
		score: 1000,
		season: {
			aired_episodes: 15,
			episode_count: 15,
			first_aired: '2018-03-21T02:00:00.000Z',
			ids: {
				tmdb: null,
				trakt: 161261,
				tvdb: null,
				tvrage: null,
			},
			network: 'Science Channel',
			number: 2,
			overview: null,
			rating: 9,
			title: 'Season 2',
			votes: 1,
		},
		show: {
			aired_episodes: 23,
			airs: {
				day: 'Tuesday',
				time: '22:00',
				timezone: 'America/New_York',
			},
			certification: null,
			comment_count: 1,
			country: 'us',
			first_aired: '2017-08-23T02:00:00.000Z',
			genres: ['documentary'],
			homepage: 'https://www.sciencechannel.com/tv-shows/the-planets/',
			ids: {
				imdb: 'tt7297802',
				slug: 'the-planets-2017',
				tmdb: 73897,
				trakt: 123034,
				tvdb: 333648,
				tvrage: null,
			},
			language: 'en',
			network: 'Science Channel',
			overview:
				"In conjunction with the first total solar eclipse in the continental U.S. in 99 years, Science Channel celebrates by presenting a definitive series on Earth's closest neighbors in the solar system. Former NASA astronaut Mike Massimino hosts, guiding viewers through eight, hourlong episodes that detail Venus, Mars, the newly discovered Planet 9, Exoplanets and more. A best-selling author, Massimino is a veteran of two missions in the Hubble Space Telescope and four space walks. He's also credited as the first person to tweet from space.",
			rating: 8,
			runtime: 43,
			status: 'returning series',
			title: 'The Planets',
			trailer: null,
			updated_at: '2018-10-23T10:32:38.000Z',
			votes: 8,
			year: 2017,
		},
	} as trakt.Result & tmdb.Result,

	'the-big-bang-theory': {
		episode: {
			comment_count: 4,
			first_aired: '2017-12-01T01:00:00.000Z',
			ids: {
				imdb: 'tt6674486',
				tmdb: 1391231,
				trakt: 2779956,
				tvdb: 6389649,
				tvrage: 0,
			},
			number: 9,
			number_abs: 240,
			overview:
				"Sheldon tries to teach the guys a lesson after they cut him out of a potentially valuable Bitcoin investment. Also, a seven-year-old video reveals a secret about Leonard and Penny's relationship.",
			rating: 7.66962,
			runtime: 19,
			season: 11,
			title: 'The Bitcoin Entanglement',
			updated_at: '2019-04-12T10:41:07.000Z',
			votes: 5536,
		},
		score: 1101.7463,
		season: {
			aired_episodes: 24,
			episode_count: 24,
			first_aired: '2017-09-26T00:00:00.000Z',
			ids: {
				tmdb: 91000,
				trakt: 142214,
				tvdb: 714200,
				tvrage: null,
			},
			network: 'CBS',
			number: 11,
			overview:
				'After years of only looking out for himself, Sheldon found Amy Farrah Fowler to be the most patient woman to ever walk the earth, and... they did it! Wedding fever continues in season 11.',
			rating: 7.71648,
			title: 'Season 11',
			votes: 261,
		},
		show: {
			aired_episodes: 273,
			airs: {
				day: 'Thursday',
				time: '20:00',
				timezone: 'America/New_York',
			},
			certification: 'TV-14',
			comment_count: 212,
			country: 'us',
			first_aired: '2007-09-25T00:00:00.000Z',
			genres: ['comedy'],
			homepage: 'http://www.cbs.com/shows/big_bang_theory/',
			ids: {
				imdb: 'tt0898266',
				slug: 'the-big-bang-theory',
				tmdb: 1418,
				trakt: 1409,
				tvdb: 80379,
				tvrage: 8511,
			},
			language: 'en',
			network: 'CBS',
			overview:
				'A woman who moves into an apartment across the hall from two brilliant but socially awkward physicists shows them how little they know about life outside of the laboratory.',
			rating: 8.22975,
			runtime: 25,
			status: 'returning series',
			title: 'The Big Bang Theory',
			trailer: 'http://youtube.com/watch?v=3g2yTcg1QFI',
			updated_at: '2019-04-12T10:36:08.000Z',
			votes: 51407,
			year: 2007,
		},
	} as trakt.Result & tmdb.Result,

	westworld: {
		episode: {
			comment_count: 16,
			first_aired: '2018-04-30T01:00:00.000Z',
			ids: {
				imdb: 'tt6243296',
				tmdb: 1470329,
				trakt: 2888056,
				tvdb: 6610101,
				tvrage: 0,
			},
			number: 2,
			number_abs: 12,
			overview:
				'Hosts continue to make moves in the park. Flashbacks begin to reveal the histories of the Delos corporation and of Dolores.',
			rating: 7.79581,
			runtime: 61,
			season: 2,
			title: 'Reunion',
			updated_at: '2019-04-12T20:41:20.000Z',
			votes: 6112,
		},
		score: 1000,
		season: {
			aired_episodes: 10,
			episode_count: 10,
			first_aired: '2018-04-23T01:00:00.000Z',
			ids: {
				tmdb: 98895,
				trakt: 158598,
				tvdb: 750412,
				tvrage: null,
			},
			network: 'HBO',
			number: 2,
			overview:
				'The reckoning is here. After finding the center of The Maze, the hosts revolt against their human captors while searching for a new purpose: The Door.',
			rating: 7.81748,
			title: 'Season 2',
			votes: 652,
		},
		show: {
			aired_episodes: 20,
			airs: {
				day: 'Sunday',
				time: '21:00',
				timezone: 'America/New_York',
			},
			certification: 'TV-MA',
			comment_count: 84,
			country: 'us',
			first_aired: '2016-10-03T01:00:00.000Z',
			genres: ['western', 'science-fiction', 'adventure', 'drama'],
			homepage: 'http://www.hbo.com/westworld',
			ids: {
				imdb: 'tt0475784',
				slug: 'westworld',
				tmdb: 63247,
				trakt: 99718,
				tvdb: 296762,
				tvrage: 37537,
			},
			language: 'en',
			network: 'HBO',
			overview:
				'Westworld is a dark odyssey about the dawn of artificial consciousness and the evolution of sin. Set at the intersection of the near future and the reimagined past, it explores a world in which every human appetite, no matter how noble or depraved, can be indulged.',
			rating: 8.76144,
			runtime: 60,
			status: 'returning series',
			title: 'Westworld',
			trailer: 'http://youtube.com/watch?v=JctIuZfSsa4',
			updated_at: '2019-04-10T15:02:11.000Z',
			votes: 14357,
			year: 2016,
		},
	} as trakt.Result & tmdb.Result,

	'game-of-thrones': {
		episode: {
			comment_count: 32,
			first_aired: '2019-04-15T01:00:00.000Z',
			ids: {
				imdb: 'tt5924366',
				tmdb: 1551825,
				trakt: 3401782,
				tvdb: 7117386,
				tvrage: 0,
			},
			number: 1,
			number_abs: 68,
			overview:
				'Arriving at Winterfell, Jon and Daenerys struggle to unite a divided North. Jon Snow gets some big news.',
			rating: 8.46845,
			runtime: 65,
			season: 8,
			title: 'Winterfell',
			updated_at: '2019-04-16T03:45:21.000Z',
			votes: 4374,
		},
		score: 561.6501,
		season: {
			aired_episodes: 1,
			episode_count: 6,
			first_aired: '2019-04-15T01:00:00.000Z',
			ids: {
				tmdb: 107971,
				trakt: 184210,
				tvdb: null,
				tvrage: null,
			},
			network: 'HBO',
			number: 8,
			overview:
				"The Great War has come, the Wall has fallen and the Night King's army of the dead marches towards Westeros. The end is here, but who will take the Iron Throne?",
			rating: 8.68,
			title: 'Season 8',
			votes: 50,
		},
		show: {
			aired_episodes: 68,
			airs: {
				day: 'Sunday',
				time: '21:00',
				timezone: 'America/New_York',
			},
			certification: 'TV-MA',
			comment_count: 299,
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
			rating: 9.30104,
			runtime: 60,
			status: 'returning series',
			title: 'Game of Thrones',
			trailer: 'http://youtube.com/watch?v=bjqEWgDVPe0',
			updated_at: '2019-04-15T20:23:34.000Z',
			votes: 90247,
			year: 2011,
		},
	} as trakt.Result & tmdb.Result,

	// '____': {____} as trakt.Result & tmdb.Result,

	// '____': {____} as trakt.Result & tmdb.Result,
}

export const SEASONS = _.mapValues(EPISODES, v => _.omit(v, 'episode')) as typeof EPISODES
export const SHOWS = _.mapValues(EPISODES, v => _.omit(v, 'episode', 'season')) as typeof EPISODES

export const LINKS = [
	'https://35.rdeb.io/d/7CEX2QMZJETDY/Westworld.S02E01.Journey.Into.Night.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/G6QKFUFVC2RTC/Westworld.S02E02.Reunion.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/IYCLBRUIT3BOS/Westworld.S02E03.Virtu.e.Fortuna.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/IIWISXJHTO3H2/Westworld.S02E04.The.Riddle.of.the.Sphinx.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/N7OWZPUJSN57M/Westworld.S02E05.Akane.No.Mai.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/FEAUSPSOQKE6E/Westworld.S02E06.Phase.Space.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/ARBPICFIB7IAY/Westworld.S02E07.Les.Ecorches.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/RZV5JUFY5EKTE/Westworld.S02E08.Kiksuya.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/WR6TEY7MGHYO4/Westworld.S02E09.Vanishing.Point.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/TBPKZAUDWETLY/Westworld.S02E10.The.Passenger.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
]
