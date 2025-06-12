import { useState } from 'react'
import evaluate from '@cadence/compiler'
import {HotTable} from '@handsontable/react-wrapper';
import Handsontable from 'handsontable';
import { textRenderer } from 'handsontable/renderers';

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    return textRenderer(instance, td, row, column, prop, 'todo', cellProps)
  },
});

function App() {
  // const [code, setCode] = useState('')

  // let result;

  // try {
  //   result = evaluate(code)
  // } catch(e) {
  //   result = (e as Error).message
  // }

  return <HotTable
      className="ht-theme-main-dark-auto"
      cells={() => ({ type: 'lisp' })}
      minCols={100}
      minRows={100}
      colWidths={200}
      rowHeaders={true}
      colHeaders={true}
      height="100%"
      width="100%"
      autoWrapRow={true}
      autoWrapCol={true}
      autoRowSize={false}
      autoColumnSize={false}
      afterChange={(changes, source) => {
        for(const [row, col, oldValue, newValue] of changes ?? []) {
          console.log({ row, col, oldValue, newValue })
        }
      }}
      licenseKey="non-commercial-and-evaluation"
    />
}

export default App
