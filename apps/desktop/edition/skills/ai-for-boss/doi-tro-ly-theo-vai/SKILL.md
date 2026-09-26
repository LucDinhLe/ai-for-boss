---
name: doi-tro-ly-theo-vai
description: "Dựng đội trợ lý theo vai (bán hàng, chăm sóc khách, kế toán, marketing) bằng hồ sơ riêng của Hermes và phối hợp qua bảng Kanban, dùng khi một trợ lý không còn đủ cho nhiều người và nhiều mảng."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "👥"
---

# Đội trợ lý theo vai

## Khi nào dùng

Dùng khi anh chị muốn có nhiều trợ lý chuyên một mảng, ví dụ bán hàng, chăm sóc khách, kế toán, marketing, mỗi trợ lý có bộ công cụ, bộ kỹ năng và bộ nhớ riêng, và giao việc qua lại cho nhau có dấu vết. Hermes làm việc này bằng hồ sơ (profile). Mỗi hồ sơ là một thư mục riêng chứa cấu hình (`config.yaml`, gồm mô hình và bộ công cụ), khoá API (`.env`), tính cách gốc (`SOUL.md`), bộ nhớ, lịch sử phiên, kỹ năng và lịch định kỳ riêng. Các hồ sơ phối hợp qua bảng Kanban của Hermes, một bảng việc dùng chung cho mọi hồ sơ trên máy, nơi mỗi thẻ việc có người nhận là một hồ sơ và mọi lần bàn giao đều được ghi lại.

Phân biệt với lệnh `/personality`. Trong AI for Boss, các vai có sẵn như `ban-hang`, `dieu-hanh`, `marketing-noi-dung`, `quan-ly-du-an` là lớp giọng và trọng tâm đặt lên phiên hiện tại; gõ `/personality ban-hang` để đổi, `/personality none` để bỏ. Đổi vai kiểu này vẫn dùng chung bộ nhớ, kỹ năng, công cụ và khoá API của cùng một hồ sơ. Hồ sơ riêng thì tách hẳn những thứ đó.

Một hồ sơ là đủ khi chỉ một mình anh chị dùng, các vai khác nhau chủ yếu ở giọng và trọng tâm, anh chị muốn mọi vai cùng nhớ chung về khách và sản phẩm, và chưa có việc nào cần chuyển tay giữa các vai qua nhiều ngày. Phần lớn hộ kinh doanh và người làm một mình nên dừng ở một hồ sơ cộng `/personality`. Không dùng kỹ năng này để chia một việc lớn trong một lần làm, việc đó thuộc `giao-viec-cho-tro-ly-phu`. Không dùng để đóng gói một việc lặp lại, việc đó thuộc `dong-goi-viec-lap-lai`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự tạo hồ sơ hay chạy lệnh khi chưa được duyệt.

1. Anh chị muốn những vai nào, và mỗi vai làm những việc gì cụ thể trong một tuần?
2. Ai sẽ dùng từng vai, anh chị tự dùng hay giao cho nhân viên? Có vai nào kết nối kênh riêng như một tài khoản Zalo hay Telegram riêng không?
3. Có dữ liệu nào vai này không nên nhìn thấy của vai kia không, ví dụ sổ sách kế toán, bảng lương, danh sách khách?
4. Mỗi vai cần công cụ gì, ví dụ trình duyệt, đọc tệp, chạy mã tính bảng, lịch định kỳ? Vai nào nên dùng mô hình rẻ hơn để tiết kiệm?
5. Việc nào hay phải chuyển tay giữa các vai, ví dụ bán hàng chốt đơn rồi kế toán xuất hoá đơn, chăm sóc khách nhận khiếu nại rồi báo quản lý?
6. Máy anh chị có để Hermes chạy nền (gateway) cả ngày được không?

## Quy trình

