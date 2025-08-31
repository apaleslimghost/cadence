const palette = {
	steel: {saturation: 0.01, hue: 220},
	scarlet: {hue: 9},
	amber: {hue: 37},
	lemon: {hue: 64},
	lime: {hue: 100},
	apple: {hue: 127},
	aqua: {hue: 172},
	ocean: {hue: 210},
	sky: {hue: 250},
	ink: {hue: 275},
	violet: {hue: 300},
	fuchsia: {hue: 345},
}

const colours = Object.fromEntries(Object.entries(palette).map(
	([name, spec]) => {
		const shades = Array.from({length: 7}, (_, i) =>
			`oklch(${0.05 + i / 7} ${'saturation' in spec ? spec.saturation : 0.2} ${spec.hue})`
		)
		const pastels = Array.from({length: 3}, (_, i) =>
			`oklch(${0.05 + 6 / 7 + i / (3 * 7)} ${('saturation' in spec ? spec.saturation : 0.2) * (1 - (i+1) / 4)} ${spec.hue})`
		)

		for(const [i, out] of [...shades, ...pastels].entries()) {
			CSS.registerProperty({
				name: `--colour-${name}-${i}`,
				syntax: '<color>',
				inherits: false,
				initialValue: out
			})
		}

		return [name, [...shades, ...pastels]]
	}
))

export default colours as Record<keyof typeof palette, string[]>
