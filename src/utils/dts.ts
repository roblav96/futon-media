import { FormatCodeSettings } from 'typescript/lib/typescript'
import { cloneDeep, isObject, isNull, camelCase, upperFirst } from 'lodash'

function fix(target: any) {
	if (isObject(target)) {
		for (let key in target) {
			if (isNull(target[key])) {
				target[key] = undefined
			} else fix(target[key])
		}
	}
	return target
}

function generate(value: any, name = '', silent = false) {
	return import('typescript/lib/typescript').then(function({
		generateTypesForGlobal,
		getDefaultFormatCodeSettings,
	}) {
		let settings = Object.assign(getDefaultFormatCodeSettings(), {
			convertTabsToSpaces: true,
		} as FormatCodeSettings)
		name = (name && upperFirst(camelCase(name))) || '____'
		let raw = generateTypesForGlobal(name, fix(cloneDeep(value)), settings)
		let output = raw.replace(/;/g, '').trim()
		if (!silent) console.log(output)
		return output
	})
}

Object.assign(global, { dts: generate })

declare namespace generate {}
export = generate
