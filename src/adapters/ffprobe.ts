import * as _ from 'lodash'
import * as execa from 'execa'
import { path as ffpath } from 'ffprobe-static'

export default async function ffprobe(link: string) {
	let { stdout } = await execa(ffpath, [
		'-print_format',
		'json',
		'-show_error',
		'-show_format',
		'-show_streams',
		link,
	])
	console.log(`stdout ->`, stdout)
}
