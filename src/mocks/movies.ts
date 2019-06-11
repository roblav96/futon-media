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
	},

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
	},

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
	},

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
	},

	'ready-player-one-2018': {
		movie: {
			adult: false,
			backdrop_path: '/q7fXcrDPJcf6t3rzutaNwTzuKP1.jpg',
			belongs_to_collection: null,
			budget: 175000000,
			certification: 'PG-13',
			comment_count: 115,
			country: 'us',
			genres: ['science-fiction', 'adventure'],
			homepage: 'http://readyplayeronemovie.com',
			id: 333339,
			ids: {
				imdb: 'tt1677720',
				slug: 'ready-player-one-2018',
				tmdb: 333339,
				trakt: 214279,
			},
			imdb_id: 'tt1677720',
			language: 'en',
			original_language: 'en',
			original_title: 'Ready Player One',
			overview:
				'When the creator of a popular video game system dies, a virtual contest is created to compete for his fortune.',
			popularity: 29.965,
			poster_path: '/pU1ULUq8D3iRxl1fdX2lZIzdHuI.jpg',
			production_countries: [
				{
					iso_3166_1: 'US',
					name: 'United States of America',
				},
			],
			rating: 7.78239,
			release_date: '2018-03-28',
			released: '2018-03-29',
			revenue: 582890172,
			runtime: 140,
			spoken_languages: [
				{
					iso_639_1: 'en',
					name: 'English',
				},
			],
			status: 'Released',
			tagline: 'A better reality awaits.',
			title: 'Ready Player One',
			trailer: 'http://youtube.com/watch?v=cSp1dM2Vj48',
			updated_at: '2019-04-14T08:49:54.000Z',
			video: false,
			vote_average: 7.6,
			vote_count: 6631,
			votes: 20854,
			year: 2018,
		},
		score: 446.413,
	},

	// '____': {____},

	// '____': {____},
}
