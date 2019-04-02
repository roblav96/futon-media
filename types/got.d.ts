import * as got from 'got'

declare module 'got' {
	interface GotFn {
		extend(options: GotJSONOptions): typeof got
        extend(options: GotFormOptions<string>): typeof got
        extend(options: GotFormOptions<null>): typeof got
        extend(options: GotBodyOptions<string>): typeof got
        extend(options: GotBodyOptions<null>): typeof got
	}
}
