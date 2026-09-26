# AI for Boss trên nền Hermes (nhánh `nen-hermes`)

Tài liệu này dành cho người và agent làm tiếp nhánh `nen-hermes` trong kho `LucDinhLe/ai-for-boss`. Đọc trước khi sửa bất cứ gì trong nhánh.

## Quyết định gốc

Ngày 25/09/2026 anh Lê Đình Lực đồng ý thử đưa AI for Boss từ lõi OpenClaw sang vỏ Hermes Vietnamese. Lý do chính: vỏ Hermes Vietnamese 2026.9.5 đã có giao diện v32 mà AI for Boss nhắm tới, đã phát hành Latest cho Windows, macOS, Linux, và lõi Hermes có sẵn kỹ năng, hồ sơ, plugin với hơn 30 điểm móc, đủ để làm lớp quản trị mà không sửa lõi.

Bản trên OpenClaw không bị xoá. Khi anh Lực chọn nền Hermes, main cũ được cất ở nhãn `archive/openclaw-beta36` rồi `nen-hermes` mới lên làm main. Nếu anh chọn giữ bản OpenClaw, nhánh này chỉ nằm yên.

## Nhánh này gồm gì

Nhánh bắt đầu từ commit `39e5387` của Hermes Vietnamese (bản phát hành 2026.9.5, lõi Nous v2026.8.31 nguyên bản theo `engine.lock`). Phần riêng của AI for Boss:

- **Danh tính riêng** trong `apps/desktop/product-metadata.json`: appId `vn.lucledinh.ai-for-boss`, tệp chạy `AIforBoss`, giao thức `aiforboss://`, thư mục dữ liệu `%LOCALAPPDATA%\ai-for-boss` hoặc `~/.ai-for-boss`, biến ghi đè `AFB_HOME`. `electron/edition-identity.ts` đọc các giá trị này thay cho chuỗi ghi cứng. `package.json` phần `build` phải khớp tay, `scripts/community-distribution.test.mjs` kiểm sự khớp.
- **Nhập dữ liệu Hermes Vietnamese** ở lần mở đầu (chỉ sao chép, bản Hermes Vietnamese giữ nguyên), khai trong `edition.importFrom`.
- **Gói doanh nghiệp** trong `apps/desktop/edition/`, đóng vào bộ cài qua `extraResources`:
  - `skills/ai-for-boss/`: 12 kỹ năng tiếng Việt chuyển từ plugin OpenClaw, chuẩn SKILL.md của Hermes.
  - `SOUL.md`: danh tính trợ lý và bảy quy tắc điều hành. Nằm ở phần tĩnh của system prompt nên trúng bộ đệm.
  - `roles/`: bốn vai trò (bán hàng, điều hành, marketing và nội dung, quản lý dự án), gieo thành `agent.personalities` để đổi vai bằng `/personality <tên>` mà vẫn dùng chung tài khoản nhà cung cấp.
  - `plugins/aifb-harness/`: sổ quyết định, đọc lại quyết định gần đây mỗi lượt, trần bước công cụ mỗi lượt, sổ token từng lần gọi mô hình.
  - `seed_edition.py`: gieo tất cả vào HERMES_HOME bằng hàm công khai của lõi.
- **Bộ đệm prompt 1 giờ** (`prompt_caching.cache_ttl: 1h`) đặt lúc gieo nếu người dùng chưa đặt.

## Gieo gói chạy thế nào

`electron/edition-seed.ts` chạy `seed_edition.py` bằng chính Python của lõi, ngay trước khi backend khởi động, khi `seedVersion` trong `edition/edition.json` mới hơn dấu ở `<HERMES_HOME>/edition-seed.json`. Hỏng thì ghi log `[edition]` và lần mở sau thử lại, không chặn khởi động.

Luật không ghi đè thứ người dùng đã sửa:

- `SOUL.md` chỉ thay khi chưa có, còn là mặc định của Hermes, hoặc đúng bản AI for Boss đã gieo lần trước (so mã băm).
- `cache_ttl` chỉ đặt khi người dùng chưa đặt.
- Kỹ năng, plugin và bốn vai trò là phần của gói, được thay bằng bản mới mỗi lần gieo.

Đổi kỹ năng, plugin, SOUL.md hay vai trò thì **tăng `seedVersion`**, nếu không máy đã cài sẽ không nhận.

## Mặc định tiết kiệm token (seedVersion 2)

Khai trong `edition/edition.json` → `configDefaults`, gieo một lần và chỉ đặt khóa người dùng chưa đặt:

