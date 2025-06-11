import { useState } from 'react'
import './App.css'
import evaluate from '@cadence/compiler'

function App() {
  const [code, setCode] = useState('')

  let result;

  try {
    result = evaluate(code)
  } catch(e) {
    result = (e as Error).message
  }

  return (
    <>
      <textarea value={code} onChange={e => setCode(e.target.value)} />
      <pre>{JSON.stringify(result)}</pre>
    </>
  )
}

export default App
