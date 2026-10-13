export const LIMITS = Object.freeze({bytes:8388608, techniques:5000, activities:5000,
  depth:16, milliseconds:5000, nodes:250000, notes:5000, ids:32, tactics:16,
  ref:128, note:4096, exportBytes:33554432})
export class BudgetError extends Error {
  constructor(code,file='@activities') {super(code); this.code=code; this.file=file}
}
export function createBudget(now,maxMilliseconds=5000) {
  if(typeof now!=='function' || !Number.isSafeInteger(maxMilliseconds) || maxMilliseconds<1 || maxMilliseconds>5000) throw new TypeError('Invalid budget configuration')
  let start,last
  const check=(file='@activities') => {
    let tick; try {tick=now()} catch {tick=NaN}
    if(!Number.isFinite(tick) || (last!==undefined && tick<last)) throw new BudgetError('analysis-clock-invalid',file)
    if(start===undefined) start=tick
    last=tick
    if(tick-start>maxMilliseconds) throw new BudgetError('analysis-timeout',file)
  }
  check()
  return {check}
}
