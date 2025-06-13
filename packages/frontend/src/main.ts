import './index.css'
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { asyncScheduler, BehaviorSubject, combineLatest, filter, finalize, from, interval, isObservable, map, mergeMap, Observable, observeOn, of, repeat, share, shareReplay, Subscriber, Subscription, switchMap, tap, zip, type OperatorFunction } from 'rxjs';
import pick from 'lodash/pick'
import mapValues from 'lodash/mapValues';

import evaluate from '@cadence/compiler'
import { get } from 'lodash';

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

    if(value) {
      cellSubscriptions[cellKey] ??= readCell(cellKey).subscribe(
        result => {
          td.textContent = result as string
          td.animate([
            { background: '#80D8FF' },
            { background: 'transparent' },
          ], {
            duration: 200,
            easing: 'ease-out'
          })
        }
      )
    } else {
      cellSubscriptions[cellKey]?.unsubscribe()
      delete cellSubscriptions[cellKey]
      td.textContent = ''
    }
  },
});

const root = document.getElementById('root')!

type MaybeObsvervable<T> = Observable<T> | T
const toObservable = <T>(v: MaybeObsvervable<T>) => isObservable(v) ? v : new BehaviorSubject(v)

const ctx = new AudioContext()

const rxlib = {
  map,
  of,
  //@ts-expect-error idc
  'pipe': (head: Observable<unknown>, ...tail: OperatorFunction<unknown, unknown>[]) => head.pipe(...tail),
  interval(...args: Parameters<typeof interval>) {
    return interval(...args).pipe(shareReplay(1))
  },
  clock: (bpm: number) => rxlib.interval(60 * 1000 / bpm),
  '*': (...args: MaybeObsvervable<number>[]) => combineLatest(args.map(toObservable)).pipe(
    map((args) => args.reduce((a, b) => a * b))
  ),
  '//': (obs: Observable<unknown>, n: number) => obs.pipe(filter((_, i) => (i % n) === 0), share()),
  seq: (...events: unknown[]) => from(events).pipe(
    observeOn(asyncScheduler),
    repeat()
  ),
  '*>': (a: Observable<unknown>, b: Observable<unknown>) => zip(a, b).pipe(
    map(([_, b]) => b),
    share()
  ),
  '→': (dest: Observable<AudioNode>, ...sources: Observable<AudioNode>[]) => {
    let sources_: AudioNode[]
    return toObservable(dest).pipe(
      switchMap(
        dest => combineLatest(sources).pipe(
          map(sources => {
            sources.forEach(s => s?.connect(dest))
            sources_ = sources
          }),
          finalize(() => sources_.forEach(s => s.disconnect(dest)))
        )
      )
    )
  },
  'osc': (type: OscillatorType, freq: MaybeObsvervable<number>) => {
    const osc = new OscillatorNode(ctx, { type })
    osc.start()
    return toObservable(freq).pipe(
      map(f => (osc.frequency.setValueAtTime(f, ctx.currentTime), osc)),
      finalize(() => osc.stop())
    )
  },
  'dest': ctx.destination
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

root.addEventListener('click', () => {
  ctx.resume()
})
