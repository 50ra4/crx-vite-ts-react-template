const SAMPLE_INSERTION_POINT_SELECTORS = [
  'main',
  '[role="main"]',
  'body',
] as const;

export const findSampleInsertionPoint = (root: ParentNode): Element | null => {
  for (const selector of SAMPLE_INSERTION_POINT_SELECTORS) {
    const insertionPoint = root.querySelector(selector);
    if (insertionPoint) return insertionPoint;
  }

  return null;
};
