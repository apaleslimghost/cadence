import _, { curry } from 'lodash';
import { defer, share, finalize, map, Observable, switchMap } from 'rxjs';
import * as Tone from 'tone';
import { NoteEvent, Entries, lispObj, SequenceEvents, fromToneCallback, colFromLetter, getCellKey, cells } from '../main';
import { serialise } from '../serialise';

const rxlib = new Proxy({
  '->': (source: Tone.ToneAudioNode, ...dests: Tone.ToneAudioNode[]) => source.chain(...dests),
  '=>': (source: Tone.ToneAudioNode, ...dests: Tone.ToneAudioNode[]) => source.fan(...dests),
  '->>': (...sources: Tone.ToneAudioNode[]) => {
    return sources.map(s => s?.toDestination());
  },
  '>>': (dest: Tone.ToneAudioNode, ...sources: Tone.ToneAudioNode[]) => {
    const gain = new Tone.Gain(0, 'decibels').connect(dest);
    sources.forEach(s => s?.connect(gain));
    return gain;
  },
  '+': curry((a: number, b: NoteEvent | Tone.FrequencyClass | number) => {
    if (Array.isArray(b)) {
      return [b[0], b[1] ? Tone.Frequency(b[1]).transpose(a) : b[1]] as const;
    }

    if (b instanceof Tone.FrequencyClass) {
      return b.transpose(a);
    }

    return a + b;
  }),
  '-': curry((a: number, b: any): any => {
    return rxlib['+'](-a, b);
  }),
  '.': _.get,
  '.=': (source: Tone.ToneAudioNode, ...options: Entries) => {
    source.set(lispObj(...options));
    return options;
  },
  '∘': _.flow,
  'trans': (frequency: Tone.Unit.BPM, signature: [number, number] | number = 4) => {
    const trans = Tone.getTransport();
    trans.start('0');
    trans.bpm.value = frequency;
    trans.timeSignature = signature;
    trans.once('stop', () => trans.position = '0');
    return trans;
  },
  'osc': (frequency: Tone.Unit.Frequency, type: Tone.ToneOscillatorType) => {
    return new Tone.OmniOscillator(frequency, type).start();
  },
  'lfo': (frequency: Tone.Unit.Frequency, type: Tone.ToneOscillatorType, min?: number, max?: number) => {
    const lfo = new Tone.LFO(frequency, min, max).start();
    lfo.type = type;
    return lfo;
  },
  'synth': (...options: Entries) => {
    return new Tone.Synth(lispObj(...options));
  },
  'pluck': (...options: Entries) => {
    return new Tone.PluckSynth(lispObj(...options));
  },
  'reverb': (...options: Entries) => {
    return new Tone.Reverb(lispObj(...options));
  },
  'filter': (...options: Entries) => {
    return new Tone.Filter(lispObj(...options));
  },
  'chorus': (...options: Entries) => {
    return new Tone.Chorus(lispObj(...options));
  },
  'delay': (...options: Entries) => {
    return new Tone.FeedbackDelay(lispObj(...options));
  },
  'sample': (url: string) => {
    return new Tone.Player(url);
  },
  'seq': (subdivision: Tone.Unit.Time, events: SequenceEvents) => {
    const seqDuration = Tone.Time(subdivision).toTicks() * events.length;
    const quantStart = '@' + subdivision;
    const transportProgress = Tone.getTransport().toTicks() / seqDuration;
    const repeat = Math.floor(transportProgress);
    const loopProgress = transportProgress - repeat;
    const startOffset = Math.floor(loopProgress * events.length);

    let seq: Tone.Sequence, onStart: () => void, onStop: () => void;

    return defer(
      () => {
        seq = new Tone.Sequence({
          events,
          subdivision
        }).start(quantStart, startOffset);
        onStart = () => seq.start(quantStart, startOffset);
        onStop = () => seq.stop();

        Tone.getTransport().on('start', onStart);
        Tone.getTransport().on('stop', onStop);

        return fromToneCallback(seq).pipe(
          share(),
          finalize(() => {
            Tone.getTransport().off('start', onStart);
            Tone.getTransport().off('stop', onStop);
            seq.stop();
          })
        );
      }
    ).pipe(
      map(([time, note]) => [
        Tone.Time(time),
        note !== '_' ? Tone.Frequency(note) : null
      ])
    );
  },
  'play': curry((synth: Tone.Synth | Tone.Player, duration: Tone.Unit.Time, [time, note]: NoteEvent) => {
    if (note) {
      if (synth instanceof Tone.Synth) {
        synth.triggerAttackRelease(note, duration, time);
      } else if (synth.loaded) {
        synth.start(time, 0, duration);
      }
    }

    return [note, duration];
  }),
  '$>': <T, U>(observable: Observable<T>, fn: (t: T) => U) => observable.pipe(map(fn)),
  '>>=': <T, U>(observable: Observable<T>, fn: (t: T) => Observable<U>) => observable.pipe(switchMap(fn)),
  'i': <T>(i: T) => i,
  'dest': Tone.getDestination(),
  ':': (from: string, to: string) => {
    const [fromMatch, _fromCol, _fromRow] = /([A-Z]+)(\d+)/.exec(from) ?? [];
    const [toMatch, _toCol, _toRow] = /([A-Z]+)(\d+)/.exec(to) ?? [];
    if (!fromMatch || !toMatch) throw new Error(`invalid range ${serialise([':', from, to])}`);

    const fromCol = colFromLetter(_fromCol);
    const fromRow = parseInt(_fromRow, 10);
    const toCol = colFromLetter(_toCol);
    const toRow = parseInt(_toRow, 10);

    if (Number.isNaN(fromCol) || Number.isNaN(fromRow) || Number.isNaN(toCol) || Number.isNaN(toRow)) {
      throw new Error(`invalid range ${serialise([':', from, to])}`);
    }

    const out: unknown[] = [];
    for (let i = fromCol; i <= toCol; i++) {
      for (let j = fromRow; j <= toRow; j++) {
        const cellKey = getCellKey(i, j);
        out.push(
          cells.get(cellKey)?.get()
        );
      }
    }

    return out;
  }
}, {
  get(target, property, receiver) {
    if (typeof property === 'string' && property.match(/([A-Z]+)(\d+)/)) {
      return cells.get(property)?.get();
    }

    return Reflect.get(target, property, receiver);
  }
});

export default rxlib;
