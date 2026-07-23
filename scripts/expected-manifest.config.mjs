const CONCRETE_JS_ASSET = /^assets\/[^*?[\]{}]+\.js$/u;
const CONTENT_SCRIPT_MATCHES = ['https://example.com/*'];

export const expectedManifest = {
  permissions: ['storage'],
  host_permissions: [],
  optional_permissions: [],
  optional_host_permissions: [],
  surfaces: {
    action: true,
    options_ui: true,
    background: true,
  },
  content_scripts: [
    {
      matches: CONTENT_SCRIPT_MATCHES,
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      matches: CONTENT_SCRIPT_MATCHES,
      extension_ids: [],
      use_dynamic_url: false,
      resources: {
        required: [],
        allowedPatterns: [CONCRETE_JS_ASSET],
      },
    },
  ],
};
