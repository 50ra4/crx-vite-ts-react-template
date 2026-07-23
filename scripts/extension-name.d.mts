export const TEMPLATE_EXTENSION_DISPLAY_NAME: string;

export type ExtensionNames = {
  build: string;
  serve: string;
};

export type ExtensionDisplayNameValidation = {
  errors: string[];
  warnings: string[];
};

export const createExtensionNames: (displayName: string) => ExtensionNames;

export const validateExtensionDisplayName: (input: {
  displayName: unknown;
  manifestName: unknown;
}) => ExtensionDisplayNameValidation;
