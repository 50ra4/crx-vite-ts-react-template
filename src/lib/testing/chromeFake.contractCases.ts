// Shared by Vitest and real-Chromium tests: review claims must agree with both.
// EXTENSION_ID is replaced only by the browser fixture's actual extension ID.
type TabUrlCase = { url: string; pattern: string; matches: boolean };
export const tabUrlCases: TabUrlCase[] = [
  {
    url: 'http://localhost:3000/form',
    pattern: 'http://localhost:3000/*',
    matches: true,
  },
  {
    url: 'http://localhost:3000/form',
    pattern: 'http://localhost:3001/*',
    matches: false,
  },
  {
    url: 'http://localhost:3000/form',
    pattern: 'http://localhost:*/*',
    matches: true,
  },
  {
    url: 'http://localhost:3000/form',
    pattern: 'http://localhost/*',
    matches: true,
  },
  {
    url: 'https://example.com:8443/form',
    pattern: 'https://example.com:8443/*',
    matches: true,
  },
  {
    url: 'https://example.com:8443/form',
    pattern: 'https://example.com:443/*',
    matches: false,
  },
  {
    url: 'https://example.com/form',
    pattern: 'https://example.com:443/*',
    matches: true,
  },
  {
    url: 'https://example.com/form',
    pattern: 'https://example.com:0443/*',
    matches: false,
  },
  {
    url: 'http://example.com/form',
    pattern: 'http://example.com:80/*',
    matches: true,
  },
  {
    url: 'http://[::1]:8080/form',
    pattern: 'http://[::1]:8080/*',
    matches: true,
  },
  {
    url: 'http://[::1]:8080/form',
    pattern: 'http://[::1]:8081/*',
    matches: false,
  },
  { url: 'http://[::1]:8080/form', pattern: 'http://[::1]/*', matches: true },
  {
    url: 'http://[::1]:8080/form',
    pattern: 'http://[0:0:0:0:0:0:0:1]:*/*',
    matches: true,
  },
  {
    url: 'https://example.com/',
    pattern: '*://*.example.com/*',
    matches: true,
  },
  {
    url: 'https://sub.example.com/form',
    pattern: 'https://*.example.com/*',
    matches: true,
  },
  {
    url: 'https://notexample.com/form',
    pattern: 'https://*.example.com/*',
    matches: false,
  },
  {
    url: 'https://example.com/form',
    pattern: 'https://EXAMPLE.COM./*',
    matches: true,
  },
  {
    url: 'http://127.0.0.1/form',
    pattern: 'http://*.0.0.1/*',
    matches: false,
  },
  {
    url: 'http://127.0.0.1/form',
    pattern: 'http://*.127.0.0.1/*',
    matches: true,
  },
  {
    url: 'https://example.com/form?q=1#fragment',
    pattern: 'https://example.com/form?q=*',
    matches: true,
  },
  {
    url: 'https://example.com/form?q=1#fragment',
    pattern: 'https://example.com/form?q=*#fragment',
    matches: false,
  },
  { url: 'chrome://version/', pattern: 'chrome://*/*', matches: true },
  { url: 'chrome://version/', pattern: 'chrome://version/*', matches: true },
  { url: 'chrome://version/', pattern: '*://*/*', matches: false },
  { url: 'chrome://version/', pattern: '<all_urls>', matches: true },
  { url: 'about:blank', pattern: 'about:*', matches: true },
  { url: 'about:blank', pattern: '<all_urls>', matches: true },
  { url: 'about:blank', pattern: '*://*/*', matches: false },
  {
    url: 'chrome-extension://EXTENSION_ID/manifest.json',
    pattern: 'chrome-extension://EXTENSION_ID/*',
    matches: true,
  },
  {
    url: 'chrome-extension://EXTENSION_ID/manifest.json',
    pattern: '<all_urls>',
    matches: true,
  },
  {
    url: 'chrome-extension://EXTENSION_ID/manifest.json',
    pattern: '*://*/*',
    matches: false,
  },
];

