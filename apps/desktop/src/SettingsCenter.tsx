import UpdateSettings from './UpdateSettings';
import DataSettings from './DataSettings';
import CapabilityCatalog from './CapabilityCatalog';
import ProviderSettings from './ProviderSettings';
import BrowserSettings from './BrowserSettings';
import ModelSettings from './ModelSettings';
import PromptOptimizerSettings from './PromptOptimizerSettings';
import ToolCatalog from './ToolCatalog';
import BrandNotices from './BrandNotices';
import { useEffect, useRef, useState } from 'react';
import { LayoutOptions } from './LayoutControls';
import type { LayoutPreferences } from './layout-preferences';
import { WorkbenchIcon } from './WorkspaceSidebar';
import ModelPicker from './ModelPicker';
import { isSelectableModel } from './chat-state';
import GatewayControl from './GatewayControl';
import { ContextMeter } from './WorkspaceControls';
import NativePage from './NativePage';
import type { ContextUsage, ModelSummary, RuntimeStatus } from './gateway-client';
import type { ProjectSummary, WorkspaceView } from './workbench-api';

const sections = [
  ['model', 'Mô hình', 'model'], ['chat', 'Trò chuyện', 'messages'], ['appearance', 'Giao diện', 'layout'],
  ['cache', 'Cache & cập nhật mô hình', 'reload'],
  ['data', 'Dữ liệu & sao lưu', 'files'],
  ['workspace', 'Không gian làm việc', 'projects'], ['browser', 'Trình duyệt & tiện ích', 'web'], ['safety', 'An toàn', 'shield'], ['memory', 'Bộ nhớ & bối cảnh', 'context'],
  ['voice', 'Giọng nói', 'voice'], ['advanced', 'Hệ thống & chẩn đoán', 'settings'], ['notifications', 'Thông báo', 'bell'],
  ['billing', 'Thanh toán & sử dụng', 'usage'], ['providers', 'Nhà cung cấp', 'model'], ['channels', 'Cổng kết nối', 'web'],
  ['shortcuts', 'Phím tắt bàn phím', 'keyboard'], ['tools', 'Công cụ & khóa API', 'key'], ['plugins', 'Plugin', 'plugin'], ['skills', 'Kỹ năng', 'skills'], ['mcp', 'MCP', 'plug'],
  ['history', 'Lịch sử trò chuyện', 'files'], ['about', 'Giới thiệu & cập nhật', 'info']
] as const;
type Section = typeof sections[number][0];
type Props = {
  runtime: RuntimeStatus; shell: ShellStatus | null; usage: ContextUsage; models: ModelSummary[];
  layout: LayoutPreferences; projects: ProjectSummary[]; sessionKey: string | null; modelDisabled: boolean; dataDisabled: boolean; pending: boolean;
  onLayout(value: LayoutPreferences): void; onModel(model: ModelSummary): void; onClose(): void;
  onConnect(query?: string): void; onNavigate(view: WorkspaceView): void; onRetry(): void; onRefreshInfo(): Promise<void>; onUseSkill(name: string): void;
  onBrowseModels?(refresh?: boolean): void; catalogueLoading?: boolean; catalogueError?: string | null;
};
export default function SettingsCenter(props: Props) {
  const [section, setSection] = useState<Section>('model'), [refreshing, setRefreshing] = useState(false), [report, setReport] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const title = sections.find(item => item[0] === section)![1];
  const model = props.models.find(item => item.provider === props.usage.modelProvider && item.id === props.usage.model);
  const modelLocked = props.modelDisabled || !props.sessionKey || props.pending;
  const connect = <button className="settings-primary" disabled={!props.runtime.connected || !props.runtime.setupReady || props.modelDisabled} onClick={() => props.onConnect()}><WorkbenchIcon name="plug" />Kết nối AI</button>;
  const gateway = <GatewayControl runtime={props.runtime} onRetry={props.onRetry} />;
  const open = (view: WorkspaceView) => props.onNavigate(view);
  const native = (view: WorkspaceView) => <NativePage view={view} projects={props.projects} ready={props.runtime.connected} activeKey={props.sessionKey}
    mutationsDisabled={props.modelDisabled || props.pending}
    onOpenProject={() => open('projects')} onRefreshProjects={() => open('projects')} onConnect={props.onConnect} onUseSkill={props.onUseSkill} />;
  const refresh = async () => { if (refreshing) return; setRefreshing(true); setReport('');
    try { await props.onRefreshInfo(); setReport('Đã làm mới thông tin bản đang chạy.'); }
    catch { setReport('Chưa đọc được thông tin mới. Anh thử lại sau.'); } finally { setRefreshing(false); } };
  return <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={event => { event.preventDefault(); props.onClose(); }}>
    <aside className="settings-nav"><div className="settings-brand"><WorkbenchIcon name="settings" /><strong>Cài đặt</strong></div>
      <nav aria-label="Danh mục cài đặt">{sections.map(([id, label, icon]) => <button key={id} type="button" aria-current={section === id ? 'page' : undefined}
        onClick={() => { setSection(id); setReport(''); }}><WorkbenchIcon name={icon} /><span>{label}</span></button>)}</nav>
      <span className="settings-version">AI for Boss · {props.shell?.product.version ?? 'Đang đọc phiên bản'}</span>
    </aside>
    <main className="settings-main"><header className="settings-heading"><h1 id="settings-title"><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />{title}</h1><button className="tool-icon" aria-label="Đóng cài đặt" title="Đóng cài đặt (Esc)" onClick={props.onClose}><WorkbenchIcon name="close" /></button></header>
      <div className="settings-body" key={section}>
        {section === 'browser' && <BrowserSettings ready={props.runtime.connected && props.runtime.setupReady} />}
        {section === 'cache' && <><ModelSettings ready={props.runtime.connected && props.runtime.setupReady} disabled={props.modelDisabled || props.pending} />
          <PromptOptimizerSettings ready={props.runtime.connected && props.runtime.setupReady} models={props.models}/></>}
        {section === 'model' && <>
          <p className="settings-lead">Chọn mô hình cho cuộc trò chuyện hiện tại. Lịch sử và bản nháp được giữ khi đổi.</p>
          <div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Mô hình đang dùng</h2><p>{props.usage.modelProvider || 'Chưa có nhà cung cấp'}</p>
            <ModelPicker id="settings-model" models={props.models} currentProvider={props.usage.modelProvider} currentId={props.usage.model}
              label={props.pending ? 'Đang xác nhận…' : model?.name || props.usage.model || 'Chọn mô hình'} disabled={modelLocked}
              onOpen={props.onBrowseModels ? () => { if (!modelLocked) props.onBrowseModels?.(false); } : undefined}
              onRefresh={props.onBrowseModels ? () => { if (!modelLocked) props.onBrowseModels?.(true); } : undefined}
              loading={props.catalogueLoading} error={props.catalogueError} onSelect={selected => {
                const target = props.models.find(item => item.provider === selected.provider && item.id === selected.id);
                if (!modelLocked && target && isSelectableModel(target)) props.onModel(target);
              }} />
            {!props.sessionKey && <p>Mở một cuộc trò chuyện để chọn mô hình cho phiên đó.</p>}{connect}</div>
          <div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Mô hình cho công việc khác</h2><p>Advisor có bộ chọn mô hình và nút bật/tắt riêng ở thanh trên cuộc trò chuyện.</p>
            <p>Tạo agent để lưu vai trò, mục tiêu và mô hình dành cho công việc của anh.</p><button onClick={() => open('agents')}>Quản lý agents</button>
            <p className="settings-muted">Chọn riêng mô hình cho thị giác, trích xuất web hoặc tạo tiêu đề chưa có trong bảng cài đặt này.</p></div>
        </>}
        {section === 'chat' && <><p className="settings-lead">Ngôn ngữ: Tiếng Việt</p><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Soạn và gửi</h2><p>Enter để gửi, Shift + Enter để xuống dòng. Có thể tiếp tục soạn nháp khi AI đang trả lời.</p><p>Tệp nằm phía trên lời nhắn; mỗi lần gửi tối đa 4 tệp, tổng 8 MB và còn phụ thuộc giới hạn kết nối.</p></div><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Quản lý cuộc trò chuyện</h2><p>Tên tự lấy từ nội dung. Dùng nút bút cạnh tên để đổi tên, Shift + nhấp để ghim.</p><p>Nháp giữ trong lần mở ứng dụng; lịch sử đã gửi do OpenClaw lưu.</p><button onClick={() => open('chat')}>Mở cuộc trò chuyện</button></div></>}
        {section === 'appearance' && <><p className="settings-lead">Điều chỉnh hiển thị trên máy này. Thay đổi có hiệu lực ngay.</p><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Giao diện và bố cục</h2><LayoutOptions value={props.layout} onChange={props.onLayout} /></>}
        {section === 'workspace' && <><p className="settings-lead">Dự án có thư mục riêng, nhóm cuộc trò chuyện và tệp làm việc.</p><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Dự án và agents</h2><p>{props.projects.length} dự án đã tải.</p><button onClick={() => open('projects')}>Tạo và quản lý dự án</button><button onClick={() => open('agents')}>Tạo và quản lý agents</button></div><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Nơi lưu dữ liệu ứng dụng</h2><p className="settings-path">{props.runtime.stateDirectory || 'Chưa có thông tin thư mục'}</p><p>Lịch sử do lõi OpenClaw quản lý; dữ liệu dự án được đồng bộ vào thư mục đã chọn.</p></div></>}
        {section === 'safety' && <><p className="settings-lead">Quyền đang áp dụng cho bản thử này.</p><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Tệp và website</h2><p>Tệp do anh chọn mới được đính kèm. ZIP được giữ nguyên, chưa tự giải nén.</p><p>Trang web chạy trong vùng riêng; chỉ đưa nội dung vào nháp khi anh bấm chia sẻ. AI chưa tự bấm hoặc gửi trên website.</p></div><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Thao tác trên máy</h2><p>AI có thể đọc, sửa tệp trong không gian làm việc và đề xuất lệnh. Lệnh được OpenClaw kiểm tra theo phạm vi làm việc. Lệnh ít rủi ro có thể chạy sau duyệt tự động; lệnh chưa xác định được phạm vi hoặc cần quyền thêm sẽ hỏi anh. Một số kết nối mô hình vẫn yêu cầu duyệt thủ công. Không có sandbox; lệnh chạy với quyền tài khoản Windows hiện tại.</p><p>Gateway chỉ kết nối cục bộ. Khóa truy cập được xử lý ở tiến trình chính, không hiển thị trong trang này.</p></div></>}
        {section === 'memory' && <><p className="settings-lead">Ngữ cảnh của cuộc trò chuyện đang chọn.</p><ContextMeter usage={props.usage} models={props.models} pending={props.pending} /><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Lịch sử và thu gọn ngữ cảnh</h2><p>OpenClaw và bộ chạy của mô hình quản lý lịch sử, bộ nhớ và việc thu gọn. Con số của phiên có thể nhỏ hơn cửa sổ API công bố.</p><p>Chưa có tùy chọn chỉnh ngân sách hoặc xóa bộ nhớ trong cửa sổ này.</p></div></>}
        {section === 'voice' && <><p className="settings-lead">Giọng nói chưa được bật trong bản này.</p><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Nhập và nghe bằng giọng nói</h2><p>Ứng dụng chưa thu micro hoặc đọc câu trả lời thành tiếng. Hiện anh có thể đính kèm tệp âm thanh; khả năng xử lý tùy mô hình và công cụ của phiên.</p></div></>}
        {section === 'advanced' && <><p className="settings-lead">Trạng thái bộ chạy và chẩn đoán kết nối.</p>{gateway}<dl className="settings-facts"><dt>OpenClaw</dt><dd>{props.runtime.serverVersion || 'Chưa xác nhận'}</dd><dt>Node</dt><dd>{props.runtime.nodeRuntime || 'Chưa xác nhận'}</dd><dt>Giao thức</dt><dd>{props.runtime.protocol || 'Chưa xác nhận'}</dd></dl>{props.runtime.lastError && <p role="status">{props.runtime.lastError}</p>}</>}
        {section === 'notifications' && <><p className="settings-lead">Thông báo công việc xuất hiện trong ứng dụng.</p><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Lịch và lời nhắc</h2><p>Tạo lịch theo mẫu rồi chọn giờ và nội dung phù hợp.</p><button onClick={() => open('cron')}>Quản lý tác vụ định kỳ</button><p className="settings-muted">Thông báo hệ thống Windows và âm báo riêng chưa được bật.</p></div></>}
        {section === 'billing' && <><p className="settings-lead">Hạn mức và thanh toán thuộc tài khoản nhà cung cấp của anh. Số liệu dưới đây do OpenClaw ghi nhận, có thể chưa bao gồm toàn bộ hóa đơn.</p>{native('usage')}</>}
        {section === 'providers' && <ProviderSettings ready={props.runtime.connected && props.runtime.setupReady} models={props.models} currentProvider={props.usage.modelProvider} currentModel={props.usage.model} onConnect={props.modelDisabled ? undefined : () => props.onConnect()} />}
        {section === 'channels' && <><p className="settings-lead">Quản lý Gateway và các kênh nhắn tin.</p>{gateway}{native('messages')}</>}
        {section === 'shortcuts' && <><p className="settings-lead">Các phím tắt đang hoạt động.</p><dl className="settings-shortcuts"><dt>Gửi tin nhắn</dt><dd><kbd>Enter</kbd></dd><dt>Xuống dòng</dt><dd><kbd>Shift + Enter</kbd></dd><dt>Phiên mới ngoài cửa sổ Cài đặt</dt><dd><kbd>Ctrl / ⌘ + N</kbd></dd><dt>Đóng menu hoặc Cài đặt</dt><dd><kbd>Esc</kbd></dd><dt>Ghim cuộc trò chuyện</dt><dd><kbd>Shift + nhấp</kbd></dd><dt>Chuyển mục trong menu mô hình</dt><dd><kbd>↑ / ↓</kbd></dd></dl></>}
        {section === 'tools' && <><p className="settings-lead">Khóa API được thiết lập qua trình kết nối, không dán vào cuộc chat.</p>{connect}<div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Công cụ của phiên</h2><p>Chọn kỹ năng dưới ô chat hoặc mở danh mục để xem những gì lõi đã nhận.</p><button onClick={() => open('skills')}>Xem kỹ năng</button><p className="settings-muted">Chưa có trình cấu hình MCP tùy ý hoặc công cụ chạy lệnh trong bảng này.</p></div></>}
        {section === 'tools' && <ToolCatalog key={props.sessionKey} ready={props.runtime.connected} sessionKey={props.sessionKey} />}
        {section === 'plugins' && <CapabilityCatalog kind="plugins" ready={props.runtime.connected && props.runtime.setupReady} mutationDisabled={props.modelDisabled} />}
        {section === 'skills' && <><p className="settings-lead">Kỹ năng và điều kiện dùng theo agent đang chọn.</p>{native('skills')}</>}
        {section === 'mcp' && <CapabilityCatalog kind="mcp" ready={props.runtime.connected && props.runtime.setupReady} />}
        {section === 'history' && <><p className="settings-lead">Cuộc trò chuyện nằm trong dự án tương ứng ở thanh bên trái.</p><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Tìm và sắp xếp</h2><p>Dùng Tìm phiên để tìm theo tên. Mở dấu ba chấm của cuộc trò chuyện để đổi tên, ghim hoặc xóa.</p><button onClick={() => open('chat')}>Trở lại cuộc trò chuyện</button><button onClick={() => open('projects')}>Xem theo dự án</button><p className="settings-muted">Đóng tab giữ lịch sử. Kho lưu trữ và khôi phục cuộc trò chuyện chưa có trong bản này.</p></div></>}
        {section === 'about' && <><p className="settings-lead">AI for Boss</p><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Phiên bản đang chạy</h2><dl className="settings-facts"><dt>Ứng dụng</dt><dd>{props.shell?.product.version || 'Chưa đọc được'}</dd><dt>OpenClaw</dt><dd>{props.runtime.serverVersion || 'Chưa kết nối'}</dd><dt>Kênh phát hành</dt><dd>Bản thử nghiệm</dd></dl></div><div className="settings-card"><h2><WorkbenchIcon name={sections.find(item => item[0] === section)![2]} />Cập nhật</h2><p>Thông tin của ứng dụng đang mở. Kiểm tra và tải bản mới trong mục bên dưới.</p><button disabled={refreshing} onClick={() => void refresh()}>{refreshing ? 'Đang đọc…' : 'Làm mới thông tin phiên bản'}</button>{report && <p role="status">{report}</p>}<p className="settings-muted">Nút này đọc lại bản đang chạy, không kiểm tra phiên bản mới trên mạng.</p></div></>}
        {section === 'about' && <><UpdateSettings /><BrandNotices /></>}
        {section === 'data' && <DataSettings disabled={props.pending || props.dataDisabled} onLayout={props.onLayout} />}
      </div><footer className="settings-footer"><button onClick={props.onClose}>Trở lại cuộc trò chuyện</button></footer>
    </main>
  </dialog>;
}
