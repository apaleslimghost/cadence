import type { Atom } from 's-expression';
import * as Tone from 'tone';
import { TransportClass } from 'tone/build/esm/core/clock/Transport';
import { Tone as ToneClass } from 'tone/build/esm/core/Tone';

function gcd(a: number, b: number): number{
  return b ? gcd(b, a % b) : a;
}

function reduceRatio(numerator: number, denominator: number){
  const div = gcd(numerator, denominator);
  return [numerator/div, denominator/div];
}

// TODO
type Result = unknown

export const serialise = (expression: Result): string => {
  if (Array.isArray(expression)) {
    return `(${expression.map(serialise).join(" ")})`;
  }

  if (typeof expression === 'object') {
    if (expression instanceof Tone.FrequencyClass) {
      return expression.toNote().toLowerCase();
    }

    if (expression instanceof Tone.TimeClass) {
      return expression.toBarsBeatsSixteenths();
    }

    if (expression instanceof Tone.Param || expression instanceof Tone.Signal) {
      return expression.value + expression.units;
    }

    if (expression instanceof TransportClass) {
      const sig = typeof expression.timeSignature === 'number' ? reduceRatio(expression.timeSignature, 4) : expression.timeSignature;
      if (sig[1] < 4) {
        const mul = 4 / sig[1];
        sig[0] *= mul;
        sig[1] *= mul;
      }
      return serialise(['⏯️', expression.bpm.toString(), sig.toString()]);
    }

    if (expression instanceof ToneClass) {
      return '🎶 ' + expression.toString();
    }
  }

  if (typeof expression === 'number') {
    return expression === Math.round(expression) ? expression.toString(10) : expression.toFixed(3);
  }

  if (typeof expression === 'string') {
    return expression;
  }

  if (typeof expression === 'boolean') {
    return expression.toString();
  }

  if (expression == null) {
    return '🔃 empty';
  }

  return Object.getPrototypeOf(expression ?? Object.create(null))?.constructor?.name
    ?? Object.prototype.toString.call(expression).replace(/\[object (.+)\]/, '$1');
};
