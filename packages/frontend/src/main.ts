import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import './index.css';

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import pick from 'lodash/pick'
import mapValues from 'lodash/mapValues';

import evaluate from '@cadence/compiler'
import { get, partition, sortBy, takeWhile } from 'lodash';
import { SignalMap } from 'signal-utils/map';
import { effect } from 'signal-utils/subtle/microtask-effect';



registerAllModules();

const ctx = new AudioContext()

const cells = new SignalMap<string, unknown>()

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

class ControlParam implements Connectable {
  private scale: GainNode
  private sum: GainNode
  public minValue: number
  public maxValue: number

  constructor(ctx: AudioContext, {minValue = 0, maxValue = 1, defaultValue = 0}: { minValue?: number, maxValue?: number, defaultValue?: number } = {}) {
    this.minValue = minValue
    this.maxValue = maxValue
    const value = new ConstantSourceNode(ctx, { offset: maxValue - minValue })
    value.start()
    this.scale = new GainNode(ctx, { gain: this.valueToScale(defaultValue) })
    const offset = new ConstantSourceNode(ctx, { offset: minValue })
    offset.start()
    this.sum = new GainNode(ctx)

    value.connect(this.scale).connect(this.sum)
    offset.connect(this.sum)
  }

  valueToScale(value: number) {
    return (value - this.minValue) / (this.maxValue - this.minValue)
  }

  connect<Dest extends AudioParam | AudioNode>(dest: Dest) {
    //@ts-expect-error typescript this is so stupid wyd
    this.sum.connect(dest)
    return dest
  }

  linearRampToValueAtTime(value: number, time: number) {
    return this.scale.gain.linearRampToValueAtTime(this.valueToScale(value), time)
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    return this.scale.gain.exponentialRampToValueAtTime(this.valueToScale(value), time)
  }
}

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    const cellKey = colLetter(column + 1) + (row + 1).toString(10)

    if(value) {
      effect(() => {
        const result = cells.get(cellKey)

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
          const osc = new Oscilloscope(ctx, result, canvas)
          osc.run()
        } else if(result != null) {
          td.textContent = result as string
        } else {
          td.textContent = '🔃 Empty'
        }
      })
    } else {
      // cellSubscriptions[cellKey]?.unsubscribe()
      // delete cellSubscriptions[cellKey]
      // td.textContent = ''
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
  'osc': (type: OscillatorType, freq: number | Connectable) => {
    const osc = new OscillatorNode(ctx, { type })
    osc.start()
    if(isConnectable(freq)) {
      freq.connect(osc.frequency)
    } else {
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
    }
      // finalize(() => osc.stop())
    return osc
  },
  'dest': () => {
    const gain = new GainNode(ctx)
    gain.connect(ctx.destination)
    return gain
  },

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
        result = evaluate(newValue, rxlib)
      } catch(error) {
        console.log(error)
      }

      cells.set(cellKey, result)
    }
  },
  licenseKey: "non-commercial-and-evaluation"
})

root.addEventListener('click', () => {
  ctx.resume()
})
