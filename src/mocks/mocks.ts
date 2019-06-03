export * from '@/mocks/movies'
export * from '@/mocks/shows'
export * from '@/mocks/people'
import * as _ from 'lodash'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'

export const LINKS = [
	'https://35.rdeb.io/d/7CEX2QMZJETDY/Westworld.S02E01.Journey.Into.Night.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/G6QKFUFVC2RTC/Westworld.S02E02.Reunion.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/IYCLBRUIT3BOS/Westworld.S02E03.Virtu.e.Fortuna.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/IIWISXJHTO3H2/Westworld.S02E04.The.Riddle.of.the.Sphinx.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/N7OWZPUJSN57M/Westworld.S02E05.Akane.No.Mai.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/FEAUSPSOQKE6E/Westworld.S02E06.Phase.Space.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/ARBPICFIB7IAY/Westworld.S02E07.Les.Ecorches.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/RZV5JUFY5EKTE/Westworld.S02E08.Kiksuya.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/WR6TEY7MGHYO4/Westworld.S02E09.Vanishing.Point.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
	'https://35.rdeb.io/d/TBPKZAUDWETLY/Westworld.S02E10.The.Passenger.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv',
]

export const LINE = `2019-04-19 12:00:34.503 Info HttpServer: HTTP POST http://192.168.50.96:8096/emby/Items/584/PlaybackInfo?UserId=733f7b63db664bf3a93c64ae0f696348&StartTimeTicks=0&IsPlayback=true&AutoOpenLiveStream=true&SubtitleStreamIndex=-1&MediaSourceId=30424d010c0e0d66f149f6c6b3eeac88&MaxStreamingBitrate=140000000. UserAgent: Mozilla/5.0 (Linux; Android 9; Pixel 3 Build/PQ2A.190305.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/72.0.3626.121 Mobile Safari/537.36`
// export const LINE = `2019-04-19 02:11:40.332 Info HttpServer: HTTP POST http://192.168.50.96:8096/emby/Items/577/PlaybackInfo?UserId=733f7b63db664bf3a93c64ae0f696348&starttimeticks=00000000&audiostreamindex=-1&maxstreamingbitrate=110000000&subtitlestreamindex=-1&mediasourceid=2204e28d5fde85500ccbaa25b9bbe2e3. UserAgent: Roku/DVP-9.0 (249.00E04142A)`
export const LINK = `https://38.rdeb.io/d/JHXH54RZIXZ6O/Mission.Impossible.Fallout.2018.1080p.WEB-DL.DD5.1.H264-FGT.mkv`

export const TRAKT_LIST_ITEMS_URL = `/users/lish408/lists/4440958/items`

export const SLUG = ` Cosmos: A Space · time Odyssey  WALL·E 90 Day Fiancé: What   Now? & black-ish ? é  é   `

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/mocks/mocks')))
}
