import React, { StrictMode } from 'react';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';

import sampleCss from './sample.css?inline';
import { findSampleInsertionPoint } from './sampleAdapter';

const SAMPLE_HOST_ATTRIBUTE = 'data-crx-content-script-sample';
const RECONCILE_DELAY_MS = 100;
const RECONCILE_MAX_WAIT_MS = 1_000;
const NAVIGATION_EVENTS = ['popstate', 'pageshow'] as const;

type MountedSample = {
  host: HTMLElement;
  root: ReactRoot;
};

const Root = () => {
  return (
    <section className="sample">
      <h1>content_script sample</h1>
      <p>This is being displayed by chrome-extension content_script</p>
    </section>
  );
};

const mountSample = (insertionPoint: Element): MountedSample => {
  const host = document.createElement('div');
  host.setAttribute(SAMPLE_HOST_ATTRIBUTE, '');

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = sampleCss;
  const mountPoint = document.createElement('div');
  shadowRoot.append(style, mountPoint);
  insertionPoint.prepend(host);

  const root = createRoot(mountPoint);
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );

  return { host, root };
};

export const startSample = (): (() => void) => {
  let mountedSample: MountedSample | undefined;
  let reconcileTimer: number | undefined;
  let maxWaitTimer: number | undefined;

  const reconcile = (): void => {
    const insertionPoint = findSampleInsertionPoint(document);

    if (
      mountedSample &&
      (!insertionPoint || mountedSample.host.parentElement !== insertionPoint)
    ) {
      mountedSample.root.unmount();
      mountedSample.host.remove();
      mountedSample = undefined;
    }

    if (!insertionPoint) return;

    const hostSelector = `:scope > [${SAMPLE_HOST_ATTRIBUTE}]`;
    const candidateHosts =
      insertionPoint.querySelectorAll<HTMLElement>(hostSelector);
    for (const candidateHost of candidateHosts) {
      if (candidateHost !== mountedSample?.host && !candidateHost.shadowRoot) {
        candidateHost.remove();
      }
    }

    if (mountedSample || insertionPoint.querySelector(hostSelector)) return;
    mountedSample = mountSample(insertionPoint);
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
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  for (const eventName of NAVIGATION_EVENTS) {
    window.addEventListener(eventName, scheduleReconcile);
  }
  reconcile();

  return () => {
    observer.disconnect();
    window.clearTimeout(reconcileTimer);
    window.clearTimeout(maxWaitTimer);
    for (const eventName of NAVIGATION_EVENTS) {
      window.removeEventListener(eventName, scheduleReconcile);
    }
    mountedSample?.root.unmount();
    mountedSample?.host.remove();
  };
};
