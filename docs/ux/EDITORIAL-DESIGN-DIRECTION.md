# AI for Boss — Hướng thiết kế Editorial Calm

Ngày chốt: 2026-08-11  
Product Owner: Lê Đình Lực  
Trạng thái: Hướng UX đã duyệt; implementation thuộc Feature 0.4 và 2.x

## 1. Mục tiêu

AI for Boss phải đem lại cảm giác sáng, sang, bình tĩnh và đáng tin cậy cho chủ doanh nghiệp. Giao diện giảm tiếng ồn kỹ thuật nhưng vẫn giữ đầy đủ quyền kiểm soát Agent, Gateway, model, Advisor, Browser, dữ liệu và phê duyệt.

Tham chiếu trải nghiệm là cách Hermes Agent tạo nhịp thị giác bằng nền giấy ấm, tương phản serif/sans, đường phân vùng mảnh, nhiều khoảng thở và điều khiển nhỏ gọn. AI for Boss chỉ học nguyên lý; không sao chép logo, icon riêng, tài sản, mã nguồn, câu chữ, bố cục pixel hoặc nhận diện thương mại.

## 2. Nguyên tắc thị giác

1. **Editorial, không phô trương:** tiêu đề dùng serif có cá tính; giao diện và dữ liệu dùng sans dễ đọc.
2. **Nền giấy ấm:** bề mặt sáng thiên kem, dark mode thiên nâu than; tránh trắng xanh và đen tuyệt đối.
3. **Một màu nhấn có chủ đích:** đồng nung/copper dùng cho trạng thái chọn, điểm nhấn và thương hiệu. Xanh chỉ dùng cho an toàn/healthy; đỏ chỉ dùng cho nguy hiểm.
4. **Đường phân vùng mảnh:** ba panel tách bằng hairline, hạn chế card nổi, pill và shadow dày.
5. **Khoảng thở là cấu trúc:** ưu tiên ít thành phần nhìn thấy cùng lúc; chi tiết kỹ thuật đi vào đúng ngữ cảnh hoặc Trung tâm điều khiển.
6. **Chuyển động tiết chế:** chỉ dùng cho thay đổi trạng thái, không có animation trang trí hoặc chạy lặp.

## 3. Nhận diện độc lập

- Wordmark là `AI for Boss`; dòng phụ `Built on OpenClaw` chỉ dùng để minh bạch nền tảng.
- Không dùng logo, mascot hoặc icon của Hermes Agent, AI Coworker hay OpenClaw làm logo sản phẩm.
- Icon chức năng dùng bộ icon nguồn mở đã kiểm tra license và thể hiện hành động phổ quát.
- Brand mark sản phẩm tương lai phải có hồ sơ nguồn gốc, license và trademark review trước public release.
- Mọi màu, khoảng cách, typography và nội dung UI được định nghĩa bằng token riêng của AI for Boss.
- Icon/brand mark cuối chưa được chốt. Concept **La bàn quyết định** đã bị Product Owner từ chối và không được dùng làm nhận diện phát hành. Prototype hiện còn concept bị loại và phải chuyển sang placeholder trung tính trước vòng usability/visual test tiếp theo.

## 4. Kiến trúc ba panel

### Panel trái — Điều hướng và dữ liệu phiên

- Tạo phiên mới.
- Đội Agent.
- Tin nhắn và Hộp phê duyệt.
- Tệp kết quả.
- Phiên đã ghim và phiên gần đây.
- Dữ liệu gắn với phiên đang chọn.
- Không gian dự án ở chân panel, hiển thị quyền `read-only` hoặc `read-write` bằng ngôn ngữ phổ thông.

Agent Home không xuất hiện tại đây; đường dẫn hệ thống chỉ nằm trong Chẩn đoán nâng cao.

### Panel giữa — Hội thoại và quyết định

- Trạng thái chưa có phiên dùng màn chào thương hiệu editorial và composer làm điểm tập trung.
- Trạng thái phiên đang chạy hiển thị tên phiên, Agent chịu trách nhiệm, model theo phiên và mục tiêu hiện tại.
- Thanh điều khiển phiên có Advisor bật/tắt, Gateway health, refresh, pause và force stop.
- Composer cho phép đính kèm, chọn model theo phiên, nhập giọng nói và gửi.
- Hành động nhạy cảm không thực thi từ composer; chúng tạo yêu cầu trong Hộp phê duyệt.

### First run — ba bước thay cho màn hình rỗng

First run giữ chất lượng Editorial Calm nhưng phải dẫn dắt rõ ba chặng:

1. **Tải và cài** do website/installer hoàn thành và xác minh.
2. **Kết nối và khai sinh** gồm ngôn ngữ, mode Thiết bị cá nhân/Always-on, provider live probe và Agent Genesis.
3. **Giao việc đầu tiên** bằng composer hoặc workflow mẫu, với permission/budget progressive disclosure.

Sau first run, Welcome quay về trạng thái nhẹ, tập trung vào composer. Onboarding không biến thành dashboard kỹ thuật hoặc chuỗi biểu mẫu dài.

### Panel phải — Ngữ cảnh sống

Panel phải chỉ hiển thị một trong ba bề mặt theo công việc hiện tại:

