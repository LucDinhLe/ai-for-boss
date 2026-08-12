# Ma trận xác thực provider

Ngày khóa: 2026-08-11

Release train: `oc-2026.7.1-2-locked.1`

Nguồn máy đọc được: [auth-support.manifest.json](../../manifests/providers/auth-support.manifest.json)

## 1. Kết quả

| Provider | Phương thức | Mức upstream | Readiness AI for Boss | Nhãn người dùng |
|---|---|---|---|---|
| OpenAI | API key | Production | Chỉ có tài liệu | Khuyến nghị cho chi phí theo lượt dùng |
| OpenAI | ChatGPT/Codex OAuth | Production | Chỉ có tài liệu | Đăng nhập ChatGPT/Codex |
| OpenAI | Device code | Có điều kiện | Chỉ có tài liệu | Dùng khi callback trình duyệt không phù hợp |
| Anthropic | API key | Production | Chỉ có tài liệu | Khuyến nghị cho vận hành ổn định |
| Anthropic | Claude CLI credential | Có điều kiện | Chỉ có tài liệu | Claude Pro/Max qua Claude Code |
| Google | Gemini API key | Production | Chỉ có tài liệu | Khuyến nghị |
| Google | Gemini CLI OAuth | Thử nghiệm | Bị chặn | Chỉ hiện ở Nâng cao với cảnh báo |
| Provider plugin | Plugin-owned | Có điều kiện | Bị chặn | Cần kiểm tra plugin |
| Local model | Không auth | Có điều kiện | Chỉ có tài liệu | Tùy runtime và cấu hình máy |

Không có phương thức nào được ghi `live-tested` hoặc có nền tảng đã test. Điều này đúng với phạm vi Feature 0.3, vì chưa dùng tài khoản chuyên dụng và chưa viết connector.

## 2. Luật lưu credential

- Static API key dự kiến dùng OS key store qua SecretRef Broker sau contract test Windows, macOS và Linux.
- OAuth/device token tiếp tục thuộc OpenClaw native auth store của profile riêng.
- Claude/Gemini CLI credential thuộc external CLI store; AI for Boss chỉ đọc trạng thái qua contract được phép, không sao chép token.
- Plugin-owned auth bị chặn cho tới khi provenance, permission, storage, revoke và terms đều được review.
- Không có plaintext fallback; không đưa secret vào renderer, command line, log, crash report, telemetry hoặc support bundle.

## 3. Điều kiện bật production

Một auth mode chỉ được bật production sau khi đủ năm bằng chứng:

1. Đường upstream tồn tại ở đúng release train.
2. Điều khoản provider được kiểm tra gần ngày phát hành.
3. Live probe đạt bằng tài khoản test chuyên dụng, quyền tối thiểu và giới hạn chi phí.
4. Disconnect/revoke flow đạt.
5. Kiểm thử xác nhận secret không xuất hiện ở renderer, argv, log, crash dump hoặc support bundle.

Nếu một điều kiện thiếu, connector giữ tắt. AI for Boss không đổi provider, model hoặc auth mode âm thầm.
