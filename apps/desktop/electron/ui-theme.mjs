/** Only the trusted product renderer can choose a browser color preference. */
export function applyUiTheme(input, nativeTheme) {
  if (!input || Object.keys(input).sort().join(',') !== 'action,theme' || input.action !== 'ui-theme'
    || !['light', 'dark'].includes(input.theme)) throw new Error('Chế độ màu chưa hợp lệ.');
  nativeTheme.themeSource = input.theme;
  return { theme: nativeTheme.themeSource };
}
