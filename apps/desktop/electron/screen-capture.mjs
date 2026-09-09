/** Explicit composer action only; never runs in the background or sends to a model. */
export async function captureScreens(input, capturer) {
  if (!input || input.action !== 'screen-capture' || Object.keys(input).length !== 1) throw new Error('Yêu cầu chụp màn hình không hợp lệ.');
  const sources = await capturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
  let bytes = 0;
  const screens = sources.slice(0, 8).flatMap((source, index) => {
    if (source.thumbnail.isEmpty()) return [];
    const data = source.thumbnail.toPNG(); bytes += data.length;
    if (bytes > 8 * 1024 * 1024) return [];
    return [{ name: `Màn hình ${index + 1}`, dataUrl: `data:image/png;base64,${data.toString('base64')}` }];
  });
  if (!screens.length) throw new Error('Chưa chụp được màn hình. Có thể dùng công cụ chụp của hệ điều hành rồi dán ảnh vào ô chat.');
  return { screens };
}
