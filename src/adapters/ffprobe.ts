import * as _ from 'lodash'
import * as execa from 'execa'
import * as fastParse from 'fast-json-parse'
import { path as ffpath } from 'ffprobe-static'

export default async function ffprobe(streamUrl: string) {
	let { stdout } = await execa(ffpath, [
		'-print_format',
		'json',
		'-show_error',
		'-show_format',
		'-show_streams',
		streamUrl,
	])
	let { err, value } = fastParse(stdout)
	if (err) throw err
	return value as FFProbe
}

// ffprobe(
// 	`https://miriam.makefast.co/dl/SewyeARRQy52TW6yrcM3YQ/1556551274/675000842/5ba4f74d335200.99795817/Sicario.Day.Of.The.Soldado.2018.1080p.BluRay.x264-%5BYTS.AM%5D.mp4`
// )

interface FFProbe {
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
		display_aspect_ratio: string
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
		duration: string
		duration_ts: number
		has_b_frames: number
		height: number
		index: number
		is_avc: string
		level: number
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
		tags: {
			handler_name: string
			language: string
		}
		time_base: string
		width: number
	}[]
}
