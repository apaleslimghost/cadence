import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import './index.css';

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';

import evaluate from '@cadence/compiler'
import { SignalMap } from 'signal-utils/map';
import { effect } from 'signal-utils/subtle/microtask-effect';
import { Signal } from 'signal-polyfill';
import { finalize, fromEventPattern, isObservable, map, Observable, share, Subscription, switchMap } from 'rxjs'
import { Tone as ToneClass } from 'tone/build/esm/core/Tone'
import * as Tone from 'tone'
import { curry } from 'lodash';
import type { ValueHolder } from 'handsontable/plugins/persistentState';


registerAllModules();

interface WithCallback<Args extends unknown[]> {
  callback: (...args: Args) => void
}

const hasCallback = <T extends unknown[]>(obj: unknown): obj is WithCallback<T> => (obj && typeof obj === 'object' && 'callback' in obj) ? true : false

const cells = new SignalMap<string, Signal.Computed<unknown>>()
const cellSubscriptions: Record<string, () => void> = {}
const cellObservableSubscriptions: Record<string, Subscription> = {}

// @ts-ignore
window.cells = cells
// @ts-ignore
window.cellSubscriptions = cellSubscriptions
// @ts-ignore
window.cellObservableSubscriptions = cellObservableSubscriptions

const colLetter = (col: number): string =>
  col <= 0
    ? ''
    : colLetter(Math.floor((col - 1) / 26)) +
      String.fromCharCode(((col - 1) % 26) + 65);

const colFromLetter = (col: string): number =>[...col].reduce(
  (acc, c) => acc * 26 + (c.charCodeAt(0) - 64),
  0
)

abstract class Scope<Source> {
  protected ctx: AudioContext
  protected src: Source
  protected canvas: HTMLCanvasElement
  protected cctx: CanvasRenderingContext2D

  constructor(ctx: AudioContext, src: Source, canvas: HTMLCanvasElement){
    this.ctx = ctx
    this.src = src
    this.canvas = canvas

    this.cctx = this.canvas.getContext("2d")!;
    this.cctx.strokeStyle = '#80D8FF';
  }

  clear() {
    this.cctx.fillStyle   = 'white';
  }

  run() {
    requestAnimationFrame(() => this.run());
    this.draw()
  }

  abstract draw(): void
}

interface Connectable {
  connect<Dest extends AudioNode | AudioParam>(dest: Dest): Dest
}

const isConnectable = (thing: unknown): thing is Connectable => (thing && typeof thing === 'object') ? ('connect' in thing && typeof thing.connect === 'function') : false

interface Disconnectable {
  disconnect(): void
}

const isDisconnectable = (thing: unknown): thing is Disconnectable => (thing && typeof thing === 'object') ? ('disconnect' in thing && typeof thing.disconnect === 'function') : false

interface Stoppable {
  stop(...args: unknown[]): void
}

const isStoppable = (thing: unknown): thing is Stoppable => (thing && typeof thing === 'object') ? ('stop' in thing && typeof thing.stop === 'function') : false

class Oscilloscope extends Scope<Connectable> {
  private anl: AnalyserNode
  private data: Uint8Array
  static FFT = 4096

  constructor(ctx: AudioContext, src: Connectable, canvas: HTMLCanvasElement) {
    super(ctx, src, canvas)

    this.anl = this.ctx.createAnalyser();
    this.anl.fftSize = Oscilloscope.FFT;
    this.src.connect(this.anl);
    this.data = new Uint8Array(Oscilloscope.FFT);
  }

  draw() {
    this.anl.getByteTimeDomainData(this.data);
    this.cctx.clearRect(0 , 0, this.canvas.width, this.canvas.height);

    this.cctx.beginPath();
    for(let i=0; i < this.data.length; i++){
        const x = i * (this.canvas.width * 2 / this.data.length);
        const v = this.data[i] / 128.0;
        const y = v * this.canvas.height / 2;
        if(i === 0) this.cctx.moveTo(x,y);
        else this.cctx.lineTo(x,y);
    }
    this.cctx.stroke();
  }
}

const pulse = (el: HTMLElement, color: string) => {
  el.animate([
    { background: color },
    { background: 'transparent' },
  ], {
    duration: 200,
    easing: 'ease-out'
  })
}

const getCellKey = (column: number, row: number) => colLetter(column) + row.toString(10)

type Atom = unknown | SExpr
type SExpr = Atom[]

