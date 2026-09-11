# 0052 — Bộ cài nhanh hơn bằng cách bớt số tệp

## Vì sao cài chậm

Bộ cài beta36 ghi 36.668 tệp rồi băm SHA256 từng tệp để xác minh. Trên Windows, chi phí nằm ở số tệp chứ không ở dung lượng: mỗi tệp là một lượt tạo trên NTFS, một lượt Defender quét khi ghi, rồi một lượt đọc lại để băm. Giải nén LZMA và dung lượng tải chỉ là phần nhỏ. Hầu hết số tệp đó là `node_modules` của OpenClaw đi kèm, trong đó khai báo kiểu TypeScript (`*.d.ts`, `*.d.mts`, `*.d.cts`), bản đồ mã nguồn (`*.map`) và các gói `@types/*` chiếm phần đáng kể mà Node không bao giờ đọc lúc chạy.

## Quyết định

- `scripts/stage-runtime.mjs` tỉa các tệp trên ngay sau `npm install` của cây OpenClaw đóng gói, qua `scripts/lib/prune-runtime.mjs`, và in số tệp đã bỏ, số tệp còn lại. Chỉ tỉa ba nhóm nói trên và thư mục bị rỗng sau đó. Không đụng `.md`, vì OpenClaw đọc kỹ năng đi kèm, prompt và mẫu workspace dạng markdown lúc chạy; không đụng `.json`, `.node`, `.ts` thường, LICENSE.
- Khóa tỉa nằm trong script dựng runtime nên áp dụng cho cả bộ cài và gói cập nhật lõi; manifest gói tự phản ánh cây đã tỉa. Cơ chế dùng lại lõi bằng hard link (nâng cấp) và xác minh đầy đủ giữ nguyên.
- Số liệu phải đọc từ log CI của lượt dựng kế tiếp (`[stage-runtime] pruned … files remain`) rồi ghi vào release notes; không nêu con số phần trăm trước khi đo.

## Chưa làm, cân nhắc sau

- Bỏ băm lại các tệp bộ cài vừa ghi (NSIS đã kiểm CRC); tiết kiệm một lượt đọc toàn bộ nhưng đổi luật "xác minh đầy đủ" đã chốt.
- Gộp OpenClaw và phụ thuộc thành vài tệp bằng esbuild: lợi lớn nhất nhưng rủi ro với plugin nạp động và module native; chờ thượng nguồn.
- Tách lõi (ít đổi) ra bộ cài riêng chỉ chạy lần đầu; bộ cài giao diện còn vài trăm tệp.
