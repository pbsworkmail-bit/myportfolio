// Non-overshooting easing — velocity is zero at both t=0 and t=1, so a
// particle driven by this never passes its destination and snaps back.
// Cubic ease-in-out is the default; quintic is available for an even
// gentler, longer deceleration into the destination.
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeInOutQuintic(t) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}
