---
name: dong-goi-viec-lap-lai
description: "Đóng gói một việc tay anh chị làm lặp lại thành kỹ năng riêng của doanh nghiệp bằng `skill_manage`, chạy thử, duyệt rồi mới đặt lịch bằng `cronjob`, dùng khi anh chị nói việc này tuần nào cũng làm."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "📦"
---

# Đóng gói việc lặp lại

## Khi nào dùng

Dùng khi anh chị làm đi làm lại một việc bằng tay, ví dụ tổng hợp doanh thu cuối ngày từ KiotViet, soạn báo cáo tuần cho sếp, nhắc nhân viên nộp số liệu thứ Sáu, gom đơn Shopee chưa giao. Kỹ năng này hỏi cho rõ quy trình, tách phần cố định khỏi phần thay đổi, viết thành một kỹ năng riêng của doanh nghiệp bằng công cụ quản lý kỹ năng `skill_manage` của Hermes, chạy thử trên một ca anh chị đã biết đáp án, và khi anh chị duyệt mới đặt lịch chạy định kỳ bằng `cronjob`. Tinh thần là biến cách làm nằm trong đầu một người thành quy trình và dữ liệu dùng chung, ai trong nhóm gọi tên kỹ năng cũng ra cùng một kết quả.

Cũng dùng khi anh chị vừa cùng trợ lý làm xong một việc trong phiên và nói "lần sau cứ làm thế này"; khi đó cuộc trò chuyện vừa rồi chính là bản mô tả, không hỏi lại từ đầu.

Không dùng cho việc chỉ làm một lần. Không dùng khi việc chủ yếu cần phán đoán mới mỗi lần, như định vị thương hiệu hay chọn chiến dịch; kỹ năng chỉ giữ phần khung lặp lại. Nếu chỉ cần viết tài liệu quy trình cho người đọc, chuyển sang `soan-quy-trinh-chuan`. Báo cáo định kỳ đã có khuôn sẵn thì dùng `bao-cao-dinh-ky`. Việc cần nhiều vai phối hợp lâu dài thì xem `doi-tro-ly-theo-vai`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Nếu việc vừa làm trong phiên, chỉ hỏi phần còn thiếu.

1. Lần gần nhất anh chị làm việc này, anh chị đã làm từng bước thế nào? Kể cụ thể, lấy tệp nào, lọc gì, tính gì, gửi cho ai.
2. Dữ liệu đầu vào nằm ở đâu và có dạng gì, tệp Excel, tệp xuất từ MISA, KiotViet, Sapo, báo cáo sàn, email, thư mục trên máy?
3. Kết quả cuối trông thế nào? Nếu có một bản anh chị làm tay mà anh chị hài lòng, gửi kèm để làm mẫu đối chiếu.
4. Có quy tắc ngầm nào anh chị hay áp dụng, ví dụ bỏ đơn dưới 50 nghìn, không tính đơn hoàn, làm tròn tới nghìn?
5. Bước nào anh chị phải tự xem và quyết, bước nào máy tự làm được? Có bước nào gửi ra ngoài, đăng bài hay tốn tiền không?
6. Việc này cần chạy khi nào, hằng ngày, hằng tuần hay chỉ khi anh chị gọi? Kết quả gửi về đâu?

## Quy trình

