import * as _ from 'lodash'
import * as deepmerge from 'deepmerge'
import { FormatCodeSettings } from 'typescript/lib/typescript'

function denullify(value: any) {
	if (_.isNull(value)) return undefined
	if (_.isArray(value)) {
		return value.map(v => denullify(v))
	}
	if (_.isObject(value)) {
		return _.mapValues(value, v => denullify(v))
	}
	return value
}

function combine(value: any) {
	if (_.isArray(value) && value.find(v => _.isObject(v))) {
		return [_.merge({}, ...value.map(v => combine(v)))]
	}
	if (_.isObject(value) && !_.isArray(value)) {
		return _.mapValues(value, v => combine(v))
	}
	return value
}

function generate(value: any, name = '', silent = false) {
	return import('typescript/lib/typescript').then(function({
		generateTypesForGlobal,
		getDefaultFormatCodeSettings,
	}) {
		let settings = Object.assign(getDefaultFormatCodeSettings(), {
			convertTabsToSpaces: true,
		} as FormatCodeSettings)
		name = (name && _.upperFirst(_.camelCase(name))) || '____'
		// value = _.cloneDeep(value)
		console.log(`denullify(value) ->`, denullify(value))
		console.log(`combine(value) ->`, combine(value))
		// value = fix(value)
		let raw = generateTypesForGlobal(name, value, settings)
		let output = _.trim(raw.replace(/;\n/g, '\n'))
		if (!silent) console.log(output)
		return output
	})
}

Object.assign(global, { dts: generate })

declare namespace generate {}
export = generate
