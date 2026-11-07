export const CYCLE = 40
export function signalPhase(t) {
  const u = ((t % CYCLE) + CYCLE) % CYCLE
  if (u < 22) return { h: 'green', v: 'red' }
  if (u < 24) return { h: 'yellow', v: 'red' }
  if (u < 25) return { h: 'red', v: 'red' }
  if (u < 35) return { h: 'red', v: 'green' }
  if (u < 37) return { h: 'red', v: 'yellow' }
  return { h: 'red', v: 'red' }
}
