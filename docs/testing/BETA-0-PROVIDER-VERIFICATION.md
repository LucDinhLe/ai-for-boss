# Beta 0 — kiểm chứng nhà cung cấp model thật

Hai câu hỏi của bước Kết nối chỉ trả lời được khi có một nhà cung cấp (provider) thật, và cả hai phải trả lời bằng bằng chứng chạy được chứ không bằng ảnh chụp màn hình.

1. Luồng xác thực có chạy trọn vẹn từ danh mục, qua trình hướng dẫn (wizard), tới bước kiểm tra kết nối hay không.
2. Sau khi kích hoạt, runtime của trợ lý có thoát khỏi mặc định hỏng `codex` hay chưa, tức là một lượt chat có thật sự chạm tới model (R-032).

`scripts/provider-verify.mjs` chạy đúng những mô-đun mà ứng dụng desktop đang dùng, gồm Supervisor, SetupChannel và GatewayAdapter, ở chế độ không giao diện, rồi ghi lại một tệp bằng chứng đã lọc bí mật.

## Chuẩn bị

- Node phải nằm trong khoảng OpenClaw chấp nhận, hiện là `>=22.22.3 <23`, `>=24.15.0 <25` hoặc `>=25.9.0`. Kho này ghim `24.19.0`. Node cũ hơn làm tiến trình con thoát ngay và Supervisor dừng ở Safe Mode sau ba lần thử, thông điệp gốc nằm trong `childLog` của tệp bằng chứng.
- Thư mục trạng thái mặc định là một thư mục tạm mới, nên mỗi lần chạy là một máy sạch. Muốn giữ phiên đăng nhập giữa các lần chạy thì truyền `--state-dir`, thêm `--fresh` khi cần xoá sạch.
- Trên Windows, mọi đường dẫn được giải sang dạng dài trước khi trao cho tiến trình con, theo R-034. Không cần làm gì thêm.

## Xem lõi đang có những đường kết nối nào

```bash
node scripts/provider-verify.mjs --list
```

Lệnh này không cần khoá và không đụng tới cấu hình. Nó in ra hai nhóm, ứng viên tự phát hiện trên máy và nhà cung cấp khai báo tay, kèm đúng cờ để dùng ở bước sau. Danh sách do OpenClaw trả về lúc chạy, nên nó đổi theo phiên bản lõi và theo plugin đã cài.

## Chạy trọn luồng với một khoá API

```bash
AIFB_PROVIDER_SECRET='<khoá>' node scripts/provider-verify.mjs --provider <id>
```

Khoá chỉ đi qua biến môi trường. Harness cố ý không có cờ dòng lệnh nào nhận khoá, vì tham số dòng lệnh hiện ra trong danh sách tiến trình của cả máy.

Chính sách trả lời tự động cho từng loại bước như sau. Bước ghi chú, tiến trình và xác nhận được chấp nhận. Bước chọn lấy phương án được lõi khuyến nghị, không có khuyến nghị thì lấy phương án đầu. Bước nhập bí mật lấy giá trị từ biến môi trường. Bước nhập tự do và bước hành động dừng lại chờ người, vì đoán ở đó là đoán mù. Muốn ghi đè bất kỳ bước nào thì thêm `--answer <stepId>=<giá trị>`.

## Chạy luồng cần thao tác tay, ví dụ đăng nhập trên trình duyệt

```bash
node scripts/provider-verify.mjs --candidate <kind> --interactive
```

Chế độ này in nguyên văn từng bước rồi chờ bạn gõ. Dùng nó cho đường đăng nhập bằng trình duyệt, mã thiết bị (device code), hoặc khi kích hoạt một công cụ dòng lệnh đã đăng nhập sẵn trên máy.

## Đọc kết quả

Tệp bằng chứng nằm ở `artifacts/beta-0/provider-verify-<nền-tảng>-<kiến-trúc>.json`. Các trường đáng đọc trước:

- `wizard.steps` ghi id, loại, tiêu đề và nguồn câu trả lời của từng bước, không ghi giá trị đã trả lời.
- `verify` là kết quả `openclaw.setup.verify`, tức lõi tự gọi thử model một lượt.
- `agentRuntime.before` và `agentRuntime.after` cho thấy runtime của trợ lý trước và sau khi kích hoạt.
- `chatTurn` ghi một lượt chat thật qua kênh chat của ứng dụng.
- `r032` tổng kết hai điều, runtime đã rời `codex` chưa và lượt chat có chạm tới model không.

Bước Kết nối chỉ được coi là đóng khi `verify.ok` đúng, `chatTurn.replied` đúng, và `failures` rỗng. Thiếu một trong ba thì R-032 vẫn mở.

## Điều harness không bao giờ ghi

Mọi thứ ra khỏi tiến trình đều đi qua bộ lọc, khoá tên chứa `key`, `token`, `secret`, `password`, `credential`, `authorization`, `cookie` hay `bearer` bị thay bằng `[redacted]`. Câu trả lời cho các bước bí mật không được ghi lại dưới bất kỳ dạng nào. Kiểm chứng nằm ở `tests/unit/provider-verify.test.mjs`.

## Ghi chú vận hành

Harness không ghi cứng tên nhà cung cấp nào, đúng như D-0022. Nó cũng không tự mở kết nối riêng, mọi lời gọi đều đi qua danh sách cho phép của kênh chat và kênh cài đặt, nên thứ nó chứng minh được đúng là thứ ứng dụng làm được.
