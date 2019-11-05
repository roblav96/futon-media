import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fastParse from 'fast-json-parse'
import * as http from '@/adapters/http'
import * as validator from 'validator'
import Fastify from '@/adapters/fastify'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)

fastify.post('/signup', async (request, reply) => {
	console.log(`/signup ->`, request.body)
	let referral = (request.body.referral as string).toLowerCase()
	let email = request.body.email as string
	let password = request.body.password as string

	let names = (await emby.User.get()).map(v => v.Name.toLowerCase())
	if (!names.includes(referral)) return { error: 'Unknown referral' }

	if (!validator.isEmail(email)) return { error: 'Invalid email format' }
	let mailboxlayer = await http.client.get('https://apilayer.net/api/check', {
		query: { access_key: process.env.MAILBOXLAYER_API_KEY, email },
		silent: true,
	})
	if (!mailboxlayer.mx_found) return { error: 'Email not found' }

	let Name = email.split('@')[0]
	let userName = `${Name}.futon.media`
	let connect = await http.client
		.post('https://connect.emby.media/service/register', {
			headers: {
				'Host': 'connect.emby.media',
				'Referer': 'https://app.emby.media/',
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.12 Safari/537.36',
				'X-Application': 'Emby Mobile/4.2.0.15',
				'X-CONNECT-TOKEN': 'CONNECT-REGISTER',
			},
			form: { email, userName, rawpw: password },
		})
		.catch(error => {
			console.error(`/signup emby connect register -> %O`, error)
			return '{"Status":"ERROR","Message":"Emby connect user already exists."}'
		})
	connect = fastParse(connect).value || connect
	if (connect.Status != 'SUCCESS') return { error: connect.Message }

	let User = new emby.User(await emby.client.post('/Users/New', { form: { Name } }))
	let DisplayPreferences = await User.getDisplayPreferences()
	_.merge(DisplayPreferences, emby.defaults.DisplayPreferences)
	await User.setDisplayPreferences(DisplayPreferences)
	_.merge(User.Configuration, emby.defaults.Configuration)
	await User.setConfiguration(User.Configuration)
	_.merge(User.Policy, emby.defaults.Policy)
	await User.setPolicy(User.Policy)

	await emby.client.post(`/Users/${User.Id}/Connect/Link`, {
		form: { ConnectUsername: userName },
	})

	return { success: true }
})
