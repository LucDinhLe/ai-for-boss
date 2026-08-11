# Security Policy

AI for Boss đang ở giai đoạn nền móng và chưa có bản phát hành công khai.

## Báo cáo lỗ hổng

Không đăng secret, dữ liệu cá nhân hoặc chi tiết khai thác lên issue công khai. Hãy báo trực tiếp cho chủ repo qua kênh riêng đã thống nhất. Kênh disclosure chính thức và SLA vá lỗi phải được chốt trước Cổng 6.

## Phạm vi hiện tại

- Repo private.
- Không có production environment.
- Không dùng credential hoặc dữ liệu thật.
- Host exec, elevated, remote browser và plugin chưa kiểm duyệt chưa được phép triển khai.

## Xử lý nghi ngờ rò rỉ

1. Dừng phát hành và cô lập artifact liên quan.
2. Thu hồi credential có khả năng bị ảnh hưởng.
3. Lưu bằng chứng sạch secret.
4. Xác định phạm vi ảnh hưởng và owner.
5. Sửa, kiểm thử hồi quy và ghi incident report.
