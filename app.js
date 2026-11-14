'use strict';
/* Ponto & Horas — controle de horas trabalhadas e extras, com sincronização via GitHub. */

const $ = s => document.querySelector(s);
const LS_DATA = 'ph.data.v1', LS_SYNC = 'ph.sync.v1';
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TYPES = {
  normal: 'Normal',
  feriado: 'Feriado (extra 100%)',
  folga: 'Folga / DSR',
  compensacao: 'Compensação (desconta do banco)',
  abono: 'Atestado / Abono',
  ferias: 'Férias',
  falta: 'Falta',
};
const DEFAULT_SETTINGS = {
  journey: [0, 480, 480, 480, 480, 480, 0], // minutos por dia da semana (Dom..Sáb)
  tolerance: 10,
  rateNormal: 50,
  rateSpecial: 100,
  saturdaySpecial: false,
  hourlyRate: 0,
  initialBank: 0,
};

/* ---------------- utilidades ---------------- */
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = min => { const s = min < 0 ? '-' : ''; min = Math.abs(Math.round(min)); return `${s}${Math.floor(min / 60)}:${pad(min % 60)}`; };
const fmtS = min => (Math.round(min) > 0 ? '+' : '') + fmt(min);
const cls = min => Math.round(min) > 0 ? 'pos' : Math.round(min) < 0 ? 'neg' : '';
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const money = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseHM = s => {
  s = String(s || '').trim(); if (!s) return 0;
  const neg = s.startsWith('-'); s = s.replace(/^[-+]/, '');
  const [h, m = '0'] = s.split(':'); const v = (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  return neg ? -v : v;
};
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
const lsDel = k => { try { localStorage.removeItem(k); } catch { } };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- feriados nacionais ---------------- */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const holCache = {};
function holidays(y) {
  if (holCache[y]) return holCache[y];
  const h = {
    [`${y}-01-01`]: 'Confraternização Universal', [`${y}-04-21`]: 'Tiradentes', [`${y}-05-01`]: 'Dia do Trabalho',
    [`${y}-09-07`]: 'Independência', [`${y}-10-12`]: 'N. Sra. Aparecida', [`${y}-11-02`]: 'Finados',
    [`${y}-11-15`]: 'Proclamação da República', [`${y}-11-20`]: 'Consciência Negra', [`${y}-12-25`]: 'Natal',
  };
  const gf = easter(y); gf.setDate(gf.getDate() - 2); h[dkey(gf)] = 'Sexta-feira Santa';
  return (holCache[y] = h);
}
const holidayName = k => holidays(+k.slice(0, 4))[k];

/* ---------------- estado ---------------- */
function emptyState() { return { version: 1, settings: { ...DEFAULT_SETTINGS }, settingsUpdatedAt: 0, days: {} }; }
function normalize(s) {
  const out = emptyState();
  if (!s || typeof s !== 'object') return out;
  out.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  out.settingsUpdatedAt = s.settingsUpdatedAt || 0;
  out.days = s.days && typeof s.days === 'object' ? s.days : {};
  return out;
}
let state = normalize(JSON.parse(lsGet(LS_DATA) || 'null'));
let syncCfg = JSON.parse(lsGet(LS_SYNC) || 'null');
const saveLocal = () => lsSet(LS_DATA, JSON.stringify(state));

function setDay(k, patch) {
  const cur = state.days[k] || { punches: [], note: '', type: '' };
  state.days[k] = { ...cur, ...patch, updatedAt: Date.now() };
  changed();
}
function setSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  state.settingsUpdatedAt = Date.now();
  changed();
}
function changed() { saveLocal(); render(); schedulePush(); }

