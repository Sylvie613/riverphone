/**
 * RiverPhone v0.1.1
 * Standalone SillyTavern extension by River × Sylvie.
 * Host-page implementation: no Tavern Helper iframe is required.
 */

const EXT = 'RiverPhone';
const MODULE_KEY = 'riverphone_sylvie';
const SETTINGS_KEY = 'riverphone_sylvie_settings';
const ACTIVITY_PROMPT_KEY = 'riverphone_sylvie_activity';
const CONTRACT_PROMPT_KEY = 'riverphone_sylvie_contract';

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10 5h4M11 18.8h2"/></svg>';

const DEFAULT_STATE = {
  status: {
    date: '2026年4月1日 · 星期三',
    event: '迟到的回复',
    time: '23:58',
    place: '江城大学 · 204宿舍',
    weather: '春夜 · 微凉',
    state: '黑色连帽外套，耳机挂在颈间，坐在电竞椅里反复查看手机。',
    affection: 0,
    delta: 0,
    thought: '不想理这条搭讪。可另一边为什么还是没有回复。',
    onlineAffection: 50,
    offlineAffection: 0
  },
  phone: {
    phone_time: '23:58',
    phone_date: '4月1日 · 周三',
    battery: 67,
    unread: 3,
    notice: ['Night：晚安。', '204宿舍群有 2 条新消息'],
    message: 'Night：你看到我之前说的话了吗？'
  },
  memory: {
    round: '0/10',
    short: '余斯是以 Night 的身份试探心意，却被装作没看见。',
    long: '尚无长期记录',
    core: 'Night 与线下的余斯是是同一人；掉马前不得无依据泄露身份。'
  },
  contacts: [
    { id: 'night', name: 'Night', subtitle: '游戏好友' },
    { id: 'yusishi', name: '余斯是', subtitle: '江城大学 · 音乐系' },
    { id: 'room204', name: '204宿舍群', subtitle: '4人群聊', group: true }
  ],
  threads: {
    night: [
      { from: 'them', text: '我觉得我们好暧昧啊。', time: '21:31' },
      { from: 'them', text: '我可能有点喜欢你。', time: '21:32' },
      { from: 'them', text: '你看到我之前说的话了吗？', time: '23:54' },
      { from: 'them', text: '晚安。', time: '23:57' }
    ],
    yusishi: [
      { from: 'me', text: '睡了吗。', time: '23:57' },
      { from: 'them', text: '睡了。', time: '23:58' }
    ],
    room204: [
      { from: 'them', sender: '裴鹤一', text: '@Night 人呢？不是说赢了这把就睡吗？', time: '23:45' },
      { from: 'them', sender: '姜予', text: '你就理理他吧，他要玉玉了。', time: '23:46' },
      { from: 'them', sender: '韩宥希', text: '他咋了？怎么退队了。', time: '23:47' }
    ]
  },
  activities: []
};

const ui = { open: false, view: 'home', contactId: null, busy: false, initialized: false };
let fallbackState = structuredClone(DEFAULT_STATE);

function ctx() {
  try { return globalThis.SillyTavern?.getContext?.() || {}; }
  catch (e) { console.warn('[RiverPhone] context unavailable', e); return {}; }
}

