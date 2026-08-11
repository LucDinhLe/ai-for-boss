# Feature Spec — 0.2b Editorial UX direction

## 1. Trạng thái

- Cổng: 0
- Loại: Product design amendment, docs-only
- Product Owner: Lê Đình Lực
- Owner thực hiện: Codex
- Trạng thái: Implemented, committed; pending independent visual review
- Ngày mở: 2026-08-11
- Giới hạn: Không mở Feature 0.3 hoặc viết desktop application code

## 2. Mục tiêu vận hành

AI for Boss có một hướng thiết kế độc lập, sáng, sang và dễ dùng hơn, học nguyên lý thị giác từ Hermes Agent nhưng giữ đầy đủ chức năng, biên an toàn và nhận diện riêng đã chốt.

## 3. Trong phạm vi

- Chốt hệ thiết kế Editorial Calm.
- Chốt vai trò của ba panel, top bar, composer và Trung tâm điều khiển.
- Chốt Agent Loop chạy nền, panel phải chỉ hiển thị hoạt động, Browser hoặc tệp.
- Chốt Advisor/Gateway/pause/stop/model theo phiên ở đúng ngữ cảnh.
- Chốt rào chắn sở hữu trí tuệ và visual-regression acceptance.
- Tạo prototype tương tác Việt/Anh, light/dark và hai trạng thái welcome/session trong vùng visualization riêng.

## 4. Ngoài phạm vi

- Electron, React, runtime, IPC, Gateway hoặc provider thật.
- Sao chép code, asset, logo, icon riêng, câu chữ hoặc bố cục pixel của Hermes Agent.
- Chốt logo cuối, font thương mại hoặc installer art.
- Phát hành prototype như sản phẩm.

## 5. Đầu vào và đầu ra

| Loại | Mô tả |
|---|---|
| Đầu vào | Ảnh tham chiếu Hermes Agent do Product Owner cung cấp; Rulebook; Master Plan; Agent Genesis; các quyết định UX đã chốt |
| Đầu ra | Editorial design direction; Decision/Risk/Changelog; prototype tương tác ngoài repo; validator tĩnh cho prototype |
| Dữ liệu nhạy cảm | Không có; nội dung trong prototype là dữ liệu mô phỏng |
| Hành động ngoài máy | Không có |

## 6. Giả định

- Product Owner muốn học tinh thần hiển thị của Hermes Agent, đồng thời giữ cấu trúc ba panel và capability AI for Boss.
- Copper, serif editorial và nền giấy ấm là hướng thử nghiệm; brand review cuối vẫn thuộc feature sau.
- Prototype là bằng chứng UX, chưa phải bằng chứng production hoặc accessibility đầy đủ.

## 7. Trường hợp biên

| Trường hợp | Hành vi |
|---|---|
| Chưa có phiên | Panel giữa tập trung vào lời hứa và composer; panel phải hiển thị empty state |
| Phiên đang chạy | Hiển thị điều khiển phiên và panel phải theo hoạt động hiện tại |
| Màn hình hẹp | Panel trái thành rail; panel phải xuống dưới; giữ control an toàn |
| Advisor tắt | Label và activity state đổi rõ ràng, không chỉ đổi màu |
| Gateway refresh | Health copy cập nhật, không lộ cổng hoặc terminal |
| Force stop | Xác nhận trong dialog và giữ checkpoint |
| Bị nhận xét giống đối thủ | Đối chiếu IP guardrail; thay asset/token/copy trước implementation |

## 8. Tiêu chí nghiệm thu

- [x] Có design direction với nguyên tắc, cấu trúc, trạng thái và acceptance criteria.
- [x] Có rào chắn không sao chép nhận diện Hermes Agent.
- [x] Prototype giữ ba panel, model theo phiên, Advisor, Gateway, Browser, tệp, Agent team, phê duyệt và cài đặt.
- [x] Agent Loop không hiển thị thành checklist; progress là hoạt động theo ngữ cảnh.
- [x] Prototype có welcome/session, Việt/Anh và light/dark.
- [x] JavaScript compile; ID/reference/panel/translation scan đạt.
- [ ] Có independent visual review ở kích thước desktop và mobile.
- [x] Có commit checkpoint hoàn tác được.

## 9. Kiểm thử

- Static validator kiểm tra JavaScript syntax, duplicate ID, element reference, right-panel target và bilingual labels.
- Manual review cho hierarchy, trademark/IP guardrail và traceability với chức năng đã chốt.
- Browser visual regression sẽ chạy lại trong Feature 0.4 khi app shell cho phép test local theo policy.

## 10. Phạm vi ảnh hưởng

- Bổ sung đầu vào cho Feature 0.4 và 2.1–2.7.
- Không thay đổi runtime manifest, credential, lab, governance lock hoặc production state.
- Prototype ngoài repo không được đóng gói cùng sản phẩm.

## 11. Rollback

Revert commit docs-only và bỏ prototype thử nghiệm. Không cần migration.

## 12. Bằng chứng hoàn thành

- Commit checkpoint: `97ab9fc` (`docs: define editorial UX direction`).
- Product Owner acceptance: yêu cầu điều chỉnh theo tinh thần Hermes Agent ngày 2026-08-11.
- Reviewer: Codex self-review; independent visual/brand review còn thiếu.
