import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as execa from 'execa'
import * as utils from '@/utils/utils'

export async function guess(paths: string[]) {
	let { stdout } = await execa('/usr/local/bin/guessit', ['-j', ...paths])
	let lines = stdout.split('\n').filter(Boolean)
	return lines.map((v) => JSON.parse(v)) as Guess[]
}

interface Guess {
	container: string
	episode: number[]
	episode_title: string
	mimetype: string
	other: string
	part: number
	release_group: string
	screen_size: string
	season: number
	source: string
	title: string
	type: string
	video_codec: string
}
