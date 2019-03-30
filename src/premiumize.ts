import * as got from 'got'

const client = got.extend({
	baseUrl: 'https://example.com',
	headers: {
		'x-unicorn': 'rainbow',
	},
})
