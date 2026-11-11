/**
 * RiverPhone v0.2.4
 * Standalone SillyTavern extension by River × Sylvie.
 * Host-page implementation: no Tavern Helper iframe is required.
 */

const MODULE_KEY = 'riverphone_sylvie';
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

const ui = { popup: null, panel: null, view: 'home', contactId: null, busy: false };
const hydratedStates = new WeakSet();

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

function state() {
  const metadata = ctx().chatMetadata;
  if (!metadata || !isYuSishiChat()) return DEFAULT_STATE;
  const current = metadata[MODULE_KEY];
  if (current && hydratedStates.has(current)) return current;
  const initial = mergeDefaults(current, DEFAULT_STATE);
  metadata[MODULE_KEY] = initial;
  hydratedStates.add(initial);
  return initial;
}

async function saveState() {
  try { await ctx().saveMetadata?.(); } catch (e) { console.warn('[RiverPhone] metadata save failed', e); }
  await updateActivityPrompt();
}

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
function activeCharacter(c = ctx()) {
  return c.characters?.[c.characterId] || c.characters?.[c.character_id] || {};
}
function isYuSishiChat() {
  const c = ctx();
  if (c.groupId || !(c.getCurrentChatId?.() ?? c.chatId)) return false;
  const character = activeCharacter(c);
  const name = String(character.name || character.data?.name || '').replace(/\s+/g, '').toLowerCase();
  return name === '余斯是' || name === 'yusishi' || character.data?.extensions?.[MODULE_KEY]?.profile === 'yusishi';
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

function explicitPhoneMessages(text) {
  const messages = [];
  const append = (name, content) => {
    const contact = DEFAULT_STATE.contacts.find(item => item.name.toLowerCase() === name.toLowerCase());
    const message = content.trim();
    if (message) messages.push({ contactId: contact.id, from: 'me', text: message });
  };
  for (const line of text.split(/\r?\n/)) {
    const quoted = [...line.matchAll(/我\s*(?:回复|回|给)\s*(Night|余斯是|204宿舍群)(?:\s*发(?:了)?(?:一?条)?消息)?\s*(?:说\s*)?[：:]?\s*(?:“([^”]+)”|「([^」]+)」|『([^』]+)』|"([^"]+)")/gi)];
    for (const match of quoted) append(match[1], match.slice(2).find(value => value !== undefined));
    if (quoted.length) continue;
    const plain = line.trim().match(/^我\s*(?:回复|回|给)\s*(Night|余斯是|204宿舍群)(?:\s*发(?:了)?(?:一?条)?消息)?\s*[：:]\s*(.+)$/i);
    if (plain) append(plain[1], plain[2]);
  }
  return messages;
}

function storyPhoneMessages(payload, userText, contacts) {
  const result = explicitPhoneMessages(userText);
  const explicitContacts = new Set(result.map(message => message.contactId));
  const events = Array.isArray(payload?.events?.messages) ? payload.events.messages : [];
  for (const event of events) {
    const text = typeof event?.text === 'string' ? event.text.trim() : '';
    if (!text) continue;
    const contactId = event.contact_id || event.contactId || 'yusishi';
    if (!contacts.some(contact => contact.id === contactId)) continue;
    const time = typeof event.time === 'string' ? event.time : '';
    if (event.from === 'me') {
      if (explicitContacts.has(contactId) || !userText.includes(text)) continue;
      result.push({ contactId, from: 'me', text, time });
    } else {
      const sender = typeof event.sender === 'string' ? event.sender : '';
      result.push({ contactId, from: 'them', text, time, sender });
    }
  }
  return result;
}

function syncStoryThreads(state, messageId, messages) {
  const defaultTime = state.phone.phone_time || state.status.time;
  let changed = false;
  for (const contact of state.contacts) {
    const thread = state.threads[contact.id] || [];
    const next = messages.filter(message => message.contactId === contact.id).map(message => ({
      from: message.from,
      sender: message.sender || '',
      text: message.text,
      time: message.time || defaultTime,
      storyMessageId: messageId,
    }));
    const previous = thread.filter(message => message.storyMessageId === messageId);
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    const index = thread.findIndex(message => message.storyMessageId === messageId);
    const merged = thread.filter(message => message.storyMessageId !== messageId);
    merged.splice(index < 0 ? merged.length : index, 0, ...next);
    state.threads[contact.id] = merged;
    changed = true;
  }
  return changed;
}

async function applyPayload(payload, messageId = null, messages = []) {
  if (!isYuSishiChat() || !payload || typeof payload !== 'object') return;
  const s = state();
  if (payload.status) {
    const next = { ...s.status, ...payload.status };
    if (messageId !== null) {
      const baseline = s.affectionTurn?.messageId === messageId ? s.affectionTurn : {
        messageId,
        online: Number(s.status.onlineAffection),
        offline: Number(s.status.offlineAffection),
      };
      s.affectionTurn = baseline;
      const onlineDelta = Number(next.onlineAffection) - baseline.online;
      const offlineDelta = Number(next.offlineAffection) - baseline.offline;
      next.onlineDelta = Number.isFinite(onlineDelta) ? onlineDelta : 0;
      next.offlineDelta = Number.isFinite(offlineDelta) ? offlineDelta : 0;
    }
    s.status = next;
  }
  if (payload.phone) {
    const p = { ...payload.phone };
    if (p.notice !== undefined) p.notice = normalizeArray(p.notice);
    s.phone = { ...s.phone, ...p };
  }
  if (payload.memory) s.memory = { ...s.memory, ...payload.memory };
  const threadsChanged = messageId !== null && syncStoryThreads(s, messageId, messages);
  if (!threadsChanged && !payload.status && !payload.phone && !payload.memory) return;
  if (messageId !== null && payload.status) renderInlineStatus(messageId, payload);
  await saveState();
  renderPhone();
}

function buildActivityPrompt() {
  if (!isYuSishiChat()) return '';
  const s = state();
  const recent = (s.activities || []).slice(-8).join('\n');
  const previous = {
    time: s.status.time,
    place: s.status.place,
    thought: compact(s.status.thought, 160),
    onlineAffection: s.status.onlineAffection,
    offlineAffection: s.status.offlineAffection,
    memory: {
      round: s.memory.round,
      short: s.memory.short,
      long: s.memory.long,
      core: s.memory.core,
    },
  };
  return '【RiverPhone 上一轮状态与记忆】\n' + JSON.stringify(previous) +
    '\n据此继续本轮剧情与手机记录，人物只能依据自己在剧情中知道的信息行动。' +
    (recent ? '\n【RiverPhone 最近手机互动】\n' + recent + '\n这些互动已经发生，应视为当前剧情事实。' : '');
}
async function updateActivityPrompt() {
  const c = ctx();
  if (!c.setExtensionPrompt) return;
  try { await c.setExtensionPrompt(ACTIVITY_PROMPT_KEY, buildActivityPrompt(), 1, 1, false, 0); } catch {}
}
function contract() {
  return '【正文视角】用第二人称续写：旁白中的「你」始终指用户扮演的萦岁；余斯是用「余斯是」「Night」或「他」指代。' +
  '即使前文出现过余斯是第一人称旁白，本轮也用这个视角接续已发生的剧情。' +
  '角色台词和手机消息保留自然人称，可以说「我」。例如：你低头看见屏幕亮了，余斯是发来一句：「我到楼下了。」\n' +
  '正常续写酒馆正文，接住用户这一条里的动作、当面说的话和手机互动。用户可以把这些内容写在同一段里。' +
  '例如「我收起耳机，跟室友说了声晚安，随后我回复 Night：『你还醒着吗？』。」' +
  '正文应写清角色怎么接话、怎么行动。角色发来手机回复时，在正文中写出实际回信文字，再将同一句抄进手机记录。' +
  '完整正文之后追加以下不可见HTML注释，不要代码围栏：\n' +
  '<!--RIVERPHONE\n{"status":{"date":"故事日期与星期","event":"不超过10字","time":"时间","place":"地点","weather":"天气","state":"余斯是衣着动作","thought":"真实心理","onlineAffection":50,"offlineAffection":0},' +
  '"phone":{"phone_time":"时间","phone_date":"日期","battery":67,"unread":0,"notice":[],"message":"最近消息或无"},' +
  '"memory":{"round":"1/10","short":"短期关键事实","long":"累计长期记忆","core":"稳定关系事实"},' +
  '"events":{"messages":[]}}\nRIVERPHONE-->\n' +
  '每轮根据实际剧情更新状态和余斯是未说出口的心理。Night与线下好感分别继承上一轮，只让相关互动带来变化，允许不变。' +
  '记忆只记录已经发生的关键事实。round 每轮推进一格，short 继承本周期的要点并加入本轮进展。满十轮把关键事实并入累计 long，保留旧长期记忆和 core，下轮从 1/10 开始。' +
  '如果用户在正文任何位置写「我回复 Night：『你还醒着吗？』」或「我回复余斯是：『到家了吗？』」，视为已经发出引号里的话。' +
  '在 events.messages 按发生顺序记录双方实际发出的消息。' +
  '每条形如 {"contact_id":"night","from":"me","text":"你还醒着吗？","time":"23:58"} 或 {"contact_id":"night","from":"them","text":"嗯，还醒着。","time":"23:59"}。' +
  'contact_id 只能是 night（Night）、yusishi（余斯是）、room204（204宿舍群）。本轮剧情自然带出的宿舍群新消息也记录到 room204，每条写明 sender，群成员只谈他们知道的事。' +
  'from 为 me 时逐字复制用户这轮写明要发送的内容，切勿替用户发言；from 为 them 时只写角色实际发出的手机文字，旁白留在正文。' +
  '如果角色这一轮还没回，就只记录用户发出的消息。如果本轮没有手机聊天，messages 留空。' +
  'Night 和线下余斯是的对话分开记录，身份未揭晓前遵守各自的知情边界。';
}
async function installContract() {
  const c = ctx();
  if (!c.setExtensionPrompt) return;
  try { await c.setExtensionPrompt(CONTRACT_PROMPT_KEY, isYuSishiChat() ? contract() : '', 1, 0, false, 0); } catch (e) { console.warn('[RiverPhone] contract inject failed', e); }
}

function shell() {
  const panel = document.createElement('section');
  panel.id = 'rp-phone-panel';
  panel.className = 'rp-shell';
  panel.innerHTML = `
    <div class="rp-screen">
      <header class="rp-top">
        <span id="rp-os-time"></span><span class="rp-word"></span><span id="rp-os-battery"></span>
      </header>
      <div id="rp-phone-body" class="rp-body"></div>
      <nav class="rp-nav" aria-label="小手机导航">
        <button type="button" data-rp-action="back">返回</button>
        <button type="button" data-rp-action="home">主页</button>
        <button type="button" data-rp-action="close">关闭</button>
      </nav>
    </div>`;
  panel.addEventListener('click', handleClick);
  panel.addEventListener('submit', handleSubmit);
  return panel;
}

async function openPhone() {
  if (ui.popup || !isYuSishiChat()) return;
  try {
    const { Popup, POPUP_TYPE } = ctx();
    ui.view = 'home';
    ui.contactId = null;
    ui.panel = shell();
    ui.popup = new Popup(ui.panel, POPUP_TYPE.DISPLAY, '', { animation: 'none', leftAlign: true });
    ui.popup.dlg.classList.add('rp-dialog');
    ui.popup.dlg.setAttribute('aria-label', 'RiverPhone 小手机');
    renderPhone();
    await ui.popup.show();
  } catch (error) {
    console.error('[RiverPhone] 打开失败', error);
    globalThis.toastr?.error('无法打开小手机。请检查 RiverPhone 与酒馆版本。', 'RiverPhone');
  } finally {
    ui.popup = null;
    ui.panel = null;
  }
}

function closePhone() {
  return ui.popup?.completeCancelled();
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
  const canSend = isYuSishiChat();
  const disabled = canSend && !ui.busy ? '' : ' disabled';
  return titleBar(c.name) + '<div class="rp-thread">' + t.map(m => '<div class="rp-msg ' + (m.from==='me'?'me':m.from==='system'?'system':'them') + '">' + (m.sender?'<b>'+esc(m.sender)+'</b><br>':'') + esc(m.text) + '<small>' + esc(m.time||'') + '</small></div>').join('') + '</div>' +
  '<form class="rp-compose" data-rp-form="' + esc(c.id) + '"><input id="rp-message-input" aria-label="手机消息" autocomplete="off" placeholder="' +
    (canSend ? (ui.busy ? '正在等回复…' : '发消息…') : '打开余斯是的聊天后可发消息') + '"' + disabled +
    '><button type="submit"' + disabled + '>发送</button></form>';
}
function statusHtml(s) {
  const affection = (name, score, delta) => '<div class="rp-pill"><small>' + name + ' 好感</small><b>' + esc(score) +
    '</b><small>本轮 ' + (delta > 0 ? '+' : '') + esc(delta || 0) + '</small></div>';
  return titleBar('状态') + '<div class="rp-pills">' +
  affection('余斯是', s.status.offlineAffection, s.status.offlineDelta) +
  affection('Night', s.status.onlineAffection, s.status.onlineDelta) +
  '<div class="rp-pill"><small>未读</small><b>'+esc(s.phone.unread||0)+'</b></div></div>' +
  stat('事件',s.status.event)+stat('日期与天气',s.status.date+' · '+s.status.weather)+stat('时间与地点',s.status.time+' · '+s.status.place)+
  stat('现在',s.status.state)+stat('他的想法',s.status.thought);
}
function memoryHtml(s) {
  return titleBar('记忆') + stat('轮次',s.memory.round)+stat('本周期',s.memory.short)+stat('长期记忆',s.memory.long)+stat('核心记忆',s.memory.core);
}
function noticeHtml(s) {
  return titleBar('通知') + (normalizeArray(s.phone.notice).map(x=>stat('NOTICE',x)).join('') || stat('NOTICE','暂无新通知'));
}
function stat(k,v){ return '<div class="rp-stat"><small>'+esc(k)+'</small><p>'+esc(v||'无')+'</p></div>'; }

function renderPhone() {
  if (!ui.panel) return;
  const s = state();
  const body = ui.panel.querySelector('#rp-phone-body');
  ui.panel.querySelector('#rp-os-time').textContent = s.phone.phone_time || s.status.time || '';
  ui.panel.querySelector('.rp-word').textContent = 'RIVERPHONE';
  ui.panel.querySelector('#rp-os-battery').textContent = Math.max(0,Math.min(100,Number(s.phone.battery||0)))+'%';
  if (ui.view==='messages') body.innerHTML=messagesHtml(s);
  else if (ui.view==='thread') body.innerHTML=threadHtml(s,ui.contactId);
  else if (ui.view==='status') body.innerHTML=statusHtml(s);
  else if (ui.view==='memory') body.innerHTML=memoryHtml(s);
  else if (ui.view==='notice') body.innerHTML=noticeHtml(s);
  else body.innerHTML=homeHtml(s);
  const thread = body.querySelector('.rp-thread');
  if (thread) requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  body.scrollTop = 0;
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
  const input=form.querySelector('input'), text=input.value.trim();
  const metadata = ctx().chatMetadata;
  if (!text || ui.busy || !metadata || !isYuSishiChat()) return;
  const id=form.dataset.rpForm,s=state(),c=s.contacts.find(x=>x.id===id)||s.contacts[0];
  s.threads[id]||=[]; s.threads[id].push({from:'me',text,time:nowTime()});
  input.value=''; ui.busy=true;
  renderPhone();
  try{
    await saveState();
    if (ctx().chatMetadata !== metadata) return;
    const r=await phoneReply(id,text);
    s.threads[id].push({from:'them',sender:r.sender,text:r.text||'…',time:r.time});
    s.phone.message=(r.sender||c.name)+'：'+(r.text||'…');
    s.phone.unread=Math.max(0,Number(s.phone.unread||0));
    s.activities.push('你给'+c.name+'发送：'+text+'；'+(r.sender||c.name)+'回复：'+(r.text||'…'));
  }catch(err){
    console.error('[RiverPhone] phone reply failed',err);
    s.threads[id].push({from:'system',text:'消息暂时没有送达：'+err.message,time:nowTime()});
  }finally{
    ui.busy = false;
    if (ctx().chatMetadata === metadata) await saveState();
    renderPhone();
  }
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
  if (!isYuSishiChat()) return;
  const index = Number(id);
  const chat = ctx().chat;
  const reply = chat?.[index];
  if (!reply || reply.is_user || reply.is_system) return;
  const previous = chat[index - 1];
  const userText = previous?.is_user ? String(previous.mes || '') : '';
  const payload = parsePayload(reply.mes);
  const messages = storyPhoneMessages(payload, userText, state().contacts);
  await applyPayload(payload || {}, index, messages);
}
function scanExisting() {
  if (!isYuSishiChat()) return;
  (ctx().chat||[]).forEach((m,i)=>{ if(!m?.is_user){const p=parsePayload(m.mes);if(p?.status)renderInlineStatus(i,p);} });
  const chat=ctx().chat||[]; for(let i=chat.length-1;i>=0;i--){if(!chat[i]?.is_user){const p=parsePayload(chat[i].mes);if(p){applyPayload({ ...p, events: undefined });break;}}}
}
function addExtensionMenuLauncher() {
  const menu = document.getElementById('extensionsMenu');
  if (!menu || document.getElementById('rp-extension-menu-launch')) return;
  const item = document.createElement('div');
  item.id = 'rp-extension-menu-launch';
  item.className = 'list-group-item flex-container flexGap5 interactable';
  item.setAttribute('tabindex','0');
  item.setAttribute('title','打开 RiverPhone');
  item.innerHTML = '<div class="fa-solid fa-mobile-screen-button extensionsMenuExtensionButton"></div><span>RiverPhone</span>';
  item.addEventListener('click', openPhone);
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPhone();
    }
  });
  menu.appendChild(item);
  const button = document.getElementById('extensionsMenuButton');
  if (button?.style) button.style.display = 'flex';
}

