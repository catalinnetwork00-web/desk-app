// Grok Bot Desk - plan B app. Reads ONLY the published JSON files at DESK_DATA_BASE + DATA_PATH + '/' + file.
// DATA_PATH arrives once via the #d= fragment, lives in localStorage, and the fragment is stripped.
// Never builds a FOMO URL: every FOMO link shown is the exact string from the JSON (made by links.py).
// Writes are not possible in plan B: the Account/Agents controls are read-only and show the Telegram command.
(function(){
'use strict';
const BASE = window.DESK_DATA_BASE;
const m0 = location.hash.match(/(?:^#|&)d=([^&]+)/);
if (m0){ localStorage.setItem('d', decodeURIComponent(m0[1])); history.replaceState(null, '', location.pathname + location.search + '#/home'); }
const D = localStorage.getItem('d');
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const AG = ['scanner', 'auditor', 'analyst', 'executor', 'risk'];
const AGN = {scanner:'Scanner', auditor:'Auditor', analyst:'Analyst', executor:'Executor', risk:'Risk'};
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = u => (typeof u === 'string' && /^https:\/\//.test(u)) ? esc(u) : '';      // only links the JSON sent, unchanged
const num = v => typeof v === 'number' && isFinite(v);
const money = v => num(v) ? '$' + v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
const pct = v => num(v) ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : '—';
const price = v => !num(v) ? '—' : v >= 1 ? '$' + v.toLocaleString('en-US', {maximumFractionDigits:4}) : v <= 0 ? '$0' : '$' + v.toFixed(Math.min(12, 3 - Math.floor(Math.log10(v))));
const big = v => !num(v) ? '—' : v >= 1e9 ? '$' + (v/1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v/1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v/1e3).toFixed(1) + 'K' : '$' + v.toFixed(0);
const hhmm = ts => num(ts) ? new Date(ts*1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false}) : '';
const sign = s => /^\+/.test(s) ? 'green' : /^-/.test(s) ? 'red' : '';

// ---------------- data layer ----------------
const cache = {}, prevChart = {};
let lastOk = null, offline = false, fails = 0, retryAt = 0;
async function get(file){
  const r = await fetch(BASE + D + '/' + file + '?t=' + Date.now(), {cache:'no-store'});
  if (r.status === 400 || r.status === 404){ const e = new Error('missing'); e.missing = true; throw e; }   // Supabase missing object
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function load(file, opts){
  try { const j = await get(file); cache[file] = j; delete cache['!' + file]; if (file === 'state.json'){ lastOk = new Date(); fails = 0; offline = false; } return j; }
  catch(e){
    if (e.missing){ cache['!' + file] = true; return null; }
    if (file === 'state.json' || !(opts && opts.quiet)){ offline = true; fails++; retryAt = Date.now() + backoff() * 1000; }
    return null;
  }
}
const backoff = () => Math.min(30, 5 * Math.max(1, fails));

// ---------------- routing ----------------
let route = [];
function parse(){ const h = location.hash.replace(/^#\/?/, ''); route = h ? h.split('/') : ['home']; if (!route[0]) route = ['home']; }
window.addEventListener('hashchange', () => { parse(); render(true); refreshFor(true); window.scrollTo(0, 0); });

// ---------------- odometer ----------------
function odo(el, text){
  if (!el) return;
  if (el.dataset.v === text) return;
  const old = el.dataset.v || ''; el.dataset.v = text;
  const chars = [...text];
  if (old.length !== text.length || RM() || !el.children.length){
    el.innerHTML = chars.map(c => /\d/.test(c) ? `<span class="d"><span class="s" style="transform:translateY(${-c*1.05}em)">${[...'0123456789'].map(n => `<span>${n}</span>`).join('')}</span></span>` : `<span>${esc(c)}</span>`).join('');
    return;
  }
  const kids = [...el.children]; const n = chars.length;
  chars.forEach((c, i) => {
    if (c === old[i]) return;
    const s = kids[i].querySelector('.s');
    if (s){ s.style.transitionDelay = ((n - 1 - i) * 30) + 'ms'; s.style.transform = `translateY(${-c*1.05}em)`; } else kids[i].textContent = c;
  });
}

// ---------------- shared bits ----------------
const ICON = {
  search:'<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  bell:'<svg class="icon" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  back:'<svg class="icon" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'};
function errRow(){
  if (!offline) return '';
  const n = Math.max(0, Math.ceil((retryAt - Date.now())/1000));
  return `<div class="err" id="err">Desk offline · retrying in ${n}s · last update ${lastOk ? esc(lastOk.toLocaleTimeString([], {hour12:false})) : '—'}</div>`;
}
const paperPill = mode => mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : '';
const sk = (h, w) => `<div class="sk" style="height:${h}px;${w ? 'width:' + w : ''};margin:8px 16px"></div>`;
const tg = cmd => `<div class="tg">Change this with Telegram: <code>${esc(cmd)}</code></div>`;
function actRow(a){
  const nm = (a.title || '').split(' ').slice(1).join(' ');
  const href = a.mint ? `#/${a.opens === 'audit' ? 'audit' : 'coin'}/${encodeURIComponent(a.mint)}` : '';
  return `<a class="row" ${href ? `href="${href}"` : ''}><div class="ava">${esc((nm || '?').slice(0,1).toUpperCase())}</div>
   <div class="m"><div>${esc(a.title)}</div><div class="sec" style="font-size:13px">${esc(a.subtitle)}${a.kind === 'bought' && a.ts ? ' · ' + hhmm(a.ts) : ''}</div></div>
   <div class="v ${sign(a.value)}">${esc(a.value)}</div></a>`;
}
function toast(t){ const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }

// ---------------- agent cards (Home carousel) ----------------
function card(a){
  const top = (nm, col, title) => `<div class="top"><span class="nm"><span class="dotr ${a.running ? '' : 'off'}"></span>${nm}</span><span class="tt" style="color:${col}">${esc(title)}</span></div>`;
  if (a.agent === 'scanner'){
    const f = a.feed || [];
    return `<a class="acard" href="#/agents">${top('Scanner', '#64d2ff', a.title)}
      <div class="feed">${f.length ? f.map(s => s.verdict === 'pass' ? `<div><span>${esc(s.name)}</span> <span class="green">${esc(s.text)}</span></div>`
          : `<div class="k"><b>${esc(s.name)}</b> · <span class="red">${esc(s.text)}</span></div>`).join('') : `<div class="sec">${esc(a.empty || 'Listening for graduations')}</div>`}</div></a>`;
  }
  if (a.agent === 'auditor'){
    const L = (a.strips && a.strips.layers) || [];
    const strips = Array.from({length:8}, (_, i) => { const l = L.find(x => x.n === i+1); return `<i class="${l ? (l.ok ? 'g' : 'r') : ''}"></i>`; }).join('');
    return `<a class="acard" href="${a.strips ? '#/audit/' + encodeURIComponent(a.strips.mint) : '#/agents'}">${top('Auditor', '#fff', a.title)}
      ${a.strips ? `<div class="sec" style="margin-top:8px">${esc(a.strips.name || '')}</div>` : ''}
      <div class="strips">${strips}</div>
      <div style="font-size:17px">${esc(a.status || (a.strips ? '' : 'No coin taken apart yet'))}</div>
      <div class="sec" style="margin-top:auto">${esc(a.rejectedText)}</div></a>`;
  }
  if (a.agent === 'analyst') return `<a class="acard" href="#/agents">${top('Analyst', '#ffd60a', a.title)}<canvas class="ring" data-ring="${num(a.score) ? a.score : ''}" data-green="${a.ringGreenFrom}"></canvas>
      <div class="sec" style="text-align:center">${num(a.score) ? 'score ' + esc(a.score) : 'no score yet'} · green from ${esc(a.ringGreenFrom)}</div></a>`;
  if (a.agent === 'executor') return `<a class="acard" href="#/agents">${top('Executor', '#00d35a', a.title)}
      <div style="font:600 22px var(--disp);margin-top:16px">${esc(a.ticket)}</div>
      ${a.bar ? `<div class="bar"><i style="width:100%"></i></div><div class="green" style="margin-top:6px">${esc(a.bar)}</div>` : '<div class="sec" style="margin-top:8px">No ticket yet tonight</div>'}</a>`;
  if (a.agent === 'risk') return `<a class="acard" href="#/agents">${top('Risk', '#ff6b9a', a.title)}
      <div style="font:600 22px var(--disp);margin-top:16px">${esc(a.lastExit || (a.open ? a.open + ' open' : 'No position'))}</div>
      <div style="margin-top:auto">${(a.pills || []).map(p => `<span class="tpill ${p.color}">${esc(p.text)}</span>`).join('')}</div></a>`;
  return '';
}

// ---------------- screens ----------------
let range = localStorage.getItem('range') || 'LIVE';
function navbar(){
  const st = cache['state.json'];
  const rows = (cache['activity.json'] || {}).rows || (st && st.activity) || [];
  const seen = +localStorage.getItem('seen') || 0;
  const unread = rows.some(r => r.id > seen && r.kind !== 'rejected');
  return `<div class="nav"><a class="tap" href="#/account"><span class="avatar">G</span></a><a class="title" href="#/agents">Grok Bot ›</a>
   <button class="tap" id="sbtn" aria-label="Search">${ICON.search}</button>
   <a class="tap bell" href="#/activity" id="bell" aria-label="Notifications">${ICON.bell}${unread ? '<span class="dot"></span>' : ''}</a></div>
   <div id="sbox" hidden class="gut" style="padding-bottom:8px"><input class="search" id="sq" placeholder="Name, symbol or mint" autocomplete="off"><div id="sres" class="rows"></div></div>`;
}
function home(){
  const st = cache['state.json'], ch = cache['chart_' + range + '.json'];
  if (!st) return navbar() + errRow() + sk(72, '70%') + sk(20, '40%') + sk(230) + sk(40) + `<div style="display:flex;gap:10px;padding:0 16px"><div class="sk" style="flex:0 0 var(--cardw);aspect-ratio:504/470;margin:0;border-radius:calc(var(--cardw)*42/504)"></div></div>` + sk(60) + sk(60);
  const acts = st.activity || [];
  return navbar() + errRow() + `
   <div class="bal"><span class="big odo" id="odo"></span>${paperPill(st.mode)}</div>
   <div class="today"><span class="${(st.todayPct||0) >= 0 ? 'green' : 'red'}">${pct(st.todayPct)}</span><span class="sec">today</span>
     ${num(st.multiplier) ? `<span class="pill mult">${st.multiplier.toFixed(2)}×</span>` : ''}</div>
   <div class="chart">${ch ? '' : '<div class="sk" style="position:absolute;inset:0 16px"></div>'}<canvas id="line"></canvas>${ch && ch.empty ? `<div class="emp">${esc(ch.empty)}</div>` : ''}</div>
   <div class="ranges">${['LIVE','1H','4H','1D','1W','ALL'].map(r => `<button data-r="${r}" class="${r === range ? 'on' : ''}">${r}</button>`).join('')}</div>
   <div class="h2"><span>Agents · ${esc(st.agentsRunning)} running</span></div>
   <div class="car" id="car">${(st.agents || []).map(card).join('')}</div>
   <div class="h2"><span>Activity</span><a href="#/activity">See all</a></div>
   <div class="rows">${acts.length ? acts.slice(0,5).map(actRow).join('') : '<div class="emptyline">Nothing yet tonight</div>'}</div>`;
}
function agentsTab(){
  const st = cache['state.json'];
  let h = `<div class="nav"><span class="title" style="font-size:28px">Agents</span></div>` + errRow();
  AG.forEach(n => {
    const d = cache[`agents_${n}.json`], c = st && (st.agents || []).find(a => a.agent === n);
    if (!d){ h += `<div class="fcard"><div class="sk" style="height:22px;margin:0 0 10px"></div><div class="sk" style="height:120px;margin:0"></div></div>`; return; }
    const ds = d.decisions || [];
    h += `<div class="fcard" id="ag-${n}">
     <div class="hd"><span class="dotr ${d.running ? '' : 'off'}"></span><span style="color:${(c && c.color) || '#fff'}">${AGN[n]}</span>
       <span class="sec" style="font-weight:400;font-size:15px">· ${d.running ? 'running' : 'paused'} · ${esc(d.todayCount)} today</span>
       <span style="flex:1"></span><span class="sw ${d.running ? 'on' : ''}" role="switch" aria-checked="${d.running}" aria-disabled="true" title="read-only in plan B"></span></div>
     ${n === 'risk' && d.pauseLocked ? '<div class="tg">Locked while a position is open</div>' : tg(d.running ? '/pause ' + n : '/resume ' + n)}
     <div style="margin-top:10px">${ds.length ? ds.map(x => `<div class="dec"><span class="sec">${hhmm(x.ts)}</span>
        <span>${url(x.coin_url) ? `<a href="${url(x.coin_url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)}</span>
        <span class="${/pass|filled|trail/.test(x.verdict) ? 'green' : /kill|reject|stop/.test(x.verdict) ? 'red' : 'sec'}">${esc(x.verdict)}</span>
        <span class="r">${esc(x.reason)}</span></div>`).join('') : `<div class="sec" style="padding:8px 0">${n === 'scanner' ? 'Listening for graduations' : 'No decisions yet'}</div>`}</div>
     <a class="tap" style="color:var(--green);justify-content:flex-start" href="#/account/${n}">Settings ›</a></div>`;
  });
  return h;
}
let actPages = 1;
function activityTab(){
  const a = cache['activity.json'];
  let h = `<div class="nav"><span class="title" style="font-size:28px">Activity</span></div>` + errRow();
  if (!a) return h + [1,2,3,4,5,6].map(() => sk(52)).join('');
  let rows = a.rows || [];
  const pages = ((cache['index.json'] || {}).activityPages || []).filter(p => p !== 'activity.json');
  for (let i = 0; i < actPages - 1 && i < pages.length; i++) rows = rows.concat((cache[pages[i]] || {}).rows || []);
  if (!rows.length) return h + `<div class="emptyline">${esc(a.empty || 'Nothing yet tonight')}</div>`;
  return h + `<div class="rows">${rows.map(actRow).join('')}</div>` + (actPages - 1 < pages.length ? `<button class="btn sec2" id="more" style="width:calc(100% - 32px)">Show more</button>` : '');
}
function back(){ return `<button class="tap back" onclick="history.length > 1 ? history.back() : (location.hash = '#/home')">${ICON.back}<span>Back</span></button>`; }

// audit beam state per mint: how many layers have been revealed on screen
const beam = {};
function auditScr(mint){
  const f = `audit_${mint}.json`, a = cache[f];
  let h = `<div class="nav">${back()}<span class="title"></span></div>` + errRow();
  if (!a && cache['!' + f]) return h + `<div class="emptyline" style="padding-top:80px">No coin taken apart yet</div>`;
  if (!a) return h + sk(30, '60%') + `<div class="sk" style="height:200px;margin:16px 25%"></div>` + [1,2,3,4,5,6,7,8].map(() => sk(32)).join('');
  const b = beam[mint] || (beam[mint] = {shown: RM() ? 99 : 0, at: 0});
  const st = cache['state.json'] || {};
  const L = a.layers || [];
  const shown = b.shown;
  const done = shown >= L.filter(l => l.ok !== null).length && a.verdict && a.verdict.passed !== null;
  return h + `<div class="gut" style="font:600 28px var(--disp)">${esc(a.name)}</div>
   <div class="discs" id="discs">${L.map((l, i) => `<div class="disc ${i < shown && l.ok !== null ? (l.ok ? 'g' : 'r') : ''}" style="z-index:${10-i}"></div>`).join('')}<div class="beam" id="beam"></div></div>
   <div style="margin-top:18px">${L.map((l, i) => `<div class="lrow"><span><span class="ck ${i < shown && l.ok !== null ? (l.ok ? 'g' : 'r') : ''}">${i < shown && l.ok !== null ? (l.ok ? '✓' : '✕') : ''}</span>${esc(l.name)}</span>
      <span class="lv">${i < shown ? esc(l.value) : (l.ok === null && a.verdict && a.verdict.passed !== null ? 'not checked' : '…')}</span></div>`).join('')}</div>
   ${done ? `<div class="verdict fade"><div class="t ${a.verdict.passed ? 'green' : 'red'}">${esc(a.verdict.title)}</div><div class="sec">${esc(a.verdict.subtitle || '')}</div></div>` : '<div class="verdict"><div class="sec">taking apart...</div></div>'}
   <div class="lrow" style="border-top:.5px solid var(--sep);margin-top:12px"><span>Take apart before buying</span><span class="sw ${a.auditorEnabled ? 'on' : ''}" aria-disabled="true"></span></div>
   <div class="gut">${tg('/set auditor.enabled ' + (a.auditorEnabled ? 'false' : 'true'))}</div>
   ${url(a.coin_url) ? `<a class="btn" href="${url(a.coin_url)}" target="_blank" rel="noopener">Open on FOMO</a>` : ''}`;
}
function runBeam(mint){
  const a = cache[`audit_${mint}.json`], b = beam[mint]; if (!a || !b || RM()) return;
  const L = a.layers || [], el = $('#beam'), discs = document.querySelectorAll('#discs .disc'); if (!el || !discs.length) return;
  if (b.busy) return;
  const i = b.shown;
  if (i >= L.length || (L[i].ok === null && a.verdict && a.verdict.passed !== null)){ el.style.opacity = 0; if (i < 99 && !b.final){ b.final = 1; render(); } return; }
  el.style.opacity = 1; el.style.top = (discs[i].offsetTop + discs[i].offsetHeight/2) + 'px';
  if (L[i].ok === null) return;                                     // server hasn't sent this layer: beam waits here
  b.busy = 1;
  setTimeout(() => { discs[i].classList.add(L[i].ok ? 'g' : 'r'); setTimeout(() => { b.busy = 0; b.shown++; render(); }, 150); }, 350);
}
function coinScr(mint){
  const f = `coin_${mint}.json`, c = cache[f];
  let h = `<div class="nav">${back()}<span class="title"></span>${c ? paperPill(c.mode) : ''}</div>` + errRow();
  if (!c && cache['!' + f]) return h + `<div class="emptyline" style="padding-top:80px">This coin isn't on the desk tonight</div>`;
  if (!c) return h + sk(30, '60%') + sk(18, '50%') + sk(50, '55%') + sk(240) + sk(120) + sk(50);
  const p = c.position, e = c.exit, s = c.stats || {};
  const left = e && num(e.timeLeftS) ? Math.max(0, e.timeLeftS - Math.round((Date.now() - (cache['_t' + f] || Date.now()))/1000)) : null;
  return h + `<div class="gut" style="display:flex;align-items:center;gap:8px"><span style="font:600 28px var(--disp)">${esc(c.name || c.symbol)}</span>${c.shield ? `<span class="chip">${esc(c.shield)}</span>` : ''}</div>
   <div class="gut sec">${esc(c.ageText || '')}</div>
   <div class="price">${price(c.price)}</div>
   ${num(c.sinceEntryPct) ? `<div class="gut ${c.sinceEntryPct >= 0 ? 'green' : 'red'}">${c.sinceEntryPct >= 0 ? '▲' : '▼'} ${Math.abs(c.sinceEntryPct).toFixed(2)}% since entry</div>` : ''}
   <div class="chart" style="height:240px;margin:12px 16px 0"><canvas id="cand"></canvas>${(c.candles || []).length ? '' : '<div class="emp">No price yet</div>'}</div>
   <div class="stats"><div><span class="sec">Market cap</span><b>${big(s.marketCap)}</b></div><div><span class="sec">Liquidity</span><b>${big(s.liquidityUsd)}</b></div>
     <div><span class="sec">24h volume</span><b>${big(s.volume24h)}</b></div><div><span class="sec">Holders</span><b>${esc(s.holdersText || 'n/a')}</b></div></div>
   ${p ? `<div class="fcard"><div class="kv"><span>Your position</span><span>${esc(p.text)}</span></div>
      ${!p.open && p.exitReason ? `<div class="kv"><span class="sec">Closed · ${esc(p.exitReason)}</span><span class="${(p.pnlUsd||0) >= 0 ? 'green' : 'red'}">${num(p.pnlUsd) ? (p.pnlUsd >= 0 ? '+' : '-') + money(Math.abs(p.pnlUsd)) : '—'}</span></div>` : ''}</div>` : ''}
   ${e ? `<div class="fcard"><div class="hd" style="margin-bottom:6px">Exit</div>
      <div class="kv"><span class="sec">Stop line</span><span class="red">${price(e.stopLine)} · -${esc(e.stopPct)}%</span></div>
      <div class="kv"><span class="sec">Trail line</span><span>${e.trailActive ? price(e.trailLine) : 'starts at ' + price(e.trailStartsAt)}</span></div>
      <div class="kv"><span class="sec">Time left</span><span id="tleft" data-left="${left}">${fmtLeft(left)}</span></div></div>` : ''}
   ${c.button && url(c.button.url) ? `<a class="btn" href="${url(c.button.url)}" target="_blank" rel="noopener">${esc(c.button.label)}</a>` : ''}`;
}
const fmtLeft = s => num(s) ? `${Math.floor(s/3600)}h ${String(Math.floor(s%3600/60)).padStart(2,'0')}m` : '—';
function accountTab(){
  const a = cache['account.json'], s = cache['settings.json'];
  let h = `<div class="nav"><span class="title" style="font-size:28px">Account</span></div>` + errRow();
  if (!a || !s) return h + sk(90) + sk(44) + sk(44) + sk(44) + sk(300);
  const R = s.ranges || {}, G = s.groups || {};
  const rowsFor = (g) => Object.keys(R).filter(k => k.startsWith(g + '.')).map(k => {
    const path = k.split('.').slice(1); let v = G[g]; path.forEach(p => v = v == null ? v : v[p]);
    const r = R[k]; const lab = k.split('.').slice(1).join('.');
    let ctl;
    if (r === 'bool') ctl = `<span class="sw ${v ? 'on' : ''}" aria-disabled="true"></span>`;
    else if (Array.isArray(r) && typeof r[0] === 'number') ctl = `<input class="nf" type="number" value="${esc(v)}" readonly aria-readonly="true">`;
    else ctl = `<span class="sec">${esc(v)}</span>`;
    const slider = Array.isArray(r) && typeof r[0] === 'number' ? `<input type="range" min="${r[0]}" max="${r[1]}" step="any" value="${esc(v)}" disabled><div class="ter" style="font-size:12px">${r[0]} to ${r[1]}</div>` : '';
    return `<div class="set"><div class="l"><span>${esc(lab)}</span>${ctl}</div>${slider}${tg(`/set ${k} ${v}`)}</div>`;
  }).join('');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return h + `<div class="fcard"><div class="kv"><span>Mode</span><span>${['PAPER','LIVE'].map(m => `<span class="pill" style="${a.mode === m ? (m === 'PAPER' ? 'background:var(--orange);color:#000' : 'background:var(--green);color:#000') : 'color:var(--t2)'}">${m}</span>`).join(' ')}</span></div>
     <div class="tg">${esc(a.liveRule || '')}${a.liveAllowed ? '' : ' · not yet allowed'}</div>${tg(a.mode === 'PAPER' ? '/mode LIVE' : '/mode PAPER')}
     <div class="kv" style="margin-top:8px"><span>Stack</span><input class="nf" value="${esc(money(a.stack))}" readonly aria-readonly="true"></div>
     ${tg('/set desk.paper_start_stack ' + (a.paperStartStack == null ? '' : a.paperStartStack))}</div>
   <div class="fcard" style="padding:0 16px">
     ${url(a.profile_url) ? `<a class="kv" style="min-height:48px" href="${url(a.profile_url)}" target="_blank" rel="noopener"><span>Your FOMO profile</span><span class="sec">›</span></a>` : ''}
     ${url(a.SIGNUP_URL) ? `<button class="kv" style="min-height:48px;width:100%;border-top:.5px solid var(--sep)" id="invite" data-u="${url(a.SIGNUP_URL)}"><span>Invite a friend</span><span class="sec">›</span></button>` : ''}</div>
   <div class="fcard"><div class="kv"><span>Telegram</span><span class="${a.telegram && a.telegram.connected ? 'green' : 'sec'}">${a.telegram && a.telegram.connected ? 'connected' : 'not connected'}</span></div>
     <div class="kv"><span>Send test push</span><span class="sec">read-only</span></div>${tg('/test')}
     <div class="kv" style="border-top:.5px solid var(--sep);margin-top:8px"><span>${standalone ? 'Enable notifications' : 'Notifications'}</span><span class="sec">off</span></div>
     <div class="tg">plan B: no web push, Telegram only</div></div>
   ${AG.concat(['desk']).map(g => `<div class="fcard" id="set-${g}"><div class="hd">${esc(AGN[g] || 'Desk')}</div>${rowsFor(g)}</div>`).join('')}`;
}

// ---------------- render ----------------
function render(fresh){
  const v = $('#view'); if (!v) return;
  if (!BASE || !D){ v.innerHTML = `<div class="nav"><span class="title">Grok Bot</span></div><div class="emptyline" style="padding-top:120px">Open this app once with the link from Grok Bot.</div>`; tabs(); return; }
  const car = $('#car'), sl = car ? car.scrollLeft : 0, odov = $('#odo') ? $('#odo').innerHTML : null, odod = $('#odo') ? $('#odo').dataset.v : null;
  const sq = $('#sq'), sqv = sq && !$('#sbox').hidden ? sq.value : null;
  const r = route[0];
  v.innerHTML = r === 'agents' ? agentsTab() : r === 'activity' ? activityTab() : r === 'account' ? accountTab()
    : r === 'coin' ? coinScr(decodeURIComponent(route[1] || '')) : r === 'audit' ? auditScr(decodeURIComponent(route[1] || '')) : home();
  tabs(); after(fresh, sl, odov, odod, sqv);
}
function after(fresh, sl, odov, odod, sqv){
  const st = cache['state.json'];
  const o = $('#odo'); if (o && st){ if (odov != null && !fresh){ o.innerHTML = odov; o.dataset.v = odod; } odo(o, money(st.balance)); }
  const car = $('#car'); if (car && !fresh) car.scrollLeft = sl;
  const ln = $('#line'); if (ln){ const k = 'chart_' + range + '.json'; const d = cache[k]; if (d){ DeskChart.line(ln, d, prevChart[k]); prevChart[k] = d; } }
  document.querySelectorAll('canvas[data-ring]').forEach(c => DeskChart.ring(c, c.dataset.ring === '' ? null : +c.dataset.ring, +c.dataset.green || 70));
  const cd = $('#cand'); if (cd){ const c = cache[`coin_${decodeURIComponent(route[1])}.json`]; if (c) DeskChart.candles(cd, c.candles, c.exit ? c.exit.exitLine : null); }
  document.querySelectorAll('.ranges button').forEach(b => b.onclick = () => { range = b.dataset.r; localStorage.setItem('range', range); render(); load('chart_' + range + '.json').then(() => render()); });
  const sb = $('#sbtn'); if (sb) sb.onclick = () => { const bx = $('#sbox'); bx.hidden = !bx.hidden; if (!bx.hidden) $('#sq').focus(); };
  if (sqv != null){ $('#sbox').hidden = false; $('#sq').value = sqv; search(sqv); }
  const sq = $('#sq'); if (sq) sq.oninput = () => search(sq.value);
  const bell = $('#bell'); if (bell) bell.onclick = () => { const rows = (cache['activity.json'] || {}).rows || []; if (rows[0]) localStorage.setItem('seen', rows[0].id); };
  const inv = $('#invite'); if (inv) inv.onclick = async () => {
    const u = inv.dataset.u;
    try { if (navigator.share){ await navigator.share({title:'FOMO', url:u}); return; } } catch(e){ if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(u); } catch(e){ const t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    toast('Link copied');
  };
  const more = $('#more'); if (more) more.onclick = async () => { const pages = (cache['index.json'] || {}).activityPages.filter(p => p !== 'activity.json'); await load(pages[actPages - 1]); actPages++; render(); };
  if (route[0] === 'account' && route[1] && fresh){ const t = $('#set-' + route[1]); if (t) t.scrollIntoView(); }
  if (route[0] === 'audit') runBeam(decodeURIComponent(route[1] || ''));
}
function search(q){
  const box = $('#sres'); q = (q || '').trim().toLowerCase(); if (!q){ box.innerHTML = ''; return; }
  const seen = {}, out = [], st = cache['state.json'] || {};
  const add = (mint, name) => { if (!mint || seen[mint]) return; seen[mint] = 1; out.push({mint, name}); };
  ((st.agents || []).find(a => a.agent === 'scanner') || {feed:[]}).feed.forEach(f => add(f.mint, f.name));
  ((cache['activity.json'] || {}).rows || []).forEach(r => add(r.mint, (r.title || '').split(' ').slice(1).join(' ')));
  ((cache['index.json'] || {}).coins || []).forEach(m => add(m, cache[`coin_${m}.json`] ? (cache[`coin_${m}.json`].name + ' ' + (cache[`coin_${m}.json`].symbol || '')) : ''));
  const hit = out.filter(o => (o.mint + ' ' + (o.name || '')).toLowerCase().includes(q)).slice(0, 8);
  box.innerHTML = hit.length ? hit.map(o => `<a class="row" href="#/coin/${encodeURIComponent(o.mint)}"><div class="ava">${esc((o.name || '?')[0])}</div><div class="m"><div>${esc(o.name || '')}</div><div class="ter" style="font-size:12px">${esc(o.mint)}</div></div></a>`).join('') : '<div class="sec" style="padding:10px 0">No match</div>';
}
function tabs(){
  const r = route[0], on = t => (r === t || (t === 'home' && (r === 'coin' || r === 'audit'))) ? 'on' : '';
  $('#tabs').innerHTML = `<a href="#/home" class="${on('home')}"><svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>Home</a>
   <a href="#/agents" class="${on('agents')}"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M12 20c0-3 2-5 4-5s6 2 6 5"/></svg>Agents</a>
   <a href="#/activity" class="${on('activity')}"><svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>Activity</a>
   <a href="#/account" class="${on('account')}"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>Account</a>`;
}

// ---------------- polling (state ~5s, others on their cadence) ----------------
const due = {};
function every(key, ms, fn){ const n = Date.now(); if (!due[key] || n >= due[key]){ due[key] = n + ms; fn(); } }
async function refreshFor(now){
  if (!D) return;
  if (now) Object.keys(due).forEach(k => { if (k !== 'state') delete due[k]; });
  const r = route[0], jobs = [];
  const add = (key, ms, file, o) => every(key, ms, () => jobs.push(load(file, o).then(j => { if (j && file.startsWith('coin_')) cache['_t' + file] = Date.now(); })));
  add('index', 30000, 'index.json', {quiet:1});
  if (r === 'home' || !cache['state.json']) add('chart' + range, 15000, 'chart_' + range + '.json');
  if (r === 'home' || r === 'activity') add('act', 15000, 'activity.json');
  if (r === 'agents') AG.forEach(n => add('ag' + n, 15000, `agents_${n}.json`));
  if (r === 'account'){ add('acc', 30000, 'account.json'); add('set', 60000, 'settings.json'); }
  if (r === 'coin') add('coin' + route[1], 10000, `coin_${decodeURIComponent(route[1])}.json`, {quiet:1});
  if (r === 'audit'){ const a = cache[`audit_${decodeURIComponent(route[1])}.json`]; add('aud' + route[1], a && a.verdict && a.verdict.passed !== null ? 15000 : 3000, `audit_${decodeURIComponent(route[1])}.json`, {quiet:1}); }
  if (jobs.length){ await Promise.all(jobs); render(); }
}
async function tickState(){
  if (!D) return;
  if (offline && Date.now() < retryAt){ const e = $('#err'); if (e) e.outerHTML = errRow(); return; }
  await load('state.json'); render(); refreshFor();
}
parse(); render(true);
if (D){ tickState(); setInterval(() => { const n = Date.now(); if (!due.state || n >= due.state){ due.state = n + 5000; tickState(); } else if (offline){ const e = $('#err'); if (e) e.outerHTML = errRow(); } refreshFor(); }, 1000); }
setInterval(() => { const t = $('#tleft'); if (t && t.dataset.left !== 'null'){ const v = Math.max(0, +t.dataset.left - 1); t.dataset.left = v; t.textContent = fmtLeft(v); } }, 1000);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
