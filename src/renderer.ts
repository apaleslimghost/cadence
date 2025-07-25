import { isObservable } from 'rxjs';
import { effect } from 'signal-utils/subtle/microtask-effect';
import * as Tone from 'tone';
import { getCellKey, cellSubscriptions, cells, pulse, cellObservableSubscriptions } from './main';
import Oscilloscope from './oscilloscope';
import { serialise } from './serialise';
import { isConnectable, isDisconnectable, isStoppable } from './types';
import type Handsontable from 'handsontable'

const renderer: Handsontable.GridSettings['renderer'] = (instance, td, row, column, prop, value, cellProps) => {
	const cellKey = getCellKey(column + 1, row + 1);

	if (value) {
	cellSubscriptions[cellKey] ??= effect(() => {
		try {
			td.removeAttribute('title');
			const result = cells.get(cellKey)?.get();
			pulse(td, '#80D8FF');

			td.animate([
			{ background: '#80D8FF' },
			{ background: 'transparent' },
			], {
			duration: 200,
			easing: 'ease-out'
			});

			if (isConnectable(result)) {
			let canvas = td.querySelector('canvas');
			if (!canvas) {
				canvas = document.createElement('canvas');
				canvas.width = td.clientWidth * devicePixelRatio;
				canvas.height = td.clientHeight * devicePixelRatio;
				td.replaceChildren(canvas);
			}
			const osc = new Oscilloscope(Tone.getContext().rawContext, result, canvas);
			osc.run();
			} else if (isObservable(result)) {
			td.textContent = '💤 pending';
			cellObservableSubscriptions[cellKey]?.unsubscribe();
			cellObservableSubscriptions[cellKey] = result.subscribe((args) => {
				pulse(td, '#E040FB33');
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
	} else if (cells.has(cellKey)) {
	try {
		const result = cells.get(cellKey)?.get();
		if (isDisconnectable(result)) result.disconnect();
		if (isStoppable(result)) result.stop(0);
	} catch { }

	cellSubscriptions[cellKey]?.();
	cellObservableSubscriptions[cellKey]?.unsubscribe();
	delete cellSubscriptions[cellKey];
	delete cellObservableSubscriptions[cellKey];
	td.textContent = '';
	td.removeAttribute('title');
	}
}

export default renderer
