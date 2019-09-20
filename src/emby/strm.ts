import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import db from '@/adapters/db'
import Emitter from '@/utils/emitter'
import Fastify from '@/adapters/fastify'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)
const emitter = new Emitter<string, string>()
process.nextTick(() => process.DEVELOPMENT && db.flush('stream:*'))

async function getDebridStreamUrl(query: emby.StrmQuery, rkey: string, strm: string) {
	let t = Date.now()
	let { e, s, imdb, tmdb, tvdb, type } = query
	let Sessions = (await emby.sessions.get()).sort((a, b) => a.Age - b.Age)
	let Session = Sessions[0]

	let UserId = await db.get(`UserId:${query.trakt}`)
	if (UserId) Session = Sessions.find(v => v.UserId == UserId) || Session

	Session = (Sessions.find(v => {
		if (!v.StrmPath) return
		if (type == 'show') {
			let zero = `S${utils.zeroSlug(s)}E${utils.zeroSlug(e)}`
			if (!v.StrmPath.includes(zero)) return
		}
		let ids = emby.library.pathIds(v.StrmPath)
		if (ids.imdb && imdb) return ids.imdb == imdb
		if (ids.tmdb && tmdb) return ids.tmdb == tmdb
		if (ids.tvdb && tvdb) return ids.tvdb == tvdb
	}) || Session) as emby.Session

	let { Quality, Channels, Codecs } = Session
	let skey = `${rkey}:${utils.hash([Quality, Channels, Codecs.audio, Codecs.video])}`
	let streamUrl = await db.get(skey)
	if (streamUrl) return streamUrl

	console.log(`getDebridStreamUrl '${strm}' ->`, Session.json)

	let full = (await trakt.client.get(`/${type}s/${query.trakt}`)) as trakt.Full
	let item = new media.Item({ type, [type]: full })
	if (type == 'show') {
		let seasons = (await trakt.client.get(`/shows/${query.trakt}/seasons`)) as trakt.Season[]
		item.use({ type: 'season', season: seasons.find(v => v.number == s) })
		let episode = (await trakt.client.get(
			`/shows/${query.trakt}/seasons/${s}/episodes/${e}`
		)) as trakt.Episode
		item.use({ type: 'episode', episode })
	}

	let torrents = await scraper.scrapeAll(item, Session.isSD)

	// if (!process.DEVELOPMENT) console.log(`all torrents '${strm}' ->`, torrents.length)
	console.log(`all torrents '${strm}' ->`, torrents.length, torrents.map(v => v.short))

	let cacheds = torrents.filter(v => v.cached.length > 0)
	if (cacheds.length == 0) {
		debrids.download(torrents, item)
		throw new Error(`cacheds.length == 0`)
	}

	// if (!process.DEVELOPMENT) console.log(`strm cacheds '${strm}' ->`, cacheds.length)
	console.log(`strm cacheds '${strm}' ->`, cacheds.length, cacheds.map(v => v.short))

	streamUrl = await debrids.getStreamUrl(cacheds, item, Channels, Codecs)
	if (!streamUrl) {
		debrids.download(torrents, item)
		throw new Error(`getDebridStreamUrl !streamUrl -> '${strm}'`)
	}
	await db.put(skey, streamUrl, utils.duration(1, 'day'))

	console.log(Date.now() - t, `👍 streamUrl '${strm}' ->`, streamUrl)
	return streamUrl
}

fastify.get('/strm', async (request, reply) => {
	if (_.size(request.query) == 0) return reply.redirect('/dev/null')
	let query = _.mapValues(request.query, (v, k: keyof emby.StrmQuery) =>
		utils.isNumeric(v) ? _.parseInt(v) : v
	) as emby.StrmQuery
	let { e, s, slug, type, imdb, tmdb, tvdb } = query

	// console.warn(`request.headers ->`, request.headers)
	let ua = request.headers['user-agent'] as string
	if (ua && !ua.startsWith('Lavf/')) {
		let Item = await emby.library.byProviderIds(
			{ imdb, tmdb, tvdb },
			{ Fields: ['MediaSources'] }
		)
		return reply.redirect(
			`${process.env.EMBY_WAN_ADDRESS}/emby/Videos/${Item.Id}/stream.strm?Static=true&mediaSourceId=${Item.MediaSources[0].Id}`
		)
	}

	let strm = slug
	if (type == 'show') strm += ` s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`
	console.log(`/strm ->`, strm)

	let rkey = `stream:${query.trakt}`
	if (type == 'show') rkey += `:s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`
	let stream = (await db.get(rkey)) as string
	if (!stream) {
		if (!emitter.eventNames().includes(`${query.trakt}`)) {
			getDebridStreamUrl(query, rkey, strm).then(
				async stream => {
					await db.put(rkey, stream, utils.duration(1, 'minute'))
					emitter.emit(`${query.trakt}`, stream)
				},
				async error => {
					console.error(`getDebridStreamUrl '${slug}' -> %O`, error)
					await db.put(rkey, '/dev/null', utils.duration(1, 'minute'))
					emitter.emit(`${query.trakt}`, '/dev/null')
				}
			)
		}
		stream = await emitter.toPromise(`${query.trakt}`)
	}

	reply.redirect(stream)
})
