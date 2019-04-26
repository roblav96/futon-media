import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magneturi from 'magnet-uri'
import * as pAll from 'p-all'
import * as path from 'path'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://api.real-debrid.com/rest/1.0',
	query: {
		auth_token: process.env.REALDEBRID_SECRET,
	},
})

export class RealDebrid extends debrid.Debrid {
	static async cached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = utils.chunks(hashes, 40)
		let cached = hashes.map(v => false)
		await pAll(
			chunks.map(chunk => async () => {
				await utils.pRandom(1000)
				let url = `/torrents/instantAvailability/${chunk.join('/')}`
				let response = (await client.get(url)) as CacheResponse
				chunk.forEach(hash => {
					if (_.isPlainObject(_.get(response, `${hash}.rd[0]`))) {
						cached[hashes.findIndex(v => v == hash)] = true
					}
				})
			}),
			{ concurrency: 3 }
		)
		return cached
	}

	async sync() {
		let response = (await client.get(
			`/torrents/instantAvailability/${this.infoHash}`
		)) as CacheResponse
		let rds = response[this.infoHash].rd as CacheFiles[]
		let cacheds = rds.sort((a, b) => {
			let asize = _.sum(_.toPairs(a).map(([id, file]) => file.filesize))
			let bsize = _.sum(_.toPairs(b).map(([id, file]) => file.filesize))
			return bsize - asize
		})
		let cached = cacheds.find(v => {
			let names = _.toPairs(v).map(([id, file]) => file.filename)
			return names.filter(v => !utils.isVideo(v)).length == 0
		})
		this._files = Object.entries(cached).map(([id, file]) => {
			return {
				bytes: file.filesize,
				id: _.parseInt(id),
				name: file.filename.slice(0, file.filename.lastIndexOf('.')),
				path: `/${file.filename}`,
			} as debrid.File
		})
		this._files.sort((a, b) => a.id - b.id)
		return this.files
	}

	async link(file: debrid.File) {
		let items = (await client.get('/torrents')) as Item[]
		let item = items.find(v => v.hash.toLowerCase() == this.infoHash)

		if (!item) {
			let download = (await client.post('/torrents/addMagnet', {
				form: { magnet: this.magnet },
			})) as Download
			await client.post(`/torrents/selectFiles/${download.id}`, {
				form: { files: this._files.map(v => v.id).join() },
			})
			item = (await client.get(`/torrents/info/${download.id}`)) as Item
			await client.delete(`/torrents/delete/${download.id}`)
		}
		if (item.links.length == 0) return

		let selected = item.files.filter(v => v.selected == 1)
		let index = _.max([selected.findIndex(v => v.path.includes(file.name)), 0])

		let unrestrict = (await client.post(`/unrestrict/link`, {
			form: { link: item.links[index] },
		})) as Unrestrict
		if (!utils.isVideo(unrestrict.download)) return
		return unrestrict.download
	}

	// private async item(magnet: string) {
	// 	let { infoHash, dn } = magneturi.decode(magnet) as Record<string, string>

	// 	let items = (await client.get('/torrents')) as Item[]
	// 	let item = items.find(v => v.hash.toLowerCase() == infoHash.toLowerCase())

	// 	if (!item) {
	// 		let download = (await client.post('/torrents/addMagnet', {
	// 			form: { magnet },
	// 		})) as Download

	// 		await utils.pTimeout(1000)
	// 		item = (await client.get(`/torrents/info/${download.id}`)) as Item

	// 		let files = this.filterFiles(item.files, dn)
	// 		if (files.length == 0) {
	// 			console.warn(`files.length == 0 ->`, item.filename)
	// 			await client.delete(`/torrents/delete/${download.id}`)
	// 			return item
	// 		}
	// 		await client.post(`/torrents/selectFiles/${download.id}`, {
	// 			form: { files: files.map(v => v.id).join() },
	// 		})

	// 		item = (await client.get(`/torrents/info/${download.id}`)) as Item
	// 	}

	// 	return item
	// }

	// async files(magnet: string) {
	// 	let item = await this.item(magnet)
	// 	if (item.links.length == 0) {
	// 		return []
	// 	}
	// 	_.merge(item, await client.get(`/torrents/info/${item.id}`))

	// 	let { dn } = magneturi.decode(magnet) as Record<string, string>
	// 	let files = this.filterFiles(item.files, dn).map(file => {
	// 		return {
	// 			bytes: file.bytes,
	// 			name: file.path.split('/').pop(),
	// 			path: file.path,
	// 		} as debrid.File
	// 	})
	// 	if (files.length != item.links.length) {
	// 		console.warn(`files.length != item.links.length ->`, dn)
	// 		return []
	// 	}
	// 	return files
	// }

	// async link(magnet: string, index: number) {
	// 	let item = await this.item(magnet)
	// 	if (item.links.length == 0) return
	// 	let download = (await client.post(`/unrestrict/link`, {
	// 		form: { link: item.links[index] },
	// 	})) as Unrestrict
	// 	return download.download
	// }

	// let downloads = (await client.get('/downloads')) as Unrestrict[]
	// downloads = downloads.filter(v => v.streamable == 1)

	// return (await pAll(
	// 	item.links.map(link => async () => {
	// 		await utils.pRandom(500)
	// 		return (await client.post(`/unrestrict/link`, {
	// 			form: { link },
	// 		})) as Unrestrict
	// 	}),
	// 	{ concurrency: 3 }
	// )).map(v => v.download)
}

type CacheResponse = Record<string, { rd: CacheFiles[] }>
type CacheFiles = Record<string, { filename: string; filesize: number }>

interface Download {
	id: string
	uri: string
}

interface File {
	bytes: number
	id: number
	path: string
	selected: number
}

interface Item {
	added: string
	bytes: number
	filename: string
	files: File[]
	hash: string
	host: string
	id: string
	links: string[]
	original_bytes: number
	original_filename: string
	progress: number
	seeders: number
	speed: number
	split: number
	status: Status
}

interface Unrestrict {
	chunks: number
	crc: number
	download: string
	filename: string
	filesize: number
	host: string
	host_icon: string
	id: string
	link: string
	mimeType: string
	streamable: number
}

interface ActiveCount {
	limit: number
	nb: number
}

type Status =
	| 'magnet_error'
	| 'magnet_conversion'
	| 'waiting_files_selection'
	| 'queued'
	| 'downloading'
	| 'downloaded'
	| 'error'
	| 'virus'
	| 'compressing'
	| 'uploading'
	| 'dead'