- `platform_toolsets.cli` (seedVersion 3): bộ công cụ cho chủ doanh nghiệp gồm web, tệp, terminal, trình duyệt, chạy mã, xem ảnh, kỹ năng, việc cần làm, bộ nhớ, tìm phiên cũ, hỏi lại, lịch định kỳ, aifb_harness. Bỏ điều khiển máy, giao việc cho agent phụ, đọc thành tiếng, kanban, tạo ảnh. Terminal được bật lại ở bản 3 vì các kỹ năng Excel, Word, PDF, PowerPoint của lõi cài thư viện Python qua terminal. Ứng dụng desktop dùng bộ công cụ của nền tảng `cli`. Máy đã gieo bản 2 mà chưa tự sửa danh sách được nâng qua `configUpgrades`.
- Giữ toàn bộ kỹ năng của lõi Hermes và kho kỹ năng cộng đồng nhúng trong tab Kỹ năng (anh Lực quyết 26/09/2026); kho được ghi rõ là của Nous Research.
- `compression.threshold_tokens: 100000`: nén phiên khi ngữ cảnh chạm 100 nghìn token, kể cả với model có cửa sổ 1 triệu token.
- `auxiliary.compression.reasoning_effort: low` và `auxiliary.title_generation.prefer_fast_model: true`: việc phụ bớt suy nghĩ, đặt tên phiên bằng model nhanh cùng nhà cung cấp.
- `file_read_max_chars: 40000`, `tool_output.max_bytes: 24000`: kết quả công cụ không nhồi quá dài vào ngữ cảnh.

Bộ công cụ theo từng vai trò chưa làm được bằng `agent.personalities` (cùng một hồ sơ dùng chung bộ công cụ). Muốn tách thật thì mỗi vai là một hồ sơ riêng, để sau.

## Bộ đệm 24 giờ cho OpenAI

Plugin đăng ký middleware `llm_request`: khi gọi thẳng `api.openai.com` bằng khóa API với dòng model trong danh sách `_EXTENDED_PROMPT_CACHE_MODELS` của lõi, thêm `prompt_cache_retention: "24h"`. Đường đăng nhập ChatGPT và nhà cung cấp khác không bị đụng.

Giữ bộ đệm ấm (gửi yêu cầu nhỏ định kỳ) chưa làm: Claude đã 1 giờ, OpenAI giờ 24 giờ, DeepSeek tự giữ nhiều giờ, nên phần còn lại chỉ là Gemini. Middleware thực thi của lõi chỉ cho gọi mô hình một lần mỗi lượt, muốn giữ ấm phải tự dựng máy khách riêng. Chờ sổ token cho thấy Gemini trượt bộ đệm nhiều rồi mới làm.

## Sổ token để đo tối ưu

Plugin ghi mỗi lần gọi mô hình một dòng vào `<HERMES_HOME>/aifb/trace.jsonl`: token vào, ra, đọc bộ đệm, ghi bộ đệm, suy luận, thời gian. Đây là số liệu để so bộ đệm 5 phút với 1 giờ, và sau này đo Advisor có tiết kiệm thật không.

## Chưa có ở nhánh này

- Ba nút hợp đồng tác vụ (Nhanh, Kỹ, Quyết định quan trọng) và trần token theo lượt: cần giao diện trong ô soạn.
- Advisor tiết kiệm (cổng kế hoạch khi có rủi ro, cổng nghiệm thu, gói tóm tắt dưới 2 nghìn token, trần 1/5 ngân sách phiên) dạng plugin. Không bật MoA có sẵn của lõi vì nó gọi thêm mô hình ở mọi vòng.
- Kênh Zalo: anh Lực quyết làm sau, dạng plugin kênh qua `register_platform`.
- Tên tệp cài vẫn bắt đầu bằng `Hermes-` vì quy trình đóng gói (`packaged-layout.mjs`, `packaged-provenance.mjs`, `check-public-docs.mjs`) dùng chung với Hermes Vietnamese. Đổi khi làm kênh phát hành chính của AI for Boss.
- Các script kênh chính (`render-current-release.mjs`, `check-public-docs.mjs`) còn trỏ kho Hermes Vietnamese; kênh thử nghiệm không dùng chúng.

## Đồng bộ vỏ từ Hermes Vietnamese

Hermes Vietnamese là nguồn gốc (upstream) của vỏ. Khi Hermes Vietnamese sửa lỗi hay nâng lõi:

```
git remote add hermes https://github.com/LucDinhLe/hermes-agent-vietnamese.git   # một lần
git fetch hermes main
git merge hermes/main
```

Xung đột thường chỉ nằm ở chuỗi hiển thị (`src/i18n/*.ts`), `package.json` phần `build`, và vài dòng trong `build-release.yml`. Giữ bản AI for Boss ở những chỗ đó. Sau khi gộp chạy lại đủ kiểm thử bên dưới.

## Kiểm thử

- `node scripts/engine-sync.mjs check`: lõi phải khớp `engine.lock` từng byte.
- `npm run --prefix apps/desktop test:desktop:platforms`: tiến trình chính, gồm `electron/edition-seed.test.ts`.
- `uv pip install -e . pytest` rồi `python -m pytest apps/desktop/edition/tests`: gieo gói vào HERMES_HOME tạm và kiểm lõi thật nhận đủ kỹ năng, vai trò, plugin, bộ đệm 1 giờ, và giữ nguyên chỗ người dùng đã sửa.

Workflow `kiem-tra-vo.yml` chạy cả ba trên mỗi pull request.

## Dựng bản thử nghiệm

Gắn tag dạng `vYYYY.M.D-thunghiem.N` (ví dụ `v2026.9.25-thunghiem.1`) lên commit của nhánh rồi đẩy tag. `build-release.yml` dựng ba nền tảng, tạo pre-release, không đổi Latest của kho, và ghi feed vào nhánh mồ côi `feed/thunghiem`.
