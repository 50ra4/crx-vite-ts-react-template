---
paths: ['src/entrypoints/content/**']
---

# Resilient content script injection recipe

Use this recipe when a content script injects UI into a host page that can
re-render or navigate without a full reload. Keep selectors, navigation events,
the debounce interval, and the mount unit in the product entrypoint. Do not add a
generic DOM injection layer to `src/lib/`.

The runnable minimal example is
`src/entrypoints/content/sample.tsx`. It uses an open Shadow Root, inline CSS,
debounced reconciliation, `popstate` / `pageshow`, and idempotent remounting. Its
page adapter is fixture-tested in `sampleAdapter.test.ts`.

## 1. Isolate host-page selectors in an adapter

Keep volatile host-page knowledge out of rendering and lifecycle code. Order
selectors from the most stable semantic selector to the weakest fallback.

```ts
// featureAdapter.ts
const FEATURE_SCOPE_SELECTORS = [
  '[data-feature-scope]',
  'main article',
] as const;

export const findFeatureScopes = (root: ParentNode): HTMLElement[] => {
  const scopes = new Set<HTMLElement>();

  for (const selector of FEATURE_SCOPE_SELECTORS) {
    for (const scope of root.querySelectorAll<HTMLElement>(selector)) {
      scopes.add(scope);
    }
  }

  return [...scopes];
};
```

Do not scatter selector fallbacks through React components. If a site has
multiple page variants, express that only in the adapter.

## 2. Test the adapter with real HTML fixtures

`src/**/*.test.ts` runs in jsdom, so feed the adapter representative HTML rather
than mocking `querySelector`. Include every supported fallback and the
not-yet-rendered case.

```ts
// featureAdapter.test.ts
import { findFeatureScopes } from './featureAdapter';

describe('findFeatureScopes', () => {
  test('finds scopes in a host-page fixture', () => {
    document.body.innerHTML = `
      <main>
        <article id="first">First</article>
        <article id="second">Second</article>
      </main>
    `;

    expect(findFeatureScopes(document)).toEqual([
      document.querySelector('#first'),
      document.querySelector('#second'),
    ]);
  });

  test('returns an empty array before the host page renders', () => {
    document.body.innerHTML = '<main>Loading...</main>';

    expect(findFeatureScopes(document)).toEqual([]);
  });
});
```

Use sanitized captured HTML when synthetic fixtures miss important nesting or
attributes. Keep fixtures small enough that a selector failure identifies the
broken assumption immediately.

## 3. Mount through an open Shadow Root

Add Vite's client types once so TypeScript understands `?inline` CSS imports:

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
```

Write CSS for the shadow tree and reset inherited host styles explicitly:

```css
/* feature.css */
:host {
  all: initial;
  display: block;
  font-family: system-ui, sans-serif;
}

.widget {
  color: #172033;
  background: #ffffff;
}
```

The complete lifecycle below supports multiple independently re-rendered scopes.
The `Map` owns every React root so removed scopes are unmounted rather than leaked.

```tsx
// feature.tsx
import React, { StrictMode } from 'react';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';

import featureCss from './feature.css?inline';
import { findFeatureScopes } from './featureAdapter';

const HOST_ATTRIBUTE = 'data-my-extension-widget';
const RECONCILE_DELAY_MS = 100;
const RECONCILE_MAX_WAIT_MS = 1_000;
const WINDOW_NAVIGATION_EVENTS = ['popstate', 'pageshow'] as const;
const SITE_NAVIGATION_EVENTS = ['turbo:load', 'pjax:end', 'soft-nav:end'] as const;

type MountedFeature = {
  host: HTMLElement;
  root: ReactRoot;
};

const Widget = () => <div className="widget">Injected content</div>;

const mountFeature = (scope: HTMLElement): MountedFeature => {
  const host = document.createElement('div');
  host.setAttribute(HOST_ATTRIBUTE, '');

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = featureCss;
  const mountPoint = document.createElement('div');
  shadowRoot.append(style, mountPoint);
  scope.prepend(host);

  const root = createRoot(mountPoint);
  root.render(
    <StrictMode>
      <Widget />
    </StrictMode>,
  );

  return { host, root };
};

export const startContentScript = (): (() => void) => {
  const mounts = new Map<HTMLElement, MountedFeature>();
  let reconcileTimer: number | undefined;
  let maxWaitTimer: number | undefined;

  const reconcile = (): void => {
    const currentScopes = new Set(findFeatureScopes(document));

    for (const [scope, mounted] of mounts) {
      if (!currentScopes.has(scope) || !mounted.host.isConnected) {
        mounted.root.unmount();
        mounted.host.remove();
        mounts.delete(scope);
      }
    }

    for (const scope of currentScopes) {
      const hostSelector = `:scope > [${HOST_ATTRIBUTE}]`;
      const candidateHosts = scope.querySelectorAll<HTMLElement>(hostSelector);
      for (const candidateHost of candidateHosts) {
        if (!candidateHost.shadowRoot) candidateHost.remove();
      }

      if (mounts.has(scope) || scope.querySelector(hostSelector)) continue;
      mounts.set(scope, mountFeature(scope));
    }
  };

  const runScheduledReconcile = (): void => {
    window.clearTimeout(reconcileTimer);
    window.clearTimeout(maxWaitTimer);
    reconcileTimer = undefined;
    maxWaitTimer = undefined;
    reconcile();
  };

  const scheduleReconcile = (): void => {
    window.clearTimeout(reconcileTimer);
    reconcileTimer = window.setTimeout(
      runScheduledReconcile,
      RECONCILE_DELAY_MS,
    );
    maxWaitTimer ??= window.setTimeout(
      runScheduledReconcile,
      RECONCILE_MAX_WAIT_MS,
    );
  };

  const observer = new MutationObserver(scheduleReconcile);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  for (const eventName of WINDOW_NAVIGATION_EVENTS) {
    window.addEventListener(eventName, scheduleReconcile);
  }
  for (const eventName of SITE_NAVIGATION_EVENTS) {
    document.addEventListener(eventName, scheduleReconcile);
  }
  reconcile();

  return () => {
    observer.disconnect();
    window.clearTimeout(reconcileTimer);
    window.clearTimeout(maxWaitTimer);
    for (const eventName of WINDOW_NAVIGATION_EVENTS) {
      window.removeEventListener(eventName, scheduleReconcile);
    }
    for (const eventName of SITE_NAVIGATION_EVENTS) {
      document.removeEventListener(eventName, scheduleReconcile);
    }
    for (const mounted of mounts.values()) {
      mounted.root.unmount();
      mounted.host.remove();
    }
    mounts.clear();
  };
};

startContentScript();
```

Only keep site-specific events the target application actually emits. Use
`popstate` for History API traversal and `pageshow` for initial display and
back-forward cache restoration. A custom event complements the observer; it does
not replace reconciliation. Always pair the quiet-period debounce with a maximum
wait so continuous host-page mutations cannot starve reconciliation. Scope host
queries to direct children and remove every marker-only clone on each pass so
host-page markup round-trips converge to one live mount.

## 4. Verification checklist

- Run the adapter test first and see it fail before implementing a new selector.
- Assert one host per scope after repeated DOM mutations and navigation events.
- Remove a mounted host or replace its scope, then assert that reconciliation
  mounts exactly one replacement.
- Confirm injected styles do not leak out of the Shadow Root and host-page styles
  do not alter the widget.
- Run `npm run verify:full` after changing content-script lifecycle or wiring.

Viewport positioning, selector choice, event names, and debounce timing are
product behavior. Test them in the derived product instead of expanding this
template into a generic framework.
