const FORBIDDEN=/[\u0000-\u001F\u007F-\u009F\u2028\u2029\u200E\u200F\u202A-\u202E\u2066-\u2069\p{Cf}]/gu
export function byCodeUnit(a,b) {return a<b?-1:a>b?1:0}
export function safeText(value,maxUnits) {return value.replace(FORBIDDEN,'').slice(0,maxUnits)}
export function isSafeField(value,maxUnits) {
  return typeof value==='string' && value.length>0 && value.length<=maxUnits && value===value.trim() && safeText(value,maxUnits)===value
}