// Empty query delimiters are significant; fragment delimiters are not.
for (const suffix of ['?', '?#fragment', '?#fragment?ignored']) {
  for (const [path, matches] of [
    ['/form?*', true],
    ['/form?', true],
    ['/form', false],
  ] as const) {
    tabUrlCases.push({
      url: `https://example.com/form${suffix}`,
      pattern: `https://example.com${path}`,
      matches,
    });
  }
}
tabUrlCases.push(
  {
    url: 'https://example.com/docs?\\tail',
    pattern: 'https://example.com/docs?\\tail/*',
    matches: false,
  },
  {
    url: 'https://example.com/docs?\\tail/page',
    pattern: 'https://example.com/docs?\\tail/*',
    matches: true,
  },
  {
    url: 'https://example.com/docs?',
    pattern: 'https://example.com/docs?/*',
    matches: false,
  },
  {
    url: 'https://example.com/docs?query',
    pattern: 'https://example.com/docs?query/*',
    matches: false,
  },
  {
    url: 'https://example.com/docs?/page',
    pattern: 'https://example.com/docs?/*',
    matches: true,
  },
  {
    url: 'https://example.com/docs',
    pattern: 'https://example.com/docs/*',
    matches: true,
  },
  {
    url: 'https://example.com/docs',
    pattern: 'https://example.com/docs*',
    matches: true,
  },
  {
    url: 'https://example.com/docs',
    pattern: 'https://example.com/doc/*',
    matches: false,
  },
  {
    url: 'https://example.com/docs',
    pattern: 'https://example.com/do*s/*',
    matches: false,
  },
  {
    url: 'https://example.com/docs/',
    pattern: 'https://example.com/docs/*',
    matches: true,
  },
  {
    url: 'https://example.com/docs/page',
    pattern: 'https://example.com/docs/*',
    matches: true,
  },
  {
    url: 'https://example.com/docs?x=1',
    pattern: 'https://example.com/docs/*',
    matches: false,
  },
  {
    url: 'https://example.com/docs?',
    pattern: 'https://example.com/docs/*',
    matches: false,
  },
  {
    url: 'https://example.com/docs#fragment',
    pattern: 'https://example.com/docs/*',
    matches: true,
  },
  {
    url: 'https://example.com/form#fragment?',
    pattern: 'https://example.com/form',
    matches: true,
  },
  {
    url: 'https://example.com/form#fragment?',
    pattern: 'https://example.com/form?*',
    matches: false,
  },
  {
    url: 'https://example.com/form%3F',
    pattern: 'https://example.com/form?*',
    matches: false,
  },
);

// Duplicate URLs deliberately prevent browser assertions from using URL identity.
export const queryFixtureUrls = [
  'about:blank',
  'about:blank',
  'https://example.com/form?',
];
export const tabUrlFilterCases: {
  name: string;
  url?: string | string[];
  indexes: number[];
}[] = [
  { name: 'omitted URL', indexes: [0, 1, 2] },
  { name: 'empty URL array', url: [], indexes: [0, 1, 2] },
  { name: 'all URLs', url: '<all_urls>', indexes: [0, 1, 2] },
  { name: 'scalar URL', url: 'https://example.com/*', indexes: [2] },
  { name: 'single URL array', url: ['https://example.com/*'], indexes: [2] },
  {
    name: 'multiple URL array',
    url: ['about:*', 'https://example.com/*'],
    indexes: [0, 1, 2],
  },
  { name: 'duplicate patterns', url: ['about:*', 'about:*'], indexes: [0, 1] },
  { name: 'unmatched array', url: ['https://missing.example/*'], indexes: [] },
];

export const acceptedTabUrlPatterns = [
  'ftp://*/*',
  'ftp://example.com:21/*',
  'ws://*/*',
  'wss://*/*',
  'urn:*',
  'data:*',
  'file:///*',
  'file://localhost/*',
  'file://*',
  'chrome-search://*/*',
  'isolated-app://*/*',
  'devtools://*/*',
  'chrome-native://*/*',
  'chrome-distiller://*/*',
];

export const invalidTabUrlPatterns = [
  'https://example.com',
  'example.com/*',
  'https://exa*.com/*',
  'http://localhost:65536/*',
  'http://localhost:-1/*',
  'http://localhost:abc/*',
  'http://localhost:/*',
  'http://[::1/*',
  'http://[invalid]/*',
  'http://[]/*',
  'https:///path',
  'https://*./*',
  'http:*',
  'urn://*/*',
  '*://localhost:3000/*',
  'chrome://version:80/*',
  'unknown-test-scheme://*/*',
];
