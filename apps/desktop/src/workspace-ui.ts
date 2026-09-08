import type { RuntimeStatus, SessionSummary } from "./gateway-client";

export type WorkspaceStage = {
  kind: string;
  badge: string;
  title: string;
  detail: string;
  action: "connect" | "new-chat" | "reload" | "retry-history" | null;
};

export function workspaceStage({ runtime, modelCatalogueState, availableModelCount, activeKey, busy, opening,
  historyReady = true, historyError = false, selectedModelStatus = "unknown" }: {
  runtime: Pick<RuntimeStatus, "supervisor" | "connected" | "setupReady" | "paused">;
  modelCatalogueState: "loading" | "ready" | "error";
  availableModelCount: number;
  activeKey: string | null;
  busy: boolean;
  opening: boolean;
  historyReady?: boolean;
  historyError?: boolean;
  selectedModelStatus?: "ready" | "unavailable" | "unknown";
}): WorkspaceStage {
  if (runtime.paused) return { kind: "paused", badge: "Đã tạm dừng", title: "Gateway đã tạm dừng",
    detail: "Nháp vẫn được giữ. Chọn Gateway → Tiếp tục Gateway khi bạn muốn làm việc tiếp.", action: null };
  if (runtime.supervisor === "safe-mode") return { kind: "unavailable", badge: "Chưa sẵn sàng",
    title: "Ứng dụng cần khởi động lại", detail: "Làm theo hướng dẫn phía trên để tiếp tục.", action: null };
  if (!runtime.connected) {
    if (["idle", "starting", "restarting"].includes(runtime.supervisor)) return { kind: "starting", badge: "Đang khởi động",
      title: "Đang mở AI for Boss", detail: "Bạn có thể giữ cửa sổ này mở. Lần đầu có thể mất vài phút.", action: null };
    return { kind: "disconnected", badge: "Đang kết nối lại", title: "Kết nối đang gián đoạn",
      detail: "Ứng dụng đang chờ kết nối trở lại. Nội dung bạn đang soạn vẫn được giữ trong cửa sổ này.", action: null };
  }
  if (!runtime.setupReady) return { kind: "preparing", badge: "Đang chuẩn bị", title: "Đang chuẩn bị kết nối AI",
    detail: "Chờ một chút để ứng dụng hoàn tất kết nối.", action: null };
  if (modelCatalogueState === "loading") return { kind: "loading-models", badge: "Đang tải kết nối",
    title: "Đang kiểm tra các kết nối đã có", detail: "Ứng dụng đang đọc danh sách AI có thể dùng.", action: null };
  if (modelCatalogueState === "error") return { kind: "catalogue-error", badge: "Chưa tải được kết nối",
    title: "Chưa đọc được danh sách AI", detail: "Tải lại danh sách để tiếp tục cuộc trò chuyện.", action: "reload" };
  if (availableModelCount === 0) return { kind: "connect", badge: "Cần kết nối AI", title: "Kết nối AI để bắt đầu",
    detail: "Đăng nhập tài khoản AI hoặc kết nối bằng API key của nhà cung cấp.", action: "connect" };
  if (opening) return { kind: "opening", badge: "Đang mở cuộc trò chuyện", title: "Đang tạo cuộc trò chuyện",
    detail: "Ô soạn tin sẽ sẵn sàng ngay sau đó.", action: null };
  if (activeKey && historyError) return { kind: "history-error", badge: "Chưa tải được cuộc trò chuyện",
    title: "Tải lại để tiếp tục cuộc trò chuyện", detail: "Bản nháp của bạn vẫn còn. Hãy tải lại nội dung trước khi gửi tin tiếp.", action: "retry-history" };
  if (busy) return { kind: "responding", badge: "Đang trả lời", title: "Trợ lý đang trả lời",
    detail: "Bạn có thể soạn tin tiếp theo trong lúc chờ. Tin chỉ được gửi khi bạn bấm Gửi.", action: null };
  if (!activeKey) return { kind: "new-chat", badge: "Chọn cuộc trò chuyện", title: "Bạn muốn bắt đầu việc gì?",
    detail: "Mở một cuộc trò chuyện bên trái hoặc tạo cuộc trò chuyện mới.", action: "new-chat" };
  if (!historyReady) return { kind: "loading-history", badge: "Đang tải cuộc trò chuyện", title: "Đang mở nội dung trò chuyện",
    detail: "Bạn có thể soạn tin trong lúc chờ tải xong.", action: null };
  if (selectedModelStatus === "unavailable") return { kind: "session-model-unavailable", badge: "Cần kết nối AI của cuộc trò chuyện",
    title: "AI của cuộc trò chuyện chưa sẵn sàng", detail: "Kết nối AI đang ghi dưới ô soạn tin để tiếp tục. Bản nháp của bạn vẫn được giữ.", action: "connect" };
  if (selectedModelStatus === "unknown") return { kind: "session-model-unknown", badge: "Chưa xác nhận AI của cuộc trò chuyện",
    title: "Cần tải lại kết nối của cuộc trò chuyện", detail: "Ứng dụng chưa xác nhận được AI dùng cho cuộc trò chuyện này. Tải lại để kiểm tra.", action: "reload" };
  return { kind: "ready", badge: "Sẵn sàng", title: "Bạn cần trợ lý giúp việc gì?",
    detail: "Cùng bạn nghiên cứu, phân tích tài liệu, xây dựng kế hoạch và sáng tạo nội dung. Tổ chức công việc theo dự án, phối hợp với Advisor và các agent, sử dụng kỹ năng và thiết lập tác vụ định kỳ theo nhu cầu.", action: null };
}

export function conversationTitle(activeKey: string | null, sessions: SessionSummary[]): string {
  if (!activeKey) return "Bắt đầu cùng AI for Boss";
  const session = sessions.find((item) => item.key === activeKey);
  const usable = (value?: string) => value?.trim() && value !== activeKey
    && !/^aifb-[0-9a-f-]{36}$/u.test(value) && value !== "Cuộc trò chuyện mới";
  return [session?.label, session?.derivedTitle, session?.displayName].find(usable)?.trim() ?? "Cuộc trò chuyện mới";
}
