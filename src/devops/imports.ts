import * as _ from 'lodash'

if (process.DEVELOPMENT) {
	process.nextTick(async () => {
		_.defaults(global, {
			_: await import('lodash'),
			crypto: await import('crypto'),
			dayjs: await import('dayjs'),
			deepdiff: await import('deep-diff'),
			deepmerge: await import('deepmerge'),
			flatten: await import('flat'),
			httperrors: await import('http-errors'),
			matcher: await import('matcher'),
			ms: await import('pretty-ms'),
			multimatch: await import('multimatch'),
			normalize: await import('normalize-url'),
			path: await import('path'),
			qs: await import('query-string'),
			similarity: await import('string-similarity'),
			ss: await import('simple-statistics'),
			Url: await import('url-parse'),
		})
	})
}
