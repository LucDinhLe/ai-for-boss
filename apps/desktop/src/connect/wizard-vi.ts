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
  sensitive?: boolean;
  multiline?: boolean;
  confirmLabel?: string;
  declineLabel?: string;
  initialValue?: unknown;
  executor?: "gateway" | "client";
  externalUrl?: string;
  deviceCode?: { code: string; expiresInMinutes?: number; message?: string };
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
    title: "Chọn nhà cung cấp AI",
    message: "Chọn nhà cung cấp. Bước tiếp theo sẽ yêu cầu API key, token hoặc đăng nhập tài khoản theo cách nhà cung cấp hỗ trợ."
  },
  { match: /paste .*api key|enter .*api key|api key:/, title: "Nhập API key", message: "Nhập API key do nhà cung cấp cấp cho bạn. API key khác mật khẩu tài khoản; không gửi API key trong ô trò chuyện." },
  { match: /paste .*token|enter .*token|setup-token/, title: "Nhập token xác thực", message: "Nhập token theo hướng dẫn của nhà cung cấp bên dưới. Token khác API key hoặc mật khẩu tài khoản; không gửi token trong ô trò chuyện." },
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

/** Preserve native auth-choice terminology; unknown secret forms stay explicit. */
export function credentialLabel(provider: { id: string; label: string }): string {
  const choice = `${provider.id} ${provider.label}`;
  if (/\btoken\b/i.test(choice)) return 'Token xác thực';
  if (/api[\s-]?key/i.test(choice)) return 'API key';
  return 'API key hoặc token';
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
  unrecognised: "Hướng dẫn gốc từ hệ thống kết nối, bản này chưa dịch.",
  detected: "Ứng dụng đã đăng nhập trên máy này",
  detectedHint: "Claude Code, Codex CLI hoặc kết nối đã lưu. Chọn để dùng lại tài khoản đó, không cần đăng nhập thêm.",
  signIn: "Đăng nhập bằng tài khoản có sẵn",
  signInHint: "Dùng gói ChatGPT, Copilot hoặc tài khoản bạn đã trả tiền. Đăng nhập trên trình duyệt, không cần API key.",
  allProviders: "Dán API key",
  allProvidersHint: "Dành cho Gemini, Claude API, OpenAI API và các nhà cung cấp khác. Lấy API key trên trang của nhà cung cấp rồi dán vào đây.",
  moreSignIn: "Thêm cách đăng nhập khác",
  moreDetails: "Ghi chú và cách khác",
  scanning: "Đang dò tài khoản trên máy… có thể mất tới nửa phút.",
  loggedInContinue: "Đã đăng nhập xong, tiếp tục",
  waitingLogin: "Đang chờ bạn đăng nhập trên trình duyệt…",
  currentModel: "Đang dùng",
  checkNow: "Kiểm tra kết nối",
  verifying: "Đang gọi thử AI…",
  verified: "Kết nối dùng được",
  verifyFailed: "Chưa dùng được",
  pasteKey: "Dán API key hoặc token",
  pasteKeyHint:
    "Chỉ nhập API key hoặc token do nhà cung cấp cấp, không nhập mật khẩu tài khoản. Thông tin này được gửi tới trình kết nối để kiểm tra, không vào cuộc trò chuyện.",
  connectWithKey: "Kết nối",
  signInBrowser: "Đăng nhập bằng trình duyệt",
  openSignInPage: "Mở trang đăng nhập",
  refreshCatalogue: "Tải lại danh sách",
  done: "Xong",
  later: "Để sau"
} as const;