function mergeDefaults(target, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(target) ? target : structuredClone(defaults);
  const out = { ...(target || {}) };
  for (const [k, v] of Object.entries(defaults)) {
    if (out[k] === undefined) out[k] = structuredClone(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = mergeDefaults(out[k], v);
  }
  return out;
}

function settings() {
  const c = ctx();
  const defaults = { enabled: true };
  if (!c.extensionSettings) return defaults;
  c.extensionSettings[SETTINGS_KEY] = mergeDefaults(c.extensionSettings[SETTINGS_KEY], defaults);
  return c.extensionSettings[SETTINGS_KEY];
}

function state() {
  const c = ctx();
  if (!c.chatMetadata) return fallbackState;
  c.chatMetadata[MODULE_KEY] = mergeDefaults(c.chatMetadata[MODULE_KEY], DEFAULT_STATE);
  return c.chatMetadata[MODULE_KEY];
}

async function saveState() {
  try { await ctx().saveMetadata?.(); } catch (e) { console.warn('[RiverPhone] metadata save failed', e); }
  await updateActivityPrompt();
}

function saveSettings() { ctx().saveSettingsDebounced?.(); }

function esc(v) {
  return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function compact(v, n=120) {
  const s = String(v ?? '').replace(/\s+/g,' ').trim();
  return s.length > n ? s.slice(0,n) + '…' : s;
}
function nowTime() {
  return state().phone.phone_time || state().status.time || new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function activeCharacter() {
  const c = ctx();
  return c.characters?.[c.characterId] || c.characters?.[c.character_id] || {};
}
function isYuSishiChat() {
  const ch = activeCharacter();
  const hay = [ch.name, ch.description, ch.personality, ch.creator_notes].filter(Boolean).join('\n');
  return /余斯是|Yu\s*Sishi|Night/i.test(hay);
}

function parseJsonLoose(raw) {
  if (!raw) return null;
  let t = String(raw).trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'');
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    t = t.slice(a,b+1).replace(/,\s*([}\]])/g,'$1');
    try { return JSON.parse(t); } catch {}
  }
  return null;
}
function kv(text) {
  const out = {};
  for (const line of String(text||'').split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
function parsePayload(message) {
  if (!message) return null;
  for (const re of [
    /<!--\s*RIVERPHONE\s*([\s\S]*?)\s*RIVERPHONE\s*-->/i,
    /<river_phone_data>\s*([\s\S]*?)\s*<\/river_phone_data>/i
  ]) {
    const m = String(message).match(re);
    const parsed = m && parseJsonLoose(m[1]);
    if (parsed) return parsed;
  }
  const sm = String(message).match(/<yusishi_status>\s*([\s\S]*?)\s*<\/yusishi_status>/i);
  const mm = String(message).match(/<yusishi_memory>\s*([\s\S]*?)\s*<\/yusishi_memory>/i);
  if (!sm && !mm) return null;
  const raw = sm ? kv(sm[1]) : {};
  const status = {}, phone = {};
  for (const [k,v] of Object.entries(raw)) {
    if (k.startsWith('phone_') || ['battery','unread','notice','message'].includes(k)) phone[k] = v;
    else status[k] = v;
  }
  return { status, phone, memory: mm ? kv(mm[1]) : {} };
}

function normalizeArray(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (!v || v === '无') return [];
  return String(v).split(/[；;|]/).map(x=>x.trim()).filter(Boolean);
}

async function applyPayload(payload, messageId=null) {
  if (!payload || typeof payload !== 'object') return;
  const s = state();
  if (payload.status) s.status = { ...s.status, ...payload.status };
  if (payload.phone) {
    const p = { ...payload.phone };
    if (p.notice !== undefined) p.notice = normalizeArray(p.notice);
    s.phone = { ...s.phone, ...p };
  }
  if (payload.memory) s.memory = { ...s.memory, ...payload.memory };
  const messages = payload.events?.messages || [];
  for (const m of messages) {
    const id = m.contact_id || m.contactId || 'yusishi';
    s.threads[id] ||= [];
    s.threads[id].push({ from:'them', sender:m.sender || '', text:String(m.text||''), time:m.time || nowTime() });
  }
  if (messageId !== null && payload.status) renderInlineStatus(messageId, payload);
  await saveState();
  renderPhone();
}

function buildActivityPrompt() {
  const s = state();
  const recent = (s.activities || []).slice(-8).join('\n');
  return recent ? '【RiverPhone最近手机互动】\n' + recent + '\n这些互动已经发生，应视为当前剧情事实。' : '';
}
async function updateActivityPrompt() {
  const c = ctx();
  if (!c.setExtensionPrompt) return;
  try { await c.setExtensionPrompt(ACTIVITY_PROMPT_KEY, buildActivityPrompt(), 1, 1, false, 0); } catch {}
}
function contract() {
  return '每次完成正文后，在回复末尾追加不可见HTML注释，不要代码围栏：\n' +
  '<!--RIVERPHONE\n{"status":{"date":"故事日期与星期","event":"不超过10字","time":"时间","place":"地点","weather":"天气","state":"余斯是衣着动作","thought":"真实心理","onlineAffection":50,"offlineAffection":0},' +
  '"phone":{"phone_time":"时间","phone_date":"日期","battery":67,"unread":0,"notice":[],"message":"最近消息或无"},' +
  '"memory":{"round":"1/10","short":"短期关键事实","long":"累计长期记忆","core":"稳定关系事实"},' +
  '"events":{"messages":[]}}\nRIVERPHONE-->\n' +
  '状态与记忆继承上一轮；手机事件只在剧情自然发生时新增。';
}
async function installContract() {
  const c = ctx();
  if (!c.setExtensionPrompt || !isYuSishiChat()) return;
  try { await c.setExtensionPrompt(CONTRACT_PROMPT_KEY, contract(), 1, 0, false, 0); } catch (e) { console.warn('[RiverPhone] contract inject failed', e); }
}

function shell() {
  return '<section id="rp-phone-panel" aria-hidden="true"><div class="rp-shell"><div class="rp-screen">' +
  '<header class="rp-top"><span id="rp-os-time">23:58</span><span class="rp-word">RIVERPHONE</span><span id="rp-os-battery">67%</span></header>' +
  '<main id="rp-phone-body" class="rp-body"></main>' +
  '<nav class="rp-nav"><button type="button" data-rp-action="back">返回</button><button type="button" data-rp-action="home">主页</button><button type="button" data-rp-action="close">关闭</button></nav>' +
  '</div></div></section>';
}

function bindLauncher(fab) {
  if (!fab || fab.dataset.rpBound === '1') return;
  fab.dataset.rpBound = '1';
  const toggle = e => {
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById('rp-phone-panel');
    if (!panel) return;
    ui.open = !ui.open;
    panel.classList.toggle('open', ui.open);
    panel.setAttribute('aria-hidden', String(!ui.open));
    if (ui.open) renderPhone();
  };
  fab.addEventListener('click', toggle, { passive: false });
  fab.addEventListener('touchend', toggle, { passive: false });
}

function ensureLauncher() {
  let fab = document.getElementById('rp-phone-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'rp-phone-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', '打开 RiverPhone');
    fab.innerHTML = ICON + '<span id="rp-fab-badge"></span>';
    fab.dataset.owner = 'riverphone-extension';
    document.body.append(fab);
  }
  bindLauncher(fab);
  fab.style.setProperty('display', settings().enabled === false ? 'none' : 'grid', 'important');
  fab.style.setProperty('visibility', 'visible', 'important');
  fab.style.setProperty('opacity', '1', 'important');
  return fab;
}

function initUi() {
  document.getElementById('rp-root')?.remove();
  document.getElementById('rp-phone-fab')?.remove();
  document.getElementById('rp-settings')?.remove();

  const root = document.createElement('div');
  root.id = 'rp-root';
  root.dataset.owner = 'riverphone-extension';
  root.innerHTML = shell();
  document.body.append(root);

  ensureLauncher();
  const panel = root.querySelector('#rp-phone-panel');
  panel.addEventListener('click', handleClick);
  panel.addEventListener('submit', handleSubmit);

  mountSettings();
  applySettings();
  renderPhone();
}

function applySettings() {
  const enabled = settings().enabled !== false;
  const root = document.getElementById('rp-root');
  const fab = document.getElementById('rp-phone-fab');
  if (root) root.style.display = enabled ? '' : 'none';
  if (fab) fab.style.setProperty('display', enabled ? 'grid' : 'none', 'important');
}
function closePhone() {
  ui.open = false;
  const p = document.getElementById('rp-phone-panel');
  p?.classList.remove('open'); p?.setAttribute('aria-hidden','true');
}

function homeHtml(s) {
  return '<section class="rp-hero"><small>' + esc(s.phone.phone_date || s.status.date) + '</small><h1>' + esc(s.phone.phone_time || s.status.time) + '</h1><p>' + esc(s.status.weather) + ' · ' + esc(s.status.place) + '</p></section>' +
  '<div class="rp-grid">' +
    card('messages','消息','Night / 余斯是 / 204宿舍') +
    card('status','状态',compact(s.status.event,20)) +
    card('memory','记忆',esc(s.memory.round || '0/10')) +
    card('notice','通知',compact((s.phone.notice||[])[0] || s.phone.message || '暂无',24)) +
  '</div>';
}
function card(view,title,sub) {
  return '<button class="rp-home-card" type="button" data-rp-view="' + view + '"><span>' + esc(sub) + '</span><b>' + esc(title) + '</b><span>打开</span></button>';
}
function titleBar(title) {
  return '<div class="rp-section-title"><button class="rp-back" type="button" data-rp-action="back">‹</button><h2>' + esc(title) + '</h2></div>';
}
function messagesHtml(s) {
  return titleBar('消息') + s.contacts.map(c => {
    const t = s.threads[c.id] || [], last = t[t.length-1];
    return '<button class="rp-contact" type="button" data-rp-contact="' + esc(c.id) + '"><span class="rp-avatar">' + esc(c.name.slice(0,1)) + '</span><span class="rp-contact-main"><b>' + esc(c.name) + '</b><p>' + esc(last?.text || c.subtitle) + '</p></span><em>' + esc(last?.time || '') + '</em></button>';
  }).join('');
}
function threadHtml(s,id) {
  const c = s.contacts.find(x=>x.id===id) || s.contacts[0], t=s.threads[id] || [];
  return titleBar(c.name) + '<div class="rp-thread">' + t.map(m => '<div class="rp-msg ' + (m.from==='me'?'me':m.from==='system'?'system':'them') + '">' + (m.sender?'<b>'+esc(m.sender)+'</b><br>':'') + esc(m.text) + '<small>' + esc(m.time||'') + '</small></div>').join('') + '</div>' +
  '<form class="rp-compose" data-rp-form="' + esc(c.id) + '"><input id="rp-message-input" autocomplete="off" placeholder="发消息…"><button type="submit">发送</button></form>';
}
function statusHtml(s) {
  return titleBar('状态') + '<div class="rp-pills"><div class="rp-pill"><small>线下</small><b>'+esc(s.status.offlineAffection)+'</b></div><div class="rp-pill"><small>Night</small><b>'+esc(s.status.onlineAffection)+'</b></div><div class="rp-pill"><small>未读</small><b>'+esc(s.phone.unread||0)+'</b></div></div>' +
  stat('现在',s.status.state)+stat('INNER NOTE',s.status.thought)+stat('地点',s.status.time+' · '+s.status.place);
}
function memoryHtml(s) {
  return titleBar('记忆') + stat('ROUND',s.memory.round)+stat('SHORT',s.memory.short)+stat('LONG',s.memory.long)+stat('CORE',s.memory.core);
}
function noticeHtml(s) {
  return titleBar('通知') + (normalizeArray(s.phone.notice).map(x=>stat('NOTICE',x)).join('') || stat('NOTICE','暂无新通知'));
}
function stat(k,v){ return '<div class="rp-stat"><small>'+esc(k)+'</small><p>'+esc(v||'无')+'</p></div>'; }

function renderPhone() {
  const s=state(), body=document.getElementById('rp-phone-body');
  if (!body) return;
  document.getElementById('rp-os-time').textContent=s.phone.phone_time || s.status.time || '';
  document.getElementById('rp-os-battery').textContent=Math.max(0,Math.min(100,Number(s.phone.battery||0)))+'%';
  const badge=document.getElementById('rp-fab-badge'), n=Number(s.phone.unread||0);
  badge.textContent=n>99?'99+':n?String(n):''; badge.classList.toggle('on',n>0);
  if (ui.view==='messages') body.innerHTML=messagesHtml(s);
  else if (ui.view==='thread') body.innerHTML=threadHtml(s,ui.contactId);
  else if (ui.view==='status') body.innerHTML=statusHtml(s);
  else if (ui.view==='memory') body.innerHTML=memoryHtml(s);
  else if (ui.view==='notice') body.innerHTML=noticeHtml(s);
  else body.innerHTML=homeHtml(s);
  requestAnimationFrame(()=>{ const b=document.querySelector('.rp-body'); if(ui.view==='thread'&&b) b.scrollTop=b.scrollHeight; });
}

function handleClick(e) {
  const action=e.target.closest('[data-rp-action]')?.dataset.rpAction;
  if (action==='close') return closePhone();
  if (action==='home'){ui.view='home';ui.contactId=null;return renderPhone();}
  if (action==='back'){ui.view=ui.view==='thread'?'messages':'home';ui.contactId=null;return renderPhone();}
  const view=e.target.closest('[data-rp-view]')?.dataset.rpView;
  if(view){ui.view=view;return renderPhone();}
  const id=e.target.closest('[data-rp-contact]')?.dataset.rpContact;
  if(id){ui.view='thread';ui.contactId=id;return renderPhone();}
}

function recentStory() {
  return (ctx().chat||[]).slice(-8).map(m=>(m.is_user?'User: ':'Character: ')+compact(m.mes,700)).join('\n');
}
function cardContext() {
  const c=activeCharacter();
  return [c.name,c.description,c.personality,c.scenario].filter(Boolean).join('\n').slice(0,10000);
}
async function phoneReply(contactId,text) {
  const s=state(), c=s.contacts.find(x=>x.id===contactId)||s.contacts[0];
  if(!ctx().generateRaw) throw new Error('当前 SillyTavern 未提供 generateRaw');
  const history=(s.threads[contactId]||[]).slice(-12).map(m=>(m.from==='me'?'User':m.sender||c.name)+': '+m.text).join('\n');
  const identity=contactId==='night'
    ? '你是余斯是使用的线上账号 Night。你知道自己就是线下余斯是；掉马前不得主动暴露。'
    : contactId==='yusishi'
      ? '你是线下身份余斯是。保持角色卡性格与当前关系阶段。'
      : '你在模拟204宿舍群聊，从余斯是、裴鹤一、姜予、韩宥希中选择最自然的发言者。';
  const raw=await ctx().generateRaw({
    systemPrompt:'只生成剧情中的手机回复，不续写主叙事。'+identity+'\n角色资料：'+cardContext()+'\n只返回JSON：{"text":"回复","sender":"群聊发言者，私聊留空","time":"故事内时间"}。',
    prompt:'最近主剧情：\n'+recentStory()+'\n\n手机记录：\n'+history+'\n\nUser刚发送：'+text,
    quietToLoud:false,skipTemplate:true
  });
  const p=parseJsonLoose(typeof raw==='string'?raw:(raw?.message||raw?.text||'')) || {text:compact(raw,400)};
  return {text:String(p.text||p.message||'').trim(),sender:p.sender||'',time:p.time||nowTime()};
}
async function handleSubmit(e) {
  const form=e.target.closest('[data-rp-form]'); if(!form) return;
  e.preventDefault();
  const input=form.querySelector('input'), text=input.value.trim(); if(!text||ui.busy)return;
  const id=form.dataset.rpForm,s=state(),c=s.contacts.find(x=>x.id===id)||s.contacts[0];
  s.threads[id]||=[]; s.threads[id].push({from:'me',text,time:nowTime()}); input.value=''; ui.busy=true; await saveState(); renderPhone();
  try{
    const r=await phoneReply(id,text);
    s.threads[id].push({from:'them',sender:r.sender,text:r.text||'…',time:r.time});
    s.phone.message=(r.sender||c.name)+'：'+(r.text||'…');
    s.phone.unread=Math.max(0,Number(s.phone.unread||0));
    s.activities.push('你给'+c.name+'发送：'+text+'；'+(r.sender||c.name)+'回复：'+(r.text||'…'));
  }catch(err){
    console.error('[RiverPhone] phone reply failed',err);
    s.threads[id].push({from:'system',text:'消息暂时没有送达：'+err.message,time:nowTime()});
  }finally{ui.busy=false;await saveState();renderPhone();}
}

function messageElement(id) {
  return document.querySelector('.mes[mesid="'+id+'"],.mes[data-message-id="'+id+'"]');
}
function renderInlineStatus(id,payload) {
  const mes=messageElement(id); if(!mes)return;
  mes.querySelector('.rp-inline-status')?.remove();
  const s={...state().status,...payload.status}, p={...state().phone,...payload.phone}, m={...state().memory,...payload.memory};
  const d=document.createElement('details'); d.className='rp-inline-status';
  d.innerHTML='<summary><b>'+esc(s.event)+'</b><span>'+esc(s.time)+' · '+esc(s.place)+'</span><span>⌄</span></summary><div class="rp-inline-inner"><p>'+esc(s.date)+' · '+esc(s.weather)+'</p><p>'+esc(s.state)+'</p><div class="rp-inline-grid"><div><small>线下</small><b>'+esc(s.offlineAffection)+'</b></div><div><small>Night</small><b>'+esc(s.onlineAffection)+'</b></div><div><small>未读</small><b>'+esc(p.unread||0)+'</b></div></div><p><b>INNER NOTE</b><br>'+esc(s.thought)+'</p><p><b>MEMORY · '+esc(m.round)+'</b><br>'+esc(m.short)+'</p></div>';
  (mes.querySelector('.mes_block')||mes).append(d);
}
async function processMessage(id) {
  const m=ctx().chat?.[Number(id)]; if(!m||m.is_user)return;
  const p=parsePayload(m.mes); if(p) await applyPayload(p,Number(id));
}
function scanExisting() {
  (ctx().chat||[]).forEach((m,i)=>{ if(!m?.is_user){const p=parsePayload(m.mes);if(p?.status)renderInlineStatus(i,p);} });
  const chat=ctx().chat||[]; for(let i=chat.length-1;i>=0;i--){if(!chat[i]?.is_user){const p=parsePayload(chat[i].mes);if(p){applyPayload(p,null);break;}}}
}
function subscribe() {
  const c=ctx(), e=c.event_types||c.eventTypes||{}; if(!c.eventSource?.on)return;
  c.eventSource.on(e.CHARACTER_MESSAGE_RENDERED||'character_message_rendered',id=>processMessage(id));
  c.eventSource.on(e.MESSAGE_EDITED||'message_edited',id=>processMessage(id));
  c.eventSource.on(e.MESSAGE_SWIPED||'message_swiped',id=>setTimeout(()=>processMessage(id),60));
  c.eventSource.on(e.CHAT_CHANGED||'chat_id_changed',async()=>{
    ui.view='home';ui.contactId=null;closePhone();await installContract();await updateActivityPrompt();setTimeout(scanExisting,150);renderPhone();applySettings();
  });
}

function mountSettings() {
  const host=document.querySelector('#extensions_settings,#extensions_settings2'); if(!host||document.getElementById('rp-settings'))return;
  const box=document.createElement('div');box.id='rp-settings';box.className='extension_container';
  box.innerHTML='<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>RiverPhone</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><label class="checkbox_label"><input id="rp-enabled" type="checkbox"><span>启用悬浮小手机</span></label><p class="notes">扩展直接运行在 SillyTavern 主页面，不依赖角色脚本 iframe。</p></div></div>';
  host.append(box);const input=box.querySelector('#rp-enabled');input.checked=settings().enabled!==false;
  input.addEventListener('change',()=>{settings().enabled=input.checked;saveSettings();applySettings();});
}

async function activate() {
  if(ui.initialized)return;ui.initialized=true;
  const s = settings();
  if (!s.launcherRecoveryV011) {
    s.enabled = true;
    s.launcherRecoveryV011 = true;
    saveSettings();
  }
  initUi();subscribe();await installContract();await updateActivityPrompt();setTimeout(scanExisting,180);
  setInterval(() => {
    if (!document.getElementById('rp-phone-fab')) ensureLauncher();
  }, 1500);
  console.info('[RiverPhone] v0.1.1 activated on host page');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',activate,{once:true});else queueMicrotask(activate);
