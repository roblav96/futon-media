import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import * as xmljs from 'xml-js'

const _declaration = { _attributes: { version: '1.0', encoding: 'utf-8', standalone: 'yes' } }

export async function toMovieNfo(item: media.Item) {
	// console.log('item ->', item)
	let movie = {
		plot: item.movie.overview,
		outline: item.movie.tagline,
		lockdata: false,
		dateadded: dayjs().format('YYYY-MM-DD hh:mm:ss'),
		title: item.movie.title,
		originaltitle: item.movie.title,
		year: item.movie.year,
		mpaa: item.movie.certification,
		imdbid: item.movie.ids.imdb,
		tmdbid: item.movie.ids.tmdb,
		premiered: item.movie.released,
		releasedate: item.movie.released,
		tagline: item.movie.tagline,
		country: item.movie.country,
		genre: item.movie.genres.map(v => _.startCase(v)),
		id: item.movie.ids.imdb,
		fileinfo: { streamdetails: { subtitle: [] } },
		art: {
			poster: 'https://image.tmdb.org/t/p/original/cOJsaT8jEmG9s1MziVIPpHBRpQ7.jpg',
			fanart: 'https://image.tmdb.org/t/p/original/ut1svoui5yDO58PoSV7BC00udpj.jpg',
		},
	} as any
	return xmljs.json2xml(JSON.stringify({ _declaration, movie }), {
		compact: true,
		spaces: '\t',
	})
}