export const serialise = (expression: Atom): string => {
  if(Array.isArray(expression)) {
    return `(${expression.map(serialise).join(" ")})`
  }

  if(typeof expression === 'object') {
    if(expression instanceof Tone.FrequencyClass) {
      return expression.toNote().toLowerCase()
    }

    if(expression instanceof Tone.TimeClass) {
      return expression.toBarsBeatsSixteenths()
    }

    if(expression instanceof ToneClass) {
      return '🎶 ' + expression.toString()
    }
  }

  if(typeof expression === 'number') {
    return expression === Math.round(expression) ? expression.toString(10) : expression.toFixed(3)
  }

  if(typeof expression === 'string') {
    return expression
  }

  if(typeof expression === 'boolean') {
    return expression.toString()
  }

  if(expression == null) {
    return '🔃 empty'
  }

  return Object.getPrototypeOf(expression ?? Object.create(null))?.constructor?.name
    ?? Object.prototype.toString.call(expression).replace(/\[object (.+)\]/, '$1')
}

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
            // let canvas = td.querySelector('canvas')
            // if(!canvas) {
            //   canvas = document.createElement('canvas')
            //   canvas.width = td.clientWidth * devicePixelRatio
            //   canvas.height = td.clientHeight * devicePixelRatio
            //   td.replaceChildren(canvas)
            // }
            // const osc = new Oscilloscope(ctx, result, canvas)
            // osc.run()
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
    } else {
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

const fromToneCallback = <T extends unknown[]>(tone: WithCallback<T>) => fromEventPattern(
  handler => tone.callback = handler,
  () => tone.callback = () => {},
  (...args) => args as T
)

const root = document.getElementById('root')!

type SequenceEvents = (string | SequenceEvents)[]

const rxlib = new Proxy({
  '->': (source: Tone.ToneAudioNode, ...dests: Tone.ToneAudioNode[]) =>  source.chain(...dests),
  '=>': (source: Tone.ToneAudioNode, ...dests: Tone.ToneAudioNode[]) =>  source.fan(...dests),
  'trans': (frequency: Tone.Unit.BPM, signature: [number, number] | number = 4) => {
    const trans = Tone.getTransport()
    trans.start('0')
    trans.bpm.value = frequency
    trans.timeSignature = signature
    trans.once('stop', () => trans.position = '0')
    return trans
  },
  'synth': () => {
    return new Tone.Synth()
  },
  'seq': (subdivision: Tone.Unit.Time, events: SequenceEvents) => {
    const seqDuration = Tone.Time(subdivision).toTicks() * events.length
    const quantStart = '@' + subdivision
    const transportProgress = Tone.getTransport().toTicks() / seqDuration
    const repeat = Math.floor(transportProgress)
    const loopProgress = transportProgress - repeat
    const startOffset = Math.floor(loopProgress * events.length)

    const seq = new Tone.Sequence({
      events,
      subdivision
    }).start(quantStart, startOffset)

    const onStart = () => seq.start(quantStart, startOffset)
    const onStop = () => seq.stop();
    Tone.getTransport().on('start', onStart)
    Tone.getTransport().on('stop', onStop)

    return fromToneCallback(seq).pipe(
      map(([time, note]) => [
        Tone.Time(time),
        Tone.Frequency(note)
      ]),
      share(),
      finalize(() => {
        Tone.getTransport().off('start', onStart)
        Tone.getTransport().off('stop', onStop)
        seq.stop()
      })
    )
  },
  'trig-ar': curry((synth: Tone.Synth, duration: Tone.Unit.Time, [time, note]: [Tone.Unit.Time, Tone.Unit.Note]) => {
    synth.triggerAttackRelease(note, duration, time)
    return [note, duration]
  }),
  '$>': <T, U>(observable: Observable<T>, fn: (t: T) => U) => observable.pipe(map(fn)),
  '>>=': <T, U>(observable: Observable<T>, fn: (t: T) => Observable<U>) => observable.pipe(switchMap(fn)),
  'i': <T>(i: T) => i,
  'dest': Tone.getDestination(),
  ':': (from: string, to: string) => {
    const [fromMatch, _fromCol, _fromRow] = /([A-Z]+)(\d+)/.exec(from) ?? []
    const [toMatch, _toCol, _toRow] = /([A-Z]+)(\d+)/.exec(to) ?? []
    if(!fromMatch || !toMatch) throw new Error(`invalid range ${serialise([':', from, to])}`)

    const fromCol = colFromLetter(_fromCol)
    const fromRow = parseInt(_fromRow, 10)
    const toCol = colFromLetter(_toCol)
    const toRow = parseInt(_toRow, 10)

    if(Number.isNaN(fromCol) || Number.isNaN(fromRow) || Number.isNaN(toCol) || Number.isNaN(toRow)) {
      throw new Error(`invalid range ${serialise([':', from, to])}`)
    }

    const out: unknown[] = []
    for(let i = fromCol; i <= toCol; i++) {
      for(let j = fromRow; j <= toRow; j++) {
        const cellKey = getCellKey(i, j)
        out.push(
          cells.get(cellKey)?.get()
        )
      }
    }

    return out
  }
}, {
  get(target, property, receiver) {
    if(typeof property === 'string' && property.match(/([A-Z]+)(\d+)/)) {
      return cells.get(property)?.get()
    }

    return Reflect.get(target, property, receiver)
  }
})


function runCell(column: number, row: number, value: string | null) {
  const cellKey = getCellKey(column as number + 1, row + 1)

  if(!value) {
    cells.delete(cellKey)
  } else {
    cells.set(cellKey, new Signal.Computed(() =>
      evaluate(value, rxlib)
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
