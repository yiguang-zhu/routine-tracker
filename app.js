import { initialState, makeId, parseBackup, readLocal, toBackup, writeLocal } from './storage.js';
import { activityFrequency, createTapGuard } from './metrics.js';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modalRoot');
const toastRoot = document.getElementById('toastRoot');
const importFile = document.getElementById('importFile');
const nav = document.getElementById('bottomNav');
// Curated, searchable icon sets. User can also type or paste any emoji.
const ICON_GROUPS = [
  {id:'common',name:'常用',icons:[
    ['🧺','洗衣 Laundry'],['🛒','购物 Grocery'],['🍽️','外食 Dine out'],['🧹','打扫 Cleaning'],
    ['🏸','羽毛球 Badminton'],['🏋️','健身 Gym'],['🏃','跑步 Running'],['📚','读书 Reading'],
    ['💻','网站电脑 Website'],['📝','写作 Writing'],['🧘','冥想 Yoga'],['🚗','开车 Commute'],
    ['☕','咖啡 Coffee'],['🍳','做饭 Cooking'],['🪴','植物 Plants'],['🎬','电影 Movie'],
    ['🚽','厕所 Bathroom'],['💆','按摩 Massage'],['✈️','旅行 Travel'],['📅','日程 Calendar']
  ]},
  {id:'home',name:'家务',icons:[
    ['🧺','洗衣 Laundry'],['🧹','扫地 Cleaning'],['🧽','擦拭 Scrubbing'],['🪣','拖地 Mopping'],
    ['🚽','厕所 Bathroom'],['🛁','泡澡 Bath'],['🚿','淋浴 Shower'],['🧼','肥皂 Soap'],
    ['🧴','清洁用品 Lotion'],['🛏️','床 Bed'],['🪟','窗户 Window'],['🪴','植物 Plants'],
    ['🪑','家具 Chair'],['🛋️','沙发 Sofa'],['🔧','维修 Repair'],['🧰','工具 Tools'],
    ['🧻','纸巾 Tissue'],['🪥','刷牙 Teeth'],['👕','衣服 Clothes'],['🧦','袜子 Socks'],
    ['🧥','外套 Jacket'],['💡','灯 Light'],['🗑️','垃圾 Trash'],['🧵','针线 Sewing']
  ]},
  {id:'food',name:'饮食',icons:[
    ['🛒','购物 Grocery'],['🥦','蔬菜 Vegetables'],['🍎','水果 Fruit'],['🍽️','外食 Dine out'],
    ['🍳','做饭 Cooking'],['🥗','沙拉 Salad'],['🍜','面 Noodles'],['🍣','寿司 Sushi'],
    ['🍕','披萨 Pizza'],['🍔','汉堡 Burger'],['🥡','外卖 Takeout'],['🍱','便当 Bento'],
    ['🍰','甜点 Dessert'],['🥐','早餐 Brunch'],['🧋','奶茶 Bubble tea'],['☕','咖啡 Coffee'],
    ['🍵','茶 Tea'],['🍷','红酒 Wine'],['🥛','牛奶 Milk'],['🧃','饮料 Juice'],
    ['🥣','早餐 Breakfast'],['🥩','牛排 Steak'],['🍞','烘焙 Bread'],['🧀','奶酪 Cheese']
  ]},
  {id:'health',name:'运动健康',icons:[
    ['🏸','羽毛球 Badminton'],['🏃','跑步 Running'],['🏋️','力量 Gym'],['🚴','骑行 Cycling'],
    ['🏊','游泳 Swim'],['🧗','攀岩 Climbing'],['🏓','乒乓球 Ping pong'],['🏀','篮球 Basketball'],
    ['⚽','足球 Soccer'],['🥾','徒步 Hiking'],['🧘','瑜伽 Yoga'],['💪','锻炼 Strength'],
    ['🚶','散步 Walk'],['🏞️','公园 Park'],['🌲','户外 Nature'],['🛶','划船 Kayaking'],
    ['💊','药物 Medicine'],['🏥','医院 Hospital'],['🩺','医生 Doctor'],['🦷','牙医 Dentist'],
    ['😴','睡眠 Sleep'],['🧠','心理 Mind'],['🛌','休息 Rest'],['💆','按摩 Massage']
  ]},
  {id:'work',name:'工作学习',icons:[
    ['📚','书籍 Books'],['📖','阅读 Reading'],['📝','笔记 Notes'],['✍️','写作 Writing'],
    ['💻','电脑 Computer'],['🖥️','显示器 Desktop'],['⌨️','打字 Typing'],['📊','统计 Data'],
    ['🗓️','计划 Schedule'],['📅','日历 Calendar'],['💼','上班 Work'],['🗂️','文件 Documents'],
    ['📁','文件夹 Folder'],['📧','邮件 Email'],['📞','电话 Call'],['🧪','实验 Experiment'],
    ['🔬','科研 Research'],['🧫','培养皿 Lab'],['🎓','学位 Education'],['🏛️','机构 Office']
  ]},
  {id:'leisure',name:'休闲生活',icons:[
    ['🎬','电影 Movie'],['🎨','艺术 Art'],['🎵','音乐 Music'],['🎧','听歌 Headphones'],
    ['🎹','钢琴 Piano'],['🎮','游戏 Gaming'],['🎲','桌游 Games'],['🎤','唱歌 Singing'],
    ['🎭','表演 Theater'],['📸','拍照 Photography'],['📷','相机 Camera'],['🎟️','活动 Event'],
    ['🧩','拼图 Puzzle'],['📺','电视 TV'],['🏖️','度假 Beach'],['📱','手机 Phone'],
    ['🐈','猫 Cat'],['🐕','狗 Dog'],['💬','聊天 Chat'],['🎁','礼物 Gift'],
    ['🛍️','逛街 Shopping'],['💇','理发 Haircut']
  ]},
  {id:'travel',name:'出行其他',icons:[
    ['🚗','汽车 Car'],['🚕','出租车 Taxi'],['🚆','火车 Train'],['🚌','公交 Bus'],
    ['✈️','飞机 Airplane'],['🚲','自行车 Bicycle'],['🚉','地铁 Metro'],['⛽','加油 Gas'],
    ['🚘','驾车 Driving'],['🏡','家 Home'],['🏙️','城市 City'],['🌃','夜景 Night'],
    ['🏔️','山 Mountain'],['⛰️','登山 Summit'],['🏕️','露营 Camping'],['📍','地点 Location'],
    ['🗺️','地图 Map'],['🧳','行李 Luggage'],['💳','支付 Card'],['💰','金钱 Money'],
    ['🏦','银行 Bank'],['☀️','天气 Sun'],['🌙','夜晚 Moon'],['⭐','收藏 Star'],
    ['❤️','喜欢 Love'],['✅','完成 Check']
  ]}
];
const PREVIEW = window.ROUTINE_PREVIEW === true;
const DAY = 86400000;
let state;
let currentPage = 'home';
let lastUndoId = null;
let toastTimer = 0;
let importMode = 'view';
let saveChain = Promise.resolve();
const acceptQuickTap = createTapGuard();
const frequencyUnits = new Map();
let renderedDay;

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
function frequencyFor(a) {
  const result = activityFrequency(a, state.logs, new Date(), frequencyUnits.get(a.id));
  if (result.unit) frequencyUnits.set(a.id, result.unit);
  else frequencyUnits.delete(a.id);
  return result;
}
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
      </button><div class="activity-bottom"><span class="activity-status"><span class="activity-today">今日 ${periodCount(a.id,1)} 次</span><span class="activity-last">${recent?'上次 · <span class="activity-last-value">'+since(recent.occurredAt)+'</span>':'点按开始记录'}</span></span>
      ${isViewer()?'':`<button class="activity-backfill" data-action="backfill" data-id="${escAttr(a.id)}" aria-label="补记 ${escAttr(a.name)}">补记</button>`}</div></div>`;
  }).join('');
  const addCard=isViewer()?'':`<button class="activity-card activity-add" data-action="add"><span class="plus-bubble">${icon('plus')}</span><span>新增事项</span></button>`;
  return `${viewerBanner()}<div class="page-heading"><div><p class="eyebrow">Notice your rhythm</p><h1 class="page-title">日常记录</h1></div></div>
  ${backupBanner()}
  <div class="section-head"><h2 class="section-title">我的事项</h2><span class="section-note">轻点记录今天</span></div>
  <div class="record-toolbar"><label class="searchbox">${icon('search')}<input id="activitySearch" type="search" autocomplete="off" placeholder="查找事项…" aria-label="查找事项"></label>
   ${isViewer()?'':`<button class="button button-secondary" data-action="add">${icon('plus')} 新增</button>`}</div>
  ${n?`<div class="activity-grid" id="activityGrid">${cards}${addCard}</div>`:emptyBlock('还没有事项','先新增一件你希望观察频率的事情。',isViewer()?'':`<button class="button button-primary" data-action="add">${icon('plus')} 新增事项</button>`)}
  <div class="section-head"><h2 class="section-title">最近记录</h2><button class="text-link" data-nav="history">查看全部 ${icon('chevron-right')}</button></div>
  ${logs.length ? `<div class="surface-list">${logs.slice(0,4).map(l=>entryRow(l,false)).join('')}</div>` : emptyBlock('从第一次记录开始','这里会显示你最近记录的活动。')}
  `;
}
function entryRow(l,editable=true) {
  const a=activityById(l.activityId);
  return `<div class="list-row"><div class="row-icon" aria-hidden="true">${iconFor(a)}</div><div class="row-text"><div class="row-title">${escapeHTML(a?.name || '未知事项')}</div><div class="row-description">${dateLong(l.occurredAt)}${dateKey(l.occurredAt)!==dateKey(l.recordedAt)?' · 补记':''}</div></div>
  ${editable && !isViewer()?`<button class="row-button" data-action="edit-log" data-id="${escAttr(l.id)}" aria-label="编辑记录">${icon('edit')}</button>`:`<div class="row-trailing">${dateShort(l.occurredAt)}</div>`}</div>`;
}
function insightsPage() {
  const items=active().map(a=>({a,thirty:periodCount(a.id,30),seven:periodCount(a.id,7),all:entriesByActivity(a.id).length,freq:frequencyFor(a),last:lastEntry(a.id)}));
  return `${viewerBanner()}<div class="page-heading"><div><p class="eyebrow">Insights</p><h1 class="page-title">活动统计</h1></div></div>
  <p class="tiny-notice frequency-explanation">频率根据近 30 天记录估算，月按 30 天折算；不足 30 天时按实际观察天数计算。</p>
  <div class="insights-grid">${items.map(({a,thirty,seven,all,freq,last})=>`
    <button class="insight-card" data-action="activity-detail" data-id="${escAttr(a.id)}" aria-label="查看${escAttr(a.name)}的记录详情">
      <div class="insight-card-top"><span class="row-icon" aria-hidden="true">${iconFor(a)}</span><span class="insight-card-title">${escapeHTML(a.name)}<small>${last?`上次 · ${since(last.occurredAt)}`:'暂无记录'}</small></span>${icon('chevron-right')}</div>
      <div class="insight-frequency"><span class="insight-frequency-label">频率</span><strong>${freq.label}</strong></div>
      ${freq.note?`<p class="frequency-note">${freq.note}</p>`:''}
      <div class="insight-metrics"><div><strong>${seven}</strong><small>近 7 天</small></div><div><strong>${thirty}</strong><small>近 30 天</small></div><div><strong>${all}</strong><small>累计</small></div></div>
    </button>`).join('')}</div>
  ${items.length?'':emptyBlock('还没有统计数据','添加事项后，就能在这里查看每项活动的频率。')}`;
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
  <p class="footer-note">Routine v2.2</p>`;
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
  const search=document.getElementById('activitySearch')?.value || '';
  app.innerHTML = (PREVIEW?`<div class="preview-banner"><span>预览版 2.1</span>演示数据与正式版完全分开，不影响你的记录。</div>`:'') + ({home:homePage, insights:insightsPage,history:historyPage,settings:settingsPage,manage:managePage}[currentPage] || homePage)();
  nav.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===currentPage));
  const pill=document.querySelector('.local-pill');
  if(pill) pill.innerHTML=`<span class="local-indicator"></span>${PREVIEW?'预览模式':isViewer()?'只读备份':'本地存储'}`;
  if (currentPage==='manage') nav.style.display='none'; else nav.style.display='';
  if (currentPage==='home' && search) {
    document.getElementById('activitySearch').value=search;
    filterActivities(search);
  }
  renderedDay=todayKey();
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
  let submitting=false;
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(submitting)return;submitting=true;
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try{await onSubmit(new FormData(form));}catch(err){toast(err.message||'操作失败');}
    finally{submitting=false;submit.disabled=false;}
  });
  modalRoot.querySelector('.modal-scrim').addEventListener('click',e=>{if(e.target.classList.contains('modal-scrim'))dismissModal();});
  if(options.focus) setTimeout(()=>document.getElementById(options.focus)?.focus(),90);
}
function emojiOptions(chosen='🧺') {
  const categories=ICON_GROUPS.map(group=>`<button type="button" class="emoji-category ${group.id==='common'?'active':''}" data-icon-category="${group.id}" aria-pressed="${group.id==='common'}">${group.name}</button>`).join('');
  const sections=ICON_GROUPS.map(group=>`<div class="emoji-section" data-icon-group="${group.id}"><div class="emoji-group-title">${group.name}</div><div class="emoji-grid">${group.icons.map(([emoji,keywords])=>`<button type="button" class="emoji-option ${emoji===chosen?'selected':''}" data-emoji="${escAttr(emoji)}" data-icon-search="${escAttr((keywords+' '+emoji).toLowerCase())}" aria-label="${escAttr(keywords)}" aria-pressed="${emoji===chosen}">${emoji}</button>`).join('')}</div></div>`).join('');
  return `<div class="emoji-tool" id="emojiTool" data-category="common">
    <div class="emoji-current"><span id="emojiSelected" aria-hidden="true">${escapeHTML(chosen)}</span><div><strong>选一个图标</strong><small>可搜索、按类别找，或自定义</small></div></div>
    <div class="emoji-categories" aria-label="图标类别">${categories}</div>
    <label class="emoji-search">${icon('search')}<input id="emojiSearch" type="search" placeholder="搜索图标，如 洗衣 / coffee" autocomplete="off" aria-label="搜索图标"></label>
    <div class="emoji-gallery" id="emojiGallery">${sections}<p class="emoji-empty" id="emojiEmpty" hidden>没有找到图标，可以自定义输入。</p></div>
    <label class="emoji-custom-label" for="emojiCustom">自定义 Emoji <span>使用 iPhone 表情键盘</span></label>
    <input id="emojiCustom" class="emoji-custom-input" type="text" maxlength="24" autocomplete="off" inputmode="text" value="${escAttr(chosen)}" placeholder="输入或粘贴一个 Emoji">
    <input type="hidden" id="emojiInput" name="emoji" value="${escAttr(chosen)}">
  </div>`;
}
function filterEmojiPicker() {
  const tool=document.getElementById('emojiTool');if(!tool)return;
  const query=document.getElementById('emojiSearch').value.toLocaleLowerCase().trim();
  let matches=0;
  tool.querySelectorAll('.emoji-section').forEach(section=>{
    const group=section.dataset.iconGroup;
    const groupAllowed=query?true:tool.dataset.category===group;
    let localMatches=0;
    section.querySelectorAll('.emoji-option').forEach(option=>{
      const match=groupAllowed && (!query || option.dataset.iconSearch.includes(query));
      option.hidden=!match;
      if(match)localMatches++;
    });
    section.hidden=!localMatches;
    matches+=localMatches;
  });
  tool.querySelector('#emojiEmpty').hidden=matches!==0;
  // Searching shows matching icons from all categories.
}
function chooseEmoji(value) {
  const tool=document.getElementById('emojiTool');if(!tool)return;
  const selected=String(value||'').trim();if(!selected)return;
  const grapheme=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(selected)][0]?.segment:[...selected][0];
  if(!grapheme)return;
  const emoji=grapheme.slice(0,12);
  tool.querySelector('#emojiSelected').textContent=emoji;
  tool.querySelector('#emojiInput').value=emoji;
  tool.querySelector('#emojiCustom').value=emoji;
  tool.querySelectorAll('.emoji-option').forEach(button=>{
    const selected=button.dataset.emoji===emoji;
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  });
}
function editActivityModal(id) {
  if(!ensureEditable())return;
  const a=activityById(id);const editing=!!a;
  openModal(editing?'编辑事项':'新增事项',`<div class="field"><label for="activityName">名称</label><input id="activityName" name="name" maxlength="45" required autocomplete="off" placeholder="例如：Laundry / 读书 / 洗车" value="${editing?escAttr(a.name):''}"></div><div class="field">${emojiOptions(editing?a.emoji:'🧺')}</div>`,async data=>{
    const name=String(data.get('name')||'').trim();const emoji=String(data.get('emoji')||'🧺');
    if(!name)throw new Error('请输入事项名称');
    if(state.activities.some(item=>item.name.toLowerCase()===name.toLowerCase()&&item.id!==id))throw new Error('已有同名事项');
    if(editing){a.name=name;a.emoji=emoji;}else{state.activities.push({id:makeId(),name,emoji,order:Math.max(-1,...state.activities.map(x=>x.order))+1,archived:false,createdAt:new Date().toISOString()});}
    dismissModal();render();await persist();toast(editing?'事项已更新':'事项已添加，可以立即记录');
  },{focus:'activityName',submitText:editing?'保存修改':'添加事项'});
  filterEmojiPicker();
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
  const frequency=frequencyFor(a);
  const lastItems=entries.slice(0,8).map(l=>`<div class="detail-date"><span>${dateLong(l.occurredAt)}</span><span>${dateKey(l.occurredAt)!==dateKey(l.recordedAt)?'补记':''}</span></div>`).join('');
  openModal(a.name,`<div class="detail-frequency"><small>频率</small><strong>${frequency.label}</strong></div>
    ${frequency.note?`<p class="frequency-note">${frequency.note}</p>`:''}
    <div class="insight-metrics detail-metrics"><div><strong>${periodCount(id,7)}</strong><small>近 7 天</small></div><div><strong>${periodCount(id,30)}</strong><small>近 30 天</small></div><div><strong>${entries.length}</strong><small>累计</small></div></div>
    <h3 class="detail-section-title">最近记录</h3>
    ${lastItems?`<div class="detail-dates">${lastItems}</div>`:`<p class="tiny-notice">暂无记录</p>`}
    <p class="tiny-notice" style="margin-top:14px">频率根据近 30 天内已观察时段的记录估算，月按 30 天折算。至少观察 7 天，且在不同日期有至少 2 条记录后显示；漏记会使估算偏低。开始观察前的补记保留在次数和历史中，不用于推算频率。</p>`,async()=>dismissModal(),{submitText:'关闭'});
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
    state=backup;frequencyUnits.clear();currentPage=importMode==='view'?'insights':'home';render();await persist();toast(importMode==='view'?'只读备份已载入':'数据已恢复');
  }catch(e){console.error(e);alert(`无法导入备份：${e.message}`);}
}
function snoozeBackup(){state.meta.reminderSnoozedUntil=new Date(Date.now()+7*DAY).toISOString();render();persist();}

