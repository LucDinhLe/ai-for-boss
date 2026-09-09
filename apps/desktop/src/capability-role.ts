// Explanatory labels only; discovery and availability always come from the pinned core.
export function capabilityRole(value: string) {
  const rules: [RegExp, string][] = [
    [/mcp|mcporter/i, 'Kết nối các công cụ và nguồn dữ liệu bên ngoài qua MCP.'],
    [/speech|transcri|audio|tts|voice|whisper/i, 'Chuyển đổi giọng nói, âm thanh và văn bản.'],
    [/image|video|music|comfy|fal/i, 'Tạo hoặc xử lý hình ảnh, video và nội dung đa phương tiện.'],
    [/memory|remember|embedding|lancedb/i, 'Tìm lại kiến thức và thông tin đã lưu để hỗ trợ cuộc trò chuyện.'],
    [/browser|web search|search provider|tavily|perplexity|brave|firecrawl/i, 'Tìm kiếm thông tin và làm việc với nội dung trên web.'],
    [/channel|telegram|slack|discord|zalo|whatsapp|messag/i, 'Kết nối kênh nhắn tin, nhận và trả lời theo quyền đã thiết lập.'],
    [/model|provider|llm|inference|codex|claude|gemini|ollama/i, 'Kết nối mô hình AI để trao đổi, phân tích và thực hiện công việc.'],
    [/document|pdf|office|xlsx|docx|pptx/i, 'Đọc hoặc xử lý tài liệu và tệp làm việc.'],
    [/github|gitlab|coding|code|acp/i, 'Hỗ trợ phát triển phần mềm và quản lý công việc với mã nguồn.'],
    [/mail|himalaya/i, 'Làm việc với thư điện tử và nội dung hộp thư.'],
    [/calendar|schedule|cron|remind/i, 'Quản lý lịch, lời nhắc và công việc định kỳ.'],
    [/security|vault|pair|auth|key|permission/i, 'Quản lý kết nối, danh tính hoặc quyền truy cập.'],
    [/file|transfer/i, 'Trao đổi và quản lý tệp trên các thiết bị được cấp quyền.']
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? 'Bổ sung năng lực cho trợ lý; xem mô tả gốc để biết phạm vi cụ thể.';
}

// Provider descriptions often contain "messages" or "image" as API nouns;
// those do not turn a model provider into a messaging channel or image editor.
export function providerRole(id: string) {
  if (/speech|elevenlabs|deepgram|whisper|tts/.test(id)) return 'Chuyển giọng nói thành văn bản hoặc tạo giọng đọc qua dịch vụ AI.';
  if (/comfy|fal|replicate/.test(id)) return 'Kết nối dịch vụ tạo và xử lý nội dung đa phương tiện.';
  if (/ollama|lmstudio|llama-cpp/.test(id)) return 'Kết nối mô hình chạy trên máy hoặc máy chủ do bạn quản lý.';
  if (/openrouter|gateway|clawrouter/.test(id)) return 'Truy cập các mô hình AI qua một dịch vụ kết nối chung.';
  return 'Cung cấp mô hình AI cho trò chuyện, phân tích và xử lý yêu cầu.';
}
