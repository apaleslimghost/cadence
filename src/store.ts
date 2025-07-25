import { SignalMap } from 'signal-utils/map';
import { Signal } from 'signal-polyfill';
import type { Subscription } from 'rxjs';

import evaluate from './lang/compiler'
import lib from './lang/stdlib';

export const cells = new SignalMap<string, Signal.Computed<unknown>>()
export const cellSubscriptions: Record<string, () => void> = {}
export const cellObservableSubscriptions: Record<string, Subscription> = {}

Object.assign(window, {
  cells,
  cellSubscriptions,
  cellObservableSubscriptions
})

export const colLetter = (col: number): string =>
  col <= 0
    ? ''
    : colLetter(Math.floor((col - 1) / 26)) +
      String.fromCharCode(((col - 1) % 26) + 65);

export const colFromLetter = (col: string): number =>[...col].reduce(
  (acc, c) => acc * 26 + (c.charCodeAt(0) - 64),
  0
)

export const getCellKey = (column: number, row: number) => colLetter(column) + row.toString(10)

export function runCell(column: number, row: number, value: string | null) {
  const cellKey = getCellKey(column as number + 1, row + 1)

  if(!value) {
	 cells.delete(cellKey)
  } else {
	 cells.set(cellKey, new Signal.Computed(() =>
		evaluate(value, lib)
	 ))
  }
}
