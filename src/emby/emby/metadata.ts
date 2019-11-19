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
	let Item = {
		CountryCode: item.movie.country,
		Added: dayjs().format('YYYY-MM-DD'),
		Language: item.movie.language,
		// DateAdded: dayjs().format('YYYY-MM-DD hh:mm:ss'),
		Genres: item.movie.genres.map(v => ({ Genre: _.startCase(v) })),
		ContentRating: item.movie.certification,
		OriginalTitle: item.movie.title,
		LocalTitle: item.movie.title,
		Overview: item.movie.overview,
		PremiereDate: item.movie.released,
		ProductionYear: item.movie.year,
		Taglines: [{ Tagline: item.movie.tagline }],
		// ProviderIds: {
		// 	Imdb: item.movie.ids.imdb,
		// 	Tmdb: item.movie.ids.tmdb.toString(),
		// } as Partial<emby.ProviderIds>,
		// Art: {
		// 	Poster: 'https://image.tmdb.org/t/p/original/cOJsaT8jEmG9s1MziVIPpHBRpQ7.jpg',
		// 	Fanart: 'https://image.tmdb.org/t/p/original/ut1svoui5yDO58PoSV7BC00udpj.jpg',
		// },
	} // as Partial<emby.Item>
	return xmljs.json2xml(JSON.stringify({ _declaration, Item }), {
		compact: true,
		spaces: '  ',
	})
}
