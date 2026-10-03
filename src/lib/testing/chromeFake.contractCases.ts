// Shared by Vitest and real-Chromium tests: review claims must agree with both.
// EXTENSION_ID is replaced only by the browser fixture's actual extension ID.
export const tabUrlCases = [
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
  { url: 'https://example.com', pattern: '*://*.example.com/*', matches: true },
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
  { url: 'http://127.0.0.1/form', pattern: 'http://*.0.0.1/*', matches: false },
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
  { url: 'chrome://version', pattern: 'chrome://*/*', matches: true },
  { url: 'chrome://version/', pattern: '*://*/*', matches: false },
  { url: 'chrome://version/', pattern: '<all_urls>', matches: true },
  { url: 'about:blank', pattern: 'about:*', matches: true },
  { url: 'about:blank', pattern: '<all_urls>', matches: true },
  { url: 'about:blank', pattern: '*://*/*', matches: false },
  {
    url: 'chrome-extension://EXTENSION_ID/popup.html',
    pattern: 'chrome-extension://EXTENSION_ID/*',
    matches: true,
  },
  {
    url: 'chrome-extension://EXTENSION_ID/popup.html',
    pattern: '<all_urls>',
    matches: true,
  },
  {
    url: 'chrome-extension://EXTENSION_ID/popup.html',
    pattern: '*://*/*',
    matches: false,
  },
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
];
