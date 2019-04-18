import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as pAll from 'p-all'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as media from '@/media/media'

export const client = new http.Http({
	baseUrl: `${process.env.EMBY_API_URL}/emby`,
	query: {
		api_key: process.env.EMBY_API_KEY,
	},
})

export async function ensureStrm() {}

export function toStrmPath(item: media.Item, quality = '' as Quality) {
	let title = utils.toSlug(item.main.title, { toName: true })
	let file = path.normalize(process.env.EMBY_LIBRARY || process.cwd())
	file += `/${item.movie ? 'movies' : 'shows'}`
	if (item.movie) {
		let year = item.main.year || new Date(item.main.released).getFullYear()
		title += ` (${year})`
		file += `/${title}/${title}`
		// file += `/${item.ids.slug}/${item.ids.slug}`
	} else if (item.episode) {
		let year = item.main.year || new Date(item.main.first_aired).getFullYear()
		title += ` (${year})`
		file += `/${title}`
		// file += `/Season ${item.S.n}`
		file += `/s${item.S.z}e${item.E.z}`
		// file += `/${item.main.title} - S${item.S.z}E${item.E.z}`
		// file += `/${item.ids.slug}/${item.ids.slug}-S${item.S.z}E${item.E.z}`
	} else throw new Error(`Incomplete item -> ${item.title}`)
	quality && (file += ` - ${quality}`)
	file += `.strm`
	return file
}

export async function addLinks(item: media.Item, links: string[]) {
	// let base = path.join(process.cwd(), 'dist')
	let base = process.env.EMBY_LIBRARY || process.cwd()

	let dir = item.movie ? 'movies' : 'shows'
	if (!(await fs.pathExists(path.join(base, dir)))) {
		throw new Error(`!fs.pathExists(${path.join(base, dir)})`)
	}
	dir += `/${item.ids.slug}`
	item.season && (dir += `/s${item.S.z}`)
	let cwd = path.join(base, dir)
	await fs.ensureDir(cwd)

	await pAll(
		links.map((link, index) => () => {
			let name = `${item.ids.slug}`
			if (item.season) {
				name += `-s${item.S.z}`
				name += `e${utils.zeroSlug(index + 1)}`
			}
			name += `.strm`
			return fs.outputFile(path.join(cwd, name), link)
		})
	)
}

export async function refreshLibrary() {
	let response = await client.post(`/Library/Refresh`, {
		verbose: true,
	})
	console.log(`Emby library refreshed`)
}

export type Quality = '480p' | '720p' | '1080p' | '4K'
