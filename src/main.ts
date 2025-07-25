import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import './index.css';

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';

import evaluate from './lang/compiler'
import { SignalMap } from 'signal-utils/map';
import { effect } from 'signal-utils/subtle/microtask-effect';
import { Signal } from 'signal-polyfill';
import { fromEventPattern, isObservable, Subscription } from 'rxjs'
import * as Tone from 'tone'
import type { AnyAudioContext } from 'tone/build/esm/core/context/AudioContext';
import { TickParam } from 'tone/build/esm/core/clock/TickParam';
import Oscilloscope from './oscilloscope';
import { isConnectable, isDisconnectable, isStoppable, WithCallback } from './types';
import { serialise } from './serialise';

import lib from './lang/stdlib';

registerAllModules();

export const cells = new SignalMap<string, Signal.Computed<unknown>>()
const cellSubscriptions: Record<string, () => void> = {}
const cellObservableSubscriptions: Record<string, Subscription> = {}

Object.assign(window, {
  cells,
  cellSubscriptions,
  cellObservableSubscriptions
})

const colLetter = (col: number): string =>
  col <= 0
    ? ''
    : colLetter(Math.floor((col - 1) / 26)) +
      String.fromCharCode(((col - 1) % 26) + 65);

export const colFromLetter = (col: string): number =>[...col].reduce(
  (acc, c) => acc * 26 + (c.charCodeAt(0) - 64),
  0
)

const pulse = (el: HTMLElement, color: string) => {
  el.animate([
    { background: color },
    { background: 'transparent' },
  ], {
    duration: 200,
    easing: 'ease-out'
  })
}

export const getCellKey = (column: number, row: number) => colLetter(column) + row.toString(10)

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    const cellKey = getCellKey(column + 1, row + 1)

    if(value) {
      cellSubscriptions[cellKey] ??= effect(() => {
        try {
          td.removeAttribute('title')
          const result = cells.get(cellKey)?.get()
          pulse(td, '#80D8FF')

          td.animate([
            { background: '#80D8FF' },
            { background: 'transparent' },
          ], {
            duration: 200,
            easing: 'ease-out'
          })

          if(isConnectable(result)) {
            let canvas = td.querySelector('canvas')
            if(!canvas) {
              canvas = document.createElement('canvas')
              canvas.width = td.clientWidth * devicePixelRatio
              canvas.height = td.clientHeight * devicePixelRatio
              td.replaceChildren(canvas)
            }
            const osc = new Oscilloscope(Tone.getContext().rawContext, result, canvas)
            osc.run()
          } else if(isObservable(result)) {
            td.textContent = '💤 pending'
            cellObservableSubscriptions[cellKey]?.unsubscribe()
            cellObservableSubscriptions[cellKey] = result.subscribe((args) => {
              pulse(td, '#E040FB33')
              td.textContent = serialise(args)
            })
          } else {
            td.textContent = serialise(result)
          }

          td.setAttribute(
            'title',
            Object.getPrototypeOf(result ?? Object.create(null))?.constructor?.name
            ?? Object.prototype.toString.call(result).replace(/\[object (.+)\]/, '$1')
          )
        } catch(error) {
          td.textContent = `⚠️ ${error}`
          td.setAttribute('title', `⚠️ ${error}`)
          console.error(error)
        }
      })
    } else if(cells.has(cellKey)) {
      try {
        const result = cells.get(cellKey)?.get()
        if(isDisconnectable(result)) result.disconnect()
        if(isStoppable(result)) result.stop(0)
      } catch {}

      cellSubscriptions[cellKey]?.()
      cellObservableSubscriptions[cellKey]?.unsubscribe()
      delete cellSubscriptions[cellKey]
      delete cellObservableSubscriptions[cellKey]
      td.textContent = ''
      td.removeAttribute('title')
    }
  },
});

export const fromToneCallback = <T extends unknown[]>(tone: WithCallback<T>) => fromEventPattern(
  handler => tone.callback = handler,
  () => tone.callback = () => {},
  (...args) => args as T
)

const root = document.getElementById('root')!

export type SequenceEvents = (string | SequenceEvents)[]

function set(obj: any, path: any[], val: any) {
  if(path.length === 1) {
    obj[path[0]] = val
  }

  set(obj[path[0]], path.slice(1), val)
  return obj
}

export type NoteEvent = [Tone.Unit.Time, Tone.Unit.Frequency | null]

const isPair = (a: unknown) => Array.isArray(a) && a.length === 2

export type Entries = [string, ...unknown[]][]
export const lispObj = (...entries: Entries) => Object.fromEntries(
  entries.map(([key, ...values]): [string, unknown] => {
    if(values.every(isPair)) {
      return [key, lispObj(...values as Entries)]
    }

    return [key, values[0]]
  })
)

function runCell(column: number, row: number, value: string | null) {
  const cellKey = getCellKey(column as number + 1, row + 1)

  if(!value) {
    cells.delete(cellKey)
  } else {
    cells.set(cellKey, new Signal.Computed(() =>
      evaluate(value, lib)
    ))
  }
}

const hot = new Handsontable(root, {
  className: "ht-theme-main-dark",
  data: [[]],
  cells: () => ({ type: 'lisp' }),
  minCols: 20,
  minRows: 100,
  colWidths: 200,
  rowHeaders: true,
  colHeaders: true,
  height: "100%",
  width: "100%",
  autoRowSize: false,
  autoColumnSize: false,
  wordWrap: false,
  persistentState: true,
  afterInit(this: Handsontable) {
    const loaded = { value: undefined }
    this.getPlugin('persistentState').loadValue('tableData', loaded)
    const data = loaded.value ?? [[]]
    this.updateData(data)
    for(const [rowNum, col] of data.entries()) {
      for(const [colNum, cell] of col.entries()) {
        runCell(colNum, rowNum, cell)
      }
    }
  },
  afterChange(this: Handsontable, changes, source) {
    if (source !== 'loadData' && source !== 'updateData') {
      this.getPlugin('persistentState').saveValue('tableData', this.getData())
    }

    for(const [row, column, oldValue, newValue] of changes ?? []) {
      if(oldValue === newValue) return

      runCell(column as number, row, newValue)
    }
  },
  licenseKey: "non-commercial-and-evaluation"
})

root.addEventListener('click', async () => {
  await Tone.start()
  root.classList.remove('pending')
})