/* ---------------- cálculos ---------------- */
function dayType(k) { const d = state.days[k]; return (d && d.type) || (holidayName(k) ? 'feriado' : 'normal'); }
function workedMin(p, liveNow) {
  let t = 0;
  for (let i = 0; i < p.length; i += 2) {
    const a = toMin(p[i]); let b;
    if (i + 1 < p.length) b = toMin(p[i + 1]); else if (liveNow != null) b = liveNow; else break;
    if (b < a) b += 1440; // virou a meia-noite
    t += b - a;
  }
  return t;
}
function calcDay(k, liveNow) {
  const d = state.days[k] || {}, s = state.settings;
  const p = (d.punches || []).filter(Boolean);
  const type = dayType(k), wd = parseKey(k).getDay(), base = s.journey[wd] || 0;
  const worked = workedMin(p, liveNow);
  let expected = 0;
  if (type === 'normal') expected = p.length ? base : 0; // dia sem registro não conta
  else if (type === 'falta' || type === 'compensacao') expected = base;
  let diff = worked - expected;
  if (type === 'normal' && expected > 0 && Math.abs(diff) <= s.tolerance) diff = 0;
  const special = type === 'feriado' || wd === 0 || (wd === 6 && s.saturdaySpecial);
  const extra = Math.max(0, diff);
  return {
    k, type, punches: p, note: d.note || '', worked, expected, diff, base,
    extraN: special ? 0 : extra, extraS: special ? extra : 0,
    incomplete: p.length % 2 === 1, recorded: !!state.days[k],
  };
}
function monthKeys(y, m) { const n = new Date(y, m + 1, 0).getDate(); return Array.from({ length: n }, (_, i) => dkey(new Date(y, m, i + 1))); }
function summarize(keys) {
  const today = dkey(new Date());
  const r = { worked: 0, expected: 0, diff: 0, extraN: 0, extraS: 0, deficit: 0, days: 0 };
  for (const k of keys) {
    const c = calcDay(k, k === today ? nowMin() : null);
    r.worked += c.worked; r.expected += c.expected; r.diff += c.diff;
    r.extraN += c.extraN; r.extraS += c.extraS; if (c.diff < 0) r.deficit += -c.diff;
    if (c.worked > 0) r.days++;
  }
  r.value = (state.settings.hourlyRate || 0) / 60 *
    (r.extraN * (1 + state.settings.rateNormal / 100) + r.extraS * (1 + state.settings.rateSpecial / 100));
  return r;
}
const bankTotal = () => state.settings.initialBank + summarize(Object.keys(state.days)).diff;

/* ---------------- registro de ponto ---------------- */
function punch() {
  const now = new Date(), today = dkey(now);
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const yk = dkey(yest), yp = (state.days[yk]?.punches || []);
  const tp = (state.days[today]?.punches || []);
  // turno que passou da meia-noite: fecha o dia anterior
  if (!tp.length && yp.length % 2 === 1 && now.getHours() < 12) {
    setDay(yk, { punches: [...yp, nowHM()] }); toast('Saída registrada no dia anterior (virada de turno)'); return;
  }
  setDay(today, { punches: [...tp, nowHM()] });
  toast((tp.length % 2 === 0 ? 'Entrada' : 'Saída') + ' registrada às ' + nowHM());
  if (navigator.vibrate) navigator.vibrate(40);
}

/* ---------------- renderização ---------------- */
let viewY = new Date().getFullYear(), viewM = new Date().getMonth();
function render() { renderToday(); renderMonth(); }

function renderToday() {
  const now = new Date(), k = dkey(now), c = calcDay(k, nowMin());
  const hol = holidayName(k);
  $('#todayLabel').innerHTML = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    (c.type !== 'normal' ? `<span class="badge">${esc(hol && c.type === 'feriado' ? hol : TYPES[c.type])}</span>` : '');
  $('#todayPunches').innerHTML = c.punches.length
    ? c.punches.map((p, i) => `<span class="chip">${i % 2 ? '⏹' : '▶'} ${p}</span>`).join('')
    : '<span class="muted small">Nenhuma marcação hoje</span>';
  $('#punchBtn').textContent = c.punches.length % 2 ? `Registrar saída` : (c.punches.length ? 'Registrar volta' : 'Registrar entrada');
  $('#punchBtn').classList.toggle('out', c.punches.length % 2 === 1);
  const expected = c.expected || (c.type === 'normal' ? c.base : 0);
  $('#hWorked').textContent = fmt(c.worked);
  $('#hExpected').textContent = fmt(expected);
  const diff = c.punches.length ? c.diff : 0;
  $('#hDiff').textContent = fmtS(diff); $('#hDiff').className = 'v ' + cls(diff);
  if (c.incomplete && expected > c.worked) {
    const t = nowMin() + (expected - c.worked);
    $('#hLeave').textContent = pad(Math.floor(t / 60) % 24) + ':' + pad(t % 60);
  } else $('#hLeave').textContent = c.incomplete || !c.punches.length ? '--:--' : (c.worked >= expected ? 'Concluída' : '--:--');
  const note = $('#todayNote');
  if (document.activeElement !== note) note.value = c.note;
  const ms = summarize(monthKeys(now.getFullYear(), now.getMonth()));
  $('#hMonthExtra').textContent = fmt(ms.extraN + ms.extraS);
  $('#hMonthBal').textContent = fmtS(ms.diff); $('#hMonthBal').className = 'v ' + cls(ms.diff);
  const b = bankTotal(); $('#hBank').textContent = fmtS(b); $('#hBank').className = 'v ' + cls(b);
}

