import path from 'node:path';

// npm's content-addressed filenames are long. Keep this separate toolkit at
// a short Windows path so NSIS and Windows PowerShell 5 can install it intact.
export function packagedChannelBundlePath(resourcesPath, platform = process.platform) {
  return platform === 'win32' ? path.win32.resolve(resourcesPath, '../ci') : path.posix.join(resourcesPath, 'channel-installer');
}
