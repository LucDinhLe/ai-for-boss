/**
 * OpenClaw writes its setup steps in English and owns that wording. Translating
 * by matching the exact sentence would break silently the day upstream rewords
 * one, and a wrong translation of a security question is worse than English.
 *
 * So the shell translates what it recognises by a stable signature, and shows
 * anything else verbatim with a short note saying the text came from OpenClaw.
 * `recognised` is what tells the UI which of the two it is looking at.
 */

export type WizardStepType =
  | "note"
  | "select"
  | "text"
  | "confirm"
  | "multiselect"
  | "progress"
  | "action";

export type WizardStep = {
  id: string;
  type: WizardStepType;
  title?: string;
  message?: string;
  options?: { value: unknown; label: string; hint?: string }[];
  placeholder?: string;
  secret?: boolean;
};

export type LocalisedStep = {
  title: string;
  message: string;
  recognised: boolean;
};

/** Signatures are matched on lowercased, whitespace-collapsed text. */
type Rule = { match: RegExp; title: string; message: string };

const RULES: Rule[] = [
  {
    match: /security disclaimer|personal-by-default/,
    title: "Lưu ý an toàn",
    message:
      "OpenClaw mặc định dành cho một người dùng trên máy của chính họ. Dùng chung nhiều người cần khoá cấu hình lại. Đọc kỹ nguyên văn bên dưới trước khi đồng ý."
  },
  {
    match: /help make openclaw better|share which features you use/,
    title: "Chia sẻ thống kê sử dụng?",
    message:
      "OpenClaw hỏi có gửi thống kê tính năng bạn dùng hay không. Không gửi nội dung trò chuyện. Chọn thế nào cũng được, sản phẩm chạy như nhau."
  },
  {
    match: /model\/auth provider|choose a provider|select provider/,
    title: "Chọn nơi cung cấp model",
    message: "Chọn nhà cung cấp bạn đã có tài khoản. Mỗi nhà có cách kết nối riêng ở bước sau."
  },
  { match: /paste .*api key|enter .*api key|api key:/, title: "Dán khoá API", message: "Khoá được lưu trên máy này, không gửi đi đâu khác." },
  {
    match: /open .*browser|sign in with|device code|visit .*to authorize/,
    title: "Đăng nhập trên trình duyệt",
    message: "Làm theo hướng dẫn bên dưới để đăng nhập. Cửa sổ này chờ tới khi bạn xong."
  },
  { match: /verify|checking|testing connection/, title: "Đang kiểm tra kết nối", message: "Đang gọi thử model một lượt để chắc chắn kết nối dùng được." },
  { match: /what should we call your first agent/, title: "Đặt tên trợ lý", message: "Tên hiển thị của trợ lý, đổi lại lúc nào cũng được." }
];

function signature(step: WizardStep): string {
  return `${step.title ?? ""} ${step.message ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

export function localiseStep(step: WizardStep): LocalisedStep {
  const text = signature(step);
  const rule = RULES.find((candidate) => candidate.match.test(text));
  if (rule) return { title: rule.title, message: rule.message, recognised: true };
  return {
    title: step.title?.trim() || "Bước tiếp theo",
    message: step.message?.trim() ?? "",
    recognised: false
  };
}

/** Buttons and chrome are always ours, so they are always Vietnamese. */
export const CHROME = {
  continue: "Tiếp tục",
  agree: "Đồng ý",
  decline: "Không",
  cancel: "Huỷ",
  back: "Quay lại",
  connect: "Kết nối",
  retry: "Thử lại",
  working: "Đang xử lý…",
  unrecognised: "Nội dung dưới đây do OpenClaw cung cấp, bản này chưa dịch.",
  detected: "Đã có sẵn trên máy này",
  detectedHint: "Dùng ngay, không cần khoá API.",
  allProviders: "Tất cả nơi cung cấp",
  verifying: "Đang gọi thử model…",
  verified: "Kết nối dùng được",
  verifyFailed: "Chưa dùng được"
} as const;
