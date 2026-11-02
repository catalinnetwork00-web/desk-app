// Plan B: reads JSON from {DESK_DATA_BASE}{DATA_PATH}/ . DATA_PATH arrives once via #d= and lives in localStorage.
(function(){
  const m = location.hash.match(/d=([^&]+)/);
  if (m) { localStorage.setItem('d', decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname); }
  const d = localStorage.getItem('d');
  const s = document.getElementById('s'), bal = document.getElementById('bal'), err = document.getElementById('err');
  if (!d) { s.textContent = 'Open this app once with the link from Grok Bot.'; return; }
  let last = null;
  async function tick(){
    try {
      const r = await fetch(window.DESK_DATA_BASE + d + '/state.json?ts=' + Date.now(), {cache:'no-store'});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); last = new Date();
      bal.textContent = (typeof j.balance === 'number') ? '$' + j.balance.toFixed(2) : '—';
      s.textContent = JSON.stringify(j, null, 2); err.hidden = true;
    } catch(e) {
      err.hidden = false;
      err.textContent = 'Desk offline · retrying in 15s · last update ' + (last ? last.toLocaleTimeString() : 'never');
    }
  }
  tick(); setInterval(tick, 15000);
})();
