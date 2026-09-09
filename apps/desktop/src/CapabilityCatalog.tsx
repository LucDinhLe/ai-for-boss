import { capabilityRole, providerRole } from './capability-role';
import { useEffect, useRef, useState } from 'react';
import { manage, type NativeCatalogue, type PluginCatalogue, type PluginToggleResult } from './workbench-api';
import { WorkbenchIcon } from './WorkspaceSidebar';
import BrandIcon from './BrandIcon';
import { compareProviders, providerSearchText, providerFamily } from './provider-order';
import { createCapabilityCatalogReader, type CapabilityEntry as Entry, type CapabilityKind as Kind } from './capability-catalog-data';

type Detect = { manualProviders?: Entry[]; authOptions?: Entry[]; prepareOptions?: Entry[]; unavailableCandidates?: (Entry & { reason?: string })[] };
const catalogueReader = createCapabilityCatalogReader({
  catalogue: () => manage<NativeCatalogue>({ action: 'catalog' }),
  live: async kind => {
    if (kind === 'providers') {
      const result = await window.aiForBoss!.setup.request('openclaw.setup.detect', {}) as Detect;
      const unique = new Map<string, Entry>();
      for (const item of [...(result.manualProviders ?? []), ...(result.authOptions ?? []), ...(result.prepareOptions ?? []), ...(result.unavailableCandidates ?? [])]) {
        const row = item as Entry & { hint?: string; reason?: string };
        if (!unique.has(row.id)) unique.set(row.id, { id: row.id, brandId: row.brandId, label: row.label, description: row.hint || row.description || row.reason });
      }
      return { entries: [...unique.values()] };
    }
    if (kind === 'plugins') {
      const result = await manage<PluginCatalogue>({ action: 'plugin-inventory' });
      return { entries: result.plugins, mutationAllowed: result.mutationAllowed };
    }
    return { entries: (await manage<{ servers: Entry[] }>({ action: 'mcp-inventory' })).servers.map(item => ({ ...item, label: item.id })) };
  }
});
export default function CapabilityCatalog({ kind, ready, connectedProviders = [], onConnect, mutationDisabled = false }: {
  kind: Kind; ready: boolean; connectedProviders?: string[]; onConnect?(query?: string): void; mutationDisabled?: boolean;
}) {
  const [catalog, setCatalog] = useState(() => catalogueReader.snapshot(kind).catalogue), [live, setLive] = useState(() => catalogueReader.snapshot(kind).entries);
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [mutationAllowed, setMutationAllowed] = useState(false), [busyId, setBusyId] = useState(''), [report, setReport] = useState('');
  const mutationLock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    void Promise.resolve().then(async () => {
      if (!current) return;
      setLoading(true); setMutationAllowed(false); setError('');
      setLive(catalogueReader.snapshot(kind).entries);
      const reads = catalogueReader.read(kind, ready);
      const results = await Promise.allSettled([
        reads.catalogue.then(snapshot => { if (current) setCatalog(snapshot); }),
        reads.live.then(result => { if (current && result) { setLive(result.entries); setMutationAllowed(result.mutationAllowed === true); } })
      ]);
      if (current) {
        if (results.some(result => result.status === 'rejected')) {
          setError('Chưa cập nhật được trạng thái. Danh mục và thông tin lần đọc trước vẫn có thể xem; anh thử tải lại.');
          setMutationAllowed(false);
        }
        setLoading(false);
      }
    });
    return () => { current = false; };
  }, [kind, ready, revision]);
  const toggle = async (item: Entry) => {
    if (mutationLock.current || mutationDisabled || !ready || loading || !mutationAllowed) return;
    mutationLock.current = true; setBusyId(item.id); setError(''); setReport('');
    try {
      const result = await manage<PluginToggleResult>({ action: 'plugin-toggle', pluginId: item.id, enabled: !item.enabled });
      catalogueReader.updatePlugin(result.plugin);
      if (!mounted.current) return;
      setLive(rows => rows?.map(row => row.id === item.id ? result.plugin : row) ?? null);
      setReport(`${item.label}: ${result.plugin.enabled ? 'đã bật' : 'đã tắt'}.${result.restartRequired ? ' Dừng rồi Tiếp tục Gateway để áp dụng. Việc đang chạy sẽ bị ngắt.' : ''}${result.warnings.length ? ' ' + result.warnings.join(' ') : ''}`);
    } catch (caught) { if (mounted.current) setError(caught instanceof Error ? caught.message : 'Chưa xác nhận thay đổi. Tải lại để kiểm tra.'); }
    finally { mutationLock.current = false; if (mounted.current) setBusyId(''); }
  };
  const merged = new Map<string, Entry>((kind === 'mcp' ? [] : catalog?.[kind] ?? []).map(item => [item.id, item]));
  for (const row of ready ? live ?? [] : []) merged.set(row.id, { ...merged.get(row.id), ...row });
  const entries = [...merged.values()].filter(item => `${item.id} ${item.label} ${item.description} ${kind === 'providers' ? providerSearchText(item.brandId || item.id) : ''} ${capabilityRole(`${item.id} ${item.description}`)}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  if (kind === 'providers') entries.sort((a, b) => compareProviders(a.brandId || a.id, b.brandId || b.id) || a.label.localeCompare(b.label));
  const icon = kind === 'providers' ? 'model' : kind === 'mcp' ? 'plug' : 'plugin';
  return <section className="capability-catalog" aria-label={`Danh mục ${kind}`}>
    <p className="settings-lead">{kind === 'mcp' ? 'MCP nối trợ lý với công cụ và dữ liệu bên ngoài. Danh sách dưới đây là các máy chủ đã cấu hình trong OpenClaw.' : `Danh mục của OpenClaw ${catalog?.version ?? ''}. Có trong bộ chạy chưa đồng nghĩa đã kết nối hoặc được cấp quyền sử dụng.`}</p>
    <div className="catalog-actions"><label className="catalog-search"><WorkbenchIcon name="search" /><input aria-label="Tìm trong danh mục" placeholder="Tìm tên hoặc năng lực…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button disabled={loading || Boolean(busyId)} onClick={() => { setLoading(true); setMutationAllowed(false); setError(''); setRevision(n => n + 1); }}><WorkbenchIcon name="reload" />Tải lại</button>
      {onConnect && <button disabled={!ready} onClick={() => onConnect()}><WorkbenchIcon name="plug" />Kết nối AI</button>}</div>
    {loading && <p role="status">{live && ready ? 'Đang cập nhật trạng thái… Thông tin dưới đây là lần đọc trước.' : 'Đang đọc danh mục…'}</p>}{error && <p role="alert">{error}</p>}
    {report && <p role="status" className="notice">{report}</p>}
    {!ready && <p>Bật Gateway để xem trạng thái hiện tại và thiết lập kết nối.</p>}
    {kind === 'providers' && ready && connectedProviders.length > 0 && <p><WorkbenchIcon name="check" /> Đang có mô hình khả dụng: {connectedProviders.join(', ')}.</p>}
    {kind === 'mcp' && <p>Danh sách cấu hình không chứng minh máy chủ đang hoạt động hoặc phiên được phép dùng công cụ. Kết nối do plugin quản lý riêng có thể không nằm trong danh sách này. Thêm, sửa và đăng nhập MCP chưa được mở trong bản thử.</p>}
    {kind === 'plugins' && <p>Bật hoặc tắt plugin đã có trên máy. Quyền sử dụng công cụ vẫn theo phiên; plugin cần cài thêm được ghi rõ bên dưới.</p>}
    <small>{entries.length} mục{query ? ' phù hợp' : ''}</small>
    <ul className="native-list catalog-list">{entries.map(item => <li key={item.id}><span className="capability-icon">{kind === 'providers' ? <BrandIcon id={item.brandId || item.id} label={item.label} /> : <WorkbenchIcon name={icon} />}</span><div className="catalog-copy"><strong>{item.label || item.id}</strong>
      <p>{kind === 'providers' ? providerRole(item.id) : capabilityRole(`${item.id} ${item.description ?? ''} ${item.category ?? ''} ${kind === 'mcp' ? 'mcp' : ''}`)}</p>
      {item.description && <details><summary>Mô tả từ OpenClaw</summary><p>{item.description}</p></details>}
      <small>{kind === 'mcp' ? `${item.transport === 'stdio' ? 'Công cụ chạy cục bộ' : 'Dịch vụ kết nối từ xa'} · ${item.enabled ? 'Được bật trong cấu hình' : 'Đang tắt'}`
        : item.state ? ({ enabled: 'Được bật', disabled: 'Đang tắt', 'not-installed': 'Chưa cài', error: 'Có lỗi', unknown: 'Chưa xác nhận' }[item.state] ?? 'Chưa xác nhận')
          : item.bundled ? 'Có trong bộ chạy · trạng thái chưa xác nhận' : live?.some(row => row.id === item.id) ? 'Có trong trình kết nối của lõi' : 'Có trong tài liệu lõi · có thể cần plugin hoặc thiết lập thêm'}</small>
    </div>{kind === 'providers' && onConnect && <button disabled={!ready} onClick={() => onConnect(providerFamily(item.brandId || item.id))}><WorkbenchIcon name="plug" />Thiết lập</button>}
      {kind === 'plugins' && item.installed && <button disabled={!ready || loading || Boolean(busyId) || !mutationAllowed || mutationDisabled} onClick={() => void toggle(item)}><WorkbenchIcon name={item.enabled ? 'stop' : 'play'} />{busyId === item.id ? 'Đang lưu…' : item.enabled ? 'Tắt plugin' : 'Bật plugin'}</button>}
    </li>)}</ul>
    {!loading && !entries.length && <p>{query ? 'Không có mục phù hợp.' : kind === 'mcp' && live ? 'Chưa có máy chủ MCP được cấu hình.' : 'Chưa có danh sách được xác nhận.'}</p>}
  </section>;
}