document.addEventListener('click',async event=>{
  const target=event.target.closest('button,[data-nav]');if(!target)return;
  const page=target.dataset.nav;if(page){event.preventDefault();navigate(page);return;}
  const action=target.dataset.action;if(!action)return;
  const id=target.dataset.id;
  switch(action){
    case 'log':if(ensureEditable() && acceptQuickTap(id))await logActivity(id);break;
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
  const cat=event.target.closest('[data-icon-category]');
  if(cat){
    const tool=document.getElementById('emojiTool');if(!tool)return;
    tool.dataset.category=cat.dataset.iconCategory;
    tool.querySelectorAll('[data-icon-category]').forEach(b=>{
      b.classList.toggle('active',b===cat);b.setAttribute('aria-pressed',String(b===cat));
    });
    tool.querySelector('#emojiSearch').value='';filterEmojiPicker();return;
  }
  const button=event.target.closest('[data-emoji]');
  if(button){chooseEmoji(button.dataset.emoji);}
});
document.addEventListener('input',event=>{
  if(event.target.id==='emojiSearch') filterEmojiPicker();
  if(event.target.id==='emojiCustom' && event.target.value.trim()) chooseEmoji(event.target.value);
});
function filterActivities(value) {
  const query=value.toLocaleLowerCase().trim();
  document.querySelectorAll('#activityGrid .activity-card[data-name]').forEach(card=>{card.hidden=!card.dataset.name.includes(query);});
}
document.addEventListener('input',event=>{
  if(event.target.id==='activitySearch')filterActivities(event.target.value);
});
function refreshDay() {
  if(state && !document.hidden && !modalRoot.innerHTML && renderedDay!==todayKey())render();
}
document.addEventListener('visibilitychange',refreshDay);
window.addEventListener('focus',refreshDay);
setInterval(refreshDay,60000);
importFile.addEventListener('change',importBackup);
document.addEventListener('keydown',event=>{if(event.key==='Escape')dismissModal();});
window.addEventListener('hashchange',()=>{if(!modalRoot.innerHTML && ['home','insights','history','settings'].includes(location.hash.slice(1)))navigate(location.hash.slice(1));});
async function init(){
  try{const data=await readLocal();state=data&&data.schema===2?data:initialState();if(!data)await writeLocal(state);}catch(err){
    console.error('IndexedDB unavailable',err);app.innerHTML=`<div class="empty-state"><strong>无法使用本地存储</strong><p>Routine 需要 iPhone 浏览器的 IndexedDB 保存记录。请关闭无痕浏览，检查 Safari 网站数据设置，然后重新打开页面。<br>${escapeHTML(err.message)}</p></div>`;nav.style.display='none';return;
  }
  const desired=location.hash.slice(1);currentPage=['home','insights','history','settings'].includes(desired)?desired:'home';render();
  if(!PREVIEW && 'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Offline cache unavailable',err));
  navigator.storage?.persist?.().catch(()=>{});
}
init();
