export const createManifestVersion = (packageVersion) => {
  const version = packageVersion.replace(/[-+].*$/u, '');
  return version === packageVersion
    ? { version }
    : { version, version_name: packageVersion };
};
