import { initialState, makeId, parseBackup, readLocal, toBackup, writeLocal } from './storage.js';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modalRoot');
const toastRoot = document.getElementById('toastRoot');
const importFile = document.getElementById('importFile');
const nav = document.getElementById('bottomNav');
const icons = ['🧺','🛒','🍽️','🧹','🏸','🏃','📚','💻','📝','🧘','🪴','🚗','💊','☕','🎬','🛁'];
const DAY = 86400000;
let state;
let currentPage = 'home';
let lastUndoId = null;
let toastTimer = 0;
let importMode = 'view';
let saveChain = Promise.resolve();

function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function escAttr(value) { return escapeHTML(value); }
function dateKey(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseLocalDate(value) { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d,12); }
function dayNumber(value) { const [y,m,d] = value.split('-').map(Number); return Math.floor(Date.UTC(y,m-1,d)/DAY); }
function dayDiff(start, end = dateKey(Date.now())) { return dayNumber(end) - dayNumber(start); }
function todayKey() { return dateKey(Date.now()); }
function dateShort(value) { return new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric'}).format(new Date(value)); }
function dateLong(value) { return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(value)); }
function since(iso) { if (!iso) return '尚无记录'; const days = dayDiff(dateKey(iso)); if (days < 0) return '未来日期'; if (days === 0) return '今天'; if (days === 1) return '昨天'; return `${days} 天前`; }
function active() { return state.activities.filter(a=>!a.archived).sort((a,b)=>a.order-b.order); }
function activityById(id) { return state.activities.find(a=>a.id===id); }
function entriesByActivity(id) { return state.logs.filter(l=>l.activityId===id).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)); }
function lastEntry(id) { return entriesByActivity(id)[0]; }
function isViewer() { return state.meta.readOnly === true; }
function iconFor(a) { return escapeHTML(a?.emoji || '✦'); }
function allSortedLogs() { return [...state.logs].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)); }
function inLastDays(iso, days) { const n=dayDiff(dateKey(iso)); return n>=0 && n<days; }
function periodCount(id, days) { return state.logs.filter(l=>(!id || l.activityId===id) && inLastDays(l.occurredAt, days)).length; }
function median(values) { if(!values.length) return null; const a=[...values].sort((x,y)=>x-y); const mid=Math.floor(a.length/2); return a.length%2?a[mid]:(a[mid-1]+a[mid])/2; }
function medianInterval(id) {
  const days=[...new Set(entriesByActivity(id).map(l=>dateKey(l.occurredAt)))].sort();
  if(days.length<2) return null;
  return median(days.slice(1).map((d,i)=>dayDiff(days[i],d)));
}
function formatDuration(n) { return n===null ? '—' : `${Number.isInteger(n)?n:n.toFixed(1)} 天`; }
function emptyBlock(title, description, action='') { return `<div class="empty-state"><strong>${title}</strong><p>${description}</p>${action}</div>`; }
function viewerBanner() {
  return isViewer() ? `<div class="view-banner">${icon('info')}<div>当前显示的是导入的<strong>只读备份</strong>（${state.meta.importedAt ? dateLong(state.meta.importedAt) : '未知时间'}导入）。手机上的新记录不会自动出现在这里。可在设置中导入更新的备份。</div></div>` : '';
}
function needsBackupReminder() {
  if(isViewer() || state.logs.length === 0) return false;
  if(state.meta.reminderSnoozedUntil && Date.now() < Date.parse(state.meta.reminderSnoozedUntil)) return false;
  if (!state.meta.lastExportAt) return state.logs.length >= 10 || (state.logs.length >= 3 && dayDiff(dateKey(state.meta.createdAt)) >= 7);
  return (Date.now()-Date.parse(state.meta.lastExportAt)) >= 30*DAY;
}
function backupBanner() {
  if (!needsBackupReminder()) return '';
  return `<div class="hint backup-reminder"><span class="hint-strong">${icon('shield')} 该备份一次了</span>记录只保存在这台设备。建议导出一份 JSON 到 iCloud Drive，避免清理网站数据时丢失历史。<div class="hint-actions"><button data-action="export">立即备份</button><button data-action="snooze">7 天后提醒</button></div></div>`;
}
function homePage() {
  const n=active().length;
  const logs=allSortedLogs();
  const last=logs[0];
  const cards=active().map(a=>{
    const recent=lastEntry(a.id);
    return `<div class="activity-card" data-name="${escAttr(a.name.toLowerCase())}">
      <button class="activity-main" data-action="log" data-id="${escAttr(a.id)}" ${isViewer()?'disabled':''} aria-label="记录 ${escAttr(a.name)}">
        <span class="activity-symbol" aria-hidden="true">${iconFor(a)}</span><span class="activity-name">${escapeHTML(a.name)}</span>
      </button><div class="activity-bottom"><span class="activity-last">${recent?'上次 · '+since(recent.occurredAt):'点按开始记录'}</span>
      ${isViewer()?'':`<button class="activity-backfill" data-action="backfill" data-id="${escAttr(a.id)}" aria-label="补记 ${escAttr(a.name)}">补记</button>`}</div></div>`;
  }).join('');
  const addCard=isViewer()?'':`<button class="activity-card activity-add" data-action="add"><span class="plus-bubble">${icon('plus')}</span><span>新增事项</span></button>`;
  return `${viewerBanner()}<div class="page-heading"><div><p class="eyebrow">Notice your rhythm</p><h1 class="page-title">生活，慢慢记录。</h1><p class="page-subtitle">做过的事，轻点一下。无需连续打卡。</p></div></div>
  <div class="summary-strip"><div class="stat-tile"><div class="stat-number">${periodCount(null,7)}</div><div class="stat-label">近 7 天记录</div></div><div class="stat-tile"><div class="stat-number">${periodCount(null,30)}</div><div class="stat-label">近 30 天记录</div></div><div class="stat-tile"><div class="stat-number">${n}</div><div class="stat-label">正在关注的事项</div></div></div>
  ${backupBanner()}
  <div class="section-head"><h2 class="section-title">快速记录</h2><span class="section-note">点卡片即可记录今天</span></div>
  <div class="record-toolbar"><label class="searchbox">${icon('search')}<input id="activitySearch" type="search" autocomplete="off" placeholder="查找事项…" aria-label="查找事项"></label>
   ${isViewer()?'':`<button class="button button-secondary" data-action="add">${icon('plus')} 新增</button>`}</div>
  ${n?`<div class="activity-grid" id="activityGrid">${cards}${addCard}</div>`:emptyBlock('还没有事项','先新增一件你希望观察频率的事情。',isViewer()?'':`<button class="button button-primary" data-action="add">${icon('plus')} 新增事项</button>`)}
  <div class="section-head"><h2 class="section-title">最近记录</h2><button class="text-link" data-nav="history">查看全部 ${icon('chevron-right')}</button></div>
  ${logs.length ? `<div class="surface-list">${logs.slice(0,4).map(l=>entryRow(l,false)).join('')}</div>` : emptyBlock('从第一次记录开始','这里会显示你最近记录的活动。')}
  ${!isViewer()?`<p class="footer-note">你记录的是生活，而不是任务清单。漏记也可以随时补上。</p>`:''}`;
}
function entryRow(l,editable=true) {
  const a=activityById(l.activityId);
  return `<div class="list-row"><div class="row-icon" aria-hidden="true">${iconFor(a)}</div><div class="row-text"><div class="row-title">${escapeHTML(a?.name || '未知事项')}</div><div class="row-description">${dateLong(l.occurredAt)}${dateKey(l.occurredAt)!==dateKey(l.recordedAt)?' · 补记':''}</div></div>
  ${editable && !isViewer()?`<button class="row-button" data-action="edit-log" data-id="${escAttr(l.id)}" aria-label="编辑记录">${icon('edit')}</button>`:`<div class="row-trailing">${dateShort(l.occurredAt)}</div>`}</div>`;
}
function weeklyBars() {
  const now=new Date(); const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()); monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  const weeks=[];
  for(let i=7;i>=0;i--){const start=new Date(monday);start.setDate(start.getDate()-i*7);const end=new Date(start);end.setDate(end.getDate()+7);
    const count=state.logs.filter(l=>{const d=new Date(l.occurredAt);return d>=start && d<end;}).length;
    weeks.push({label:`${start.getMonth()+1}/${start.getDate()}`,count,current:i===0});}
  const max=Math.max(1,...weeks.map(w=>w.count));
  return `<div class="bars" role="img" aria-label="过去八周记录次数：${weeks.map(w=>w.label+' '+w.count+'次').join('，')}">${weeks.map(w=>`<div class="bar-col"><div class="bar-fill ${w.current?'current':''}" style="height:${Math.max(3,w.count/max*103)}px" title="${w.label}：${w.count} 次"></div><span class="bar-label">${w.label}</span></div>`).join('')}</div>`;
}
function insightsPage() {
  const items=active().map(a=>({a,thirty:periodCount(a.id,30),seven:periodCount(a.id,7),all:entriesByActivity(a.id).length,med:medianInterval(a.id)})).sort((a,b)=>b.thirty-a.thirty||a.a.order-b.a.order);
  return `${viewerBanner()}<div class="page-heading"><div><p class="eyebrow">Insights</p><h1 class="page-title">看见自己的节奏。</h1><p class="page-subtitle">用真实的记录理解频率，而不是追逐连续天数。</p></div></div>
  <div class="metric-grid"><div class="metric-tile"><div class="metric-value">${periodCount(null,30)}</div><div class="metric-caption">最近 30 天 · 总记录</div></div><div class="metric-tile"><div class="metric-value">${state.logs.length}</div><div class="metric-caption">全部历史记录</div></div></div>
  <div class="section-head"><h2 class="section-title">八周趋势</h2><span class="section-note">每周记录次数</span></div><div class="card">${weeklyBars()}</div>
  <div class="section-head"><h2 class="section-title">各项活动</h2><span class="section-note">最近 30 天 · 由多到少</span></div>
  ${items.length?`<div class="surface-list">${items.map(({a,thirty,seven,all,med})=>`<button class="list-row" style="width:100%;text-align:left;background:white;border-left:0;border-right:0;border-top:0;cursor:pointer" data-action="activity-detail" data-id="${escAttr(a.id)}"><span class="row-icon" aria-hidden="true">${iconFor(a)}</span><span class="row-text"><span class="row-title">${escapeHTML(a.name)}</span><span class="row-description">近 7 天 ${seven} 次 · 典型间隔 ${formatDuration(med)} · 共 ${all} 次</span></span><span class="row-trailing"><span class="row-primary">${thirty}</span><br>近 30 天</span>${icon('chevron-right')}</button>`).join('')}</div>`:emptyBlock('暂无事项','添加活动并开始记录后，这里会显示你的生活频率。')}
  <p class="footer-note">统计基于已录入的活动。没有记录不代表没有发生。</p>`;
}
function historyPage() {
  const logs=allSortedLogs(); const groups=new Map();
  for(const l of logs){const k=dateKey(l.occurredAt);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(l);}
  return `${viewerBanner()}<div class="page-heading"><div><p class="eyebrow">History</p><h1 class="page-title">每一次，都有迹可循。</h1><p class="page-subtitle">${logs.length} 条记录 · 可以修改日期、补记或删除。</p></div>
  ${isViewer()?'':`<button class="button button-secondary" data-action="backfill">${icon('calendar')} 补记</button>`}</div>
  ${logs.length?Array.from(groups.entries()).map(([day,items])=>`<div class="history-day">${dateLong(parseLocalDate(day))} · ${items.length} 条</div><div class="surface-list">${items.map(l=>entryRow(l,true)).join('')}</div>`).join(''):emptyBlock('这里还空着','你录入的活动会按发生日期自动整理。')}`;
}
function settingsPage() {
  const last=state.meta.lastExportAt?dateLong(state.meta.lastExportAt):'还未导出过备份';
  const imported=state.meta.importedAt?dateLong(state.meta.importedAt):'尚未导入';
  return `${viewerBanner()}<div class="page-heading"><div><p class="eyebrow">Settings</p><h1 class="page-title">保持简单，也保持安心。</h1><p class="page-subtitle">所有数据仅存储在当前设备的浏览器中。</p></div></div>
  <section class="setting-section"><h2>事项管理</h2><div class="setting-content"><div class="split-label"><strong>你关注的事项</strong><small>${active().length} 个使用中</small></div><div class="setting-button-stack">${isViewer()?'':`<button class="button button-primary" data-action="add">${icon('plus')} 新增事项</button><button class="button button-secondary" data-action="manage">管理 / 归档</button>`}</div><p>随时新增、改名或归档。归档不会删除历史记录。</p></div></section>
  <section class="setting-section"><h2>备份与电脑查看</h2><div class="setting-content"><div class="split-label"><strong>本地数据</strong><small>${state.activities.length} 个事项 · ${state.logs.length} 条记录</small></div><p>上次导出：${last}。每 30 天提醒导出一次；首次记录达到一定数量后也会提醒。提醒仅在打开 App 时显示。</p>
  <div class="setting-button-stack">${isViewer()?'':`<button class="button button-primary" data-action="export">${icon('download')} 导出 JSON 备份</button><button class="button button-secondary" data-action="export-csv">导出 CSV</button>`}</div>
  <div class="setting-button-stack" style="margin-top:10px"><button class="button button-secondary" data-action="import-view">${icon('upload')} 查看备份（只读）</button><button class="button button-secondary" data-action="import-restore">${icon('upload')} 恢复备份</button></div>
  <p class="setting-meta">${isViewer()?'本机只读备份的导入日期：'+imported:'电脑打开本网站后，使用「查看备份」载入从 iPhone 导出的 JSON 文件。不会自动同步。'}</p></div></section>
  <section class="setting-section"><h2>隐私与设备</h2><div class="setting-content"><div class="split-label"><strong>${icon('shield')} 无账户 · 无云端</strong></div><p>不需要登录、不上传你的记录。浏览器或 iOS 清理网站数据、删除 App 等操作可能导致记录丢失，请把备份文件保存到 iCloud Drive。</p>
  <div class="setting-button-stack"><button class="button button-danger" data-action="reset">${icon('trash')} 清除这台设备的数据</button></div></div></section>
  <section class="setting-section"><h2>安装到 iPhone</h2><div class="setting-content"><strong>像 App 一样使用</strong><p>在 Safari 中打开此网站，点「分享」→「添加到主屏幕」，开启「作为 Web App 打开」。以后从桌面图标启动。</p></div></section>
  <p class="footer-note">Routine v2 · Built for noticing, not judging.</p>`;
}
function managePage() {
  return `<div class="view-heading"><button class="back-btn" data-nav="settings" aria-label="返回设置">${icon('arrow-left')}</button><h1>管理事项</h1></div>
  <div class="management-list">${[...state.activities].sort((a,b)=>a.order-b.order).map(a=>`<div class="manage-item"><span class="row-icon" aria-hidden="true">${iconFor(a)}</span><span class="row-title">${escapeHTML(a.name)}${a.archived?' <small class="muted">(已归档)</small>':''}</span><button class="button button-secondary" data-action="rename" data-id="${escAttr(a.id)}">编辑</button><button class="button button-secondary" data-action="archive" data-id="${escAttr(a.id)}">${a.archived?'恢复':'归档'}</button><button class="row-button button-text-danger" data-action="delete-activity" data-id="${escAttr(a.id)}" aria-label="删除">${icon('trash')}</button></div>`).join('')}</div><div class="hint">归档后不再出现在快速记录区，但历史记录和统计不会被删除。永久删除会同时删除关联的记录。</div>`;
}
function navigate(name) {
  currentPage=name;
  render();
  window.scrollTo({top:0,behavior:'instant'});
}
function render() {
  if(!state) return;
  app.innerHTML = ({home:homePage, insights:insightsPage,history:historyPage,settings:settingsPage,manage:managePage}[currentPage] || homePage)();
  nav.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===currentPage));
  const pill=document.querySelector('.local-pill');
  if(pill) pill.innerHTML=`<span class="local-indicator"></span>${isViewer()?'只读备份':'本地存储'}`;
  if (currentPage==='manage') nav.style.display='none'; else nav.style.display='';
}
function toast(message, action, callback) {
  clearTimeout(toastTimer);
  toastRoot.innerHTML=`<div class="toast">${icon('check')}<span>${escapeHTML(message)}</span>${action?`<button id="toastAction">${escapeHTML(action)}</button>`:''}</div>`;
  if(action) document.getElementById('toastAction').addEventListener('click',()=>{toastRoot.innerHTML='';callback?.();});
  toastTimer=setTimeout(()=>{toastRoot.innerHTML='';},4200);
}
async function persist() {
  const snapshot=structuredClone(state);
  saveChain=saveChain.catch(()=>{}).then(()=>writeLocal(snapshot));
  try{ await saveChain; }catch(err){console.error(err);toast('保存失败，请检查设备存储空间');}
}
function ensureEditable(){if(isViewer()){toast('当前是只读备份，不能在这里添加记录');return false;}return true;}
async function logActivity(id,when=new Date()) {
  if(!ensureEditable())return;
  const a=activityById(id);if(!a)return;
  const log={id:makeId(),activityId:id,occurredAt:when.toISOString(),recordedAt:new Date().toISOString()};
  state.logs.push(log);lastUndoId=log.id;render();await persist();
  toast(`已记录 ${a.name}`, '撤销', async()=>{if(!ensureEditable())return;state.logs=state.logs.filter(l=>l.id!==log.id);lastUndoId=null;render();await persist();});
}
function dismissModal() {modalRoot.innerHTML='';document.body.style.overflow='';}
function openModal(title,contents,onSubmit, options={}) {
  modalRoot.innerHTML=`<div class="modal-scrim" data-dismiss="true"><div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-handle"></div><div class="modal-header"><h2 id="modalTitle">${escapeHTML(title)}</h2><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><form id="modalForm">${contents}<div class="modal-footer">${options.extraButton||''}<button class="button button-primary" type="submit">${escapeHTML(options.submitText||'保存')}</button></div></form></div></div>`;
  document.body.style.overflow='hidden';
  const form=document.getElementById('modalForm');
  form.addEventListener('submit',async e=>{e.preventDefault();try{await onSubmit(new FormData(form));}catch(err){toast(err.message||'操作失败');}});
  modalRoot.querySelector('.modal-scrim').addEventListener('click',e=>{if(e.target.classList.contains('modal-scrim'))dismissModal();});
  if(options.focus) setTimeout(()=>document.getElementById(options.focus)?.focus(),90);
}
function emojiOptions(chosen='🧺') {return `<div class="emoji-picker" role="group" aria-label="选择图标">${icons.map((emoji,i)=>`<button class="emoji-option ${emoji===chosen?'selected':''}" type="button" data-emoji="${escAttr(emoji)}" aria-label="图标 ${i+1}" aria-pressed="${emoji===chosen}">${emoji}</button>`).join('')}</div><input type="hidden" id="emojiInput" name="emoji" value="${escAttr(chosen)}">`;}
function editActivityModal(id) {
  if(!ensureEditable())return;
  const a=activityById(id);const editing=!!a;
  openModal(editing?'编辑事项':'新增事项',`<div class="field"><label for="activityName">名称</label><input id="activityName" name="name" maxlength="45" required autocomplete="off" placeholder="例如：Laundry / 读书 / 洗车" value="${editing?escAttr(a.name):''}"></div><div class="field"><label>选择一个图标</label>${emojiOptions(editing?a.emoji:'🧺')}</div>`,async data=>{
    const name=String(data.get('name')||'').trim();const emoji=String(data.get('emoji')||'🧺');
    if(!name)throw new Error('请输入事项名称');
    if(state.activities.some(item=>item.name.toLowerCase()===name.toLowerCase()&&item.id!==id))throw new Error('已有同名事项');
    if(editing){a.name=name;a.emoji=emoji;}else{state.activities.push({id:makeId(),name,emoji,order:Math.max(-1,...state.activities.map(x=>x.order))+1,archived:false,createdAt:new Date().toISOString()});}
    dismissModal();render();await persist();toast(editing?'事项已更新':'事项已添加，可以立即记录');
  },{focus:'activityName',submitText:editing?'保存修改':'添加事项'});
}
function backfillModal(id) {
  if(!ensureEditable())return;
  const options=active().map(a=>`<option value="${escAttr(a.id)}" ${a.id===id?'selected':''}>${escapeHTML(a.name)}</option>`).join('');
  if(!options){toast('请先添加一个事项');return;}
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  openModal('补记活动',`<p class="dialog-copy">忘记当天记录也没关系。选择实际发生的日期即可。</p><div class="field"><label for="logActivity">事项</label><select id="logActivity" name="activityId" required>${options}</select></div><div class="field"><label for="logDate">实际发生日期</label><input id="logDate" name="date" type="date" required max="${todayKey()}" value="${dateKey(yesterday)}"></div>`,async data=>{
    const date=String(data.get('date')||'');const aid=String(data.get('activityId')||'');
    if(!activityById(aid)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>todayKey()||dateKey(parseLocalDate(date))!==date)throw new Error('请选择有效的事项和日期');
    dismissModal();await logActivity(aid,parseLocalDate(date));
  },{submitText:'添加这条记录'});
}
function editLogModal(id) {
  if(!ensureEditable())return;
  const log=state.logs.find(l=>l.id===id);if(!log)return;
  const options=state.activities.map(a=>`<option value="${escAttr(a.id)}" ${a.id===log.activityId?'selected':''}>${escapeHTML(a.name)}</option>`).join('');
  openModal('编辑记录',`<div class="field"><label for="editActivity">事项</label><select id="editActivity" name="activityId">${options}</select></div><div class="field"><label for="editDate">发生日期</label><input id="editDate" type="date" name="date" required max="${todayKey()}" value="${dateKey(log.occurredAt)}"></div>`,async data=>{
    const d=String(data.get('date')||'');const aid=String(data.get('activityId')||'');
    if(!activityById(aid)||d>todayKey()||dateKey(parseLocalDate(d))!==d)throw new Error('请选择有效的日期');
    log.activityId=aid;log.occurredAt=parseLocalDate(d).toISOString();dismissModal();render();await persist();toast('记录已修改');
  },{submitText:'保存修改',extraButton:`<button class="button button-danger" type="button" data-action="delete-log" data-id="${escAttr(id)}">删除</button>`});
}
function activityDetailModal(id) {
  const a=activityById(id);if(!a)return;
  const entries=entriesByActivity(id);
  openModal(a.name,`<div class="metric-grid" style="margin-bottom:20px"><div class="metric-tile"><div class="metric-value">${periodCount(id,30)}</div><div class="metric-caption">近 30 天次数</div></div><div class="metric-tile"><div class="metric-value">${formatDuration(medianInterval(id))}</div><div class="metric-caption">典型记录间隔（中位数）</div></div><div class="metric-tile"><div class="metric-value">${entries.length}</div><div class="metric-caption">累计次数</div></div><div class="metric-tile"><div class="metric-value">${entries.length?since(entries[0].occurredAt):'—'}</div><div class="metric-caption">距上次记录</div></div></div><p class="tiny-notice">间隔根据不同记录日期计算。没有记录不代表没有发生。</p>`,async()=>dismissModal(),{submitText:'关闭'});
}
async function deleteActivity(id) {
  if(!ensureEditable())return;
  const a=activityById(id);if(!a)return;
  const count=entriesByActivity(id).length;
  if(!confirm(`永久删除「${a.name}」？${count?`这也会删除关联的 ${count} 条记录。`:''}\n\n此操作无法撤销。`))return;
  state.activities=state.activities.filter(x=>x.id!==id);state.logs=state.logs.filter(x=>x.activityId!==id);
  render();await persist();toast('事项已删除');
}
async function resetData(){if(!confirm('清除这台设备上的全部事项和历史记录？\n\n此操作无法撤销。建议先导出备份。'))return;if(!confirm('请再次确认：真的要清除全部数据吗？'))return;state={schema:2,activities:[],logs:[],meta:{createdAt:new Date().toISOString(),lastExportAt:null,reminderSnoozedUntil:null,readOnly:false,importedAt:null}};currentPage='home';render();await persist();toast('这台设备的数据已清除');}
function csvValue(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function csvExport(){const rows=[['date','occurred_at','recorded_at','activity']];for(const l of allSortedLogs().reverse()){rows.push([dateKey(l.occurredAt),l.occurredAt,l.recordedAt,activityById(l.activityId)?.name||'']);}return '\ufeff'+rows.map(row=>row.map(csvValue).join(',')).join('\r\n');}
function downloadBlob(name,blob){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
async function exportFile(format='json'){
  if(!ensureEditable())return;
  const filename=`Routine-${format==='json'?'Backup':'Logs'}-${todayKey()}.${format}`;
  const blob=format==='json'?new Blob([JSON.stringify(toBackup(state),null,2)],{type:'application/json'}):new Blob([csvExport()],{type:'text/csv;charset=utf-8'});
  let exported=false;
  const file=new File([blob],filename,{type:blob.type});
  if(navigator.canShare?.({files:[file]})){
    try {await navigator.share({files:[file],title:filename});exported=true;}catch(e){if(e.name==='AbortError')return;}
  }
  if(!exported){downloadBlob(filename,blob);exported=true;}
  if(format==='json'&&exported){state.meta.lastExportAt=new Date().toISOString();state.meta.reminderSnoozedUntil=null;await persist();render();}
  toast('文件已生成，请确认保存到 iCloud Drive');
}
function requestImport(mode){importMode=mode;importFile.value='';importFile.click();}
async function importBackup(event){
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>20*1024*1024){toast('备份超过 20MB，请检查文件');return;}
  try{
    const backup=parseBackup(JSON.parse(await file.text()));
    if(importMode==='restore') {
      if(!confirm(`将从 ${backup.activities.length} 个事项、${backup.logs.length} 条记录恢复数据。\n\n这会覆盖本设备当前存储的全部数据。是否继续？`))return;
      backup.meta.readOnly=false;backup.meta.importedAt=null;
    }else{
      if(!confirm(`以只读方式查看 ${backup.activities.length} 个事项、${backup.logs.length} 条记录？\n\n这会替换本设备现有的本地数据（如有）。iPhone 上的原始数据不受影响。`))return;
      backup.meta.readOnly=true;backup.meta.importedAt=new Date().toISOString();
    }
    state=backup;currentPage=importMode==='view'?'insights':'home';render();await persist();toast(importMode==='view'?'只读备份已载入':'数据已恢复');
  }catch(e){console.error(e);alert(`无法导入备份：${e.message}`);}
}
function snoozeBackup(){state.meta.reminderSnoozedUntil=new Date(Date.now()+7*DAY).toISOString();render();persist();}

document.addEventListener('click',async event=>{
  const target=event.target.closest('button,[data-nav]');if(!target)return;
  const page=target.dataset.nav;if(page){event.preventDefault();navigate(page);return;}
  const action=target.dataset.action;if(!action)return;
  const id=target.dataset.id;
  switch(action){
    case 'log':await logActivity(id);break;
    case 'add':editActivityModal();break;
    case 'rename':editActivityModal(id);break;
    case 'backfill':backfillModal(id);break;
    case 'edit-log':editLogModal(id);break;
    case 'activity-detail':activityDetailModal(id);break;
    case 'close-modal':dismissModal();break;
    case 'delete-log':if(confirm('确定删除这条记录吗？')){state.logs=state.logs.filter(l=>l.id!==id);dismissModal();render();await persist();toast('记录已删除');}break;
    case 'archive':if(ensureEditable()){const a=activityById(id);if(a){a.archived=!a.archived;render();await persist();}}break;
    case 'delete-activity':await deleteActivity(id);break;
    case 'manage':navigate('manage');break;
    case 'export':await exportFile();break;
    case 'export-csv':await exportFile('csv');break;
    case 'import-view':requestImport('view');break;
    case 'import-restore':requestImport('restore');break;
    case 'reset':await resetData();break;
    case 'snooze':snoozeBackup();break;
  }
});

document.addEventListener('click',event=>{
  const b=event.target.closest('[data-emoji]');if(!b)return;
  modalRoot.querySelectorAll('[data-emoji]').forEach(el=>{el.classList.remove('selected');el.setAttribute('aria-pressed','false');});
  b.classList.add('selected');b.setAttribute('aria-pressed','true');document.getElementById('emojiInput').value=b.dataset.emoji;
});
document.addEventListener('input',event=>{
  if(event.target.id!=='activitySearch')return;
  const query=event.target.value.toLocaleLowerCase().trim();
  document.querySelectorAll('#activityGrid .activity-card[data-name]').forEach(card=>{card.hidden=!card.dataset.name.includes(query);});
});
importFile.addEventListener('change',importBackup);
document.addEventListener('keydown',event=>{if(event.key==='Escape')dismissModal();});
window.addEventListener('hashchange',()=>{if(!modalRoot.innerHTML && ['home','insights','history','settings'].includes(location.hash.slice(1)))navigate(location.hash.slice(1));});
async function init(){
  try{const data=await readLocal();state=data&&data.schema===2?data:initialState();if(!data)await writeLocal(state);}catch(err){
    console.error('IndexedDB unavailable',err);app.innerHTML=`<div class="empty-state"><strong>无法使用本地存储</strong><p>Routine 需要 iPhone 浏览器的 IndexedDB 保存记录。请关闭无痕浏览，检查 Safari 网站数据设置，然后重新打开页面。<br>${escapeHTML(err.message)}</p></div>`;nav.style.display='none';return;
  }
  const desired=location.hash.slice(1);currentPage=['home','insights','history','settings'].includes(desired)?desired:'home';render();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Offline cache unavailable',err));
  navigator.storage?.persist?.().catch(()=>{});
}
init();
