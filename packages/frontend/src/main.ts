import './index.css'
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { BehaviorSubject, combineLatest, interval, isObservable, map, mergeMap, Observable, of, share, Subscriber, Subscription, switchMap, tap, type OperatorFunction } from 'rxjs';
import pick from 'lodash/pick'
import mapValues from 'lodash/mapValues';

import evaluate from '@cadence/compiler'

registerAllModules();

const cells: Record<string, BehaviorSubject<Observable<unknown>>> = {}
const cellSubscriptions: Record<string, Subscription> = {}

function getCell(key: string) {
  return (cells[key] ??= new BehaviorSubject(of('' as unknown)))
}

function readCell(key: string) {
  return getCell(key).pipe(
    switchMap(o => o),
  )
}

function replaceCell(key: string, cell: Observable<unknown>) {
  getCell(key).next(cell)
}

const colLetter = (col: number): string =>
  col <= 0
    ? ''
    : colLetter(Math.floor((col - 1) / 26)) +
      String.fromCharCode(((col - 1) % 26) + 65);

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    const cellKey = colLetter(column + 1) + (row + 1).toString(10)

    cellSubscriptions[cellKey] ??= readCell(cellKey).subscribe(
      result =>  td.textContent = result as string
    )
  },
});

const root = document.getElementById('root')!

type MaybeObsvervable<T> = Observable<T> | T
const toObservable = <T>(v: MaybeObsvervable<T>) => isObservable(v) ? v : new BehaviorSubject(v)

const rxlib = {
  map,
  of,
  //@ts-expect-error idc
  '→': (head: Observable<unknown>, ...tail: OperatorFunction<unknown, unknown>[]) => head.pipe(...tail),
  interval(...args: Parameters<typeof interval>) {
    return interval(...args).pipe(share())
  },
  '*': (...args: MaybeObsvervable<number>[]) => combineLatest(args.map(toObservable)).pipe(
    map((args) => args.reduce((a, b) => a * b))
  )
}

const rxspec = {
  subscribe: readCell
}

new Handsontable(root, {
      className: "ht-theme-main-dark-auto",
      cells: () => ({ type: 'lisp' }),
      minCols: 100,
      minRows: 100,
      colWidths: 200,
      rowHeaders: true,
      colHeaders: true,
      height: "100%",
      width: "100%",
      autoWrapRow: true,
      autoWrapCol: true,
      autoRowSize: false,
      autoColumnSize: false,
      afterChange: (changes) => {
        for(const [row, column, oldValue, newValue] of changes ?? []) {
          if(oldValue === newValue) return

          const cellKey = colLetter(1 + (column as number)) + (row + 1).toString(10)
          let result

          try {
            result = evaluate(newValue, rxlib, rxspec)
          } catch(error) {
            console.log(error)
          }

          replaceCell(cellKey, toObservable(result))
        }
      },
      licenseKey: "non-commercial-and-evaluation"
})