function subscribe() {
  const c=ctx(), e=c.event_types||c.eventTypes||{}; if(!c.eventSource?.on)return;
  c.eventSource.on(e.CHARACTER_MESSAGE_RENDERED||'character_message_rendered',id=>processMessage(id));
  c.eventSource.on(e.MESSAGE_EDITED||'message_edited',id=>processMessage(id));
  c.eventSource.on(e.MESSAGE_SWIPED||'message_swiped',id=>setTimeout(()=>processMessage(id),60));
  c.eventSource.on(e.CHAT_CHANGED||'chat_id_changed',async()=>{
    void closePhone();
    syncLaunchers();
    await installContract();
    await updateActivityPrompt();
    scanExisting();
  });
}

function addComposerLauncher() {
  const host = document.getElementById('leftSendForm');
  if (!host || document.getElementById('rp-composer-launch')) return;
  const button = document.createElement('button');
  button.id = 'rp-composer-launch';
  button.type = 'button';
  button.title = '打开小手机';
  button.setAttribute('aria-label', '打开小手机');
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = ICON;
  button.addEventListener('click', openPhone);
  host.append(button);
}

function syncLaunchers() {
  if (!isYuSishiChat()) {
    document.getElementById('rp-composer-launch')?.remove();
    document.getElementById('rp-extension-menu-launch')?.remove();
    return;
  }
  addComposerLauncher();
  addExtensionMenuLauncher();
}

async function activate() {
  syncLaunchers();
  const { SlashCommand, SlashCommandParser } = ctx();
  SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'riverphone',
    helpString: '在余斯是的聊天中打开 RiverPhone 小手机。',
    callback: () => {
      if (isYuSishiChat()) void openPhone();
      else globalThis.toastr?.info('请先打开余斯是的聊天。', 'RiverPhone');
      return '';
    },
  }));
  subscribe();
  await installContract();
  await updateActivityPrompt();
  scanExisting();
  console.info('[RiverPhone] v0.2.4');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',activate,{once:true});else queueMicrotask(activate);
