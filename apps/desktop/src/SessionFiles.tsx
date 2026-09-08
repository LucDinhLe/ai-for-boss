import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionFile, listSessionFiles, type FilePreview, type SessionFile, type SessionFileList } from "./workbench-api";

type Props = { sessionKey: string | null; ready: boolean; mode?: "browser" | "artifacts" };
export default function SessionFiles({ sessionKey, ready, mode = "browser" }: Props) {
  if (!ready) return <p className="empty-state">Kết nối bộ chạy để xem tệp.</p>;
  if (!sessionKey) return <p className="empty-state">Chọn một phiên để xem tệp của phiên đó.</p>;
  return <FileBrowser key={`${sessionKey}:${mode}`} sessionKey={sessionKey} mode={mode} />;
}

function FileBrowser({ sessionKey, mode: initialMode }: { sessionKey: string; mode: "browser" | "artifacts" }) {
  const [mode, setMode] = useState(initialMode);
  const [path, setPath] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [listing, setListing] = useState<SessionFileList | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const epoch = useRef(0);
  const invalidate = useCallback(() => { epoch.current++; }, []);
  useEffect(() => {
    let current = true;
    const token = ++epoch.current;
    listSessionFiles(sessionKey, path, search).then(value => {
      if (current && token === epoch.current) { setListing(value); setLoading(false); }
    }).catch(() => {
      if (current && token === epoch.current) { setError("Chưa đọc được danh sách tệp. Bạn có thể tải lại."); setLoading(false); }
    });
    return () => { current = false; invalidate(); };
  }, [sessionKey, path, search, revision, invalidate]);
  const reset = () => {
    epoch.current++; setPreview(null); setError(""); setReading(false); setListing(null); setLoading(true);
  };
  const open = async (file: SessionFile) => {
    if (!listing) return;
    if (file.kind === "directory") { reset(); setPath(file.path); setSearch(""); setQuery(""); return; }
    if (file.kind !== "file" || file.missing) return;
    const token = ++epoch.current;
    setPreview(null); setError(""); setReading(true);
    try {
      const result = await getSessionFile(listing, file);
      if (token === epoch.current) setPreview(result);
    } catch {
      if (token === epoch.current) setError("Không xem được tệp này. Tệp có thể đã đổi, bị giới hạn quyền hoặc vượt 256 KB.");
    } finally {
      if (token === epoch.current) setReading(false);
    }
  };
  const entries = mode === "artifacts" ? listing?.files.filter(file => file.modified) ?? [] : listing?.entries ?? [];
  return <section className="files-browser" aria-label={mode === "artifacts" ? "Tệp kết quả của phiên" : "Tệp của phiên"}>
    <div className="files-toolbar">
      <button type="button" aria-pressed={mode === 'browser'} onClick={() => { reset(); setPath(''); setSearch(''); setQuery(''); setMode('browser'); setRevision(v => v + 1); }}>Tất cả</button>
      <button type="button" aria-pressed={mode === 'artifacts'} onClick={() => { reset(); setPath(''); setSearch(''); setQuery(''); setMode('artifacts'); setRevision(v => v + 1); }}>Kết quả</button>
      <button type="button" onClick={() => { reset(); setRevision(value => value + 1); }} disabled={loading}>Tải lại</button>
      {mode === "browser" && listing?.parentPath !== null && listing?.parentPath !== undefined && <button type="button" onClick={() => {
        const parent = listing.parentPath!; reset(); setPath(parent); setSearch(""); setQuery("");
      }}>Lên một thư mục</button>}
    </div>
    {mode === "browser" && <form className="files-search" onSubmit={event => {
      event.preventDefault(); reset(); setSearch(query.trim()); setRevision(value => value + 1);
    }}>
      <input aria-label="Tìm tệp trong phiên" placeholder="Tìm tệp…" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} />
      <button type="submit" disabled={loading}>Tìm</button>
    </form>}
    {mode === "artifacts" && <p className="page-description">Các tệp được runtime ghi nhận đã tạo hoặc sửa trong phiên này.</p>}
    {path && mode === "browser" && <p className="files-path">{path}</p>}
    {loading ? <p role="status">Đang đọc danh sách…</p> : !error && entries.length === 0 && <p className="empty-state">{mode === "artifacts" ? "Phiên chưa có tệp kết quả được ghi nhận." : "Chưa có tệp trong mục này."}</p>}
    <ul className="native-list file-list">{entries.map((file, index) => <li key={`${file.path}:${index}`}>
      <button type="button" className="file-entry" disabled={file.missing || file.kind === "symlink"} onClick={() => void open(file)}>
        <span aria-hidden="true">{file.kind === "directory" ? "▸" : "·"}</span> <span>{file.name}</span>
        <small>{file.missing ? "Không còn tệp" : file.kind === "symlink" ? "Liên kết không xem được" : file.modified ? "Đã sửa" : ""}</small>
      </button>
    </li>)}</ul>
    {listing?.truncated && <p role="status">Danh sách đã được giới hạn. Hãy tìm tên cụ thể hoặc mở thư mục con.</p>}
    {reading && <p role="status">Đang xem tệp…</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    {preview && <section className="file-preview" aria-label="Xem trước tệp">
      <div className="files-toolbar"><strong>{preview.name}</strong><button type="button" onClick={() => { epoch.current++; setPreview(null); }}>Đóng</button></div>
      {preview.kind === "text" ? <pre>{preview.content}</pre> : preview.kind === "image" && preview.imageUrl
        ? <img src={preview.imageUrl} alt={preview.name} /> : <p>Định dạng này chưa có bản xem trước.</p>}
    </section>}
  </section>;
}
