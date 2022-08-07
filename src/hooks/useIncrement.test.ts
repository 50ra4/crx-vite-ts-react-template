import { useIncrement } from './useIncrement';
import { act, renderHook } from '@testing-library/react';

describe('useIncrement', () => {
  it('the number including 1 should be returned', () => {
    const { result } = renderHook(() => useIncrement(1));

    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe(2);
  });
});
