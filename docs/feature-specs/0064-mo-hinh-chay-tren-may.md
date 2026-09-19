# 0064 — Mô hình chạy thẳng trên máy

Trạng thái: Draft, chờ Product Owner duyệt. Mở ngày 2026-09-19.

Tách khỏi 0063 vì 0063 nằm trọn trong renderer và không đổi hợp đồng IPC, còn
feature này phải cài plugin lúc chạy, tải nhiều GB và dò phần cứng. Hai blast
radius khác hẳn nhau, không gộp một spec.

## Vấn đề

Product Owner đối chiếu với AICoworker trên cùng máy ngày 19/09: bên đó có một
thẻ **Local LLM (on-device)** gắn nhãn "Built-in · native", chạy mô hình mở qua
llama.cpp, không cần khoá API, không cần mây. Thẻ có một dòng "Auto-optimize for
this PC" gợi ý đúng mô hình hợp với máy kèm một nút Apply, rồi tới danh sách mô
hình tải được kèm dung lượng.

AI for Boss chưa có gì tương đương. Với khách doanh nghiệp nhỏ Việt Nam, đây
không phải tính năng phụ: nó là câu trả lời cho hai câu hỏi hay gặp nhất — "dữ
liệu của tôi có ra ngoài không" và "không trả phí hàng tháng thì có dùng được
không".

## Lõi đã có sẵn gì

Đối chiếu `apps/desktop/electron/native-catalog.json` ngày 19/09:

- `llama-cpp` → gói `@openclaw/llama-cpp-provider`, mô tả "Managed and external
  llama.cpp servers for GGUF chat and embeddings", `"bundled": false`.
- `ollama` → gói `@openclaw/ollama-provider`, hỗ trợ Ollama và Ollama Cloud,
  `"bundled": false`.

Nghĩa là **không phải tự viết bộ chạy**. Nhưng `bundled: false` nghĩa là plugin
chưa đi kèm ứng dụng, nên trước khi thẻ này dùng được thì phải có đường cài
plugin — thứ mà vỏ hiện chưa làm ở bất cứ đâu.

## Cần trả lời trước khi viết mã

Spec này chưa đủ dữ kiện để chốt quyết định. Các câu phải đo trước:

1. **Cài plugin lúc chạy bằng đường nào.** Lõi có lệnh cài plugin qua Gateway
   không, hay phải cài ở tầng gói Node của host? Nếu là đường thứ hai thì đây là
   việc của bộ cài chứ không phải của vỏ, và phạm vi spec đổi hẳn.
2. **Chọn `llama-cpp` hay `ollama`.** `ollama` cần một ứng dụng riêng đã cài trên
   máy; `llama-cpp` do lõi tự nuôi tiến trình. Hai lựa chọn này cho hai trải
   nghiệm cài đặt rất khác nhau.
3. **Dò phần cứng lấy ở đâu.** Câu "máy này chạy được mô hình nào" cần biết RAM,
   VRAM và GPU. Lõi có trả về không, hay vỏ phải tự dò — và nếu vỏ tự dò thì đó
   là một bề mặt mới cần review bảo mật.
4. **Tải mô hình vài GB đặt ở đâu và ai dọn.** Liên quan trực tiếp tới lỗi 14
   file `Uninstall-0.0.5-beta.*.exe` còn sót: nếu gỡ ứng dụng mà để lại 7 GB mô
   hình trên ổ của khách thì đó là lỗi nặng hơn nhiều.

## Ràng buộc đã biết

- Không hứa trước khi đo. R-025: không được để tài liệu hay giao diện nói rằng
  mô hình local đã chạy được, khi mới chỉ có tên plugin trong danh mục.
- Không tự viết đường chạy mô hình nào lõi không có. D-0022 giữ nguyên.
- Mô hình chạy trên máy **không** tự động nghĩa là an toàn hơn. Nó bỏ được đường
  dữ liệu ra mây, nhưng thêm một tiến trình chạy dài và một thư mục nhiều GB do
  ứng dụng quản lý. Cả hai đều cần ghi vào RISKS.md trước khi bật.
- Chất lượng mô hình mở nhỏ kém xa mô hình trên mây. Giao diện phải nói thật
  điều đó, không để khách chọn nhầm rồi kết luận sản phẩm kém.

## Hình dạng giao diện đã chốt

Bản mẫu `https://claude.ai/artifact/Ybgsu4Uo9tYLHjtrVKqWoC`, khung "Sau", thẻ
cuối danh sách. Một thẻ nằm chung với các thẻ nhà cung cấp, huy hiệu trạng thái
riêng ("Chưa bật"), một dòng nói máy này chạy được gì kèm dung lượng phải tải, và
đúng một nút chính. 0063 đã chừa chỗ cho thẻ này.

## Bằng chứng hoàn thành

Điền khi xong. Trước đó, bốn câu ở mục "Cần trả lời" phải có câu trả lời ghi lại
được, kèm nguồn.
