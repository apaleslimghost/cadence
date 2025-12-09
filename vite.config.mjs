import {plugin as mdPlugin} from 'vite-plugin-markdown'
import wasm from 'vite-plugin-wasm'

export default {
  build: {
    target: 'esnext'
  },
  plugins: [
    mdPlugin({
      mode: 'html'
    }),
    wasm()
  ]
}
