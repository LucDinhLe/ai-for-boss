// Hợp đồng desktop ↔ lõi: số REQUIRED_BACKEND_CONTRACT của vỏ phải bằng đúng
// DESKTOP_BACKEND_CONTRACT của lõi ghim trong engine.lock. Lệch số là lý do bản
// 2026.9.4 hiện cảnh báo "Dịch vụ nền đã cũ" lặp lại (vỏ đòi 7, lõi 8.31 báo 6).

export function parseEngineContract(serverPy) {
  const m = /^DESKTOP_BACKEND_CONTRACT\s*=\s*(\d+)\s*$/m.exec(serverPy)
  return m ? Number(m[1]) : null
}

export function parseShellContract(updatesTs) {
  const m = /^(?:export\s+)?const\s+REQUIRED_BACKEND_CONTRACT\s*=\s*(\d+)\s*$/m.exec(updatesTs)
  return m ? Number(m[1]) : null
}

/** Trả về null khi khớp, ngược lại là thông báo lỗi. */
export function contractMismatch(serverPy, updatesTs) {
  const engine = parseEngineContract(serverPy)
  const shell = parseShellContract(updatesTs)

  if (engine === null) return 'không đọc được DESKTOP_BACKEND_CONTRACT trong tui_gateway/server.py của lõi'
  if (shell === null) return 'không đọc được REQUIRED_BACKEND_CONTRACT trong apps/desktop/src/store/updates.ts'
  if (engine !== shell) return `vỏ đòi contract ${shell} nhưng lõi ghim báo ${engine}`

  return null
}