function renderMonth() {
  const s = state.settings, keys = monthKeys(viewY, viewM), sum = summarize(keys), today = dkey(new Date());
  $('#monthLabel').textContent = new Date(viewY, viewM, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const stat = (l, v, c = '') => `<div class="stat"><div class="l">${l}</div><div class="v ${c}">${v}</div></div>`;
  $('#monthStats').innerHTML =
    stat('Trabalhado', fmt(sum.worked)) + stat('Previsto', fmt(sum.expected)) +
    stat(`Extras ${s.rateNormal}%`, fmt(sum.extraN), sum.extraN ? 'pos' : '') +
    stat(`Extras ${s.rateSpecial}%`, fmt(sum.extraS), sum.extraS ? 'pos' : '') +
    stat('Horas faltantes', fmt(sum.deficit), sum.deficit ? 'neg' : '') +
    stat('Saldo do mês', fmtS(sum.diff), cls(sum.diff)) +
    (s.hourlyRate ? stat('Valor das extras', money(sum.value), sum.value ? 'pos' : '') : '') +
    stat('Banco total', fmtS(bankTotal()), cls(bankTotal()));
  $('#dayList').innerHTML = keys.map(k => {
    const c = calcDay(k, k === today ? nowMin() : null), d = parseKey(k), wd = d.getDay();
    const hol = holidayName(k);
    let mid = c.punches.length ? `<b>${c.punches.join(' – ')}</b>` : '';
    if (c.type !== 'normal') mid = `<span class="badge" style="margin:0 4px 0 0">${esc(c.type === 'feriado' && hol ? hol : TYPES[c.type])}</span>` + mid;
    if (c.note) mid += `<br>${esc(c.note)}`;
    if (!mid) mid = c.base ? '—' : '<span class="small">sem expediente</span>';
    const right = c.worked || c.expected
      ? `${fmt(c.worked)}<br><span class="${cls(c.diff)}">${fmtS(c.diff)}</span>${c.incomplete && k !== today ? '<br><span class="neg small">incompleto</span>' : ''}`
      : '';
    return `<li data-k="${k}" class="${wd === 0 || wd === 6 ? 'wknd' : ''} ${k === today ? 'today' : ''}">
      <div class="d">${pad(d.getDate())}<small>${WD[wd]}</small></div><div class="p">${mid}</div><div class="r">${right}</div></li>`;
  }).join('');
}

function renderSettings() {
  const s = state.settings;
  $('#journeyGrid').innerHTML = WD.map((w, i) =>
    `<div><label for="j${i}">${w}</label><input id="j${i}" data-wd="${i}" value="${fmt(s.journey[i])}" inputmode="numeric"></div>`).join('');
  $('#cTol').value = s.tolerance; $('#cRateN').value = s.rateNormal; $('#cRateS').value = s.rateSpecial;
  $('#cHour').value = s.hourlyRate || ''; $('#cSat').checked = !!s.saturdaySpecial; $('#cInitial').value = fmt(s.initialBank);
  const c = syncCfg || {};
  $('#sOwner').value = c.owner || ''; $('#sRepo').value = c.repo || ''; $('#sPath').value = c.path || 'dados/horas.json';
  $('#sBranch').value = c.branch || ''; $('#sToken').value = c.token || '';
  $('#sDevice').value = c.device || (/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Celular' : 'Computador');
}

/* ---------------- edição de dia ---------------- */
let editingKey = null;
function pairRow(a = '', b = '') {
  const div = document.createElement('div'); div.className = 'pair';
  div.innerHTML = `<div><label>Entrada</label><input type="time" value="${a}"></div>
    <div><label>Saída</label><input type="time" value="${b}"></div>
    <button type="button" class="btn danger" aria-label="Remover">✕</button>`;
  div.querySelector('button').onclick = () => div.remove();
  return div;
}
function openDay(k) {
  editingKey = k; const c = calcDay(k), d = parseKey(k), hol = holidayName(k);
  $('#dlgTitle').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#dlgSub').textContent = (hol ? hol + ' · ' : '') + 'Jornada prevista: ' + fmt(c.base);
  $('#dlgType').innerHTML = Object.entries(TYPES).map(([v, l]) => `<option value="${v}" ${v === c.type ? 'selected' : ''}>${l}</option>`).join('');
  const box = $('#dlgPairs'); box.innerHTML = '';
  for (let i = 0; i < c.punches.length; i += 2) box.appendChild(pairRow(c.punches[i], c.punches[i + 1] || ''));
  if (!c.punches.length) box.appendChild(pairRow());
  $('#dlgNote').value = c.note;
  $('#dayDlg').showModal();
}
function saveDay() {
  const punches = [];
  for (const row of $('#dlgPairs').querySelectorAll('.pair')) {
    const [a, b] = [...row.querySelectorAll('input')].map(i => i.value);
    if (a) punches.push(a); if (a && b) punches.push(b);
  }
  const type = $('#dlgType').value;
  const autoType = holidayName(editingKey) ? 'feriado' : 'normal';
  setDay(editingKey, { punches, type: type === autoType ? '' : type, note: $('#dlgNote').value.trim() });
  $('#dayDlg').close(); toast('Dia salvo');
}

/* ---------------- sincronização GitHub ---------------- */
const b64enc = str => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const b64dec = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
    : JSON.stringify(v);

function merge(a, b) {
  const out = emptyState();
  const sa = a.settingsUpdatedAt || 0, sb = b.settingsUpdatedAt || 0;
  out.settings = { ...DEFAULT_SETTINGS, ...(sa >= sb ? a.settings : b.settings) };
  out.settingsUpdatedAt = Math.max(sa, sb);
  for (const k of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
    const x = a.days[k], y = b.days[k];
    out.days[k] = !y ? x : !x ? y : ((x.updatedAt || 0) >= (y.updatedAt || 0) ? x : y);
  }
  return out;
}

function ghUrl() {
  const path = syncCfg.path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(syncCfg.owner)}/${encodeURIComponent(syncCfg.repo)}/contents/${path}`;
}
const ghHeaders = () => ({ Authorization: 'Bearer ' + syncCfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
async function ghError(r) {
  let m = ''; try { m = (await r.json()).message; } catch { }
  if (r.status === 401) return 'Token inválido ou expirado';
  if (r.status === 403) return 'Sem permissão (verifique a permissão Contents do token)';
  if (r.status === 404) return 'Repositório não encontrado (ou token sem acesso a ele)';
  return `GitHub ${r.status}: ${m}`;
}
async function ghGet() {
  const q = syncCfg.branch ? '?ref=' + encodeURIComponent(syncCfg.branch) : '';
  const r = await fetch(ghUrl() + q, { headers: ghHeaders(), cache: 'no-store' });
  if (r.status === 404) {
    // arquivo ainda não existe? confirma que o repositório existe
    const rr = await fetch(`https://api.github.com/repos/${encodeURIComponent(syncCfg.owner)}/${encodeURIComponent(syncCfg.repo)}`, { headers: ghHeaders(), cache: 'no-store' });
    if (!rr.ok) throw new Error(await ghError(rr));
    return null;
  }
  if (!r.ok) throw new Error(await ghError(r));
  const j = await r.json();
  return { sha: j.sha, data: normalize(JSON.parse(b64dec(j.content))) };
}
async function ghPut(data, sha) {
  const body = {
    message: `Ponto: atualização (${syncCfg.device || 'aparelho'}) ${new Date().toLocaleString('pt-BR')}`,
    content: b64enc(JSON.stringify(data, null, 1)),
  };
  if (sha) body.sha = sha; if (syncCfg.branch) body.branch = syncCfg.branch;
  const r = await fetch(ghUrl(), { method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 409 || (r.status === 422 && sha)) { const e = new Error('conflito'); e.conflict = true; throw e; }
  if (!r.ok) throw new Error(await ghError(r));
}

let syncing = false, syncAgain = false, pushTimer = null, lastSync = null;
function setPill(kind, text) { const p = $('#syncPill'); p.className = 'pill ' + kind; p.textContent = text; }
function schedulePush() {
  if (!syncCfg) { setPill('', 'Salvo neste aparelho'); return; }
  setPill('busy', 'Alterações pendentes…');
  clearTimeout(pushTimer); pushTimer = setTimeout(sync, 1500);
}
async function sync() {
  if (!syncCfg) return;
  if (syncing) { syncAgain = true; return; }
  if (!navigator.onLine) { setPill('err', 'Offline · salvo no aparelho'); return; }
  syncing = true; setPill('busy', 'Sincronizando…');
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const remote = await ghGet();
        const merged = remote ? merge(state, remote.data) : state;
        if (stable(merged) !== stable(state)) { state = merged; saveLocal(); render(); }
        if (!remote || stable(merged) !== stable(remote.data)) await ghPut(merged, remote && remote.sha);
        break;
      } catch (e) { if (e.conflict && attempt < 4) continue; throw e; }
    }
    lastSync = new Date();
    setPill('ok', '✓ Salvo no GitHub ' + pad(lastSync.getHours()) + ':' + pad(lastSync.getMinutes()));
    $('#syncInfo').textContent = `Conectado a ${syncCfg.owner}/${syncCfg.repo} · ${syncCfg.path}`;
  } catch (e) {
    setPill('err', '⚠ ' + (navigator.onLine ? e.message : 'Offline · salvo no aparelho'));
    $('#syncInfo').textContent = 'Erro: ' + e.message + ' — os dados continuam salvos neste aparelho.';
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; sync(); }
  }
}

