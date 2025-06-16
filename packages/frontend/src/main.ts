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

const ctx = new AudioContext()

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

class Oscilloscope {
  private paused = false
  private ctx: AudioContext
  private src: AudioNode
  private canvas: HTMLCanvasElement
  private anl: AnalyserNode
  private data: Uint8Array
  private cctx: CanvasRenderingContext2D

  constructor(ctx: AudioContext, src: AudioNode, canvas: HTMLCanvasElement){
    this.ctx = ctx
    this.src = src
    this.canvas = canvas
    this.anl    = this.ctx.createAnalyser();

    this.anl.fftSize = 2048;
    this.src.connect(this.anl);

    this.data = new Uint8Array(2048);
    this.cctx = this.canvas.getContext("2d")!;
    this.cctx.strokeStyle = '#80D8FF';
  }

  clear() {
    this.cctx.fillStyle   = 'white';
  }

  draw() {
      requestAnimationFrame(() => this.draw());
      this.cctx.clearRect(0 , 0, this.canvas.width, this.canvas.height);
      this.anl.getByteTimeDomainData(this.data);

      this.cctx.beginPath();
      for(let i=0; i < this.data.length; i++){
          const x = i * (this.canvas.width * 1.0 / this.data.length); // need to fix x
          const v = this.data[i] / 128.0;
          const y = v * this.canvas.height / 2;
          if(i === 0) this.cctx.moveTo(x,y);
          else this.cctx.lineTo(x,y);
      }
      this.cctx.stroke();
  }
}

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    const cellKey = colLetter(column + 1) + (row + 1).toString(10)

    if(value) {
      cellSubscriptions[cellKey] ??= readCell(cellKey).subscribe(
        result => {
          td.animate([
            { background: '#80D8FF' },
            { background: 'transparent' },
          ], {
            duration: 200,
            easing: 'ease-out'
          })

          if(result instanceof AudioNode) {
            let canvas = td.querySelector('canvas')
            if(!canvas) {
              canvas = document.createElement('canvas')
              canvas.width = td.clientWidth * devicePixelRatio
              canvas.height = td.clientHeight * devicePixelRatio
              td.replaceChildren(canvas)
            }
            const osc = new Oscilloscope(ctx, result, canvas)
            osc.run()
          } else if(result || result === false) {
            td.textContent = result as string
          } else {
            td.textContent = '🔃 Empty'
          }
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
            return dest
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
    )
  },
  'dest': () => {
    const gain = new GainNode(ctx)
    gain.connect(ctx.destination)
    return gain
  },
  'gate': (clock: Observable<unknown>, length: MaybeObsvervable<number>) => clock.pipe(
    switchMap(() => concat(
      of(true),
      toObservable(length).pipe(
        mergeMap(ms => of(false).pipe(delay(ms)))
      )
    ))
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

root.addEventListener('click', () => {
  ctx.resume()
})