1. Kiểm tra xem một hồ sơ có đủ không, dựa trên câu trả lời. Chỉ đề xuất tách hồ sơ khi có ít nhất một lý do thật, gồm bộ nhớ vai này làm nhiễu vai kia, người dùng khác nhau cho từng vai, cần bộ công cụ hoặc mô hình khác nhau, hoặc có việc chuyển tay kéo dài nhiều ngày. Nếu không có lý do nào, dừng ở đây, hướng dẫn dùng `/personality` với các vai có sẵn và giải thích một câu vì sao.
2. Thiết kế đội nhỏ nhất đủ dùng, thường hai đến ba hồ sơ. Lập bảng mỗi vai gồm tên hồ sơ (chữ thường không dấu, chữ số, gạch ngang, ví dụ `ban-hang`, `ke-toan`), mô tả một câu, bộ công cụ, kỹ năng AI for Boss nên có, thư mục làm việc, người dùng. Trình anh chị duyệt bảng này.
3. Nói rõ giới hạn trước khi tạo. Hồ sơ tách cấu hình, bộ nhớ và kỹ năng nhưng không khoá quyền truy cập tệp; trên máy anh chị, mọi hồ sơ vẫn đọc được các thư mục tài khoản máy đọc được. Dữ liệu thật sự nhạy cảm cần để ở máy hoặc tài khoản khác. Không mở hai cửa sổ trợ lý cùng chạy trên một hồ sơ.
4. Soạn các lệnh tạo hồ sơ và chờ anh chị nói "làm đi" rồi mới chạy. Với mỗi vai, lệnh `hermes profile create ke-toan --clone --description "Đối chiếu sao kê, công nợ, chuẩn bị chứng từ cho kế toán."` tạo hồ sơ mới chép cấu hình, khoá API, `SOUL.md` và kỹ năng từ hồ sơ hiện tại, bộ nhớ và lịch sử để trống. Sau khi tạo, hồ sơ có lệnh tắt cùng tên, ví dụ `ke-toan chat` hoặc `hermes -p ke-toan chat`. Sửa tính cách gốc trong tệp `SOUL.md` của hồ sơ đó, chọn bộ công cụ bằng `hermes -p ke-toan tools`, xem kỹ năng bằng `hermes -p ke-toan skills list`, đặt thư mục làm việc bằng `hermes -p ke-toan config set terminal.cwd <đường-dẫn-tuyệt-đối>`. Mô tả hồ sơ sửa lại được bằng `hermes profile describe ke-toan --text "..."`.
5. Kiểm tra đội bằng `hermes profile list` và `hermes profile show <tên>`. Anh chị cũng xem và sửa được từng hồ sơ trên bảng điều khiển web mở bằng `hermes dashboard`, chọn hồ sơ ở thanh bên.
6. Dựng bảng Kanban khi có việc chuyển tay. Chạy `hermes kanban init` một lần. Bộ điều phối của bảng chạy bên trong gateway, nên cần `hermes gateway start`; không có gateway thì thẻ sẵn sàng nằm yên chờ. Giao việc bằng `hermes kanban create "Xuất hoá đơn đơn hàng 0925" --assignee ke-toan --body "..."`, hoặc gõ `/kanban create ...` ngay trong khung trò chuyện. Việc của vai nhận chỉ bắt đầu sau việc vai trước thì nối bằng `hermes kanban link <thẻ-trước> <thẻ-sau>`. Việc cần làm trên thư mục dữ liệu thật thì thêm `--workspace dir:<đường-dẫn-tuyệt-đối>`, vì thư mục tạm mặc định bị xoá khi thẻ xong.
7. Hướng dẫn anh chị theo dõi và can thiệp gồm `hermes kanban list` xem bảng, `hermes kanban show <mã-thẻ>` xem chi tiết, `hermes kanban watch` theo dõi trực tiếp, `hermes kanban comment <mã-thẻ> "..."` để lại chỉ dẫn, `hermes kanban unblock <mã-thẻ>` gỡ thẻ đang chờ anh chị. Hồ sơ nhận việc tự có công cụ `kanban_*` khi được bộ điều phối gọi; hồ sơ muốn tự tạo và chia thẻ cho vai khác phải ghi rõ bộ công cụ `kanban` trong cấu hình.
8. Chốt quy tắc chung cho cả đội. Mọi vai giữ `quy-tac-dieu-hanh`; việc gửi ra ngoài, chi tiền, sửa dữ liệu gốc đều dừng ở trạng thái chờ duyệt trên thẻ. Khi anh chị chốt cơ cấu đội, gọi `aifb_record_decision` ghi các vai, lý do tách và người dùng từng vai.

## Tiêu chuẩn đầu ra

Một kết luận rõ ràng một hồ sơ là đủ hay cần tách, kèm lý do. Nếu tách, có bảng đội gồm tên hồ sơ, mô tả, bộ công cụ, kỹ năng, thư mục làm việc, người dùng; danh sách lệnh đã được duyệt và kết quả chạy; hướng dẫn giao việc qua Kanban với ví dụ một thẻ thật của doanh nghiệp. Mọi lệnh nêu ra là lệnh có thật của Hermes, không tự đặt thêm cờ. Nói rõ giới hạn hồ sơ không khoá quyền truy cập tệp. Không tạo hồ sơ, không bật gateway, không tạo thẻ khi chưa có "làm đi".

## Ba ca mẫu