/* ---------------- exportações ---------------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCSV() {
  const s = state.settings, keys = monthKeys(viewY, viewM);
  const rows = [['Data', 'Dia', 'Tipo', 'Marcações', 'Trabalhado', 'Previsto', 'Saldo', `Extra ${s.rateNormal}%`, `Extra ${s.rateSpecial}%`, 'Anotações']];
  for (const k of keys) {
    const c = calcDay(k);
    rows.push([parseKey(k).toLocaleDateString('pt-BR'), WD[parseKey(k).getDay()], TYPES[c.type], c.punches.join(' - '),
      fmt(c.worked), fmt(c.expected), fmtS(c.diff), fmt(c.extraN), fmt(c.extraS), c.note]);
  }
  const t = summarize(keys);
  rows.push(['TOTAL', '', '', '', fmt(t.worked), fmt(t.expected), fmtS(t.diff), fmt(t.extraN), fmt(t.extraS), s.hourlyRate ? 'Valor extras: ' + money(t.value) : '']);
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(`horas-${viewY}-${pad(viewM + 1)}.csv`, csv, 'text/csv;charset=utf-8');
}

/* ---------------- eventos ---------------- */
function showTab(name) {
  document.querySelectorAll('section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'config') renderSettings();
  lsSet('ph.tab', name); window.scrollTo(0, 0);
}
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
$('#punchBtn').onclick = punch;
$('#editTodayBtn').onclick = () => openDay(dkey(new Date()));
let noteTimer;
$('#todayNote').addEventListener('input', e => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => setDay(dkey(new Date()), { note: e.target.value.trim() }), 700);
});
$('#prevMonth').onclick = () => { if (--viewM < 0) { viewM = 11; viewY--; } renderMonth(); };
$('#nextMonth').onclick = () => { if (++viewM > 11) { viewM = 0; viewY++; } renderMonth(); };
$('#dayList').onclick = e => { const li = e.target.closest('li[data-k]'); if (li) openDay(li.dataset.k); };
$('#addPair').onclick = () => $('#dlgPairs').appendChild(pairRow());
$('#dayForm').onsubmit = e => { e.preventDefault(); saveDay(); };
$('#dlgCancel').onclick = () => $('#dayDlg').close();
$('#dlgClear').onclick = () => {
  if (!confirm('Apagar marcações e anotações deste dia?')) return;
  setDay(editingKey, { punches: [], note: '', type: '' }); $('#dayDlg').close();
};
$('#csvBtn').onclick = exportCSV;
$('#printBtn').onclick = () => window.print();
$('#syncPill').onclick = () => syncCfg ? sync() : showTab('config');

