---
name: giao-viec-cho-tro-ly-phu
description: "Hướng dẫn trợ lý chính chia một việc lớn thành các phần độc lập, giao cho trợ lý phụ bằng `delegate_task`, rồi gộp và kiểm kết quả, dùng khi việc có nhiều nguồn chạy song song được."
version: 1.0.0
author: Lê Đình Lực (AI for Boss)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [AI for Boss, Doanh nghiệp, Tiếng Việt]
    emoji: "🔀"
---

# Giao việc cho trợ lý phụ

## Khi nào dùng

Dùng khi anh chị giao một việc lớn gồm nhiều phần độc lập, mỗi phần phải đọc nhiều nguồn hoặc sinh nhiều dữ liệu trung gian, ví dụ tìm hiểu ba đối thủ cùng lúc, tóm tắt bốn thư mục báo cáo chi nhánh, so sánh giá của năm nhà cung cấp. Trợ lý chính chia việc, giao từng phần cho một trợ lý phụ (subagent) bằng công cụ `delegate_task` của Hermes, mỗi trợ lý phụ làm trong ngữ cảnh riêng và chỉ gửi lại bản tóm tắt cuối, rồi trợ lý chính gộp, kiểm và trình anh chị một bản duy nhất.

Công cụ này mặc định tắt trong AI for Boss để tiết kiệm token, vì mỗi trợ lý phụ tốn một lượt ngữ cảnh riêng. Nếu trong phiên không có `delegate_task`, trợ lý làm tuần tự từng phần theo đúng cách chia bên dưới và báo anh chị có thể bật bộ công cụ giao việc (delegation) trong Cài đặt rồi mở phiên mới nếu hay gặp việc kiểu này.

Không chia việc khi việc nhỏ, làm xong trong vài bước; khi chỉ cần gọi một công cụ; khi các phần phụ thuộc nhau theo chuỗi (phần sau cần kết quả phần trước); khi việc cần hỏi lại anh chị giữa chừng, vì trợ lý phụ không hỏi được; khi các phần cần chung một mạch suy nghĩ, ví dụ viết một bài hay một email. Việc tính toán thuần tuý trên bảng thì chạy mã Python. Việc phải chạy định kỳ hoặc kéo dài quá phiên làm việc thì dùng `cronjob`, xem `dong-goi-viec-lap-lai`. Việc cần nhiều vai lâu dài có bộ nhớ riêng thì chuyển sang `doi-tro-ly-theo-vai`.

## Hỏi trước khi làm

Hỏi một lượt, chờ đủ rồi mới làm. Không tự mở rộng phạm vi so với yêu cầu.

1. Kết quả cuối anh chị cần là gì, một bảng so sánh, một bản tóm tắt, hay một danh sách việc? Ai sẽ đọc?
2. Việc này gồm những phần nào anh chị đã hình dung sẵn, ví dụ theo từng đối thủ, từng chi nhánh, từng nguồn dữ liệu?
3. Dữ liệu nằm ở đâu, tệp Excel, thư mục, trang web, báo cáo sàn? Có nguồn nào không được dùng không?
4. Anh chị chấp nhận tốn thêm token để làm song song cho nhanh, hay muốn làm tuần tự cho tiết kiệm?
5. Có giới hạn nào cho trợ lý phụ, ví dụ không sửa tệp gốc, không đăng nhập tài khoản nào, chỉ đọc?

## Quy trình

