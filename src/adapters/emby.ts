import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as pAll from 'p-all'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as media from '@/media/media'

export const client = new http.Http({
	baseUrl: 'https://futon.media:8096/emby',
	query: { api_key: process.env.EMBY_API_KEY },
})

export async function libraryLinks(item: media.Item, links: string[]) {
	let base = process.env.EMBY_LIBRARY || process.cwd()
	console.log(`base ->`, base)

	let dir = item.movie ? 'movies' : 'shows'
	if (!fs.pathExistsSync(path.join(base, dir))) {
		// return console.warn(`!fs.pathExistsSync(${path.join(base, dir)})`)
	}
	dir += `/${item.ids.slug}`
	item.season && (dir += `/s${item.S.z}`)
	let cwd = path.resolve(base, dir)
	// await fs.ensureDir(cwd)
	console.log(`cwd ->`, cwd)

	links.forEach((link, i) => {
		let name = `${item.ids.slug}`
		item.season && (name += `-s${item.S.z}e${utils.zeroSlug(i + 1)}`)
		name += `.strm`
		console.log(`name, link ->`, name, link)
		// fs.outputFileSync(name, link)
	})

	await libraryRefresh()
}

export async function libraryRefresh() {
	let response = await client.post(`/Library/Refresh`)
	console.log(`response ->`, response)
}
