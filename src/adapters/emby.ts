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

	let dir = item.movie ? 'movies' : 'shows'
	if (!fs.pathExistsSync(path.join(base, dir))) {
		return console.warn(`!fs.pathExistsSync(${path.join(base, dir)})`)
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

	await libraryRefresh()
}

export async function libraryRefresh() {
	let response = await client.post(`/Library/Refresh`, {
		verbose: true,
	})
}
