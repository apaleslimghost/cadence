import './index.css'
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { BehaviorSubject, combineLatest, mergeMap, Observable, of, switchMap } from 'rxjs';
import pick from 'lodash/pick'
import mapValues from 'lodash/mapValues';

import evaluate from '@cadence/compiler'

registerAllModules();

type Cell<T> = {
  source: string,
  result: Observable<T>
}

type Cells = Record<string, BehaviorSubject<Cell<unknown>>>

const store = new BehaviorSubject<Cells>({})

const cellEvents = (cellKeys: string[]) => store.pipe(
  switchMap(cells => combineLatest(pick(cells, cellKeys)).pipe(
    mergeMap(cells => combineLatest(mapValues(cells, cell => cell.result)))
  ))
);

function replaceCell(key: string, cell: Cell<unknown>) {
  store.next({
    ...store.value,
    [key]: new BehaviorSubject(cell)
  })
}

function updateCell(key: string, cell: Cell<unknown>) {
  store.value[key].next(cell)
}

const colLetter = (col: number): string =>
  col <= 0
    ? ''
    : colLetter(Math.floor((col - 1) / 26)) +
      String.fromCharCode(((col - 1) % 26) + 65);

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    const cellKey = colLetter(column) + row.toString(10)

    cellEvents([cellKey]).subscribe(
      result =>  td.textContent = result[cellKey] as string
    )
  },
});

const root = document.getElementById('root')!

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
          console.log({ row, column, oldValue, newValue })
          const cellKey = colLetter(column as number) + row.toString(10)
          let result

          try {
            result = evaluate(newValue)
          } catch(error) {
            console.log(error)
          }

          replaceCell(cellKey, {
            source: newValue,
            result: of(result)
          })
        }
      },
      licenseKey: "non-commercial-and-evaluation"
})
