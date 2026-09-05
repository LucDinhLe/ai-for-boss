# AI for Boss

**Tầm nhìn sản phẩm AI Agent dành cho chủ doanh nghiệp, nhà quản lý và người làm chuyên môn.**

AI for Boss đang được xây dựng trên nền tảng mã nguồn mở OpenClaw, hướng tới việc giúp người dùng dễ dàng cài đặt, tạo, quản lý và giao việc cho AI Agent qua một giao diện đơn giản, an toàn và dễ sử dụng.

> [!IMPORTANT]
> **Trạng thái hiện tại:** dự án đang ở Cổng 0. Phần tài liệu và hợp đồng của cổng này đã đóng, senior platform/security review độc lập vẫn chờ, và dự án đang thi công **beta 0** trên nhánh `experiment/beta-0`: ứng dụng tự nuôi một Gateway OpenClaw bên trong và nói chuyện với nó qua giao thức chính thức, kèm một cửa sổ trò chuyện tối thiểu. Beta 0 tồn tại để trả lời một câu hỏi bằng bằng chứng, rằng Gateway chạy được nguyên bản trên từng hệ điều hành hay Windows bắt buộc phải mượn Linux subsystem.
>
> Chưa có: bộ cài, updater, ký số, kết nối nhà cung cấp model, Advisor thật, tool, duyệt hành động, quản lý dự án, và bất kỳ bản phát hành nào cho người dùng thật. Bản đóng gói vẫn là `experimental-internal` và chưa mang theo Node runtime nên chưa chạy được trên máy sạch. Các khả năng bên dưới là **mục tiêu sản phẩm** trừ khi hồ sơ release ghi rõ đã kiểm chứng; không capability nào đang được quảng cáo là production-ready.
>
> Beta 0 chạy trên candidate train `oc-2026.9.1-candidate.1` (OpenClaw `2026.9.1`, Node `24.19.0`, Electron `43.3.0`, pnpm `11.2.2`, Gateway protocol v4). Đây là **candidate**, không phải release train đã khóa; train đã khóa vẫn là `oc-2026.7.1-2-locked.1`. Điều kiện để promote nằm trong `manifests/runtime/beta-0-candidate.lock.json`.

## Vì sao AI for Boss ra đời?

Các mô hình AI ngày càng mạnh, nhưng việc biến chúng thành AI Agent có khả năng hỗ trợ công việc lâu dài vẫn còn phức tạp với phần lớn người dùng.

Để tự cài đặt và vận hành AI Agent, người dùng thường phải làm quen với dòng lệnh, Node.js, Git, WSL, Gateway, API key, quyền truy cập, cấu hình mô hình và nhiều thành phần kỹ thuật khác.

Sau khi cài đặt, họ vẫn phải tự giải quyết nhiều câu hỏi quan trọng:

- AI Agent được phép làm gì?
- Agent đang sử dụng mô hình nào?
- Dữ liệu nào được gửi ra ngoài?
- Hành động nào cần người dùng phê duyệt?
- Chi phí sử dụng được kiểm soát như thế nào?
- Làm sao biết kết quả của Agent đủ tin cậy để sử dụng?

Mục tiêu của AI for Boss là đưa toàn bộ hành trình này vào một phần mềm thống nhất, dễ hiểu và phù hợp với người không chuyên kỹ thuật.

## Hành trình mục tiêu gồm ba bước

Khi đạt các cổng phát hành, người dùng dự kiến bắt đầu với AI for Boss qua ba bước:

1. Cài đặt phần mềm.
2. Kết nối mô hình và tạo AI Agent.
3. Giao công việc đầu tiên.

Các thành phần kỹ thuật sẽ được quản lý phía sau. Người dùng tập trung vào mục tiêu, dữ liệu, quyết định và kết quả công việc.

## AI for Boss mang lại lợi ích gì?

### Cài đặt dễ dàng

Mục tiêu phát hành là hỗ trợ Windows, macOS và Linux theo ma trận đã được kiểm thử của từng bản.

Khi bộ cài đạt Cổng 4, người dùng sẽ không cần tự cài đặt hoặc vận hành OpenClaw, Gateway, Node.js, Git, WSL hay package manager.

### Tạo AI Agent theo nhu cầu riêng

Người dùng có thể thiết lập cho Agent:

- Tên gọi.
- Vai trò và phạm vi công việc.
- Giọng điệu giao tiếp.
- Cách xưng hô.
- Emoji hoặc hình ảnh đại diện.
- Thứ tự ưu tiên.
- Ranh giới và những hành động cần xin phép.

Thiết kế mục tiêu yêu cầu mỗi Agent có danh tính, phiên làm việc, bộ nhớ và quyền truy cập riêng; biên này chưa được triển khai hoặc kiểm chứng trong runtime sản phẩm.

### Kết nối mô hình AI của người dùng

Kế hoạch sản phẩm hỗ trợ kết nối với nhiều nhà cung cấp mô hình như OpenAI, Anthropic, Google và các mô hình tương thích khác sau khi từng connector qua contract, điều khoản và live test.

Người dùng sử dụng tài khoản của chính mình, lựa chọn mô hình phù hợp với từng công việc và chủ động kiểm soát chi phí.

### Giao việc bằng ngôn ngữ thông thường

Người dùng chỉ cần mô tả mục tiêu hoặc kết quả mong muốn.

AI Agent dự kiến có thể:

