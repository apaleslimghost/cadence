import { isObservable } from 'rxjs';
import { effect } from 'signal-utils/subtle/microtask-effect';
import * as Tone from 'tone';
import { getCellKey, cellSubscriptions, cells, cellObservableSubscriptions } from './store';
import Oscilloscope from './oscilloscope';
import { serialise } from './serialise';
import { Connectable, isConnectable, isDisconnectable, isParam, isStoppable, isTimed } from './types';
import type Handsontable from 'handsontable'
import colours from './palette';

export const pulse = (el: HTMLElement, color: string) => {
	el.animate([
		{ background: color },
		{ background: 'transparent' },
	], {
		duration: 200,
		easing: 'ease-out'
	})
}

const renderer: Handsontable.GridSettings['renderer'] = (instance, td, row, column, prop, value, cellProps) => {
	const cellKey = getCellKey(column + 1, row + 1);

	if (value) {
		cellSubscriptions[cellKey] ??= effect(() => {
			try {
				td.removeAttribute('title');
				const result = cells.get(cellKey)?.get();
				pulse(td, colours.aqua[4]);

				if(isParam(result)) {
					let range = td.querySelector('[type=range]') as HTMLInputElement;
					let value = td.querySelector('.range-value');
					let bar = td.querySelector('.range-bar') as HTMLSpanElement;

					const isFreq = [
						'frequency',
						'hertz'
					].includes(result.units)

					const max =
						isFreq ? 24000
						: result.units === 'decibels' ? 120
						: result.maxValue
					const min =
						isFreq ? 10
						: result.units === 'decibels' ? -120
						: result.minValue

					if (!range || !value || !bar) {
						range = document.createElement('input');
						range.type = 'range'
						range.min = '0'
						range.max = '1'
						range.step = '0.000001'

						range.value = (isFreq ?
							Math.log(result.value / min) / Math.log(max / min) :
							(result.value - min) / (max - min)
						).toString()

						value = document.createElement('span')
						value.classList = 'range-value'
						value.textContent = serialise(result)

						bar = document.createElement('span')
						bar.classList = 'range-bar'
						bar.style.width = `${(100 * range.valueAsNumber).toFixed(1)}%`

						td.replaceChildren(range, bar, value);
					}

					range.addEventListener('input', () => {
						result.value = isFreq ?
							min * Math.pow(max / min, range.valueAsNumber) :
							min + (max - min) * range.valueAsNumber

						value.textContent = serialise(result)
						bar.style.width = `${(100 * range.valueAsNumber).toFixed(1)}%`
					})

				} else if (isConnectable(result)) {
					 function renderOsc(node: Connectable) {
						let canvas = td.querySelector('canvas');
						if (!canvas) {
							canvas = document.createElement('canvas');
							canvas.width = td.clientWidth * devicePixelRatio;
							canvas.height = td.clientHeight * devicePixelRatio;
							td.replaceChildren(canvas);
						}
						const osc = new Oscilloscope(Tone.getContext().rawContext, node, canvas);
						osc.run();
					}

					if(result instanceof Tone.Player || result instanceof Tone.GrainPlayer) {
						if(!result.loaded && 'promise' in result && result.promise instanceof Promise) {
							td.textContent = '⏳ loading';
							result.promise.then(
								() => renderOsc(result),
								(error: unknown) => {
									td.textContent = `⚠️ ${error}`;
									td.setAttribute('title', `⚠️ ${error}`);
									console.error(error);
								}
							)
						} else {
							renderOsc(result)
						}
					} else {
						renderOsc(result)
					}
				} else if (isObservable(result)) {
					td.textContent = '💤 pending';
					cellObservableSubscriptions[cellKey]?.unsubscribe();
					cellObservableSubscriptions[cellKey] = result.subscribe((args) => {
						if(isTimed(args) ? args[1] : args) {
							pulse(td, colours.fuchsia[4]);
						}
						td.textContent = serialise(args);
					});
				} else {
					td.textContent = serialise(result);
				}

				td.setAttribute(
					'title',
					Object.getPrototypeOf(result ?? Object.create(null))?.constructor?.name
					?? Object.prototype.toString.call(result).replace(/\[object (.+)\]/, '$1')
				);
			} catch (error) {
				td.textContent = `⚠️ ${error}`;
				td.setAttribute('title', `⚠️ ${error}`);
				console.error(error);
			}
		});
	} else {
		td.textContent = '';
		td.removeAttribute('title');
	}
}

export default renderer
