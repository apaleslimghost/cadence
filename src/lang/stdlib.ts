import _, { curry } from 'lodash';
import { defer, share, finalize, map, Observable, switchMap, fromEventPattern, withLatestFrom, filter, zip, of, zipWith, repeat, from } from 'rxjs';
import * as Tone from 'tone';
import {euclid, rotate} from '@tonaljs/rhythm-pattern'
import * as Mode from '@tonaljs/mode'
import * as Chord from '@tonaljs/chord'
import { serialise } from '../serialise';
import { Entries, isTimed, NoteEvent, SequenceEvents, WithCallback } from '../types';
import { cells, colFromLetter, getCellKey } from '../store';

const isPair = (a: unknown) => Array.isArray(a) && a.length === 2

const lispObj = (...entries: Entries) => Object.fromEntries(
  entries.map(([key, ...values]): [string, unknown] => {
    if(values.every(isPair)) {
      return [key, lispObj(...values as Entries)]
    }

    return [key, values[0]]
  })
)

const fromToneCallback = <T extends unknown[]>(tone: WithCallback<T>) => fromEventPattern(
  handler => tone.callback = handler,
  () => tone.callback = () => {},
  (...args) => args as T
)

const rxlib = new Proxy({
  '->': (source: Tone.ToneAudioNode, ...dests: Tone.ToneAudioNode[]) => {
    source.chain(...dests)

    return {
      toSerialisable() {
        return [source, ...dests].flatMap(node => [node, '->']).slice(0, -1)
      },
      disconnect() {
        source.disconnect(dests[0])
        for(let i = 0; i < dests.length - 1; i++) {
          dests[i].disconnect(dests[i + 1])
        }
      }
    }
  },
  '=>': (source: Tone.ToneAudioNode, ...dests: Tone.ToneAudioNode[]) => {
    source.fan(...dests)

    return {
      toSerialisable() {
        return [source, '=>', ...dests]
      },
      disconnect() {
        for(const dest of dests) {
          source.disconnect(dest)
        }
      }
    }
  },
  '->>': (...sources: Tone.ToneAudioNode[]) => {
    sources.map(s => s?.toDestination());

    return {
      toSerialisable() {
        return [...sources, '->', Tone.getDestination()]
      },
      disconnect() {
        for(const source of sources) {
          source.disconnect(Tone.getDestination())
        }
      }
    }
  },
  '>>': (dest: Tone.ToneAudioNode, ...sources: Tone.ToneAudioNode[]) => {
    const gain = new Tone.Gain(0, 'decibels').connect(dest);
    sources.forEach(s => s?.connect(gain));

    return {
      toSerialisable() {
        return [...sources, '>>', dest]
      },
      disconnect() {
        for(const source of sources) {
          source.disconnect(gain)
        }
        gain.disconnect(dest)
      }
    }
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
    trans.stop('0');

    trans.bpm.value = frequency;
    trans.timeSignature = signature;

    trans.start('0');
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
  'poly': (voice: any, ...options: Entries) => {
    return new Tone.PolySynth({
      voice,
      options: lispObj(...options)
    });
  },
  'mono': (voice: any, ...options: Entries) => {
    return new voice(lispObj(...options));
  },
  'synth': Tone.Synth,
  'metal': Tone.MetalSynth,
  'fm': Tone.FMSynth,
  'membrane': Tone.MembraneSynth,
  'am': Tone.AMSynth,
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
    const {promise, resolve, reject} = Promise.withResolvers()

    return Object.assign(new Tone.Player({
      url,
      onload: () => resolve(null),
      onerror: reject
    }), { promise });
  },
  'pat': (subdivision: Tone.Unit.Time, events: SequenceEvents) =>
    defer(
      () => {
        const seq = new Tone.Sequence({
          events,
          subdivision
        }).start('@1m');

        const onStart = () => seq.start('@1m');
        const onStop = () => seq.stop('@1m');

        Tone.getTransport().on('start', onStart);
        Tone.getTransport().on('stop', onStop);

        return fromToneCallback(seq).pipe(
          share(),
          finalize(() => {
            Tone.getTransport().off('start', onStart);
            Tone.getTransport().off('stop', onStop);
            seq.stop('@1m');
          })
        );
      }
    ).pipe(
      share(),
      map(([time, note]) => [
        Tone.TransportTime(time),
        note
      ])
    ),
  'seq': (interval: Tone.Unit.Time, events: any[]) =>
    defer(
      () => {
        const seq = new Tone.Loop({
          interval
        }).start('@1m');
        let index = 0

        const onStart = () => seq.start('@1m');
        const onStop = () => seq.stop('@1m');

        Tone.getTransport().on('start', onStart);
        Tone.getTransport().on('stop', onStop);

        return fromToneCallback(seq).pipe(
          share(),
          map(time => {
            const event = events[index]
            index = (index + 1) % events.length
            return [time, event]
          }),
          finalize(() => {
            Tone.getTransport().off('start', onStart);
            Tone.getTransport().off('stop', onStop);
            seq.stop('@1m');
          })
        );
      }
    ).pipe(
      share(),
      map(([time, event]) => [
        Tone.TransportTime(time),
        event
      ])
    ),
  'play': curry((synth: Tone.Synth | Tone.Player, duration: Tone.Unit.Time, [time, note]: NoteEvent) => {
    if (note) {
      if (synth instanceof Tone.PolySynth) {
        synth.triggerAttackRelease(Array.isArray(note) ? note : [note], duration, time.toBarsBeatsSixteenths());
      } else if (synth instanceof Tone.PluckSynth) {
        synth.triggerAttack(
          Array.isArray(note) ? note[0] : note,
          time.toBarsBeatsSixteenths()
        );
      } else if (synth instanceof Tone.Synth) {
        synth.triggerAttackRelease(
          Array.isArray(note) ? note[0] : note,
          duration,
          time.toBarsBeatsSixteenths()
        );
      } else if (synth.loaded) {
        synth.start(time.toBarsBeatsSixteenths(), 0, duration);
      }
    }

    return [Tone.Time(duration), note];
  }),
  '$>': <T, U>(items: Observable<T> | T[], fn: (t: T) => U) =>
    Array.isArray(items) ? items.map(fn) : items.pipe(map(fn)),
  '>>=': <T, U>(observable: Observable<T>, fn: (t: T) => Observable<U>) => observable.pipe(switchMap(fn)),
  'i': <T>(i: T) => i,
  'k': <T>(k: T) => () => k,
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
  },
  'p': (curry(<T extends Function>(probability: number, a: T, b: T): T => (...args: Parameters<T>): ReturnType<T> => Math.random() < probability ? a(...args) : b(...args))),
  'sig': (units: Tone.Unit.UnitName = 'number', minValue = 0, maxValue = 1, value = minValue) => new Tone.Signal({ units, value, minValue, maxValue }),
  euclid,
  zip: <T, U>(a: Observable<T>, b: Observable<U>) => a.pipe(
    withLatestFrom(b),
    filter(
      ([a, b]) =>
        Boolean(isTimed(a) ? a[1] : a) &&
        Boolean(isTimed(b) ? b[1] : b)
    ),
    map(([a, b]) =>
      isTimed(a) && isTimed(b) ? [a[0], b[1]] : b
    )
  ),
  key: curry(
    (tonic: string, mode: string) => ({
      tonic, mode,
      chords: Mode.triads(mode, tonic),
      notes: Mode.notes(mode, tonic)
    })
  ),
  chord: curry(
    (key: {chords: string[]}, octave: number, chord: number) =>
      Chord.notes(key.chords[chord % key.chords.length]).map(n => n + (octave + Math.floor(chord / key.chords.length)))
  ),
  note: curry(
    (key: {notes: string[]}, octave: number, note: number) =>
      key.notes[note % key.notes.length] + (octave + Math.floor(note / key.notes.length))
  ),
  rotate,
  bank: (bank: string) => {
    function b(instrument: string, index = 0) {
      const url = `/banks/${bank}/${instrument}/${index.toString().padStart(2, '0')}.wav`
      return rxlib.sample(url)
    }

    b.toSerialisable = () => ['bank', new String(bank)]

    return b
  },
  loop: (url: string, length: Tone.Unit.Time) => {
    const {promise, resolve, reject} = Promise.withResolvers()
    const lenSeconds = Tone.Time(length).toSeconds()

    const player = new Tone.GrainPlayer({
      url,
      loop: true,
      grainSize: 0.1,
      overlap: 0.01,
      onload() {
        resolve(null)
        setRate()
      },
      onerror: reject
    })

    Tone.getTransport().on('start', setRate)

    Tone.getTransport().on('stop', () => {
      player.stop('@1m')
    })

    function setRate() {
      if(!player.loaded) return
      const lenSeconds = Tone.Time(length).toSeconds()
      player.playbackRate = Tone.Time(player.buffer.duration).toSeconds() / lenSeconds
      if(Tone.getTransport().state === 'started') {
        player.start('@1m')
      }
    }

    return Object.assign(player, { promise })
  }
}, {
  get(target, property, receiver) {
    if (typeof property === 'string' && property.match(/([A-Z]+)(\d+)/)) {
      return cells.get(property)?.get();
    }

    return Reflect.get(target, property, receiver);
  }
});

Object.assign(window, { rxlib })

export default rxlib;
