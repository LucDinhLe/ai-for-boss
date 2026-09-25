// edition-identity.ts — danh tính kỹ thuật của bản đóng gói, đọc từ một nguồn duy nhất
// là product-metadata.json. Trước đây các chuỗi này ghi cứng rải rác trong main.ts;
// gom về đây để bản AI for Boss (nhánh nen-hermes) chỉ khác Hermes Vietnamese ở tệp
// metadata, và mỗi lần đồng bộ vỏ từ Hermes Vietnamese không phải gỡ xung đột từng dòng.
//
// package.json `build` vẫn phải khớp tay với các giá trị này (electron-builder không đọc
// tệp này); scripts/edition-identity.test.mjs kiểm sự khớp đó.

import path from 'node:path'

import metadata from '../product-metadata.json'

const identity = metadata.technicalIdentity

export const EDITION_DISPLAY_NAME: string = metadata.displayName
export const EDITION_APP_ID: string = identity.appId
export const EDITION_AUMID: string = identity.windowsAppUserModelId
export const EDITION_PROTOCOL: string = identity.protocol
export const EDITION_HOME_DIR_WINDOWS: string = identity.windowsHermesHomeName
export const EDITION_HOME_DIR_POSIX: string = identity.posixHermesHomeName
export const EDITION_HOME_ENV: string = identity.homeEnvOverride
export const EDITION_NSIS_GUID: string = identity.nsisGuid
export const EDITION_UPDATE_REPO = `${metadata.updateRepository.owner}/${metadata.updateRepository.repo}`
export const EDITION_USER_AGENT = `${identity.executableName}-desktop`

/**
 * Thư mục dữ liệu của những bản cài cạnh mà bản này được phép đề nghị nhập (chỉ sao chép).
 * AI for Boss nhận dữ liệu Hermes Vietnamese; Hermes Vietnamese để trống, chỉ dùng danh
 * sách bản cũ trong legacy-import.ts.
 */
export function editionImportCandidates(platform: string, env: NodeJS.ProcessEnv, home: string): string[] {
  const sources: Array<{ windows: string; posix: string }> =
    (metadata as { edition?: { importFrom?: Array<{ windows: string; posix: string }> } }).edition?.importFrom ?? []

  const out: string[] = []

  for (const source of sources) {
    if (platform === 'win32' && env.LOCALAPPDATA) {
      out.push(path.join(env.LOCALAPPDATA, source.windows))
    }

    out.push(path.join(home, source.posix))
  }

  return out
}
