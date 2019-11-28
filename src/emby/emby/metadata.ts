import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as trakt from '@/adapters/trakt'
import * as tvdb from '@/adapters/tvdb'
import * as utils from '@/utils/utils'
import * as xmljs from 'xml-js'

process.nextTick(async () => {
	let all = await tvdb.getAll('361753' /** '71256' */)
	console.log(`tvdb all ->`, all)
})

const _declaration = { _attributes: { version: '1.0', encoding: 'utf-8', standalone: 'yes' } }

export async function toMovieXml(item: media.Item) {
	// console.log('item ->', item)
	let Item = {
		CountryCode: item.movie.country,
		// Added: dayjs().format('YYYY-MM-DD'),
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
		Trailer: item.movie.trailer,
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
		spaces: 2,
	})
}

// export async function toSeriesXml(item: media.Item) {
// 	// console.log('item ->', item)
// 	let Item = {
// 		CountryCode: item.show.country,
// 		// Added: dayjs().format('YYYY-MM-DD'),
// 		Language: item.show.language,
// 		// DateAdded: dayjs().format('YYYY-MM-DD hh:mm:ss'),
// 		Genres: item.show.genres.map(v => ({ Genre: _.startCase(v) })),
// 		ContentRating: item.show.certification,
// 		OriginalTitle: item.show.title,
// 		LocalTitle: item.show.title,
// 		Overview: item.show.overview,
// 		PremiereDate: item.show.released,
// 		Status: _.capitalize(item.show.status),
// 		ProductionYear: item.show.year,
// 		Taglines: [{ Tagline: item.show.tagline }],
// 		Trailer: item.show.trailer,
// 		// ProviderIds: {
// 		// 	Imdb: item.movie.ids.imdb,
// 		// 	Tmdb: item.movie.ids.tmdb.toString(),
// 		// } as Partial<emby.ProviderIds>,
// 		// Art: {
// 		// 	Poster: 'https://image.tmdb.org/t/p/original/cOJsaT8jEmG9s1MziVIPpHBRpQ7.jpg',
// 		// 	Fanart: 'https://image.tmdb.org/t/p/original/ut1svoui5yDO58PoSV7BC00udpj.jpg',
// 		// },
// 	} // as Partial<emby.Item>
// 	return xmljs.json2xml(JSON.stringify({ _declaration, Item }), {
// 		compact: true,
// 		spaces: '  ',
// 	})
// }