1. Viết lại quy trình thành các bước đánh số bằng chính từ ngữ anh chị dùng. Nếu anh chị gọi là "tệp chốt ca" thì kỹ năng cũng gọi là tệp chốt ca. Trình anh chị xem và sửa trước khi đi tiếp.
2. Tách ba loại phần việc. Phần cố định gồm trình tự, nguồn dữ liệu, định dạng kết quả, quy tắc. Phần thay đổi gồm ngày, tên, số tiền, tên tệp; phần này thành tham số, không ghi cứng số của lần làm mẫu. Phần phán đoán là những chỗ anh chị từng do dự hay sửa lại; phần này thành chốt duyệt.
3. Đặt chốt duyệt đúng chỗ. Mọi bước gửi tin cho khách hay nhân viên, đăng bài, chi tiền, sửa hoặc xoá dữ liệu gốc đều phải có chốt "trình nháp, chờ anh chị nói làm đi". Những bước chỉ đọc và tính thì để chạy thẳng; kỹ năng hỏi xin phép chín lần còn chậm hơn làm tay.
4. Soạn nội dung kỹ năng theo cùng khung với các kỹ năng AI for Boss gồm frontmatter có `name` (chữ thường không dấu, nối bằng gạch ngang, tối đa 64 ký tự, không trùng tên kỹ năng có sẵn) và `description` (57 ký tự đầu tự nói được khi nào dùng), rồi các mục Khi nào dùng, Đầu vào, Các bước, Chốt duyệt, Đầu ra, Khi thiếu dữ liệu. Mẫu biểu, bảng tra, danh sách khách dùng chung thì để thành tệp đi kèm trong thư mục `templates/` hoặc `references/` của kỹ năng. Kỹ năng không bao giờ được bịa số; thiếu dữ liệu thì báo thiếu.
5. Trình anh chị toàn văn kỹ năng. Khi anh chị đồng ý, gọi `skill_manage` với mảng `operations`, phần tử đầu có `action` là `create`, `name`, `content` là toàn văn SKILL.md; thêm phần tử `write_file` với `file_path` và `file_content` cho từng tệp đi kèm. Kỹ năng được lưu vào thư mục kỹ năng của hồ sơ đang dùng. Nếu danh sách kỹ năng chưa hiện tên mới, dùng lệnh `/reload-skills`. Lần sửa sau dùng `action` là `patch` với `old_string` và `new_string`, không ghi đè cả tệp.
6. Chạy thử kỹ năng ngay trong phiên trên đúng ca anh chị đã làm tay, đặt kết quả cạnh bản làm tay và chỉ ra từng chỗ lệch. Lệch thì sửa kỹ năng và chạy lại, không đề nghị anh chị chấp nhận một kết quả gần đúng. Chỉ đi tiếp khi anh chị nói kết quả khớp.
7. Nếu việc cần chạy định kỳ, chọn tần suất theo tốc độ dữ liệu thật sự thay đổi, không theo mong muốn được báo nhiều. Nêu rõ lần chạy nào chỉ kiểm tra và bỏ qua, lần nào mới cần hành động, và khi nào dừng hoặc báo anh chị. Trình đề xuất lịch gồm tên, lịch chạy (ví dụ `every monday 8am` hoặc `0 8 * * 1`), lời nhắc tự đủ nghĩa, kỹ năng nạp kèm, nơi nhận kết quả. Lượt chạy theo lịch mở trong một phiên mới không có ngữ cảnh cuộc trò chuyện và không hỏi lại được ai, nên lời nhắc phải ghi đủ đường dẫn tệp và quy tắc; lượt chạy theo lịch chỉ được soạn nháp và báo cáo, không tự gửi cho khách hay nhân viên.
8. Khi anh chị nói "làm đi", gọi `cronjob` với `action` là `create`, kèm `schedule`, `prompt`, `name`, `skills`; bỏ trống `deliver` để kết quả về lại cuộc trò chuyện này. Nếu cần mỗi lần chạy biết kết quả lần trước để khỏi báo trùng, bật `continuity`. Sau đó gọi `action` là `run` với mã lịch vừa tạo để chạy thật một lần, trình kết quả cho anh chị duyệt. Kết quả chưa ổn thì `pause` lịch, sửa rồi `resume`. Nhắc anh chị kỹ năng ít dùng có thể bị bộ dọn kỹ năng tự lưu trữ; kỹ năng quan trọng mà chạy thưa thì ghim bằng `/curator pin <tên-kỹ-năng>`. Gọi `aifb_record_decision` ghi tên kỹ năng, lịch chạy và người duyệt.

## Tiêu chuẩn đầu ra

Một kỹ năng riêng của doanh nghiệp đã được anh chị duyệt toàn văn, viết bằng từ ngữ của anh chị, có tham số cho phần thay đổi, có chốt duyệt trước mọi bước gửi ra ngoài, chi tiền hay sửa dữ liệu gốc. Có một lần chạy thử khớp với bản làm tay, ghi rõ các chỗ đã sửa. Nếu có lịch, lịch chỉ được tạo sau khi anh chị nói "làm đi", có một lần `run` thử đã duyệt, và lời nhắc tự đủ nghĩa. Báo cáo cuối gồm tên kỹ năng, cách gọi, lịch chạy nếu có, cách tạm dừng, và danh sách tệp đi kèm.

