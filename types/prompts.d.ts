import * as prompts from 'prompts'

declare module 'prompts' {
	interface PromptObject {
        suggest?: any
		// suggest?(input: string, choices: string[]): Promise<string[]>
	}
}
