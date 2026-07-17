import { useCallback, useState } from 'react';

export const useIncrement = (initialValue: number) => {
  const [state, setState] = useState(initialValue);
  const increment = useCallback(() => {
    setState((v) => v + 1);
  }, []);

  return [state, increment] as const;
};
