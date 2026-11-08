// Tiny SVG node wrappers. Every attribute write goes through a cache, so a frame
// only touches the DOM for values that actually changed.
import { clamp01, lerp, f } from './geometry.js'

const NS = 'http://www.w3.org/2000/svg'

export function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag)
  for (const k in attrs) n.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(n)
  return n
}

export class Item {
  constructor(node, maxA = 1) {
    this.n = node
    this.maxA = maxA
    this.c = { h: true }
    node.setAttribute('display', 'none')
  }
  attr(k, v) {
    if (this.c[k] !== v) { this.c[k] = v; this.n.setAttribute(k, v) }
  }
  // Opacity 0..1 (scaled by maxA). Fully transparent nodes are display:none, so
  // anything that has not appeared yet (or has gone) costs nothing to paint.
  alpha(a) {
    const v = Math.round(clamp01(a) * this.maxA * 100) / 100
    const hide = v <= 0
    if (hide !== this.c.h) { this.c.h = hide; this.n.setAttribute('display', hide ? 'none' : 'inline') }
    if (!hide) this.attr('opacity', v)
  }
}

// Curve/outline drawn progressively with the dash trick (pathLength normalised to 1).
export class Path extends Item {
  constructor(parent, cls, maxA, d = '') {
    super(el('path', { class: cls, d, pathLength: 1 }, parent), maxA)
  }
  d(v) { this.attr('d', v) }
  show(p, a = 1) {
    if (p >= 0.9995) this.attr('stroke-dasharray', 'none')
    else { this.attr('stroke-dasharray', '1 2'); this.attr('stroke-dashoffset', (1 - p).toFixed(4)) }
    this.alpha(p <= 0.001 ? 0 : a)
  }
}

// Straight segment drawn from A towards B; styled (e.g. dashed) purely by CSS.
export class Seg extends Item {
  constructor(parent, cls, maxA) { super(el('path', { class: cls }, parent), maxA) }
  show(ax, ay, bx, by, p = 1, a = 1) {
    if (p <= 0.001 || a <= 0) { this.alpha(0); return }
    this.attr('d', `M${f(ax)} ${f(ay)}L${f(lerp(ax, bx, p))} ${f(lerp(ay, by, p))}`)
    this.alpha(a)
  }
}

// Dot or ring, sized in screen pixels (`rpx`) so it stays legible at any card size.
export class Dot extends Item {
  constructor(parent, cls, rpx, maxA = 1, x = 0, y = 0) {
    super(el('circle', { class: cls, cx: f(x), cy: f(y), r: 0 }, parent), maxA)
    this.rpx = rpx
    this.u = 1
  }
  pos(x, y) { this.attr('cx', f(x)); this.attr('cy', f(y)) }
  size(rpx) { this.rpx = rpx; this.fit() }
  resize(u) { this.u = u; this.fit() }
  fit() { this.attr('r', (Math.max(0.5, this.rpx) * this.u).toFixed(2)) }
}
