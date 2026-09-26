import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const p = await b.newPage({viewport:{width:1100,height:1400}});
await p.goto('file:///tmp/claude-0/-home-claude/32cb0162-2c82-583d-8d22-6dbc5cce2fe9/scratchpad/wordmark/index.html');
await p.waitForTimeout(2500);
await p.screenshot({path:'/tmp/wm.png',fullPage:false});
await b.close();
