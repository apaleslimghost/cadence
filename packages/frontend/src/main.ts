import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import './index.css';

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';

import evaluate, { serialise } from '@cadence/compiler'
import { SignalMap } from 'signal-utils/map';
import { effect } from 'signal-utils/subtle/microtask-effect';
import { Signal } from 'signal-polyfill';
import * as Tone from 'tone'


registerAllModules();

interface WithCallback<Args extends unknown[]> {
  callback: (...args: Args) => void
}

const hasCallback = <T extends unknown[]>(obj: unknown): obj is WithCallback<T> => (obj && typeof obj === 'object' && 'callback' in obj) ? true : false

const cells = new SignalMap<string, Signal.Computed<unknown>>()
const cellSubscriptions: Record<string, () => void> = {}

const colLetter = (col: number): string =>
  col <= 0
    ? ''
    : colLetter(Math.floor((col - 1) / 26)) +
      String.fromCharCode(((col - 1) % 26) + 65);

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

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    const cellKey = colLetter(column + 1) + (row + 1).toString(10)

    if(value) {
      cellSubscriptions[cellKey] ??= effect(() => {
        try {
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
          } else if(hasCallback(result)) {
            const cb = result.callback
            result.callback = (...args) => {
              cb(...args)
              pulse(td, '#7C4DFF')
              td.textContent = serialise(args)
            }
          } else if(result != null) {
            td.textContent = result as string
          } else {
            td.textContent = '🔃 Empty'
          }
        } catch(error) {
          td.textContent = `⚠️ ${error}`
          td.setAttribute('title', `⚠️ ${error}`)
          console.error(error)
        }
      })
    } else {
      cellSubscriptions[cellKey]?.()
      delete cellSubscriptions[cellKey]
      td.textContent = ''
    }
  },
});

const root = document.getElementById('root')!

const rxlib = {
  '→': (dest: AudioNode, ...sources: AudioNode[]) => {
    sources.forEach(s => s?.connect(dest))
    return dest

    // finalize(() => sources_.forEach(s => s.disconnect(dest)))
  },
  // TODO allow using Connectables for params
  'clock': (frequency: Tone.Unit.Hertz, units: 'bpm' | 'hertz' = 'bpm') => {
    return new Tone.Clock({
      frequency,
      units
    }).start()
  },
  'dest': () => {
    return Tone.getDestination()
  },
}

const rxspec = {
  subscribe: ([key]: [string]) => cells.get(key)?.get()
}

new Handsontable(root, {
  className: "ht-theme-main-dark",
  cells: () => ({ type: 'lisp' }),
  minCols: 100,
  minRows: 100,
  colWidths: 200,
  rowHeaders: true,
  colHeaders: true,
  height: "100%",
  width: "100%",
  autoRowSize: false,
  autoColumnSize: false,
  wordWrap: false,
  afterChange: (changes) => {
    for(const [row, column, oldValue, newValue] of changes ?? []) {
      if(oldValue === newValue) return

      const cellKey = colLetter(1 + (column as number)) + (row + 1).toString(10)

      if(!newValue) {
        cells.delete(cellKey)
      } else {
        cells.set(cellKey, new Signal.Computed(() =>
          evaluate(newValue, rxlib, rxspec)
        ))
      }
    }
  },
  licenseKey: "non-commercial-and-evaluation"
})

root.addEventListener('click', () => {
  Tone.start()
})