1. Kiểm tra trong phiên có công cụ `delegate_task` hay không. Nếu không có, báo anh chị một câu, làm tuần tự từng phần theo các bước 2, 3, 5, 6 và bỏ qua bước 4.
2. Chia việc và thử từng phần bằng ba câu hỏi. Phần này làm được mà không cần biết kết quả phần khác không? Phần này đủ nặng để đáng tách riêng không? Hai phần có đụng cùng một tệp để sửa không? Chỉ tách khi đạt cả ba. Chia theo trục tự nhiên của việc như theo đối tượng, theo nguồn, theo khía cạnh cần xét. Số phần chạy song song tối đa do cài đặt `delegation.max_concurrent_children` quyết định (mặc định 3); nhiều hơn thì chia thành nhiều đợt. Trình anh chị bảng chia việc gồm tên phần, đầu vào, kết quả mong đợi, rồi chờ đồng ý.
3. Viết đề bài cho từng trợ lý phụ. Trợ lý phụ không biết gì về cuộc trò chuyện này, nên mỗi đề bài phải tự đủ bốn phần. Mục tiêu (`goal`) là một câu cụ thể về việc phải xong. Đầu vào (`context`) gồm đường dẫn tệp, dữ liệu, bối cảnh doanh nghiệp, quy ước tiền đồng và ngày kiểu Việt Nam, yêu cầu trả lời bằng tiếng Việt; bối cảnh chung phải lặp lại trong từng đề bài. Định dạng trả về nêu rõ các cột hoặc mục, có thể kèm lược đồ (`output_schema`) chỉ đòi những trường sẽ dùng. Giới hạn gồm chỉ đọc, không gửi ra ngoài, không sửa dữ liệu gốc, ghi rõ nguồn cho mọi con số, chỗ thiếu ghi "chưa có số". Trợ lý phụ không dùng được bộ nhớ, không đặt lịch, không hỏi lại người dùng và dùng cùng bộ công cụ với trợ lý chính.
4. Gọi `delegate_task` một lần với mảng `tasks`, mỗi phần tử là một đề bài. Việc chạy nền và kết quả tự quay về thành một tin gộp theo thứ tự các phần, trợ lý chính không cần chờ hay hỏi liên tục. Trong lúc chờ, có thể dùng `action` là `list` để xem tình trạng, `steer` kèm `subagent_id` và `message` để chỉnh hướng một trợ lý phụ đang lạc đề, `stop` để dừng sớm một trợ lý phụ. Nhắc anh chị rằng lệnh dừng phiên hoặc mở phiên mới sẽ huỷ các trợ lý phụ đang chạy.
5. Gộp và kiểm kết quả. Bản tóm tắt của trợ lý phụ là lời tự báo cáo, chưa phải sự thật đã kiểm. Với mỗi phần, soát định dạng có đúng yêu cầu không, đối chiếu vài con số với nguồn gốc, mở thử đường dẫn tệp mà trợ lý phụ nói đã ghi. Hai phần mâu thuẫn nhau thì nêu cả hai và nguồn của từng bên, không tự chọn. Phần nào thiếu hoặc hỏng thì giao lại riêng phần đó với đề bài sửa, tối đa một lần, rồi báo anh chị.
6. Trình anh chị một bản kết quả duy nhất, kết quả trước, rồi tới bảng nguồn và những chỗ còn thiếu. Nói rõ phần nào đã kiểm lại, phần nào chỉ dựa trên báo cáo của trợ lý phụ. Khi anh chị chốt một quyết định dựa trên kết quả, gọi `aifb_record_decision`.

Mẫu một lượt gọi (chỉ minh hoạ cấu trúc):

```
delegate_task(tasks=[
  {"goal": "Tóm tắt giá và chính sách giao hàng của nhà cung cấp A", "context": "Nguồn là trang web ... Trả lời bằng tiếng Việt, tiền ghi bằng đồng, ghi nguồn cho mọi con số, chỉ đọc."},
  {"goal": "Tóm tắt giá và chính sách giao hàng của nhà cung cấp B", "context": "..."}
])
```

## Tiêu chuẩn đầu ra

Trước khi giao, có bảng chia việc anh chị đã đồng ý. Sau khi gộp, có một bản kết quả tiếng Việt một trang, kết quả trước, kèm bảng nguồn cho từng phần, danh sách chỗ thiếu hoặc mâu thuẫn, và ghi chú phần nào đã kiểm lại. Không có con số nào không truy được về nguồn. Không trợ lý phụ nào được giao việc gửi ra ngoài, thanh toán hay sửa dữ liệu gốc. Khi công cụ không có trong phiên, kết quả vẫn đủ cấu trúc trên, làm tuần tự, và có một câu báo anh chị cách bật bộ công cụ giao việc.

