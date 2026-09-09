import openclaw from './assets/brands/OPENCLAW-ICON-ATTRIBUTION.md?raw';
import simpleIcons from './assets/brands/SIMPLE-ICONS-LICENSE.md?raw';
import disclaimer from './assets/brands/SIMPLE-ICONS-DISCLAIMER.md?raw';
import fontAwesome from './assets/brands/FONT-AWESOME-LICENSE.txt?raw';

export default function BrandNotices() {
  return <details className="brand-notices"><summary>Ghi nhận nguồn biểu tượng và giấy phép</summary>
    <p>Biểu tượng giúp nhận diện dịch vụ tương ứng; không thể hiện việc nhà cung cấp bảo trợ AI for Boss.</p>
    {Object.entries({ OpenClaw: openclaw, 'Simple Icons': simpleIcons, 'Quyền nhãn hiệu': disclaimer, 'Font Awesome': fontAwesome }).map(([name, notice]) => <details key={name}><summary>{name}</summary><pre>{notice}</pre></details>)}
  </details>;
}
