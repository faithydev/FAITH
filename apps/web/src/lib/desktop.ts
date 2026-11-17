/**
 * The Windows app, built from the separate FAITH-Desktop repository and published as GitHub releases.
 * Its files keep fixed names, so the "latest/download" links always serve the newest release
 * without changing this file; update `version` and the sizes when a release is cut.
 */
const releases = 'https://github.com/faithydev/FAITH-Desktop/releases';

export const DESKTOP = {
  version: '1.0.0',
  releases,
  installer: { url: `${releases}/latest/download/FAITH-Setup-x64.exe`, size: '116 MB' },
  portable: { url: `${releases}/latest/download/FAITH-Portable-x64.exe`, size: '105 MB' },
} as const;
