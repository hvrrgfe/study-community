// ====== Supabase 配置 ======
const SUPABASE_URL = 'https://wsipigpjkxaeljfrrvyq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YbtTbQGMakCyoAVV0atHDw_z_D8hZtB';
let supabase = null;

async function initSupabase() {
  let lastErr;
  for (let i = 0; i < 20; i++) {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      return supabase;
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 500)); }
  }
  console.error('Supabase初始化失败:', lastErr);
  return null;
}

// ====== 全局状态 ======
let currentUser = null;   // { account, member }
let currentPage = 'home';
let supaReady = false;

const SUBJECTS = ['数学','语文','物理','化学','生物','综合'];
const SUBJECT_ICONS = {'数学':'📐','语文':'✍️','物理':'🔬','化学':'⚗️','生物':'🧬','综合':'📦','英语':'🔤'};

// ====== 工具函数 ======
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getMonth()+1}月${dt.getDate()}日`;
}
function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}
function weekdayCN(d) {
  return ['日','一','二','三','四','五','六'][new Date(d).getDay()];
}

function titleColor(title) {
  const map = {'萌新':'萌新','常驻':'常驻','元老':'元老','编外管理员':'编外管理员'};
  return map[title] || '萌新';
}

// ====== 导航 ======
function goPage(page) {
  // 关闭移动菜单
  document.getElementById('navTabs').classList.remove('mobile-open');

  // 特殊：未登录时访问需要登录的页面
  const needLogin = ['profile'];
  if (needLogin.includes(page) && !currentUser) {
    page = 'login';
  }

  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  // 更新tab高亮
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.page === page);
  });

  // 渲染页面
  renderPage(page);

  window.scrollTo(0, 0);
}

function toggleMobileMenu() {
  document.getElementById('navTabs').classList.toggle('mobile-open');
}

async function renderPage(page) {
  if (!supaReady) { showLoading(page); return; }
  switch(page) {
    case 'home': await renderHome(); break;
    case 'leaderboard': await renderLeaderboard(); break;
    case 'contributions': await renderContributions(); break;
    case 'resources': await renderResources(); break;
    case 'solutions': await renderSolutions(); break;
    case 'moments': await renderMoments(); break;
    case 'events': await renderEvents(); break;
    case 'login': renderLogin(); break;
    case 'profile': await renderProfile(); break;
  }
}

function showLoading(page) {
  const el = document.getElementById('page-' + page);
  if (el) el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;
}

// ====== 数据查询 ======
async function fetchMembers() {
  const { data, error } = await supabase.from('members').select('*').order('points', { ascending: false });
  if (error) { console.error('fetchMembers:', error); return []; }
  return data || [];
}

async function fetchContributions(filter = 'all') {
  let q = supabase.from('contributions').select('*').order('created_at', { ascending: false });
  if (filter !== 'all') q = q.eq('type', filter);
  const { data, error } = await q.limit(50);
  if (error) { console.error('fetchContributions:', error); return []; }
  return data || [];
}

async function fetchResources(subject = 'all') {
  let q = supabase.from('resources').select('*').order('created_at', { ascending: false });
  if (subject !== 'all') q = q.eq('subject', subject);
  const { data, error } = await q.limit(50);
  if (error) { console.error('fetchResources:', error); return []; }
  return data || [];
}

async function fetchSolutions(subject = 'all') {
  let q = supabase.from('solutions').select('*').order('created_at', { ascending: false });
  if (subject !== 'all') q = q.eq('subject', subject);
  const { data, error } = await q.limit(30);
  if (error) { console.error('fetchSolutions:', error); return []; }
  return data || [];
}

async function fetchMoments() {
  const { data, error } = await supabase.from('group_moments').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) { console.error('fetchMoments:', error); return []; }
  return data || [];
}

async function fetchEvents() {
  const { data, error } = await supabase.from('community_events').select('*').order('event_date', { ascending: true }).limit(30);
  if (error) {
    // 表可能还不存在
    console.error('fetchEvents:', error);
    return [];
  }
  return data || [];
}

async function fetchStats() {
  try {
    const [members, contribs, res, sols, moments, events] = await Promise.all([
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('contributions').select('id', { count: 'exact', head: true }),
      supabase.from('resources').select('id', { count: 'exact', head: true }),
      supabase.from('solutions').select('id', { count: 'exact', head: true }),
      supabase.from('group_moments').select('id', { count: 'exact', head: true }),
      supabase.from('community_events').select('id', { count: 'exact', head: true }),
    ]);
    return {
      members: members.count || 0,
      contributions: contribs.count || 0,
      resources: res.count || 0,
      solutions: sols.count || 0,
      moments: moments.count || 0,
      events: events.count || 0,
    };
  } catch (e) {
    console.error('fetchStats:', e);
    return { members:70, contributions:0, resources:0, solutions:0, moments:0, events:0 };
  }
}

// ====== 首页 ======
async function renderHome() {
  const el = document.getElementById('page-home');
  el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;

  const [members, stats, events, contribs] = await Promise.all([
    fetchMembers(),
    fetchStats(),
    fetchEvents(),
    fetchContributions('all'),
  ]);

  const today = new Date();
  const upcomingEvents = events.filter(e => new Date(e.event_date) >= today).slice(0, 3);
  const recentContribs = contribs.slice(0, 5);

  el.innerHTML = `
    <div class="hero">
      <h1>📚 <span class="accent">学习群</span>社区</h1>
      <p class="tagline">以学会友 · 共同进步 · 这里是「我们」的地方</p>
      <div class="hero-stats">
        <div class="hero-stat"><span class="num">${stats.members}</span><br><span class="label">群成员</span></div>
        <div class="hero-stat"><span class="num">${stats.contributions}</span><br><span class="label">贡献记录</span></div>
        <div class="hero-stat"><span class="num">${stats.resources}</span><br><span class="label">共享资料</span></div>
        <div class="hero-stat"><span class="num">${stats.solutions}</span><br><span class="label">群友题解</span></div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">🏆</div><div class="stat-value">${members.length}</div><div class="stat-label">活跃成员</div></div>
      <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">${events.length}</div><div class="stat-label">活动场次</div></div>
      <div class="stat-card"><div class="stat-icon">🎬</div><div class="stat-value">${stats.moments}</div><div class="stat-label">群史名场面</div></div>
      <div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-value">${members.reduce((s,m)=>s+(m.points||0),0)}</div><div class="stat-label">总积分</div></div>
    </div>

    ${upcomingEvents.length ? `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">📅</span>即将开始的活动</h2>
      <span class="section-link" onclick="goPage('events')">查看全部 →</span>
    </div>
    ${upcomingEvents.map(e => renderEventCard(e)).join('')}
    ` : ''}

    ${recentContribs.length ? `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">⭐</span>最近贡献</h2>
      <span class="section-link" onclick="goPage('contributions')">查看全部 →</span>
    </div>
    ${recentContribs.map(c => renderContribItem(c)).join('')}
    ` : `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">⭐</span>贡献墙</h2>
    </div>
    <div class="card" style="text-align:center;padding:28px 16px;">
      <div style="font-size:36px;opacity:.3;margin-bottom:8px;">🌱</div>
      <p style="color:var(--text-secondary);font-size:13px;">还没有贡献记录<br>成为第一个贡献者吧！</p>
      ${currentUser ? `<button class="btn-primary" style="margin-top:12px;" onclick="goPage('contributions')">我要贡献</button>` : ''}
    </div>
    `}

    <div class="section-header">
      <h2 class="section-title"><span class="icon">🏆</span>积分榜 Top 5</h2>
      <span class="section-link" onclick="goPage('leaderboard')">完整排行 →</span>
    </div>
    ${members.slice(0,5).map((m,i) => renderRankItem(m, i)).join('')}
  `;
}

function renderRankItem(m, i) {
  const avatar = m.avatar_emoji || '👤';
  const title = m.title || '萌新';
  const name = esc(m.name || '未知');
  return `
    <div class="rank-item">
      <div class="rank-num">${i+1}</div>
      <span class="rank-avatar">${avatar}</span>
      <div class="rank-info">
        <span class="rank-name">${name}</span>
        <span class="rank-title-tag ${titleColor(title)}">${esc(title)}</span>
        ${m.grade ? `<span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${esc(m.grade)}</span>` : ''}
      </div>
      <span class="rank-points">${m.points||0}分</span>
    </div>
  `;
}

// ====== 排行榜 ======
async function renderLeaderboard() {
  const el = document.getElementById('page-leaderboard');
  el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;
  const members = await fetchMembers();

  if (!members.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>暂无数据</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">🏆</span>积分排行榜</h2>
    </div>
    <div class="card" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      ${['萌新','常驻','元老','编外管理员'].map(t => {
        const cnt = members.filter(m => (m.title||'萌新') === t).length;
        return `<span style="font-size:12px;"><span class="rank-title-tag ${titleColor(t)}">${t}</span> <span style="color:var(--text-muted)">${cnt}人</span></span>`;
      }).join('')}
    </div>
    <ul class="rank-list">
      ${members.map((m,i) => `<li>${renderRankItem(m,i)}</li>`).join('')}
    </ul>
  `;
}

