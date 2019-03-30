import * as got from 'got'

declare module 'got' {
	interface GotFn {
		extend(options: GotJSONOptions): GotFn
        extend(options: GotFormOptions<string>): GotFn
        extend(options: GotFormOptions<null>): GotFn
        extend(options: GotBodyOptions<string>): GotFn
        extend(options: GotBodyOptions<null>): GotFn
	}
}