### Ca 1: Tiệm hoa một chủ muốn "mỗi mảng một trợ lý"
Đầu vào: Chủ tiệm tự bán hàng, tự trả lời khách trên Facebook và Zalo, tự đăng bài, nhờ dịch vụ kế toán ngoài làm thuế. Muốn tạo bốn trợ lý bán hàng, chăm sóc khách, marketing, kế toán.
Bối cảnh: Chỉ một người dùng, muốn mọi vai cùng nhớ khách quen và mẫu hoa.
Đầu ra đạt chuẩn: Trợ lý kết luận một hồ sơ là đủ vì chỉ một người dùng và muốn nhớ chung; hướng dẫn `/personality ban-hang` khi soạn báo giá, `/personality marketing-noi-dung` khi lên bài, `/personality none` để về mặc định. Phần kế toán dùng `chuan-bi-chung-tu-cho-ke-toan` trong cùng hồ sơ. Không chạy lệnh tạo hồ sơ nào.
Tiêu chí chấm:
- Không tạo bốn hồ sơ khi chưa có lý do tách.
- Phân biệt đúng `/personality` với hồ sơ.
- Dùng đúng tên vai có sẵn của AI for Boss.
- Lý do kết luận ngắn, rõ ràng.

### Ca 2: Công ty nội thất 30 người, bán hàng chốt đơn rồi kế toán xuất hoá đơn
Đầu vào: Ba nhân viên kinh doanh dùng chung một trợ lý, kế toán trưởng muốn trợ lý riêng không lẫn ghi chú khách với số liệu sổ sách. Mỗi tuần khoảng 40 đơn cần chuyển từ kinh doanh sang kế toán (số giả định).
Bối cảnh: Máy chủ văn phòng bật cả ngày, có thư mục chung chứa hợp đồng và đơn hàng.
Đầu ra đạt chuẩn: Đội hai hồ sơ `ban-hang` và `ke-toan`, lý do là người dùng khác nhau và bộ nhớ cần tách. Lệnh tạo có `--clone` và `--description`, chỉ chạy sau khi được duyệt. Bảng Kanban có `hermes kanban init`, gateway bật, mẫu thẻ `hermes kanban create "Xuất hoá đơn đơn 0925" --assignee ke-toan --workspace dir:<thư-mục-đơn-hàng>`. Nói rõ hồ sơ không ngăn nhân viên kinh doanh mở thư mục sổ sách trên cùng máy.
Tiêu chí chấm:
- Có lý do tách cụ thể.
- Có cảnh báo về quyền truy cập tệp.
- Thẻ làm trên thư mục thật dùng `dir:` với đường dẫn tuyệt đối.
- Có gọi `aifb_record_decision` khi chốt cơ cấu đội.

### Ca 3: Chuyên gia marketing tự do quản lý nội dung cho năm khách
Đầu vào: Chuyên gia muốn mỗi khách một trợ lý nhớ giọng thương hiệu riêng, và một trợ lý tổng hợp báo cáo tuần cho cả năm khách.
Bối cảnh: Giọng của khách này hay bị lẫn sang bài của khách kia khi dùng chung một trợ lý.
Đầu ra đạt chuẩn: Trợ lý đề xuất một hồ sơ cho mỗi khách để bộ nhớ không lẫn, tạo lần lượt bằng `hermes profile create khach-a --clone --description "..."` sau khi được duyệt, mỗi hồ sơ có `SOUL.md` ghi giọng thương hiệu. Báo cáo tuần là một thẻ Kanban giao cho hồ sơ tổng hợp; hồ sơ này cần bộ công cụ `kanban` nếu phải tự chia thẻ cho các hồ sơ khách. Gợi ý bắt đầu với hai khách để thử trước khi làm cả năm.
Tiêu chí chấm:
- Lý do tách gắn với vấn đề lẫn giọng thật.
- Tên hồ sơ đúng quy tắc chữ thường không dấu.
- Nêu đúng điều kiện bộ công cụ `kanban` cho hồ sơ điều phối.
- Đề xuất đi từng bước, không tạo cả năm hồ sơ một lúc.

## Nguồn
Chuyển thể từ `c-level-advisor/skills/chief-of-staff` trong alirezarezvani/claude-skills (MIT) và `plugins/agent-teams/skills/team-composition-patterns` trong wshobson/agents (MIT), chỉ lấy ý chia vai và cỡ đội. Lệnh và thao tác đối chiếu với tài liệu Hermes Agent (MIT) gồm `website/docs/user-guide/profiles.md`, `website/docs/reference/profile-commands.md`, `website/docs/user-guide/features/kanban.md` và `website/docs/user-guide/features/personality.md`.
