export const TEMPLATE_EXTENSION_DISPLAY_NAME = 'CRX Vite TS React Template';

export const createExtensionNames = (displayName) => ({
  build: displayName,
  serve: `[DEV] ${displayName}`,
});

export const validateExtensionDisplayName = ({ displayName, manifestName }) => {
  const errors = [];
  const warnings = [];

  if (typeof displayName !== 'string' || displayName.trim().length === 0) {
    errors.push('package.json displayName must be a non-empty string.');
    return { errors, warnings };
  }

  if (manifestName !== displayName) {
    errors.push(
      `name must equal package.json displayName ${JSON.stringify(displayName)}; received ${JSON.stringify(manifestName)}.`,
    );
  }

  if (displayName === TEMPLATE_EXTENSION_DISPLAY_NAME) {
    warnings.push(
      `package.json displayName is still the template default ${JSON.stringify(TEMPLATE_EXTENSION_DISPLAY_NAME)}; set the product display name before release.`,
    );
  }

  return { errors, warnings };
};
