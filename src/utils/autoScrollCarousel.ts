export interface CarouselAdvance {
  /** Always animate to this x — motion is always forward, which is what sells the loop. */
  animateToX: number;
  /**
   * Set only when `animateToX` has crossed into the duplicated copy of the
   * content. Apply this, unanimated, once the scroll settles — it lands on
   * the pixel-identical position in the first copy, so the jump is invisible.
   */
  snapBackX: number | null;
}

/**
 * One auto-advance step of an infinitely-looping carousel built from content
 * rendered twice back to back. Real content of width `contentWidth` is
 * rendered as `[...items, ...items]`; scrolling always moves forward by
 * `stepX`, and once that motion crosses past the end of the first copy, the
 * caller snaps back into it after the animation completes — because the two
 * copies are pixel-identical, that snap reads as nothing happening rather
 * than as a rewind.
 */
export function advanceCarousel(currentX: number, stepX: number, contentWidth: number): CarouselAdvance {
  const animateToX = currentX + stepX;
  const snapBackX = animateToX >= contentWidth ? animateToX - contentWidth : null;
  return { animateToX, snapBackX };
}

/**
 * Keeps the tracked scroll position truthful after a scroll event that wasn't
 * (only) the auto-advance timer — a manual drag, or momentum settling past
 * the duplicate boundary. Wraps back into the first copy the same way
 * `advanceCarousel` does, so a manual swipe can carry the loop into the
 * duplicate zone without ever visibly "running out" of content.
 */
export function settleScrollPosition(x: number, contentWidth: number): number {
  return x >= contentWidth ? x - contentWidth : x;
}