1. **Tiến trình:** tóm tắt hoạt động, bằng chứng và trạng thái chờ; không hiển thị toàn bộ Agent Loop như checklist cố định.
2. **Trình duyệt:** browser profile của Agent, nguồn đang đọc và quyền hiện hành.
3. **Tệp:** preview artifact cùng provenance và trạng thái Advisor.

Agent Loop chạy nền mặc định. Advisor xuất hiện trong tiến trình khi phản biện kế hoạch hoặc kiểm tra đầu cuối, đúng hai checkpoint đã chốt. Plan gate phải hiển thị quyết định `approve`, `revise`, `clarify` hoặc `blocked`; final gate hiển thị tiêu chí đạt/chưa đạt, bằng chứng và khuyến nghị bàn giao. Người dùng có thể override hoặc tắt Advisor, nhưng trạng thái chưa review và audit phải rõ.

## 5. Thanh trên và Trung tâm điều khiển

Thanh trên giữ các thao tác toàn ứng dụng:

- Chuyển bố cục.
- Hộp phê duyệt.
- Âm thanh/thông báo.
- Trung tâm điều khiển.
- Theme.
- Tiếng Việt/English.

Trung tâm điều khiển chứa:

- Kết nối.
- Models & Providers.
- Agents & danh tính, gồm Agent Genesis.
- Gateway & Runtime.
- Kênh giao tiếp.
- Browser, MCP, Plugins, Skills và Tools.
- Dữ liệu, nhập/xuất, backup và recovery.
- Bảo mật, quyền và audit.
- Chẩn đoán, support bundle và cập nhật.
- Cấu hình ứng dụng và accessibility.

## 6. Trạng thái bắt buộc

- Welcome/new session.
- Active, waiting for user, waiting for approval, paused, force-stopped và completed.
- Advisor on/off/reviewing/failed.
- Gateway healthy/degraded/restarting/safe mode/offline.
- Không gian dự án available/read-only/read-write/unavailable.
- Browser idle/running/approval-required/blocked.
- Artifact draft/advisor-pending/approved/failed.
- Deployment local/always-on; remote connected/reconnecting/offline/claim-expired.

Mỗi trạng thái phải có text hoặc icon; màu không được là tín hiệu duy nhất.

## 7. Responsive và accessibility

- Desktop đầy đủ dùng ba panel.
- Màn hình hẹp thu panel trái thành rail và đưa panel phải xuống dưới.
- Không giấu emergency stop, Gateway health hoặc trạng thái Advisor khi thu gọn; nhãn có thể chuyển thành icon kèm accessible name.
- Hỗ trợ bàn phím, screen reader, zoom, contrast, giảm chuyển động và Việt/Anh.
- Nội dung thiết yếu không nhỏ hơn 11 px ở implementation production; prototype có thể thu nhỏ để mô phỏng nhưng không phải chuẩn phát hành.

## 8. Tiêu chí nghiệm thu cho implementation

1. Người dùng mới nhận ra nơi giao việc trong năm giây.
2. Người dùng đổi model theo phiên và bật/tắt Advisor mà không mở Cài đặt.
3. Gateway health, pause và force stop luôn truy cập được trong phiên.
4. Tệp của phiên mở đúng panel phải và vẫn thể hiện nguồn tạo cùng trạng thái Advisor.
5. Browser, tiến trình và tệp không cạnh tranh không gian cùng lúc.
6. Agent Loop không bị lộ thành bảng bước kỹ thuật.
7. Trung tâm điều khiển bao phủ capability đã chốt mà không dồn lên màn hình chính.
8. Không có tài sản nhận diện sao chép từ sản phẩm tham chiếu.
9. Light/dark, Việt/Anh và breakpoint chính đạt visual regression test.
10. Usability test với người không kỹ thuật hoàn thành tác vụ đầu mà không cần terminal.
11. 90% người thử mục tiêu hoàn thành ba bước và bắt đầu tác vụ đầu trong năm phút; 80% tìm đúng composer trong năm giây.
12. Người thử giải thích đúng model, Advisor, dữ liệu nào rời máy và hành động nào đang chờ duyệt.
13. Independent visual review chấm hierarchy, clarity và perceived trust cao hơn AICoworker, learnability không thấp hơn.
14. Cùng một session UX hoạt động với runtime local và Always-on; lỗi remote không biến thành thuật ngữ Gateway trên luồng chính.

## 9. Phân bổ theo feature

| Feature | Đầu ra |
|---|---|
| 0.4 | App shell và token nền; navigation giả lập, chưa nối runtime thật |
| 0.5 | Accessibility, CSP, IPC state và visual regression policy |
| 2.1 | Design system Việt/Anh và component states |
| 2.2 | Welcome, onboarding, kết nối và Agent Genesis |
| 2.3 | Session, chat, history, attachment và artifact |
| 2.4 | Model theo phiên và budget |
| 2.5 | Đội Agent và phối hợp nhiều Agent |
| 2.6 | Advisor states và review provenance |
| 2.7 | Hộp phê duyệt, pause và emergency stop |
| 4.x Headless | Mode selector, remote claim, connection/recovery states và Web Client responsive |

## 10. Ngoài phạm vi của bản chốt này

- Chưa phải code production hoặc Electron shell.
- Chưa chốt font thương mại, icon/logo cuối, motion system hoặc installer visuals.
- Chưa chứng minh runtime, Gateway, Browser hoặc capability thật.
- Chưa thay đổi thứ tự cổng trong `AGENTS.md`.