- Làm rõ yêu cầu.
- Lập kế hoạch thực hiện.
- Xác định dữ liệu và công cụ cần dùng.
- Trình bày quyền truy cập cần thiết.
- Thực hiện công việc.
- Theo dõi tiến trình.
- Tạo kết quả và tài liệu bàn giao.

### Quản lý nhiều AI Agent

Kế hoạch sản phẩm cho phép tạo nhiều Agent cho các vai trò khác nhau:

- Trợ lý điều hành.
- Phân tích kinh doanh.
- Nghiên cứu thị trường.
- Quản lý nội dung.
- Hỗ trợ đào tạo.
- Tổng hợp tài liệu.
- Theo dõi kế hoạch và công việc.

Kiến trúc mục tiêu tách không gian từng Agent để hạn chế việc lẫn danh tính, dữ liệu, bộ nhớ và quyền truy cập; capability này tiếp tục bị khóa tới khi có enforcement và isolation test thực thi.

### Kiểm soát dữ liệu, quyền và chi phí

Theo thiết kế mục tiêu, trước khi Agent thực hiện hành động quan trọng, người dùng có thể kiểm tra:

- Dữ liệu nào sẽ được sử dụng.
- Dữ liệu có rời khỏi thiết bị hay không.
- Công cụ nào sẽ được kích hoạt.
- Agent cần quyền đọc hay quyền chỉnh sửa.
- Hành động nào cần phê duyệt.
- Chi phí dự kiến của tác vụ.

Người dùng luôn giữ quyền quyết định cuối cùng.

### Advisor kiểm tra kế hoạch và kết quả

Thiết kế mục tiêu sử dụng Advisor tại hai checkpoint:

1. Kiểm tra kế hoạch trước khi Agent thực hiện.
2. Kiểm tra kết quả trước khi bàn giao cho người dùng.

Advisor giúp phát hiện yêu cầu chưa rõ, giả định thiếu cơ sở, dữ liệu chưa đủ, rủi ro bị bỏ sót và kết luận chưa đáng tin cậy.

### Quản lý tập trung trong một giao diện

Kế hoạch sản phẩm tập trung các hoạt động quan trọng vào một ứng dụng:

- Cài đặt và cập nhật.
- Kết nối mô hình.
- Tạo và quản lý Agent.
- Quản lý phiên làm việc.
- Theo dõi tiến trình.
- Xem và phê duyệt hành động.
- Quản lý dữ liệu và quyền truy cập.
- Kiểm tra tình trạng hệ thống.
- Sao lưu và phục hồi.

## AI for Boss dành cho ai?

AI for Boss được phát triển cho:

- Chủ doanh nghiệp nhỏ và vừa muốn ứng dụng AI vào vận hành.
- Nhà quản lý cần hỗ trợ phân tích, lập kế hoạch và theo dõi công việc.
- Chuyên gia, giảng viên, trainer, coach và consultant làm việc với nhiều tri thức.
- Người làm nội dung, nghiên cứu và phát triển sản phẩm.
- Học viên muốn học cách sử dụng và quản lý AI Agent.
- Người muốn sử dụng sức mạnh của OpenClaw qua một giao diện dễ tiếp cận hơn.

## AI for Boss được xây dựng từ đâu?

AI for Boss được xây dựng trên OpenClaw, nền tảng mã nguồn mở cung cấp lõi vận hành cho AI Agent.

OpenClaw cung cấp nền tảng cho các khả năng như:

- Kết nối và lựa chọn mô hình AI.
- Quản lý Agent và phiên làm việc.
- Bộ nhớ và ngữ cảnh.
- Công cụ và Browser.
- Kỹ năng và plugin.
- Kết nối MCP.
- Lịch tác vụ và hoạt động nền.
- Quản lý tệp và dữ liệu.
- Chẩn đoán và phục hồi.

Trên nền tảng đó, AI for Boss đang phát triển lớp trải nghiệm và quản trị dành cho người dùng phổ thông:

- Ứng dụng desktop đa nền tảng.
- Quy trình cài đặt và khởi tạo.
- Giao diện tạo và quản lý Agent.
- Kết nối mô hình qua trải nghiệm trực quan.
- Kiểm soát dữ liệu và quyền truy cập.
- Cơ chế phê duyệt hành động.
- Advisor kiểm tra kế hoạch và kết quả.
- Giám sát tình trạng hệ thống.
- Sao lưu, phục hồi và cập nhật.

Dự án ghi rõ **AI for Boss — Built on OpenClaw** để thể hiện nguồn nền tảng và giữ sự minh bạch với người dùng.

## Nguyên tắc thiết kế

AI for Boss được xây dựng theo các nguyên tắc:

- Dễ sử dụng với người không chuyên kỹ thuật.
- Người dùng luôn giữ quyền quyết định.
- Quyền truy cập được cấp rõ ràng và có giới hạn.
- Dữ liệu, công cụ và chi phí được trình bày minh bạch.
- Hành động nhạy cảm cần được phê duyệt.
- Mỗi Agent có danh tính và không gian riêng.
- Lỗi phải dừng an toàn và có khả năng phục hồi.
- Khả năng chưa được kiểm chứng không được trình bày như đã sẵn sàng.

## Tầm nhìn

AI for Boss giúp người dùng phổ thông có thể cài đặt, tạo, quản lý và giao việc cho AI Agent mà không phải tự vận hành một hệ thống kỹ thuật phức tạp.

Sức mạnh của AI được đặt trong một trải nghiệm rõ ràng, nơi người dùng luôn nhìn thấy dữ liệu, quyền hạn, chi phí, tiến trình và trách nhiệm đằng sau mỗi hành động.
