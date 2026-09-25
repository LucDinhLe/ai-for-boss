# 0068 — Tài khoản nào dùng được, nói thẳng trong app

Trạng thái: Done trên nhánh `feat/0068-tai-khoan-dung-duoc`, chờ Product Owner thử. Mở ngày 2026-09-25.

## Vấn đề

Product Owner hỏi ngày 25/09: không dùng được gói đăng nhập Claude và Gemini thì khách hỏi sao. Tra chính sách hiện hành cùng ngày:

- Anthropic: từ 15/06/2026 tạm dừng đợt siết đã báo; Agent SDK, `claude -p` và ứng dụng bên thứ ba đăng nhập bằng gói Pro, Max, Team vẫn được phép và trừ vào hạn mức gói (Claude Help Center, bài "Use the Claude Agent SDK with your Claude plan"). Lõi đã có bộ chạy `claude-cli`, và hộp thoại đã có lựa chọn nối qua Claude Code, nhưng gọi nó là "ứng dụng trên máy" nên khách không nhận ra đó là gói Claude của mình.
- Google: từ 18/06/2026 ngừng Gemini CLI cho mọi gói cá nhân; điều khoản Antigravity cấm bên thứ ba. Đường hợp lệ cho cá nhân còn API key (AI Studio, Vertex).

Chính sách của cả hai hãng đã đổi nhiều lần trong năm; đây là ảnh chụp ngày 25/09, không phải cam kết.

## Quyết định

1. Mục "Tài khoản nào dùng được?" gập trên trang Nhà cung cấp, liệt kê đúng các đường hãng cho phép.
2. Nút `claude-cli` ghi "Đăng nhập bằng gói Claude (qua Claude Code)". Thẻ Claude không có Claude Code thì hiện cách cài, nút mở trang hướng dẫn và nút Dò lại.
3. Ô dán key Gemini có nút mở trang tạo key AI Studio.
4. Thẻ Antigravity không có tuyến thì bấm được, giải thích và chuyển sang Gemini bằng API key. Không tự viết đường đăng nhập Antigravity (0066 vẫn chờ).
5. Hai trang ngoài là cặp cố định trong host (`resolveHelpPage`), renderer chỉ gửi mã trang, không gửi địa chỉ.
6. Sửa rò tệp tạm `aifb-layout.json.<uuid>.tmp`: thử lại khi Windows từ chối đổi tên (EPERM, EACCES, EBUSY), luôn xoá tệp tạm khi thất bại, và dọn tệp tạm cũ đúng mẫu ở lần đọc bố cục đầu tiên.

## Cố ý không làm

- Không dùng lại phiên đăng nhập gói Gemini, Antigravity hay Claude.ai qua đường không chính thức, dù đối thủ làm vậy.
- Không cổng chia sẻ LLM ra ngoài máy.

## Bằng chứng

- `pnpm verify` exit 0.
- Test mới: Antigravity dẫn sang ô key Gemini; Claude không có Claude Code hiện hướng dẫn và Dò lại gọi đúng một lượt dò; hai trang trợ giúp chỉ nhận mã cố định; ghi JSON thử lại khi bị khoá và không để lại tệp tạm; lượt dọn chỉ xoá đúng mẫu.
