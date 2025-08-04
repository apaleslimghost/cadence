import { AnyAudioContext } from "tone/build/esm/core/context/AudioContext"
import * as Tone from 'tone'
import { Connectable } from "./types"
import colours from './palette';

export default class Oscilloscope {
  static FFT = 4096

  private anl: AnalyserNode
  private data: Uint8Array
  protected ctx: AnyAudioContext
  protected src: Connectable
  protected canvas: HTMLCanvasElement
  protected cctx: CanvasRenderingContext2D

  constructor(ctx: AnyAudioContext, src: Connectable, canvas: HTMLCanvasElement) {
	 this.ctx = ctx
	 this.src = src instanceof Tone.LFO ? src['_oscillator'] : src
	 this.canvas = canvas

	 this.cctx = this.canvas.getContext("2d")!;
	 this.cctx.strokeStyle = colours.ocean[5];
	 this.cctx.lineWidth = devicePixelRatio;

	 this.anl = this.ctx.createAnalyser();
	 this.anl.fftSize = src instanceof Tone.LFO ? 32768 : 4096;
	 this.src.connect(this.anl);
	 this.data = new Uint8Array(this.anl.fftSize);
  }

  clear() {
	 this.cctx.fillStyle   = 'white';
  }

  run() {
	 requestAnimationFrame(() => this.run());
	 this.draw()
  }

  draw() {
	 this.anl.getByteTimeDomainData(this.data);
	 this.cctx.clearRect(0 , 0, this.canvas.width, this.canvas.height);

	 this.cctx.beginPath();
	 for(let i=0; i < this.data.length; i++){
		  const x = i * (this.canvas.width * 2 / this.data.length);
		  const v = this.data[i] / 128.0;
		  const y = this.canvas.height - v * this.canvas.height / 2;
		  if(i === 0) this.cctx.moveTo(x,y);
		  else this.cctx.lineTo(x,y);
	 }
	 this.cctx.stroke();
  }
}
