# cadence

todo

- [x] cells ui
- [x] parsing and running exprs in cells
- [x] reactive cell references
- [x] primitives for generating and processing observables
- [x] visual cell ui
  - [x] observable values
  - [x] observable update flashing
  - [ ] controls
  - [ ] audionode oscilloscopes
  - [x] data persistence
  - [ ] automerge?
  - [ ] collab?
- [ ] more tonejs wrappers/primitives
  - [ ] samples/banks
  - [ ] jux rev (thanks yaxu)
  - [ ] synth params
  - [ ] oscs and filters
  - [ ] effects
  - [ ] LFOs/envelopes, connecting nodes to params not via observables 🤔
  - [ ] easier .connect/.chain
  - [x] spreadsheet ranges for arrays
- [ ] bugs/UI improvements
  - [ ] stopping/restarting transport
  - [x] display pending observable value
  - [ ] loop sync, quantisation etc
  - [x] split actual values in observable from displayed values in cell (hookable serialise)
  - [ ] flash cell on read(? is that even possible?)
  - [ ] indistinguishable between deleting a cell that returns a reference to something and deleting the cell containing the thing
  - [ ] starting loops that were initialised before the transport started (should work? doesn't consistently eg on load with persistent data)
  - [ ] need to unsubscribe/stop(?) when editing a cell or if its dependencies update, not just on delete
- [ ] midi
  - [ ] CCs
  - [ ] notes
    - [ ] computer keyboard cell type???
