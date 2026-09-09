import { useEffect, useState } from 'react';
import { manage, type ToolInventory } from './workbench-api';
import { WorkbenchIcon } from './WorkspaceSidebar';
import { capabilityRole } from './capability-role';

export default function ToolCatalog({ ready, sessionKey }: { ready: boolean; sessionKey: string | null }) {
  const [data, setData] = useState<ToolInventory | null>(null), [query, setQuery] = useState(''), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    if (ready) void manage<ToolInventory>({ action: 'tool-inventory', ...(sessionKey ? { sessionKey } : {}) })
      .then(result => { if (current) setData(result); }).catch(() => { if (current) setError('Chưa đọc được công cụ. Tải lại khi kết nối ổn định.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [ready, sessionKey, revision]);
  const tools = data?.tools.filter(tool => `${tool.label} ${tool.id} ${tool.description}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))) ?? [];
  return <section className="capability-catalog" aria-label="Công cụ của phiên">
    <p className="settings-lead">{sessionKey ? 'Công cụ và quyền thực tế của cuộc trò chuyện đang chọn, do OpenClaw xác nhận.' : 'Mở một cuộc trò chuyện để kiểm tra công cụ được phép dùng trong phiên đó.'}</p>
    <div className="catalog-actions"><label className="catalog-search"><WorkbenchIcon name="search" /><input aria-label="Tìm công cụ" placeholder="Tìm tên hoặc công việc…" value={query} onChange={e => setQuery(e.target.value)} /></label><button disabled={!ready || loading} onClick={() => { setLoading(true); setData(null); setError(''); setRevision(n => n + 1); }}><WorkbenchIcon name="reload" />Tải lại công cụ</button></div>
    {!ready ? <p>Bật Gateway để xem công cụ.</p> : loading ? <p role="status">Đang kiểm tra quyền và công cụ…</p> : null}
    {error && <p role="alert">{error}</p>}
    {data && <><p>{data.effective ? 'Quyền của phiên đã được xác nhận' : 'Danh mục chung; chưa xác nhận quyền của phiên'} · {tools.length} công cụ{data.profile ? ` · ${data.profile}` : ''}</p>
      {data.notices.map(n => <p key={n.id} className="notice">{n.message}</p>)}
      <ul className="native-list catalog-list">{tools.map(tool => <li key={tool.id}><span className="capability-icon"><WorkbenchIcon name={tool.source === 'mcp' ? 'plug' : tool.source === 'channel' ? 'messages' : 'skills'} /></span><div className="catalog-copy"><strong>{tool.label || tool.id}</strong><p>{capabilityRole(`${tool.id} ${tool.description}`)}</p><details><summary>Mô tả công cụ</summary><p>{tool.description || tool.id}</p></details><small>{tool.deniedBySession ? 'Bị giới hạn trong phiên' : data.effective ? 'Có trong tập công cụ hiệu lực' : 'Có trong danh mục'} · {tool.pluginId || tool.mcpServer || tool.source}</small></div></li>)}</ul>
      {!tools.length && <p>{query ? 'Không có công cụ phù hợp.' : 'Phiên hiện chưa được cấp công cụ. Bạn vẫn có thể trao đổi và gửi tài liệu cho mô hình.'}</p>}</>}
  </section>;
}
