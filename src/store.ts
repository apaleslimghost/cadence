import { SignalMap } from 'signal-utils/map';
import { Signal } from 'signal-polyfill';
import type { Subscription } from 'rxjs';

import { DocHandle, Repo, isValidAutomergeUrl } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"

import evaluate from './lang/compiler'
import lib from './lang/stdlib';

export const cells = new SignalMap<string, Signal.Computed<unknown>>()
export const cellSubscriptions: Record<string, () => void> = {}
export const cellObservableSubscriptions: Record<string, Subscription> = {}

Object.assign(window, {
  cells,
  cellSubscriptions,
  cellObservableSubscriptions
})

export const colLetter = (col: number): string =>
  col <= 0
    ? ''
    : colLetter(Math.floor((col - 1) / 26)) +
      String.fromCharCode(((col - 1) % 26) + 65);

export const colFromLetter = (col: string): number =>[...col].reduce(
  (acc, c) => acc * 26 + (c.charCodeAt(0) - 64),
  0
)

export const getCellKey = (column: number, row: number) => colLetter(column) + row.toString(10)

export function runCell(column: number, row: number, value: string | null) {
  const cellKey = getCellKey(column as number + 1, row + 1)

  if(!value) {
	 cells.delete(cellKey)
  } else {
	 cells.set(cellKey, new Signal.Computed(() =>
		evaluate(value, lib)
	 ))
  }
}

export const repo = new Repo({
  storage: new IndexedDBStorageAdapter("automerge"),
  network: [new BrowserWebSocketClientAdapter("wss://sync.automerge.org")],
})

type RepoState = {
  data: any[][]
}

const docUrl = window.location.hash.slice(1)
export let handle: DocHandle<RepoState>

if (docUrl && isValidAutomergeUrl(docUrl)) {
  handle = await repo.find<RepoState>(docUrl)
} else {
  handle = repo.create<RepoState>({ data: [[]] })
  window.location.hash = handle.url
}
