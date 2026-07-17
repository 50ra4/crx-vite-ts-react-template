import { add } from './calc';

describe('utils/calc', () => {
  it('should return added number', () => {
    expect(add(1, 1)).toBe(2);
    expect(add(1, 2)).toBe(3);
    expect(add(3, 2)).toBe(5);
  });
});
