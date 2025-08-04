declare module "@quarterto/colours" {
	type Colour = [string, string, string, string, string, string, string] & Record<
		| number
		| 'darkest'
		| 'deep'
		| 'darker'
		| 'dark'
		| 'primary'
		| 'light'
		| 'lighter'
		| 'pale'
		| 'lightest',
		string
	>

	const colours: Record<
		| 'steel'
		| 'scarlet'
		| 'amber'
		| 'lemon'
		| 'lime'
		| 'apple'
		| 'aqua'
		| 'ocean'
		| 'sky'
		| 'ink'
		| 'violet'
		| 'fuchsia',
		Colour
	>

	export default colours
}
