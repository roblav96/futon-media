import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as execa from 'execa'
import * as fastParse from 'fast-json-parse'
import * as ms from 'pretty-ms'
import * as utils from '@/utils/utils'
import * as ffpath from 'ffprobe-binaries'

export async function probe(
	url: string,
	options: { chapters?: boolean; format?: boolean; streams?: boolean },
) {
	let flags = ['-print_format', 'json', '-show_error']
	flags.push('-analyzeduration', '1000000', '-probesize', '1000000')
	let pairs = Object.entries(options).filter(([k, v]) => v)
	flags.push(...pairs.map(([k]) => `-show_${k}`))
	let { stdout } = await execa(ffpath, flags.concat(url))
	let { err, value } = fastParse(stdout) as { err: Error; value: Probe }
	if (err) throw err
	if (value.format && value.format.tags) {
		value.format.tags = _.mapKeys(value.format.tags, (v, k) => k.toLowerCase()) as any
	}
	if (_.isArray(value.streams)) {
		value.streams = value.streams.map(stream => {
			stream = _.mapKeys(stream, (v, k) => k.toLowerCase()) as any
			stream = _.mapValues(stream, (v, k) => (_.isString(v) ? v.toLowerCase() : v)) as any
			if (stream.tags) {
				stream.tags = _.fromPairs(_.toPairs(stream.tags).map(v =>
					v.map(vv => (_.isString(vv) ? vv.toLowerCase() : vv)),
				) as any) as any
			}
			return stream
		})
	}
	return value
}

export function json(format: Format) {
	let fkeys = ['bit_rate', 'duration', 'format_long_name', 'format_name', 'size']
	format = _.pick(format, fkeys) as any
	try {
		if (format.bit_rate) {
			format.bit_rate = `${utils.fromBytes(_.parseInt(format.bit_rate))}/s`
		}
		if (format.duration) {
			let duration = utils.duration(_.parseInt(format.duration), 'second')
			format.duration = ms(duration, { unitCount: 2 })
		}
		if (format.size) {
			format.size = utils.fromBytes(_.parseInt(format.size))
		}
	} catch (error) {
		console.error(`ffprobe json -> %O`, error)
	}
	return format
}

export interface Chapter {
	end: number
	end_time: string
	id: number
	start: number
	start_time: string
	tags: {
		title: string
	}
	time_base: string
}

export interface Format {
	bit_rate: string
	duration: string
	filename: string
	format_long_name: string
	format_name: string
	nb_programs: number
	nb_streams: number
	probe_score: number
	size: string
	start_time: string
	tags: {
		compatible_brands: string
		creation_time: string
		encoder: string
		major_brand: string
		minor_version: string
		title: string
	}
}

export interface Stream {
	avg_frame_rate: string
	bit_rate: string
	bits_per_raw_sample: string
	bits_per_sample: number
	channel_layout: string
	channels: number
	chroma_location: string
	codec_long_name: string
	codec_name: string
	codec_tag: string
	codec_tag_string: string
	codec_time_base: string
	codec_type: string
	coded_height: number
	coded_width: number
	color_primaries: string
	color_range: string
	color_space: string
	color_transfer: string
	display_aspect_ratio: string
	dmix_mode: string
	duration: string
	duration_ts: number
	has_b_frames: number
	height: number
	index: number
	is_avc: string
	level: number
	loro_cmixlev: string
	loro_surmixlev: string
	ltrt_cmixlev: string
	ltrt_surmixlev: string
	max_bit_rate: string
	nal_length_size: string
	nb_frames: string
	pix_fmt: string
	profile: string
	r_frame_rate: string
	refs: number
	sample_aspect_ratio: string
	sample_fmt: string
	sample_rate: string
	start_pts: number
	start_time: string
	time_base: string
	width: number
	disposition: {
		attached_pic: number
		clean_effects: number
		comment: number
		default: number
		dub: number
		forced: number
		hearing_impaired: number
		karaoke: number
		lyrics: number
		original: number
		timed_thumbnails: number
		visual_impaired: number
	}
	tags: {
		handler_name: string
		language: string
		title: string
	}
}

export interface Probe {
	chapters: Chapter[]
	format: Format
	streams: Stream[]
}