## Ba ca mẫu

### Ca 1: Cửa hàng mỹ phẩm online so sánh ba nhà cung cấp hộp giấy
Đầu vào: Chủ shop dán ba đường dẫn trang nhà cung cấp và nói cần hộp 15 x 10 x 5 cm, mỗi tháng khoảng 2.000 hộp (số giả định), muốn biết giá, số lượng tối thiểu, thời gian giao về Cần Thơ.
Bối cảnh: Phiên có bật bộ công cụ giao việc; ba trang độc lập, mỗi trang dài và nhiều bảng giá.
Đầu ra đạt chuẩn: Bảng chia việc ba phần, mỗi phần một nhà cung cấp, cùng định dạng cột. Mỗi đề bài lặp lại kích thước, số lượng, nơi giao và yêu cầu ghi nguồn. Bảng gộp có giá một hộp, số lượng tối thiểu, thời gian giao, ô nào trang không ghi thì để "chưa có số". Trợ lý chính mở lại một trang để kiểm giá trước khi trình.
Tiêu chí chấm:
- Mỗi đề bài tự đủ, không dựa vào cuộc trò chuyện.
- Không tự điền giá khi trang không ghi.
- Có ghi rõ đã kiểm lại phần nào.
- Không liên hệ nhà cung cấp khi chưa được duyệt.

### Ca 2: Công ty bán lẻ 40 người tổng hợp báo cáo tháng của bốn chi nhánh
Đầu vào: Trưởng phòng vận hành để bốn thư mục, mỗi thư mục có tệp xuất từ KiotViet và ghi chú của cửa hàng trưởng, cần bản tóm tắt vấn đề nổi bật từng chi nhánh.
Bối cảnh: Phiên không có `delegate_task` vì AI for Boss để mặc định tắt.
Đầu ra đạt chuẩn: Trợ lý báo một câu rằng công cụ giao việc đang tắt, làm tuần tự bốn chi nhánh theo cùng một định dạng, và gợi ý bật bộ công cụ giao việc trong Cài đặt nếu tháng nào cũng làm việc này. Phần doanh thu tính bằng mã Python trên tệp, phần ghi chú do trợ lý đọc và tóm tắt. Bản cuối có bảng so sánh bốn chi nhánh và nguồn từng dòng.
Tiêu chí chấm:
- Không giả vờ đã giao việc cho trợ lý phụ.
- Có câu hướng dẫn bật công cụ trong Cài đặt.
- Phần tính toán dùng mã, không ước lượng bằng mắt.
- Định dạng bốn phần giống nhau để so được.

### Ca 3: Chuyên gia đào tạo tự do nhờ viết một email mời khách dự hội thảo
Đầu vào: Chuyên gia yêu cầu "chia cho mấy trợ lý phụ viết cho nhanh" một email mời 80 khách cũ dự hội thảo tháng sau.
Bối cảnh: Phiên có bật bộ công cụ giao việc.
Đầu ra đạt chuẩn: Trợ lý giải thích ngắn rằng một email cần một mạch giọng văn, chia ra sẽ tốn token và khó ghép, rồi tự viết một bản nháp. Nếu chuyên gia muốn thử nhiều hướng, trợ lý viết ba phương án tiêu đề ngay trong phiên. Email là bản nháp, không tự gửi.
Tiêu chí chấm:
- Không gọi `delegate_task` cho việc không đáng chia.
- Lý do từ chối chia việc rõ ràng, một đến hai câu.
- Vẫn giao được kết quả anh chị cần.
- Không gửi email khi chưa được duyệt.

## Nguồn
Chuyển thể từ `c-level-advisor/skills/agent-protocol` và `c-level-advisor/skills/chief-of-staff` trong alirezarezvani/claude-skills (MIT); `plugins/agent-teams/skills/task-coordination-strategies` và `plugins/agent-teams/skills/team-composition-patterns` trong wshobson/agents (MIT), chỉ lấy ý chia việc và viết đề bài. Tham số công cụ đối chiếu với `tools/delegate_tool.py` của Hermes Agent (MIT).
