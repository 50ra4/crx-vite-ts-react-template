export type ManifestVersion = {
  version: string;
  version_name?: string;
};

export const createManifestVersion: (packageVersion: string) => ManifestVersion;