// ====== 贡献榜 ======
let contribFilter = 'all';
async function renderContributions() {
  const el = document.getElementById('page-contributions');
  el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;

  const [contribs, members] = await Promise.all([fetchContributions(contribFilter), fetchMembers()]);
  const memberMap = {};
  members.forEach(m => memberMap[m.id] = m);

  // 月度排行
  const now = new Date();
  const monthContribs = contribs.filter(c => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRank = {};
  monthContribs.forEach(c => {
    const mid = c.member_id;
    if (!monthRank[mid]) monthRank[mid] = { points:0, count:0, name:'', title:'萌新', avatar:'👤' };
    monthRank[mid].points += c.points || 0;
    monthRank[mid].count += 1;
    if (memberMap[mid]) {
      monthRank[mid].name = memberMap[mid].name;
      monthRank[mid].title = memberMap[mid].title || '萌新';
      monthRank[mid].avatar = memberMap[mid].avatar_emoji || '👤';
    }
  });
  const monthList = Object.values(monthRank).sort((a,b) => b.points - a.points).slice(0, 5);

  const filters = ['all','资料','题解','活动策划','群史记录'];

  el.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">⭐</span>贡献榜</h2>
      ${currentUser ? `<button class="btn-sm btn-primary" onclick="showContribForm()">+ 记录贡献</button>` : ''}
    </div>

    ${monthList.length ? `
    <div class="card">
      <div style="font-size:14px;font-weight:600;margin-bottom:10px;">📅 ${now.getMonth()+1}月贡献榜</div>
      ${monthList.map((r,i) => `
        <div class="rank-item" style="margin-bottom:6px;">
          <div class="rank-num">${i+1}</div>
          <span class="rank-avatar">${r.avatar}</span>
          <div class="rank-info">
            <span class="rank-name">${esc(r.name||'匿名')}</span>
            <span class="rank-title-tag ${titleColor(r.title)}">${esc(r.title)}</span>
            <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${r.count}条贡献</span>
          </div>
          <span class="rank-points">+${r.points}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="contrib-tabs">
      ${filters.map(f => `
        <div class="contrib-tab ${contribFilter===f?'active':''}" onclick="contribFilter='${f}';renderContributions()">${f==='all'?'全部':f}</div>
      `).join('')}
    </div>

    ${contribs.length ? contribs.map(c => renderContribItem(c, memberMap)).join('') : `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <p>还没有贡献记录</p>
        ${currentUser ? `<button class="btn-primary" style="margin-top:12px;" onclick="showContribForm()">成为第一个贡献者</button>` : `<p style="margin-top:8px;font-size:12px;">登录后可记录贡献</p>`}
      </div>
    `}
  `;
}

function renderContribItem(c, memberMap) {
  const icon = c.type === '题解' ? '✍️' : c.type === '资料' ? '📚' : c.type === '活动策划' ? '🎯' : '🎬';
  let authorName = c.member_id && memberMap?.[c.member_id] ? memberMap[c.member_id].name : '匿名贡献者';
  return `
    <div class="contrib-item">
      <span class="contrib-icon">${icon}</span>
      <div class="contrib-content">
        <div class="contrib-title">${esc(c.title)}</div>
        ${c.description ? `<div class="contrib-desc">${esc(c.description)}</div>` : ''}
        <div class="contrib-meta">${esc(c.type)} · ${esc(authorName)} · ${fmtDate(c.created_at)}</div>
      </div>
      <span class="contrib-pts">+${c.points||0}</span>
    </div>
  `;
}

function showContribForm() {
  if (!currentUser) { toast('请先登录'); return; }
  const el = document.getElementById('page-contributions');
  const existing = el.querySelector('.contrib-form-card');
  if (existing) { existing.remove(); return; }
  const form = document.createElement('div');
  form.className = 'card contrib-form-card';
  form.style.cssText = 'border-color:var(--pink);margin-bottom:16px;';
  form.innerHTML = `
    <h3 style="font-size:16px;margin-bottom:12px;">✏️ 记录新贡献</h3>
    <div class="form-group">
      <label>类型</label>
      <select id="cf-type" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;">
        <option value="资料">📚 资料</option>
        <option value="题解">✍️ 题解</option>
        <option value="活动策划">🎯 活动策划</option>
        <option value="群史记录">🎬 群史记录</option>
      </select>
    </div>
    <div class="form-group">
      <label>标题</label>
      <input id="cf-title" type="text" placeholder="贡献标题" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;">
    </div>
    <div class="form-group">
      <label>描述（选填）</label>
      <input id="cf-desc" type="text" placeholder="简单描述..." style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;">
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary" style="flex:1;" onclick="submitContrib()">提交</button>
      <button class="btn-secondary" onclick="this.closest('.contrib-form-card').remove()">取消</button>
    </div>
  `;
  el.querySelector('.section-header').after(form);
}

async function submitContrib() {
  const type = document.getElementById('cf-type').value;
  const title = document.getElementById('cf-title').value.trim();
  const desc = document.getElementById('cf-desc').value.trim();
  if (!title) { toast('请填写标题'); return; }
  const pts = type === '题解' ? 10 : type === '资料' ? 8 : type === '活动策划' ? 15 : 5;
  const { error } = await supabase.from('contributions').insert({
    member_id: currentUser.member?.id || null,
    type, title, description: desc, points: pts,
  });
  if (error) { toast('提交失败: ' + error.message); return; }
  // 加分到 member
  if (currentUser.member?.id) {
    const newPts = (currentUser.member.points || 0) + pts;
    await supabase.from('members').update({ points: newPts }).eq('id', currentUser.member.id);
  }
  toast('贡献已记录 +' + pts + '分！');
  renderContributions();
}

// ====== 资料库 ======
let resSubject = 'all';
async function renderResources() {
  const el = document.getElementById('page-resources');
  el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;
  const resources = await fetchResources(resSubject);

  el.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">📚</span>资料共建库</h2>
      ${currentUser ? `<button class="btn-sm btn-primary" onclick="showResourceForm()">+ 投稿资料</button>` : ''}
    </div>
    <div class="filter-bar">
      <div class="filter-chip ${resSubject==='all'?'active':''}" onclick="resSubject='all';renderResources()">全部</div>
      ${SUBJECTS.filter(s=>s!=='综合').map(s => `<div class="filter-chip ${resSubject===s?'active':''}" onclick="resSubject='${s}';renderResources()">${SUBJECT_ICONS[s]||'📦'} ${s}</div>`).join('')}
    </div>
    ${resources.length ? resources.map(r => `
      <div class="resource-item">
        <span class="res-icon">${SUBJECT_ICONS[r.subject]||'📦'}</span>
        <div class="res-info">
          <div class="res-title">${r.url ? `<a href="${esc(r.url)}" target="_blank">${esc(r.title)}</a>` : esc(r.title)}</div>
          ${r.description ? `<div class="res-desc">${esc(r.description)}</div>` : ''}
          <div class="res-meta">
            <span class="subject-tag">${esc(r.subject)}</span>
            <span>📁 ${esc(r.file_type||'链接')}</span>
            ${r.contributor_name ? `<span>👤 ${esc(r.contributor_name)}</span>` : ''}
            <span>📅 ${fmtDate(r.created_at)}</span>
            ${r.likes ? `<span>❤️ ${r.likes}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('') : `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>资料库还是空的</p>
        ${currentUser ? `<button class="btn-primary" style="margin-top:12px;" onclick="showResourceForm()">分享第一份资料</button>` : `<p style="margin-top:8px;font-size:12px;">登录后可投稿资料</p>`}
      </div>
    `}
  `;
}

function showResourceForm() {
  if (!currentUser) { toast('请先登录'); return; }
  const el = document.getElementById('page-resources');
  const existing = el.querySelector('.res-form-card');
  if (existing) { existing.remove(); return; }
  const form = document.createElement('div');
  form.className = 'card res-form-card';
  form.style.cssText = 'border-color:var(--blue);margin-bottom:16px;';
  form.innerHTML = `
    <h3 style="font-size:16px;margin-bottom:12px;">📤 投稿资料</h3>
    <div class="form-group"><label>标题</label><input id="rf-title" type="text" placeholder="资料名称" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div class="form-group"><label>科目</label>
      <select id="rf-subject" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;">
        ${SUBJECTS.map(s=>`<option value="${s}">${SUBJECT_ICONS[s]||'📦'} ${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>描述（选填）</label><input id="rf-desc" type="text" placeholder="简单介绍..." style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div class="form-group"><label>链接</label><input id="rf-url" type="text" placeholder="https://..." style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary" style="flex:1;" onclick="submitResource()">提交</button>
      <button class="btn-secondary" onclick="this.closest('.res-form-card').remove()">取消</button>
    </div>
  `;
  el.querySelector('.section-header').after(form);
}

async function submitResource() {
  const title = document.getElementById('rf-title').value.trim();
  const subject = document.getElementById('rf-subject').value;
  const desc = document.getElementById('rf-desc').value.trim();
  const url = document.getElementById('rf-url').value.trim();
  if (!title) { toast('请填写标题'); return; }
  const { error } = await supabase.from('resources').insert({
    title, subject, description: desc, url: url||null,
    file_type: url ? '链接' : '文档',
    contributed_by: currentUser.member?.id || null,
    contributor_name: currentUser.member?.name || currentUser.account,
  });
  if (error) { toast('提交失败: ' + error.message); return; }
  // 记录贡献
  await supabase.from('contributions').insert({
    member_id: currentUser.member?.id || null,
    type: '资料', title, description: desc, points: 8,
  });
  if (currentUser.member?.id) {
    const newPts = (currentUser.member.points || 0) + 8;
    await supabase.from('members').update({ points: newPts }).eq('id', currentUser.member.id);
  }
  toast('资料已发布 +8分！');
  renderResources();
}

// ====== 题解库 ======
let solSubject = 'all';
let solDetailView = null;

async function renderSolutions() {
  const el = document.getElementById('page-solutions');
  if (solDetailView) {
    renderSolutionDetail(solDetailView, el);
    return;
  }
  el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;
  const solutions = await fetchSolutions(solSubject);

  el.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">✍️</span>群友题解库</h2>
      ${currentUser ? `<button class="btn-sm btn-primary" onclick="showSolutionForm()">+ 写题解</button>` : ''}
    </div>
    <div class="filter-bar">
      <div class="filter-chip ${solSubject==='all'?'active':''}" onclick="solSubject='all';renderSolutions()">全部</div>
      ${SUBJECTS.filter(s=>s!=='综合').map(s => `<div class="filter-chip ${solSubject===s?'active':''}" onclick="solSubject='${s}';renderSolutions()">${SUBJECT_ICONS[s]||'📦'} ${s}</div>`).join('')}
    </div>
    ${solutions.length ? solutions.map(s => `
      <div class="solution-item" onclick='viewSolution(${JSON.stringify(s).replace(/'/g,"&#39;")})'>
        <div class="sol-title">${SUBJECT_ICONS[s.subject]||'📦'} ${esc(s.title)}</div>
        <div class="sol-preview">${esc(s.content).substring(0,120)}...</div>
        <div class="sol-meta">
          <span class="sol-author">✍️ ${esc(s.author_name||'匿名')}</span>
          <span>📅 ${fmtDate(s.created_at)}</span>
          ${s.likes ? `<span>❤️ ${s.likes}</span>` : ''}
        </div>
      </div>
    `).join('') : `
      <div class="empty-state">
        <div class="empty-icon">✍️</div>
        <p>还没有群友题解</p>
        ${currentUser ? `<button class="btn-primary" style="margin-top:12px;" onclick="showSolutionForm()">写第一篇题解</button>` : `<p style="margin-top:8px;font-size:12px;">登录后可撰写题解</p>`}
      </div>
    `}
  `;
}

function viewSolution(s) {
  solDetailView = s;
  renderSolutions();
}

function renderSolutionDetail(s, el) {
  el.innerHTML = `
    <button class="btn-secondary btn-sm" style="margin-bottom:12px;" onclick="solDetailView=null;renderSolutions()">← 返回列表</button>
    <div class="solution-detail">
      <h2>${SUBJECT_ICONS[s.subject]||'📦'} ${esc(s.title)}</h2>
      <div class="sol-meta" style="margin-bottom:16px;">
        <span class="sol-author">✍️ ${esc(s.author_name||'匿名')}</span>
        <span>📅 ${fmtDateTime(s.created_at)}</span>
        <span class="subject-tag" style="background:var(--blue-soft);color:var(--blue);padding:1px 6px;border-radius:3px;font-size:11px;">${esc(s.subject)}</span>
      </div>
      <div class="md-content">${marked.parse(s.content || '')}</div>
    </div>
  `;
}

function showSolutionForm() {
  if (!currentUser) { toast('请先登录'); return; }
  const el = document.getElementById('page-solutions');
  const existing = el.querySelector('.sol-form-card');
  if (existing) { existing.remove(); return; }
  const form = document.createElement('div');
  form.className = 'card sol-form-card';
  form.style.cssText = 'border-color:var(--pink);margin-bottom:16px;';
  form.innerHTML = `
    <h3 style="font-size:16px;margin-bottom:12px;">✏️ 写题解</h3>
    <div class="form-group"><label>标题</label><input id="sf-title" type="text" placeholder="题目标题" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div class="form-group"><label>科目</label>
      <select id="sf-subject" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;">
        ${SUBJECTS.map(s=>`<option value="${s}">${SUBJECT_ICONS[s]||'📦'} ${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>题解内容（支持 Markdown）</label>
      <textarea id="sf-content" placeholder="支持 Markdown 格式...&#10;&#10;## 解题思路&#10;...&#10;&#10;## 答案&#10;..." style="width:100%;min-height:200px;padding:10px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary" style="flex:1;" onclick="submitSolution()">提交题解</button>
      <button class="btn-secondary" onclick="this.closest('.sol-form-card').remove()">取消</button>
    </div>
  `;
  el.querySelector('.section-header').after(form);
}

async function submitSolution() {
  const title = document.getElementById('sf-title').value.trim();
  const subject = document.getElementById('sf-subject').value;
  const content = document.getElementById('sf-content').value.trim();
  if (!title || !content) { toast('请填写标题和内容'); return; }
  const { data, error } = await supabase.from('solutions').insert({
    title, subject, content,
    author_id: currentUser.member?.id || null,
    author_name: currentUser.member?.name || currentUser.account,
  });
  if (error) { toast('提交失败: ' + error.message); return; }
  await supabase.from('contributions').insert({
    member_id: currentUser.member?.id || null,
    type: '题解', title, points: 10,
  });
  if (currentUser.member?.id) {
    const newPts = (currentUser.member.points || 0) + 10;
    await supabase.from('members').update({ points: newPts }).eq('id', currentUser.member.id);
  }
  toast('题解已发布 +10分！');
  solDetailView = null;
  renderSolutions();
}

// ====== 群史馆 ======
async function renderMoments() {
  const el = document.getElementById('page-moments');
  el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;
  const moments = await fetchMoments();

  el.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">🎬</span>群史馆</h2>
      ${currentUser ? `<button class="btn-sm btn-primary" onclick="showMomentForm()">+ 记录名场面</button>` : ''}
    </div>
    <div class="card" style="text-align:center;padding:14px;margin-bottom:16px;">
      <p style="font-size:13px;color:var(--text-secondary);">这里记录群里的经典名场面、老梗、好笑对话<br>共同回忆是最强的黏合剂 🎬</p>
    </div>
    ${moments.length ? moments.map(m => `
      <div class="moment-item">
        <span class="moment-type-tag">${esc(m.moment_type||'名场面')}</span>
        <div class="moment-title">${esc(m.title)}</div>
        ${m.content ? `<div class="moment-content">${esc(m.content)}</div>` : ''}
        ${m.image_url ? `<img class="moment-img" src="${esc(m.image_url)}" alt="${esc(m.title)}">` : ''}
        <div class="moment-meta">👤 ${esc(m.author_name||'匿名')} · 📅 ${fmtDate(m.created_at)}</div>
      </div>
    `).join('') : `
      <div class="empty-state">
        <div class="empty-icon">🎬</div>
        <p>群史馆还是空的</p>
        <p style="margin-top:8px;font-size:12px;">群里出现的好笑对话、经典回答，记录下来吧</p>
        ${currentUser ? `<button class="btn-primary" style="margin-top:12px;" onclick="showMomentForm()">记录第一个名场面</button>` : `<p style="margin-top:8px;font-size:12px;">登录后可记录</p>`}
      </div>
    `}
  `;
}

function showMomentForm() {
  if (!currentUser) { toast('请先登录'); return; }
  const el = document.getElementById('page-moments');
  const existing = el.querySelector('.moment-form-card');
  if (existing) { existing.remove(); return; }
  const form = document.createElement('div');
  form.className = 'card moment-form-card';
  form.style.cssText = 'border-color:var(--pink);margin-bottom:16px;';
  form.innerHTML = `
    <h3 style="font-size:16px;margin-bottom:12px;">🎬 记录名场面</h3>
    <div class="form-group"><label>类型</label>
      <select id="mf-type" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;">
        <option value="名场面">🎬 名场面</option>
        <option value="玩梗">😂 玩梗</option>
        <option value="经典对话">💬 经典对话</option>
        <option value="暴题夜">⚡ 暴题夜</option>
      </select>
    </div>
    <div class="form-group"><label>标题</label><input id="mf-title" type="text" placeholder="名场面标题" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div class="form-group"><label>描述</label><textarea id="mf-content" placeholder="发生了什么..." style="width:100%;min-height:80px;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></textarea></div>
    <div class="form-group"><label>图片链接（选填）</label><input id="mf-img" type="text" placeholder="https://..." style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary" style="flex:1;" onclick="submitMoment()">提交</button>
      <button class="btn-secondary" onclick="this.closest('.moment-form-card').remove()">取消</button>
    </div>
  `;
  el.querySelector('.section-header').after(form);
}

async function submitMoment() {
  const type = document.getElementById('mf-type').value;
  const title = document.getElementById('mf-title').value.trim();
  const content = document.getElementById('mf-content').value.trim();
  const img = document.getElementById('mf-img').value.trim();
  if (!title) { toast('请填写标题'); return; }
  const { error } = await supabase.from('group_moments').insert({
    title, content, image_url: img||null, moment_type: type,
    author_id: currentUser.member?.id || null,
    author_name: currentUser.member?.name || currentUser.account,
  });
  if (error) { toast('提交失败: ' + error.message); return; }
  await supabase.from('contributions').insert({
    member_id: currentUser.member?.id || null,
    type: '群史记录', title, points: 5,
  });
  if (currentUser.member?.id) {
    const newPts = (currentUser.member.points || 0) + 5;
    await supabase.from('members').update({ points: newPts }).eq('id', currentUser.member.id);
  }
  toast('名场面已记录 +5分！');
  renderMoments();
}

// ====== 活动日历 ======
async function renderEvents() {
  const el = document.getElementById('page-events');
  el.innerHTML = `<div class="loading"><span class="spin"></span>加载中...</div>`;
  const events = await fetchEvents();

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = events.filter(e => new Date(e.event_date) >= today);
  const past = events.filter(e => new Date(e.event_date) < today).reverse();

  el.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><span class="icon">📅</span>活动日历</h2>
      ${currentUser ? `<button class="btn-sm btn-primary" onclick="showEventForm()">+ 添加活动</button>` : ''}
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:8px;">🔥 固定栏目</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;padding:4px 10px;border-radius:8px;background:var(--blue-soft);color:var(--blue);">周日 · 暴题夜</span>
        <span style="font-size:12px;padding:4px 10px;border-radius:8px;background:var(--pink-soft);color:var(--pink);">周五 · 吐槽日</span>
        <span style="font-size:12px;padding:4px 10px;border-radius:8px;background:rgba(168,85,247,.15);color:#a855f7;">月末 · 群史总结</span>
        <span style="font-size:12px;padding:4px 10px;border-radius:8px;background:rgba(34,197,94,.15);color:#22c55e;">周六 · 答题夜</span>
      </div>
    </div>

    ${upcoming.length ? `
      <div style="font-size:14px;font-weight:600;margin:16px 0 8px;">📌 即将到来</div>
      ${upcoming.map(e => renderEventCard(e)).join('')}
    ` : ''}

    ${past.length ? `
      <div style="font-size:14px;font-weight:600;margin:16px 0 8px;color:var(--text-muted);">📜 往期回顾</div>
      ${past.map(e => renderEventCard(e)).join('')}
    ` : ''}

    ${!events.length ? `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>暂无活动安排</p>
        ${currentUser ? `<button class="btn-primary" style="margin-top:12px;" onclick="showEventForm()">添加第一个活动</button>` : ''}
      </div>
    ` : ''}
  `;
}

function renderEventCard(e) {
  const dt = new Date(e.event_date);
  const month = dt.getMonth() + 1;
  const day = dt.getDate();
  const wd = weekdayCN(e.event_date);
  const type = e.event_type || '固定活动';
  const status = e.status || '即将开始';
  const today = new Date(); today.setHours(0,0,0,0);
  const isPast = dt < today;
  const actualStatus = isPast ? '已结束' : status;

  return `
    <div class="event-card">
      <div class="event-date">
        <div class="month">${month}月</div>
        <div class="day">${day}</div>
        <div class="weekday">周${wd}</div>
      </div>
      <div class="event-info">
        <div class="event-title">${esc(e.title)}<span class="event-type-tag ${type}">${esc(type)}</span></div>
        ${e.description ? `<div class="event-desc">${esc(e.description)}</div>` : ''}
        <div class="event-time">🕐 ${esc(e.start_time||'20:00')} — ${esc(e.end_time||'21:00')}${e.subject ? ' · ' + esc(e.subject) : ''}</div>
        <div class="event-status ${actualStatus}">${actualStatus === '即将开始' ? '🟡 即将开始' : actualStatus === '进行中' ? '🟢 进行中' : '⚫ 已结束'}</div>
      </div>
    </div>
  `;
}

function showEventForm() {
  if (!currentUser) { toast('请先登录'); return; }
  const el = document.getElementById('page-events');
  const existing = el.querySelector('.event-form-card');
  if (existing) { existing.remove(); return; }
  const form = document.createElement('div');
  form.className = 'card event-form-card';
  form.style.cssText = 'border-color:var(--blue);margin-bottom:16px;';
  form.innerHTML = `
    <h3 style="font-size:16px;margin-bottom:12px;">📅 添加活动</h3>
    <div class="form-group"><label>活动名称</label><input id="ef-title" type="text" placeholder="如：暴题夜·数学" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div class="form-group"><label>类型</label>
      <select id="ef-type" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;">
        <option value="固定活动">📌 固定活动</option>
        <option value="答题夜">📝 答题夜</option>
        <option value="特别活动">🎉 特别活动</option>
      </select>
    </div>
    <div class="form-group"><label>日期</label><input id="ef-date" type="date" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div class="form-group" style="display:flex;gap:8px;">
      <div style="flex:1;"><label>开始</label><input id="ef-start" type="time" value="20:00" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
      <div style="flex:1;"><label>结束</label><input id="ef-end" type="time" value="21:00" style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    </div>
    <div class="form-group"><label>描述（选填）</label><input id="ef-desc" type="text" placeholder="活动描述..." style="width:100%;padding:8px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;"></div>
    <div style="display:flex;gap:8px;">
      <button class="btn-primary" style="flex:1;" onclick="submitEvent()">提交</button>
      <button class="btn-secondary" onclick="this.closest('.event-form-card').remove()">取消</button>
    </div>
  `;
  el.querySelector('.section-header').after(form);
}

async function submitEvent() {
  const title = document.getElementById('ef-title').value.trim();
  const type = document.getElementById('ef-type').value;
  const date = document.getElementById('ef-date').value;
  const start = document.getElementById('ef-start').value;
  const end = document.getElementById('ef-end').value;
  const desc = document.getElementById('ef-desc').value.trim();
  if (!title || !date) { toast('请填写名称和日期'); return; }
  const { error } = await supabase.from('community_events').insert({
    title, event_type: type, description: desc,
    event_date: date, start_time: start, end_time: end,
  });
  if (error) { toast('提交失败: ' + error.message); return; }
  toast('活动已添加！');
  renderEvents();
}

// ====== 登录 ======
function renderLogin() {
  const el = document.getElementById('page-login');
  el.innerHTML = `
    <div class="login-box">
      <h2>🔑 登录学习群社区</h2>
      <div class="form-group">
        <label>用户名</label>
        <input id="login-user" type="text" placeholder="用户名" autocomplete="username" style="width:100%;padding:10px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;font-size:14px;">
      </div>
      <div class="form-group">
        <label>密码</label>
        <input id="login-pass" type="password" placeholder="密码" autocomplete="current-password" style="width:100%;padding:10px;background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;font-size:14px;">
      </div>
      <button class="btn-primary login-btn" onclick="doLogin()">登录</button>
      <div class="login-error" id="login-err"></div>
      <div class="login-hint">使用学习群答题系统的账号登录<br>群主: admin / 成员: student001-070</div>
    </div>
  `;
  // 回车登录
  setTimeout(() => {
    const input = document.getElementById('login-pass');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  }, 100);
}

async function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const errEl = document.getElementById('login-err');
  if (!user || !pass) { errEl.textContent = '请输入用户名和密码'; return; }
  errEl.textContent = '';

  // 从 accounts 表验证
  const { data, error } = await supabase
    .from('accounts')
    .select('username, password, role, member_id')
    .eq('username', user)
    .eq('password', pass)
    .maybeSingle();

  if (error || !data) {
    errEl.textContent = '用户名或密码错误';
    return;
  }

  // 获取 member 信息
  let member = null;
  if (data.member_id) {
    const { data: m } = await supabase.from('members').select('*').eq('id', data.member_id).maybeSingle();
    member = m;
  } else {
    // 尝试按 username 匹配 member
    const { data: m } = await supabase.from('members').select('*').eq('name', user).maybeSingle();
    member = m;
  }

  currentUser = { account: user, role: data.role || 'member', member };
  updateNavUI();
  toast('欢迎回来，' + (member?.name || user) + '！');
  goPage('home');
}

function logout() {
  currentUser = null;
  updateNavUI();
  toast('已退出登录');
  goPage('home');
}

function updateNavUI() {
  const userInfo = document.getElementById('userInfo');
  const loginBtn = document.getElementById('loginBtn');
  if (currentUser) {
    userInfo.style.display = 'flex';
    loginBtn.style.display = 'none';
    document.getElementById('userAvatar').textContent = currentUser.member?.avatar_emoji || '👤';
    document.getElementById('userNameDisplay').textContent = currentUser.member?.name || currentUser.account;
    document.getElementById('userTitle').textContent = currentUser.member?.title || '萌新';
  } else {
    userInfo.style.display = 'none';
    loginBtn.style.display = 'block';
  }
}

// ====== 个人主页 ======
async function renderProfile() {
  const el = document.getElementById('page-profile');
  if (!currentUser) { goPage('login'); return; }

  const m = currentUser.member;
  if (!m) {
    el.innerHTML = `<div class="card"><p>未关联群成员信息，请联系群主绑定。</p></div>`;
    return;
  }

  // 获取我的贡献
  const { data: myContribs } = await supabase.from('contributions')
    .select('*').eq('member_id', m.id).order('created_at', { ascending: false });
  const { data: myResources } = await supabase.from('resources')
    .select('*').eq('contributed_by', m.id).order('created_at', { ascending: false });
  const { data: mySolutions } = await supabase.from('solutions')
    .select('*').eq('author_id', m.id).order('created_at', { ascending: false });

  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${m.avatar_emoji || '👤'}</div>
      <div>
        <div class="profile-name">${esc(m.name || '')}</div>
        <span class="rank-title-tag ${titleColor(m.title||'萌新')}">${esc(m.title||'萌新')}</span>
        ${m.grade ? `<span style="font-size:12px;color:var(--text-muted);margin-left:6px;">${esc(m.grade)}</span>` : ''}
        ${currentUser.role === 'admin' ? '<span style="font-size:11px;color:var(--pink);margin-left:4px;">👑 群主</span>' : ''}
        <div class="profile-stats">
          <div class="profile-stat"><span class="num">${m.points||0}</span><br><span class="label">积分</span></div>
          <div class="profile-stat"><span class="num">${myContribs?.length||0}</span><br><span class="label">贡献</span></div>
          <div class="profile-stat"><span class="num">${(myResources?.length||0)+(mySolutions?.length||0)}</span><br><span class="label">作品</span></div>
        </div>
      </div>
    </div>

    ${m.intro ? `<div class="card"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">📝 自我介绍</div><div>${esc(m.intro)}</div></div>` : ''}
    ${m.specialty ? `<div class="card"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">💪 擅长科目</div><div>${esc(m.specialty)}</div></div>` : ''}

    <div class="section-header">
      <h3 class="section-title"><span class="icon">⭐</span>我的贡献</h3>
    </div>
    ${myContribs?.length ? myContribs.map(c => renderContribItem(c)).join('') : '<div class="card" style="text-align:center;color:var(--text-muted);font-size:13px;">还没有贡献记录，去资料库或题解库投稿吧！</div>'}

    <div class="section-header" style="margin-top:16px;">
      <h3 class="section-title"><span class="icon">📚</span>我的资料</h3>
    </div>
    ${myResources?.length ? myResources.map(r => `
      <div class="resource-item">
        <span class="res-icon">${SUBJECT_ICONS[r.subject]||'📦'}</span>
        <div class="res-info">
          <div class="res-title">${r.url ? `<a href="${esc(r.url)}" target="_blank">${esc(r.title)}</a>` : esc(r.title)}</div>
          <div class="res-meta"><span class="subject-tag">${esc(r.subject)}</span><span>📅 ${fmtDate(r.created_at)}</span></div>
        </div>
      </div>
    `).join('') : '<div class="card" style="text-align:center;color:var(--text-muted);font-size:13px;">还没有投稿资料</div>'}

    <div class="section-header" style="margin-top:16px;">
      <h3 class="section-title"><span class="icon">✍️</span>我的题解</h3>
    </div>
    ${mySolutions?.length ? mySolutions.map(s => `
      <div class="solution-item" onclick='solDetailView=${JSON.stringify(s).replace(/'/g,"&#39;")};goPage("solutions")'>
        <div class="sol-title">${SUBJECT_ICONS[s.subject]||'📦'} ${esc(s.title)}</div>
        <div class="sol-preview">${esc(s.content).substring(0,100)}...</div>
      </div>
    `).join('') : '<div class="card" style="text-align:center;color:var(--text-muted);font-size:13px;">还没有写过题解</div>'}
  `;
}

// ====== 初始化 ======
async function init() {
  const sb = await initSupabase();
  supaReady = !!sb;

  if (!supaReady) {
    document.getElementById('page-home').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>连接数据库失败，请刷新重试</p>
      </div>`;
    return;
  }

  // 渲染首页
  goPage('home');
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
