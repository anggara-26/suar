import { advanceCarousel, settleScrollPosition } from '@/src/utils/autoScrollCarousel';

describe('advanceCarousel', () => {
  it('moves forward by the step when nowhere near the duplicate boundary', () => {
    const result = advanceCarousel(100, 50, 1000);
    expect(result.animateToX).toBe(150);
    expect(result.snapBackX).toBeNull();
  });

  it('flags a snap-back once the step crosses into the duplicated copy', () => {
    // Content is 300 wide; stepping from 280 by 50 lands at 330, past the boundary.
    const result = advanceCarousel(280, 50, 300);
    expect(result.animateToX).toBe(330);
    expect(result.snapBackX).toBe(30); // 330 - 300
  });

  it('treats landing exactly on the boundary as crossing it', () => {
    const result = advanceCarousel(250, 50, 300);
    expect(result.animateToX).toBe(300);
    expect(result.snapBackX).toBe(0);
  });

  it('keeps animating forward even from an already-wrapped position', () => {
    // After a previous snap-back, currentX starts small again — still just adds the step.
    const result = advanceCarousel(30, 50, 300);
    expect(result.animateToX).toBe(80);
    expect(result.snapBackX).toBeNull();
  });
});

describe('settleScrollPosition', () => {
  it('leaves a position inside the first copy untouched', () => {
    expect(settleScrollPosition(120, 300)).toBe(120);
  });

  it('wraps a position at or past the duplicate boundary back into the first copy', () => {
    expect(settleScrollPosition(300, 300)).toBe(0);
    expect(settleScrollPosition(340, 300)).toBe(40);
  });
});
