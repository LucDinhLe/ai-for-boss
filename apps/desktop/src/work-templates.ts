export const WORK_TEMPLATES = [
  { id: "plan", label: "Lập kế hoạch", text: "Giúp tôi lập kế hoạch cho mục tiêu: [điền mục tiêu].\nBối cảnh và nguồn lực: [điền thông tin].\nThời hạn: [điền thời hạn].\nTrình bày các bước, ưu tiên, rủi ro và tiêu chí hoàn thành. Hỏi lại nếu thiếu thông tin quan trọng." },
  { id: "decision", label: "Phản biện quyết định", text: "Giúp tôi xem xét quyết định: [điền quyết định].\nCác lựa chọn và bối cảnh: [điền thông tin].\nPhân tích giả định, lợi ích, đánh đổi, rủi ro và thông tin cần có trước khi quyết định." },
  { id: "content", label: "Soạn nội dung", text: "Soạn bản nháp [loại nội dung] cho [người đọc].\nMục đích: [điền mục đích].\nThông tin cần dùng: [dán thông tin].\nGiọng điệu và độ dài: [điền yêu cầu]. Không tự thêm số liệu chưa được cung cấp." }
] as const;

export function appendToDraft(current: string, text: string): string {
  return current ? `${current}\n\n${text}` : text;
}
