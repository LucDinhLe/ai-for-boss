# Feature 0.5 QA evidence

Các ảnh trong thư mục này được tạo từ production renderer bundle bằng dữ liệu
fixture, không có credential hoặc network:

- `first-run-1440x900.png`: Bước 1, Việt, giao diện sáng.
- `first-run-1024x768.png`: Bước 2 sau khi chọn fixture Google, selector đã khóa.
- `first-run-step-3-980x680.png`: Bước 3 ở viewport nhỏ nhất của app.
- `first-run-complete-1440x900-dark-en.png`: Hoàn tất mẫu, Anh, giao diện tối,
  Genesis vẫn `STAGING` và sample plan có ba bước.

Tái tạo harness bằng `corepack pnpm run qa:prepare`, phục vụ repo cục bộ rồi đi
xuyên hành trình bằng browser automation. QA đã kiểm tra lỗi input chỉ khoảng
trắng, chuyển ngôn ngữ/theme, state/model nhất quán và không tràn ngang ở ba
viewport. Đây không phải human usability test, screen-reader run, live Gateway,
OAuth, OpenClaw runtime hoặc bằng chứng artifact đã ký.