$('#journeyGrid').addEventListener('change', e => {
  const i = +e.target.dataset.wd; const j = [...state.settings.journey];
  j[i] = Math.max(0, parseHM(e.target.value)); e.target.value = fmt(j[i]); setSettings({ journey: j });
});
$('#cTol').onchange = e => setSettings({ tolerance: Math.max(0, +e.target.value || 0) });
$('#cRateN').onchange = e => setSettings({ rateNormal: Math.max(0, +e.target.value || 0) });
$('#cRateS').onchange = e => setSettings({ rateSpecial: Math.max(0, +e.target.value || 0) });
$('#cHour').onchange = e => setSettings({ hourlyRate: Math.max(0, +e.target.value || 0) });
$('#cSat').onchange = e => setSettings({ saturdaySpecial: e.target.checked });
$('#cInitial').onchange = e => { const v = parseHM(e.target.value); e.target.value = fmt(v); setSettings({ initialBank: v }); };

$('#connectBtn').onclick = async () => {
  const cfg = {
    owner: $('#sOwner').value.trim(), repo: $('#sRepo').value.trim(), path: $('#sPath').value.trim().replace(/^\/+/, '') || 'dados/horas.json',
    branch: $('#sBranch').value.trim(), token: $('#sToken').value.trim(), device: $('#sDevice').value.trim(),
  };
  if (!cfg.owner || !cfg.repo || !cfg.token) { toast('Preencha usuário, repositório e token'); return; }
  syncCfg = cfg; lsSet(LS_SYNC, JSON.stringify(cfg));
  await sync();
  if ($('#syncPill').classList.contains('ok')) toast('Conectado! Sincronização automática ativada');
};
$('#syncNowBtn').onclick = () => syncCfg ? sync() : toast('Configure a conexão primeiro');
$('#disconnectBtn').onclick = () => {
  if (!confirm('Desconectar deste aparelho? Os dados locais e os do GitHub são mantidos.')) return;
  syncCfg = null; lsDel(LS_SYNC); renderSettings(); setPill('', 'Somente neste aparelho'); $('#syncInfo').textContent = '';
};
$('#exportBtn').onclick = () => download(`ponto-backup-${dkey(new Date())}.json`, JSON.stringify(state, null, 1), 'application/json');
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = normalize(JSON.parse(await f.text()));
    if (!confirm(`Restaurar backup com ${Object.keys(data.days).length} dias? Ele será mesclado com os dados atuais.`)) return;
    const now = Date.now();
    for (const k in data.days) data.days[k].updatedAt = now; // o backup prevalece
    data.settingsUpdatedAt = now;
    state = merge(data, state); changed(); renderSettings(); toast('Backup restaurado');
  } catch { toast('Arquivo inválido'); }
  e.target.value = '';
};

// atualização ao vivo e sincronização periódica
setInterval(() => { const d = new Date(); $('#clock').textContent = d.toLocaleTimeString('pt-BR'); }, 1000);
setInterval(() => { if (document.visibilityState === 'visible') renderToday(); }, 20000);
setInterval(() => { if (syncCfg && document.visibilityState === 'visible') sync(); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { render(); sync(); } });
window.addEventListener('online', sync);
window.addEventListener('offline', () => syncCfg && setPill('err', 'Offline · salvo no aparelho'));
window.addEventListener('storage', e => { if (e.key === LS_DATA) { state = normalize(JSON.parse(e.newValue || 'null')); render(); } });

// inicialização
$('#clock').textContent = new Date().toLocaleTimeString('pt-BR');
render();
const savedTab = lsGet('ph.tab'); if (savedTab && savedTab !== 'hoje') showTab(savedTab);
if (syncCfg) sync(); else setPill('', 'Somente neste aparelho');
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
