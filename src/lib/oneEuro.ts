/**
 * One Euro filter (Casiez et al. 2012): heavy smoothing when the signal is slow,
 * light smoothing when it moves fast — kills jitter without adding drag lag.
 */
class LowPass {
  private y: number | null = null
  filter(x: number, alpha: number) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y
    return this.y
  }
  last() {
    return this.y
  }
}

const alphaFor = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

export class OneEuro {
  private x = new LowPass()
  private dx = new LowPass()
  private lastT: number | null = null
  private minCutoff: number
  private beta: number
  private dCutoff: number

  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  /** `t` in milliseconds. */
  filter(value: number, t: number) {
    const dt = this.lastT === null ? 1 / 60 : Math.max((t - this.lastT) / 1000, 1e-3)
    this.lastT = t
    const prev = this.x.last()
    const deriv = prev === null ? 0 : (value - prev) / dt
    const edx = this.dx.filter(deriv, alphaFor(this.dCutoff, dt))
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    return this.x.filter(value, alphaFor(cutoff, dt))
  }
}

export class OneEuro2D {
  private fx: OneEuro
  private fy: OneEuro
  constructor(minCutoff?: number, beta?: number) {
    this.fx = new OneEuro(minCutoff, beta)
    this.fy = new OneEuro(minCutoff, beta)
  }
  filter(p: { x: number; y: number }, t: number) {
    return { x: this.fx.filter(p.x, t), y: this.fy.filter(p.y, t) }
  }
}
