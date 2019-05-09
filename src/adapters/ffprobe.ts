import * as _ from 'lodash'
import * as execa from 'execa'
import * as fastParse from 'fast-json-parse'
import { path as ffpath } from 'ffprobe-static'

const defaults = {
	chapters: false,
	format: false,
	streams: true,
}
export default async function ffprobe(
	streamUrl: string,
	options: { chapters?: boolean; format?: boolean; streams?: boolean }
) {
	let pairs = Object.entries(options).filter(([k, v]) => v)
	let flags = ['-print_format', 'json', '-show_error'].concat(pairs.map(([k]) => `-show_${k}`))
	let { stdout } = await execa(ffpath, flags.concat(streamUrl))
	let { err, value } = fastParse(stdout) as { err: Error; value: FFProbe }
	if (err) throw err
	value.streams.forEach(stream => {
		for (let key in stream) {
			let value = stream[key]
			_.isString(value) && (stream[key] = value.toLowerCase())
		}
		if (stream.tags) {
			stream.tags = _.fromPairs(_.toPairs(stream.tags).map(v =>
				_.isString(v) ? v.toLowerCase() : v
			) as any) as any
		}
	})
	return value
}

// ffprobe(
// 	`https://37.rdeb.io/d/Z24TYAXEJW5KQ/Mission.Impossible.Fallout.2018.IMAX.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv`,
// 	// `https://miriam.makefast.co/dl/SewyeARRQy52TW6yrcM3YQ/1556551274/675000842/5ba4f74d335200.99795817/Sicario.Day.Of.The.Soldado.2018.1080p.BluRay.x264-%5BYTS.AM%5D.mp4`,
// 	{ chapters: true /** format: true, streams: true */ }
// ).then(probe => {
// 	console.log(`probe ->`, probe)
// })

export interface FFProbe {
	chapters: {
		end: number
		end_time: string
		id: number
		start: number
		start_time: string
		tags: {
			title: string
		}
		time_base: string
	}[]
	format: {
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
			encoder: string
			major_brand: string
			minor_version: string
		}
	}
	streams: {
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
		}
	}[]
}