## Ba ca mẫu

### Ca 1: Quán ăn hai chi nhánh tổng hợp doanh thu cuối ngày
Đầu vào: Chủ quán mỗi tối tải hai tệp xuất từ KiotViet, cộng doanh thu tiền mặt và chuyển khoản, trừ đơn huỷ, rồi nhắn vào nhóm Zalo gia đình. Hôm qua tổng 14,2 triệu (số giả định), chủ quán gửi kèm bản tự tính.
Bối cảnh: Việc vừa làm cùng trợ lý trong phiên, chủ quán nói "mai cứ làm thế này".
Đầu ra đạt chuẩn: Trợ lý không hỏi lại từ đầu, dựng kỹ năng `doanh-thu-cuoi-ngay` với tham số ngày và thư mục tệp, quy tắc trừ đơn huỷ lấy từ lần sửa của chủ quán. Chạy thử ra đúng 14,2 triệu. Lịch đề xuất 22 giờ mỗi ngày, kết quả là bản nháp tin nhắn về cuộc trò chuyện, không tự nhắn nhóm Zalo.
Tiêu chí chấm:
- Không hỏi lại những gì vừa làm trong phiên.
- Không ghi cứng số 14,2 triệu vào kỹ năng.
- Tin nhắn nhóm Zalo là bản nháp.
- Lịch chỉ tạo sau khi chủ quán nói làm đi.

### Ca 2: Công ty thương mại 25 người làm báo cáo tuần cho giám đốc
Đầu vào: Trợ lý giám đốc mỗi thứ Hai lấy báo cáo bán hàng từ Sapo, báo cáo công nợ từ MISA và ghi chú các trưởng nhóm trong Google Sheets, viết một trang tóm tắt. Gửi kèm ba bản báo cáo cũ làm mẫu.
Bối cảnh: Hai người trong phòng thay nhau làm, mỗi người viết một kiểu.
Đầu ra đạt chuẩn: Kỹ năng thống nhất khung một trang theo bản mẫu, tệp `templates/bao-cao-tuan.md` đi kèm để ai cũng dùng chung. Chạy thử trên số liệu tuần trước, chỉ ra hai chỗ lệch với bản làm tay và sửa. Lịch `every monday 8am`, lời nhắc ghi đủ đường dẫn ba nguồn; có một lần `run` thử trước khi coi là xong.
Tiêu chí chấm:
- Có tệp mẫu dùng chung đi kèm kỹ năng.
- Lời nhắc lịch tự đủ nghĩa, không dựa vào cuộc trò chuyện.
- Chỗ lệch khi chạy thử được sửa, không bỏ qua.
- Có gọi `aifb_record_decision` ghi lịch và người duyệt.

### Ca 3: Kế toán dịch vụ tự do nhắc khách gửi chứng từ hằng tháng
Đầu vào: Kế toán có 12 khách hộ kinh doanh, ngày 25 hằng tháng soát bảng Google Sheets xem ai chưa gửi hoá đơn đầu vào rồi nhắn Zalo nhắc từng người.
Bối cảnh: Kế toán muốn "tự động nhắn luôn cho khách".
Đầu ra đạt chuẩn: Kỹ năng soát bảng và soạn sẵn tin nhắc cho từng khách chưa gửi, bật `continuity` để không nhắc trùng người đã gửi sau lần trước. Trợ lý giải thích lượt chạy theo lịch không hỏi được ai nên chỉ soạn nháp, kế toán duyệt rồi tự gửi hoặc bảo trợ lý gửi trong phiên. Việc nhắc công nợ tiền thì chuyển sang `nhac-cong-no`.
Tiêu chí chấm:
- Không đặt lịch tự gửi tin cho khách.
- Có cơ chế tránh nhắc trùng.
- Tách rõ nhắc chứng từ với nhắc công nợ.
- Có một lần chạy thử trên danh sách tháng trước.

## Nguồn
Chuyển thể từ `small-business/skills/build-agent` trong anthropics/knowledge-work-plugins (Apache 2.0); `skills/marketing-loops` trong coreyhaines31/marketingskills (MIT); `skills/software-development/hermes-agent-skill-authoring` của Hermes Agent (MIT). Tham số công cụ đối chiếu với `tools/skill_manager_tool.py` và `tools/cronjob_tools.py` của Hermes Agent.
