// 달빛 숲의 몬무스 — 화면/입력 담당
import { SPECIES, SKILLS, ITEMS, RELICS, STATUSES, ELEMENTS, STARTERS } from '../core/data.js';
import { hashString } from '../core/rng.js';
import { xpToNext, unlockedSkills, SKILL_UNLOCK } from '../core/units.js';
import {
  newRun, serializeRun, deserializeRun, availableNodes, enterNode, finishBattle, joinParty,
  declineRecruit, restHeal, restTrain, buy, gainRelic, advanceAct, beginBattle, useItemOutside,
  ACT_NAMES, MAP_ROWS,
} from '../core/run.js';
import {
  alive, canAct, usableSkills, needsTarget, validTargets, allyAct, keeperTalk, useItem,
  endPlayerTurn, findUnit, livingEnemies, receptivity, josa,
} from '../core/battle.js';
import { autoTurn, befriendTarget } from '../core/ai.js';
import { pickEvent, eventById } from '../core/events.js';
import { NODE_TYPES } from '../core/map.js';
import { activeSynergies, pickBanter, SYNERGIES } from '../core/banter.js';
import { portraitSVG, expressionFor } from './portrait.js';
import { loadMeta, saveMeta, loadRunJson, saveRunJson, clearRun } from './store.js';
import { sfx, setSound } from './audio.js';

const app = document.getElementById('app');
const S = {
  screen: 'title',
  run: null,
  battle: null,
  meta: loadMeta(),
  ui: {},
  pending: null,
  modal: null,
};
setSound(S.meta.sound);

const wait = (ms) => new Promise((r) => setTimeout(r, ms / (S.meta.speed || 1)));
const $ = (sel, root = document) => root.querySelector(sel);
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100)).toFixed(1)}%`;
const 이가 = (w) => w + josa(w, '이', '가');
const 을를 = (w) => w + josa(w, '을', '를');
const 은는 = (w) => w + josa(w, '은', '는');

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function markSeen(species, friend = false) {
  const m = S.meta;
  if (!m.seen.includes(species)) m.seen.push(species);
  if (friend && !m.friends.includes(species)) m.friends.push(species);
  saveMeta(m);
}

// ── 공용 조각 ───────────────────────────────────────────────
function pic(species, expr = 'normal', bg = true) {
  const el = SPECIES[species].element;
  const style = bg ? ` style="background: radial-gradient(circle at 50% 38%, ${ELEMENTS[el].color}55, transparent 70%)"` : '';
  return `<div class="pic"${style}>${portraitSVG(species, expr)}</div>`;
}

function hpBar(cur, max, shield = 0) {
  const low = cur / max < 0.3 ? ' low' : '';
  const sh = shield ? `<span class="shield" style="width:${pct(Math.min(shield, max), max)}"></span>` : '';
  return `<div class="barline"><span class="lbl">❤</span><div class="bar hp${low}"><i style="width:${pct(cur, max)}"></i>${sh}</div><span class="val" data-hpv>${Math.max(0, cur)}/${max}</span></div>`;
}
function bondBar(cur, max) {
  return `<div class="barline"><span class="lbl">💗</span><div class="bar bond"><i style="width:${pct(cur, max)}"></i></div><span class="val" data-bondv>${Math.round((cur / max) * 100)}%</span></div>`;
}
function statusChips(u) {
  return Object.entries(u.st || {}).filter(([k, v]) => v && STATUSES[k]).map(([k, v]) => {
    const s = STATUSES[k];
    return `<span class="st${s.bad ? ' bad' : ''}" title="${s.name}: ${s.desc}">${s.icon}${k === 'shield' || k === 'poison' ? v : v > 1 ? v : ''}</span>`;
  }).join('');
}
function elemTag(el) { return `<span class="tag" title="${ELEMENTS[el].name} 속성">${ELEMENTS[el].icon}${ELEMENTS[el].name}</span>`; }

const KIND_ICON = { attack: '⚔️', charm: '💗', heal: '💚', buff: '⬆️', debuff: '🌀', summon: '📣', wait: '💭' };
function skillLine(id, unit) {
  const s = SKILLS[id];
  const cd = s.cd ? ` · 재사용 ${s.cd}턴` : '';
  const pw = s.power ? ` · 위력 ${s.power}${s.hits > 1 ? `×${s.hits}` : ''}` : '';
  const lock = unit && !unlockedSkills(unit).includes(id) ? ` <span class="muted">(Lv.${SKILL_UNLOCK[SPECIES[unit.species].skills.indexOf(id)]} 해금)</span>` : '';
  return `<div>${KIND_ICON[s.kind] || ''} <b>${s.name}</b>${lock} <span class="muted">${s.desc}${pw}${cd}</span></div>`;
}

function relicBar(run) {
  return `<div class="relics">${run.relics.map((r) => `<button class="relic btn ghost small" data-act="relicInfo" data-id="${r}" title="${RELICS[r].name}: ${RELICS[r].desc}" aria-label="${RELICS[r].name}">${RELICS[r].icon}</button>`).join('')}</div>`;
}

function topbar() {
  const r = S.run;
  const node = r.nodeId ? r.map.nodes[r.nodeId] : null;
  const floor = node ? (node.type === 'boss' ? '보스' : `${node.row + 1}층`) : '입구';
  const items = Object.entries(r.items).map(([k, n]) => `${ITEMS[k].icon}${n}`).join(' ');
  return `<div class="topbar">
    <span class="title">${r.act}막 · ${ACT_NAMES[r.act - 1]}</span>
    <span class="tag">${floor}</span>
    <span class="tag num">🪙 ${r.gold}</span>
    <span class="tag" title="가방">${items || '빈 가방'}</span>
    <span class="spacer"></span>
    ${relicBar(r)}
    <button class="btn ghost small" data-act="menu" aria-label="메뉴">☰</button>
  </div>`;
}

// ── 화면 렌더링 ─────────────────────────────────────────────
function render() {
  const fn = SCREENS[S.screen];
  app.innerHTML = fn ? fn() : '';
  renderModal();
  if (S.screen === 'battle') afterBattleRender();
}

function renderModal() {
  let back = $('.modal-back');
  if (!S.modal) { if (back) back.remove(); return; }
  if (!back) { back = document.createElement('div'); back.className = 'modal-back'; document.body.appendChild(back); }
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${S.modal()}</div>`;
}
function openModal(fn) { S.modal = fn; renderModal(); }
function closeModal() { S.modal = null; renderModal(); }

const SCREENS = {};

// ── 타이틀 ─────────────────────────────────────────────────
SCREENS.title = () => {
  const hasSave = !!loadRunJson();
  const m = S.meta;
  const totalSp = Object.keys(SPECIES).length;
  return `<section class="stack title-screen">
    <div class="title-art" aria-hidden="true"><div class="moon"></div>
      <div class="cast">${portraitSVG('kitsune', 'happy')}${portraitSVG('slime', 'normal')}${portraitSVG('mandrake', 'shy')}</div>
    </div>
    <h1 class="logo">달빛 숲의 몬무스<small>MOONLIT · MONMUSU</small></h1>
    <p class="muted" style="max-width:46ch;margin:0">달빛을 잃은 숲. 등불지기인 당신은 숲의 몬스터 소녀들과 싸우거나, 마음을 열어 친구가 되며 달의 마녀가 있는 성으로 향합니다.</p>
    <div class="title-menu">
      ${hasSave ? '<button class="btn primary" data-act="continue">이어하기</button>' : ''}
      <button class="btn ${hasSave ? '' : 'primary'}" data-act="newGame">새 모험</button>
      <button class="btn" data-act="daily">오늘의 숲 (일일 시드)</button>
      <div class="row center" style="gap:8px">
        <button class="btn small" data-act="codex">📖 도감 ${m.friends.length}/${totalSp}</button>
        <button class="btn small" data-act="help">❔ 도움말</button>
        <button class="btn small" data-act="toggleSound">${m.sound ? '🔊' : '🔇'} 소리</button>
      </div>
    </div>
    <div class="title-stats">모험 ${m.runs}회 · 클리어 ${m.wins}회 · 진엔딩 ${m.trueEnds}회</div>
  </section>`;
};

// ── 첫 동료 선택 ───────────────────────────────────────────
SCREENS.starter = () => `<section class="stack">
  <div><div class="eyebrow">첫 번째 동료</div><h1 style="font-size:30px">누구와 함께 숲에 들어갈까요?</h1>
  <p class="muted" style="margin:4px 0 0">시드 <span class="num">${S.ui.seed}</span></p></div>
  <div class="starters">${STARTERS.map((id) => {
    const sp = SPECIES[id];
    return `<button class="panel starter" data-act="pickStarter" data-id="${id}">
      ${pic(id, 'happy')}
      <div class="row" style="justify-content:space-between"><h2 style="font-size:22px">${sp.given} <span class="muted small">${sp.name}</span></h2>${elemTag(sp.element)}</div>
      <div class="tag" style="align-self:flex-start">${sp.role}</div>
      <p class="small muted" style="margin:0">${sp.lore}</p>
      <div class="skill-list">${sp.skills.slice(0, 3).map((s) => skillLine(s)).join('')}</div>
      <div class="quote small">“${sp.lines.join}”</div>
    </button>`;
  }).join('')}</div>
  <div class="row"><button class="btn ghost" data-act="toTitle">← 돌아가기</button></div>
</section>`;

// ── 지도 ───────────────────────────────────────────────────
SCREENS.map = () => {
  const r = S.run;
  const open = new Set(availableNodes(r).map((n) => n.id));
  const visited = new Set(r.visited || []);
  const nodes = Object.values(r.map.nodes);
  const rowH = 66;
  const H = (MAP_ROWS + 1) * rowH;
  const pos = (n) => ({ x: ((n.col + 0.5) / 4) * 100, y: (MAP_ROWS - n.row) * rowH + rowH / 2 });
  let lines = '';
  for (const n of nodes) {
    for (const id of n.next) {
      const a = pos(n); const b = pos(r.map.nodes[id]);
      const hot = n.id === r.nodeId && open.has(id);
      const done = visited.has(n.id) && (visited.has(id) || id === r.nodeId);
      lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${hot ? 'var(--lantern)' : done ? 'var(--moon)' : 'var(--line)'}" stroke-width="${hot ? 2.5 : 1.6}" stroke-dasharray="${hot || done ? '0' : '4 5'}" vector-effect="non-scaling-stroke"/>`;
    }
  }
  const nodeEls = nodes.map((n) => {
    const p = pos(n);
    const cls = ['node', n.type === 'boss' ? 'boss' : '', open.has(n.id) ? 'open' : '', visited.has(n.id) ? 'visited' : '', n.id === r.nodeId ? 'current' : ''].join(' ');
    const t = NODE_TYPES[n.type];
    return `<button class="${cls}" style="left:${p.x}%;top:${p.y}px" ${open.has(n.id) ? `data-act="go" data-id="${n.id}"` : 'tabindex="-1"'} title="${t.name}" aria-label="${t.name}">${t.icon}</button>`;
  }).join('');
  const legend = Object.entries(NODE_TYPES).map(([, t]) => `<span>${t.icon} ${t.name}</span>`).join('');
  return `${topbar()}
  <div class="map-wrap">
    <section class="panel map">
      <div class="eyebrow">${r.act}막</div>
      <h2>${ACT_NAMES[r.act - 1]}</h2>
      <p class="muted small" style="margin:2px 0 0">빛나는 칸을 눌러 다음 길을 고르세요. 맨 위에 이 숲의 주인이 기다립니다.</p>
      <div class="map-board" style="height:${H}px">
        <svg class="edges" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        ${nodeEls}
      </div>
      <div class="legend">${legend}</div>
    </section>
    <aside class="party-side">
      <div class="eyebrow">동료 ${r.party.length}/${r.maxParty}</div>
      ${r.party.map((u) => `<button class="mini${u.fainted ? ' fainted' : ''}" data-act="detail" data-uid="${u.uid}">
        ${pic(u.species, u.fainted ? 'hurt' : 'normal')}
        <div class="stack" style="gap:3px;min-width:0">
          <div class="row" style="gap:6px;justify-content:space-between"><b style="font-family:var(--font-display);font-weight:400">${u.name}</b><span class="small muted">Lv.${u.level} ${ELEMENTS[u.element].icon}</span></div>
          ${u.fainted ? '<span class="small" style="color:var(--danger)">기절 — 휴식이나 깃털로 회복</span>' : hpBar(u.hp, u.maxHp)}
          <div class="bar xp" title="경험치"><i style="width:${pct(u.xp, xpToNext(u.level))}"></i></div>
        </div>
      </button>`).join('')}
      ${synergyBox(r)}
      ${banterBox(r)}
      <p class="small muted" style="margin:0">동료를 누르면 능력치·스킬을 보고 회복 아이템을 쓸 수 있어요.</p>
    </aside>
  </div>`;
};

function synergyBox(run) {
  const syn = activeSynergies(run.party);
  if (!syn.length) return '';
  return `<div class="panel synergy-box"><div class="eyebrow">💞 인연 효과</div>${syn.map((x) => `<div class="small"><b>${x.name}</b> <span class="muted">${x.desc}</span></div>`).join('')}</div>`;
}

function banterBox(run) {
  const lines = pickBanter(run);
  if (!lines || !lines.length) return '';
  return `<div class="chat" aria-label="동료들의 수다">${lines.map(({ uid, line }) => {
    const u = run.party.find((x) => x.uid === uid);
    return `<div class="chat-line"><span class="chat-pic">${portraitSVG(u.species, 'happy')}</span><div class="chat-bubble"><b>${u.name}</b> ${line}</div></div>`;
  }).join('')}</div>`;
}

function synergyHints(u) {
  const party = S.run ? S.run.party : [];
  const rel = SYNERGIES.filter((x) => x.members.includes(u.species));
  if (!rel.length) return '';
  return `<div class="small"><span class="eyebrow">인연</span> ${rel.map((x) => {
    const other = x.members.find((m) => m !== u.species);
    const on = x.members.every((m) => party.some((p) => p.species === m && !p.fainted));
    return `<span class="tag${on ? ' on' : ''}" title="${x.desc}">${on ? '💞' : '🤍'} ${x.name} · ${SPECIES[other].name}</span>`;
  }).join(' ')}</div>`;
}

function unitDetail(u) {
  const sp = SPECIES[u.species];
  const run = S.run;
  const usable = ['potion', 'feather', 'elixir'].filter((k) => run && run.items[k] > 0 && run.party.includes(u));
  return () => `
    <div class="detail-head">${pic(u.species, u.fainted ? 'hurt' : 'happy')}
      <div class="stack" style="gap:4px">
        <h2>${u.name} <span class="muted small">${sp.name} · Lv.${u.level}</span></h2>
        <div class="row" style="gap:6px">${elemTag(u.element)}<span class="tag">${sp.role}</span><span class="tag">좋아하는 것 ${ITEMS[sp.gift].icon}</span></div>
        ${hpBar(u.hp, u.maxHp)}
        <div class="small muted">경험치 ${u.xp}/${xpToNext(u.level)}</div>
      </div>
    </div>
    <div class="stats"><div>HP<b>${u.maxHp}</b></div><div>공격<b>${u.atk}</b></div><div>방어<b>${u.def}</b></div><div>매력<b>${u.cha}</b></div><div>속도<b>${u.spd}</b></div></div>
    <div class="skill-list">${sp.skills.map((s) => skillLine(s, u)).join('')}</div>
    ${synergyHints(u)}
    <p class="small muted" style="margin:0">${sp.lore}</p>
    ${usable.length ? `<div class="row">${usable.map((k) => `<button class="btn small" data-act="useOutside" data-id="${k}" data-uid="${u.uid}">${ITEMS[k].icon} ${ITEMS[k].name} 사용 (${run.items[k]})</button>`).join('')}</div>` : ''}
    <div class="row end"><button class="btn" data-act="closeModal">닫기</button></div>`;
}

// ── 전투 ───────────────────────────────────────────────────
function intentHtml(e) {
  if (!e.intent || !alive(e)) return '';
  if (e.st.sleep) return '<div class="intent">💤 잠듦</div>';
  const s = SKILLS[e.intent.skill];
  if (s.kind === 'wait') return '<div class="intent shy">💭 머뭇머뭇…</div>';
  const t = e.intent.target != null ? findUnit(S.battle, e.intent.target) : null;
  const tgt = s.target === 'allEnemies' ? ' → 전체' : t && t.side === 'ally' ? ` → ${t.name}` : '';
  return `<div class="intent ${s.kind === 'attack' ? 'atk' : ''}" title="${s.name}: ${s.desc}">${KIND_ICON[s.kind]} ${s.name}${tgt}</div>`;
}

function unitCard(u) {
  const b = S.battle;
  const ui = S.ui;
  const cls = ['unit', u.side];
  if (u.side === 'ally') {
    if (canAct(b, u) && !ui.busy) cls.push('ready');
    if (ui.selected === u.uid) cls.push('selected');
    if (b.acted.includes(u.uid) || u.st.sleep) cls.push('acted');
    if (u.fainted) cls.push('fainted');
  }
  if (u.gone) cls.push('gone', u.gone);
  const tg = targetsNow();
  let act = '';
  if (tg && tg.has(u.uid)) { cls.push('targetable'); if (u.side === 'enemy' && ui.targetMode === 'harm') cls.push('foe-t'); act = `data-act="target" data-uid="${u.uid}"`; }
  else if (u.side === 'ally' && canAct(b, u)) act = `data-act="select" data-uid="${u.uid}"`;
  else act = `data-act="inspect" data-uid="${u.uid}"`;
  const sp = SPECIES[u.species];
  const badge = u.boss ? '<span class="badge">👑</span>' : u.elite ? '<span class="badge">💢</span>' : '';
  const goneTxt = u.gone === 'friend' ? '<div class="small" style="color:var(--heart)">💗 친구가 되었다!</div>' : u.gone === 'fled' ? '<div class="small muted">도망쳤다</div>' : u.gone === 'left' ? '<div class="small muted">돌아갔다</div>' : '';
  return `<button class="${cls.join(' ')}" data-uid="${u.uid}" ${act} aria-label="${u.name} ${sp.name}">
    ${u.side === 'enemy' ? intentHtml(u) : ''}${badge}
    ${pic(u.species, expressionFor(u))}
    <div class="name"><b>${u.name}</b><span class="small muted">${sp.name} Lv.${u.level} ${ELEMENTS[u.element].icon}</span></div>
    ${hpBar(u.hp, u.maxHp, u.st.shield || 0)}
    ${u.side === 'enemy' ? bondBar(u.bond, u.bondMax) : ''}
    <div class="sts">${statusChips(u)}${u.fainted ? '<span class="st bad">기절</span>' : ''}</div>
    ${goneTxt}
  </button>`;
}

/** 지금 고를 수 있는 대상 uid 집합 (없으면 null) */
function targetsNow() {
  const ui = S.ui; const b = S.battle;
  if (!b || ui.busy) return null;
  if (ui.pendingSkill) {
    const u = findUnit(b, ui.selected);
    const s = SKILLS[ui.pendingSkill];
    ui.targetMode = s.kind === 'charm' ? 'charm' : 'harm';
    return new Set(validTargets(b, u, s).map((x) => x.uid));
  }
  if (ui.pendingTalk) { ui.targetMode = 'charm'; return new Set(livingEnemies(b).map((x) => x.uid)); }
  if (ui.pendingItem) {
    const it = ITEMS[ui.pendingItem];
    ui.targetMode = it.gift ? 'charm' : 'harm';
    if (it.target === 'enemy') return new Set(livingEnemies(b).map((x) => x.uid));
    if (it.target === 'ally') return new Set(b.allies.filter(alive).map((x) => x.uid));
    if (it.target === 'fallenAlly') return new Set(b.allies.filter((x) => x.fainted).map((x) => x.uid));
  }
  return null;
}

SCREENS.battle = () => {
  const b = S.battle; const ui = S.ui; const run = S.run;
  const sel = ui.selected != null ? findUnit(b, ui.selected) : null;
  const kindLbl = b.kind === 'boss' ? '👑 보스전' : b.kind === 'elite' ? '💢 강적' : `턴 ${b.turn}`;
  let cmd = '';
  if (b.phase === 'player') {
    let skills = '';
    if (sel && canAct(b, sel)) {
      const usable = usableSkills(b, sel);
      skills = unlockedSkills(sel).map((id, i) => {
        const s = SKILLS[id];
        const ok = usable.includes(id) && !ui.busy;
        const cd = sel.cd[id] ? `⏳${sel.cd[id]}` : s.cd ? `↻${s.cd}` : '';
        return `<button class="btn skill k-${s.kind}${ui.pendingSkill === id ? ' selected' : ''}" data-act="skill" data-id="${id}" ${ok ? '' : 'disabled'} title="${s.desc}">
          <span class="top"><span>${KIND_ICON[s.kind]} ${s.name}</span><span class="small muted">${i + 1} ${cd}</span></span>
          <span class="desc">${s.desc}${s.power ? ` (위력 ${s.power}${s.hits > 1 ? `×${s.hits}` : ''})` : ''}</span></button>`;
      }).join('');
    }
    const bag = Object.entries(run.items).map(([k, n]) => `<button class="btn small item-btn${ui.pendingItem === k ? ' selected' : ''}" data-act="item" data-id="${k}" ${b.keeperUsed || ui.busy ? 'disabled' : ''} title="${ITEMS[k].name}: ${ITEMS[k].desc}">${ITEMS[k].icon}<span class="n">${n}</span></button>`).join('');
    const hint = ui.pendingSkill ? `${SKILLS[ui.pendingSkill].name}: 대상을 고르세요` : ui.pendingTalk ? '말을 걸 몬무스를 고르세요' : ui.pendingItem ? `${ITEMS[ui.pendingItem].name}: 대상을 고르세요` : sel && canAct(b, sel) ? '' : b.allies.some((u) => canAct(b, u)) ? '행동할 동료를 고르세요' : '모두 행동했어요. 턴을 마치세요';
    cmd = `<section class="panel command">
      ${sel && canAct(b, sel) ? `<div class="who">${sel.name}의 행동</div><div class="skills">${skills}</div>` : ''}
      <div class="keeper"><span class="lbl">🏮 등불지기${b.keeperUsed ? ' (행동 완료)' : ''}</span>
        <button class="btn small heart${ui.pendingTalk ? ' selected' : ''}" data-act="talk" ${b.keeperUsed || ui.busy ? 'disabled' : ''} title="적의 호감도를 조금 올린다">💬 말 걸기</button>
        <div class="bag">${bag}</div>
      </div>
      <div class="hint">${hint}</div>
      <div class="row end">
        ${ui.pendingSkill || ui.pendingTalk || ui.pendingItem ? '<button class="btn ghost" data-act="cancel">취소</button>' : ''}
        <button class="btn" data-act="auto" ${ui.busy ? 'disabled' : ''} title="남은 행동을 자동으로 정하고 턴을 마칩니다">⚙️ 자동</button>
        <button class="btn primary" data-act="endTurn" ${ui.busy ? 'disabled' : ''}>턴 종료 ⏎</button>
      </div>
    </section>`;
  }
  return `${topbar()}
  <section class="battle">
    <div class="side enemies">${b.enemies.map(unitCard).join('')}</div>
    <div class="vs">${kindLbl}</div>
    <div class="log" aria-live="polite">${(ui.log || []).slice(-6).map((l) => `<p>${l}</p>`).join('')}</div>
    <div class="side allies">${b.allies.map(unitCard).join('')}</div>
    ${cmd}
  </section>`;
};

function afterBattleRender() {
  const log = $('.log');
  if (log) log.scrollTop = log.scrollHeight;
}

function addLog(msg) {
  S.ui.log = S.ui.log || [];
  S.ui.log.push(msg);
  if (S.ui.log.length > 40) S.ui.log.shift();
  const log = $('.log');
  if (log) {
    log.innerHTML = S.ui.log.slice(-6).map((l) => `<p>${l}</p>`).join('');
    log.scrollTop = log.scrollHeight;
  }
}

function cardEl(uid) { return $(`.unit[data-uid="${uid}"]`); }
function floatText(uid, text, cls) {
  const el = cardEl(uid);
  if (!el) return;
  const f = document.createElement('div');
  f.className = `float ${cls}`;
  f.textContent = text;
  el.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}
function speech(uid, line) {
  const el = cardEl(uid);
  if (!el || !line) return;
  const s = document.createElement('div');
  s.className = 'speech';
  s.textContent = line;
  el.appendChild(s);
  setTimeout(() => s.remove(), 2600);
}
function retint(uid, disp) {
  const el = cardEl(uid);
  const u = findUnit(S.battle, uid);
  if (!el || !u) return;
  const d = disp[uid];
  const hp = el.querySelector('.bar.hp');
  if (hp) {
    hp.querySelector('i').style.width = pct(d.hp, u.maxHp);
    hp.classList.toggle('low', d.hp / u.maxHp < 0.3);
    el.querySelector('[data-hpv]').textContent = `${Math.max(0, Math.round(d.hp))}/${u.maxHp}`;
  }
  const bd = el.querySelector('.bar.bond');
  if (bd) {
    bd.querySelector('i').style.width = pct(d.bond, u.bondMax);
    el.querySelector('[data-bondv]').textContent = `${Math.round((d.bond / u.bondMax) * 100)}%`;
  }
  const p = el.querySelector('.pic');
  if (p) p.innerHTML = portraitSVG(u.species, d.expr || expressionFor({ ...u, hp: d.hp, bond: d.bond, st: {} }));
}

/** 엔진 이벤트를 순서대로 연출한다. disp = 연출 시작 시점의 표시값 */
async function play(events, disp) {
  const b = S.battle;
  for (const e of events) {
    const u = e.uid != null ? findUnit(b, e.uid) : null;
    const nm = u ? u.name : '';
    switch (e.type) {
      case 'action': {
        const s = SKILLS[e.skill];
        if (s.kind === 'wait') break;
        addLog(`<b>${nm}</b>의 ${s.name}!`);
        const el = cardEl(e.uid);
        if (el) { el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge'); }
        await wait(300);
        break;
      }
      case 'damage': {
        if (!disp[e.uid]) break;
        disp[e.uid].hp -= e.amount;
        const lbl = e.cause === 'poison' ? '☠️' : e.cause === 'burn' ? '🔥' : e.cause === 'thorn' ? '🌹' : '';
        floatText(e.uid, `${lbl}-${e.amount}${e.crit ? '!' : ''}`, e.crit ? 'crit' : 'dmg');
        if (e.eff === 'super') addLog('효과가 굉장했다!');
        const el = cardEl(e.uid);
        if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
        e.crit ? sfx.crit() : sfx.hit();
        retint(e.uid, disp);
        await wait(e.cause ? 220 : 260);
        break;
      }
      case 'heal':
        if (!disp[e.uid] || !e.amount) break;
        disp[e.uid].hp += e.amount;
        floatText(e.uid, `+${e.amount}`, 'heal');
        sfx.heal();
        retint(e.uid, disp);
        await wait(200);
        break;
      case 'bond':
        if (!disp[e.uid]) break;
        disp[e.uid].bond = Math.max(0, disp[e.uid].bond + e.amount);
        if (e.amount > 0) { floatText(e.uid, `💗+${Math.round((e.amount / u.bondMax) * 100)}%`, 'bond'); sfx.heart(); }
        else floatText(e.uid, `💔${Math.round((e.amount / u.bondMax) * 100)}%`, 'miss');
        retint(e.uid, disp);
        await wait(e.amount > 0 ? 260 : 120);
        break;
      case 'miss': floatText(e.uid, '회피!', 'miss'); sfx.miss(); await wait(200); break;
      case 'resist': floatText(e.uid, '버텼다!', 'miss'); await wait(160); break;
      case 'block': floatText(e.uid, `🔰${e.amount}`, 'block'); await wait(150); break;
      case 'status': {
        const st = STATUSES[e.status];
        if (st) { floatText(e.uid, `${st.icon}${st.name}`, st.bad ? 'miss' : 'heal'); if (!st.bad) sfx.buff(); }
        await wait(140);
        break;
      }
      case 'cleanse': floatText(e.uid, '✨정화', 'heal'); await wait(140); break;
      case 'wake': addLog(`${nm}${josa(nm, '이', '가')} 깨어났다.`); break;
      case 'sleeping': addLog(`${nm}${josa(nm, '은', '는')} 쿨쿨 자고 있다…`); await wait(200); break;
      case 'gold': floatText(e.uid, `🪙+${e.amount}`, 'heal'); sfx.coin(); await wait(150); break;
      case 'speech': speech(e.uid, e.line); await wait(500); break;
      case 'text':
        addLog(e.msg);
        if (e.shy && e.uid != null) { disp[e.uid].expr = 'shy'; retint(e.uid, disp); delete disp[e.uid].expr; floatText(e.uid, '///', 'bond'); }
        await wait(280);
        break;
      case 'keeper':
        if (e.action === 'talk') { addLog(`등불지기가 ${nm}에게 말을 걸었다.`); speech(e.uid, talkLine(u)); }
        else addLog(`등불지기가 ${ITEMS[e.item].icon} ${ITEMS[e.item].name}${josa(ITEMS[e.item].name, '을', '를')} 사용했다.`);
        await wait(280);
        break;
      case 'befriend': {
        sfx.befriend();
        addLog(`💗 <b>${nm}</b>${josa(nm, '이', '가')} 마음을 열었다!`);
        disp[e.uid].expr = 'love';
        retint(e.uid, disp);
        speech(e.uid, e.line);
        const el = cardEl(e.uid);
        if (el) el.classList.add('gone', 'friend');
        markSeen(u.species, true);
        await wait(1100);
        break;
      }
      case 'flee': {
        sfx.flee();
        addLog(`${nm}${josa(nm, '은', '는')} 도망쳤다.`);
        speech(e.uid, e.line);
        const el = cardEl(e.uid);
        if (el) el.classList.add('gone');
        await wait(700);
        break;
      }
      case 'leave': { const el = cardEl(e.uid); if (el) el.classList.add('gone'); break; }
      case 'faint': {
        sfx.faint();
        addLog(`${nm}${josa(nm, '이', '가')} 쓰러졌다…`);
        const el = cardEl(e.uid);
        if (el) el.classList.add('fainted');
        await wait(500);
        break;
      }
      case 'revive': floatText(e.uid, '부활!', 'heal'); sfx.heal(); addLog(`${nm}${josa(nm, '이', '가')} 다시 일어났다!`); render(); await wait(300); break;
      case 'summon': addLog(`${nm}${josa(nm, '이', '가')} 나타났다!`); render(); Object.assign(disp, snapshot()); markSeen(u.species); await wait(400); break;
      case 'escape': addLog('연막 속으로 도망쳤다!'); await wait(400); break;
      case 'synergy': addLog(`💞 인연 효과 — <b>${e.name}</b>!`); await wait(350); break;
      case 'turn':
        if (e.side === 'enemy') { addLog('— 몬무스들의 차례 —'); await wait(250); }
        break;
      default: break;
    }
  }
}

function talkLine(u) {
  const lines = ['…뭐야, 갑자기.', '흐응, 무슨 얘기?', '너 이상한 인간이네.', '…조금은 들어줄게.', '그, 그렇게 말해도…'];
  if (!u) return '';
  const br = u.bond / u.bondMax;
  if (br > 0.6) return SPECIES[u.species].lines.shy;
  return lines[(u.uid + S.battle.turn) % lines.length];
}

function snapshot() {
  const b = S.battle;
  const d = {};
  for (const u of [...b.allies, ...b.enemies]) d[u.uid] = { hp: u.hp, bond: u.bond };
  return d;
}

async function runAction(fn) {
  if (S.ui.busy) return;
  const disp = snapshot();
  let ev;
  try { ev = fn(); } catch (err) { toast(err.message); return; }
  S.ui.busy = true;
  S.ui.pendingSkill = S.ui.pendingItem = null; S.ui.pendingTalk = false;
  // 버튼만 비활성화한 화면에서 연출
  render();
  for (const [uid, d] of Object.entries(disp)) { if (findUnit(S.battle, Number(uid))) retint(Number(uid), disp); void d; }
  await play(ev, disp);
  S.ui.busy = false;
  autoSelect();
  render();
  await checkBattleOver();
}

function autoSelect() {
  const b = S.battle;
  const cur = b.allies.find((u) => u.uid === S.ui.selected);
  if (cur && canAct(b, cur)) return;
  const next = b.allies.find((u) => canAct(b, u));
  S.ui.selected = next ? next.uid : null;
}

async function checkBattleOver() {
  const b = S.battle;
  if (b.phase === 'won' || b.phase === 'lost' || b.phase === 'fled') {
    await wait(600);
    if (b.phase === 'won') sfx.win();
    if (b.phase === 'lost') sfx.lose();
    concludeBattle();
  }
}

function bossIntro(battle) {
  const boss = battle.enemies[0];
  const sp = SPECIES[boss.species];
  markSeen(boss.species);
  S.screen = 'bossIntro';
  S.ui = { boss, battle };
  render();
}

SCREENS.bossIntro = () => {
  const { boss } = S.ui;
  const sp = SPECIES[boss.species];
  return `<section class="panel stack ending boss-intro">
    <div class="eyebrow">${sp.role}</div>
    <div class="recruit-pic big">${portraitSVG(boss.species, 'angry')}</div>
    <h1 style="font-size:34px">${sp.given} <span class="muted" style="font-size:18px">${sp.name} · Lv.${boss.level}</span></h1>
    <p class="quote" style="max-width:48ch">“${sp.lines.intro}”</p>
    <p class="small muted">${sp.lore}</p>
    <p class="small">💡 보스는 HP가 절반이 되기 전까지 마음의 벽이 있어 호감도가 잘 오르지 않아요. 좋아하는 것: ${ITEMS[sp.gift].icon} ${ITEMS[sp.gift].name}</p>
    <button class="btn primary" data-act="faceBoss">맞선다</button>
  </section>`;
};

function startBattle(battle) {
  S.battle = battle;
  S.ui = { selected: null, log: [], busy: false };
  for (const e of battle.enemies) markSeen(e.species);
  const names = battle.enemies.map((e) => e.name).join(', ');
  addLog(battle.kind === 'boss' ? `👑 ${names}${josa(names, '이', '가')} 앞을 가로막는다!` : `야생의 ${names}${josa(names, '이', '가')} 나타났다!`);
  autoSelect();
  S.screen = 'battle';
  render();
  const first = battle.enemies[0];
  setTimeout(() => speech(first.uid, SPECIES[first.species].lines.intro), 250);
  if (battle.events.length) { const disp = snapshot(); play(battle.events.filter((e) => e.type !== 'turn'), disp); battle.events = []; }
  if (!S.meta.tutorial) {
    S.meta.tutorial = true;
    saveMeta(S.meta);
    openModal(() => `<div class="eyebrow">첫 전투</div><h2>싸울까, 친구가 될까?</h2>
      <ul class="tut">
        <li>테두리가 빛나는 동료를 누르고 <b>스킬</b> → <b>대상</b>을 고르세요.</li>
        <li>몬무스의 <span style="color:var(--leafhp)">❤ HP</span>가 0이 되면 도망치고, <span style="color:var(--heart)">💗 호감도</span>가 가득 차면 <b>친구</b>가 되어 동료로 합류해요.</li>
        <li>💗 매혹 스킬, 등불지기의 <b>💬 말 걸기</b>, 좋아하는 <b>선물</b>로 호감도를 올려요. 때리면 호감도가 조금 떨어져요.</li>
        <li>적 머리 위 말풍선은 <b>다음 행동</b>이에요. 다 고르면 <b>턴 종료</b>!</li>
      </ul>
      <div class="row end"><button class="btn primary" data-act="closeModal">알겠어요</button></div>`);
  }
}

function concludeBattle() {
  const b = S.battle;
  const run = S.run;
  const res = finishBattle(run, b);
  if (b.phase === 'lost') return gameOver();
  if (b.phase === 'fled') { toast('무사히 도망쳤다!'); return toMap(); }
  for (const r of res.recruits) markSeen(r.species, true);
  S.pending = {
    result: res,
    kind: b.kind,
    bossNode: b.kind === 'boss' && run.nodeId === 'boss',
    bossFriend: b.befriended.some((e) => e.boss),
    befriended: b.befriended.map((e) => e.name),
    relicPicked: !res.relicChoices.length,
    // 최종 보스는 엔딩에서 함께하므로 영입 창을 띄우지 않는다
    recruits: res.recruits.filter((r) => !(b.kind === 'boss' && run.act === 3 && SPECIES[r.species].boss)),
  };
  S.battle = null;
  S.screen = 'reward';
  render();
}

// ── 보상 ───────────────────────────────────────────────────
SCREENS.reward = () => {
  const p = S.pending; const res = p.result;
  const lv = res.levelUps.map((l) => `<div>⬆️ <b>${l.name}</b> Lv.${l.from} → Lv.${l.to}${newSkillNote(l)}</div>`).join('');
  const items = res.items.map((i) => `${ITEMS[i].icon} ${ITEMS[i].name}`).join(', ');
  const relics = !p.relicPicked ? `<div class="stack"><div class="eyebrow">부적을 하나 고르세요</div><div class="reward-grid">${res.relicChoices.map((id) => `<button class="btn relic-card" data-act="pickRelic" data-id="${id}"><span class="ic">${RELICS[id].icon}</span><b>${RELICS[id].name}</b><span class="small muted">${RELICS[id].desc}</span></button>`).join('')}</div><div class="row end"><button class="btn ghost small" data-act="skipRelic">건너뛰기</button></div></div>` : '';
  return `${topbar()}<section class="panel stack">
    <div class="eyebrow">${p.kind === 'boss' ? '보스 격파' : '전투 승리'}</div>
    <h2 style="font-size:26px">${p.befriended.length ? `${p.befriended.join(', ')}${josa(p.befriended[p.befriended.length - 1], '과', '와')} 친구가 되었다!` : '숲이 다시 조용해졌다.'}</h2>
    <div class="row"><span class="tag num">🪙 +${res.gold}</span><span class="tag num">✨ 경험치 +${res.xp}</span>${items ? `<span class="tag">${items}</span>` : ''}</div>
    ${lv ? `<div class="stack" style="gap:4px">${lv}</div>` : ''}
    ${relics}
    ${p.relicPicked ? '<div class="row end"><button class="btn primary" data-act="rewardNext">계속 →</button></div>' : ''}
  </section>`;
};

function newSkillNote(l) {
  const u = S.run.party.find((x) => x.uid === l.uid);
  if (!u) return '';
  const sp = SPECIES[u.species];
  const learned = sp.skills.filter((_, i) => SKILL_UNLOCK[i] > l.from && SKILL_UNLOCK[i] <= l.to);
  return learned.length ? ` <span style="color:var(--lantern)">· 새 스킬 ${learned.map((s) => SKILLS[s].name).join(', ')}!</span>` : '';
}

function rewardNext() {
  const p = S.pending;
  if (p.recruits.length) return showRecruit(p.recruits.shift(), rewardNext);
  S.pending = null;
  if (p.bossNode) {
    const r = advanceAct(S.run, p.bossFriend);
    if (r.ending) return ending(r.ending);
    S.screen = 'actclear';
    S.ui = { bossFriend: p.bossFriend };
    return render();
  }
  toMap();
}

function showRecruit(recruit, after) {
  const run = S.run;
  const sp = SPECIES[recruit.species];
  const full = run.party.length >= run.maxParty;
  S.ui.recruit = recruit;
  S.ui.afterRecruit = after;
  openModal(() => `
    <div class="eyebrow">새 동료</div>
    <div class="recruit-pic">${portraitSVG(recruit.species, 'love')}</div>
    <h2 style="text-align:center">${recruit.name} <span class="muted small">${sp.name} · Lv.${recruit.level}</span></h2>
    <div class="quote">“${sp.lines.join}”</div>
    <div class="row center">${elemTag(sp.element)}<span class="tag">${sp.role}</span></div>
    <div class="skill-list">${sp.skills.map((s) => skillLine(s, recruit)).join('')}</div>
    ${full ? `<div class="stack" style="gap:6px"><div class="small muted">파티가 가득 찼어요 (${run.party.length}/${run.maxParty}). 대신 작별할 동료를 고르거나, 마음만 받고 보낼 수 있어요.</div>
      <div class="row">${run.party.map((u) => `<button class="btn small" data-act="swapRecruit" data-uid="${u.uid}">${u.name} Lv.${u.level}와 작별</button>`).join('')}</div></div>` : ''}
    <div class="row end">
      <button class="btn ghost" data-act="declineRecruit">마음만 받을게 (답례 받기)</button>
      ${full ? '' : '<button class="btn primary" data-act="acceptRecruit">함께 가자!</button>'}
    </div>`);
}

function finishRecruit() {
  const after = S.ui.afterRecruit;
  S.ui.recruit = null;
  closeModal();
  after?.();
}

// ── 막 클리어 / 엔딩 / 게임오버 ─────────────────────────────
const ACT_STORY = [
  ['드라이어드 실바의 숲을 지나자, 멀리서 화산의 붉은 빛이 보인다.', '“달빛을 되찾고 싶다면 불꽃 골짜기의 용을 만나거라. 그 아이도 외로울 테니.”'],
  ['용 공주의 둥지 너머, 검은 성이 달 없는 하늘에 우뚝 서 있다.', '“…마녀는 원래 다정한 아이였다. 누군가 차를 같이 마셔줄 사람이 필요했을 뿐이야.”'],
];
SCREENS.actclear = () => {
  const r = S.run;
  const story = ACT_STORY[r.act - 2] || ['', ''];
  return `<section class="panel stack ending">
    <div class="eyebrow">${r.act - 1}막 클리어</div>
    <h1 style="font-size:32px">${ACT_NAMES[r.act - 1]}으로</h1>
    <div class="cast">${r.party.map((u) => portraitSVG(u.species, 'happy')).join('')}</div>
    <p>${story[0]}</p>
    ${S.ui.bossFriend ? `<p class="quote" style="max-width:52ch">${story[1]}</p>` : ''}
    <p class="muted small">막 사이에서 푹 쉬었다. 모두 완전히 회복했다.</p>
    <button class="btn primary" data-act="toMap">${r.act}막으로 출발</button>
  </section>`;
};

function ending(kind) {
  const m = S.meta;
  m.runs++; m.wins++; if (kind === 'true') m.trueEnds++;
  saveMeta(m);
  clearRun();
  S.screen = 'ending';
  S.ui = { ending: kind };
  render();
}

SCREENS.ending = () => {
  const r = S.run;
  const tr = S.ui.ending === 'true';
  const st = r.stats;
  return `<section class="panel stack ending">
    <div class="eyebrow">${tr ? '진엔딩' : '엔딩'}</div>
    <h1 style="font-size:34px">${tr ? '달이 다시 떠오르다' : '되찾은 달빛'}</h1>
    <div class="cast">${r.party.filter((u) => u.species !== 'witch').map((u) => portraitSVG(u.species, 'happy')).join('')}${tr ? portraitSVG('witch', 'love') : ''}</div>
    ${tr ? `<p>마녀 녹스는 성의 창문을 활짝 열었다. 갇혀 있던 달빛이 숲으로 쏟아져 내린다.</p>
      <p class="quote">“…매주 목요일엔 차 마시러 와. 약속이야. 안 오면 달을 또 숨길 거야.”</p>
      <p>그날 이후, 달빛 숲에는 밤마다 작은 다과회가 열린다고 한다.</p>`
    : `<p>마녀가 사라지자 성에 갇혀 있던 달빛이 풀려났다. 숲은 다시 은빛으로 빛난다.</p>
      <p class="muted">하지만 어딘가에서, 아무도 없는 성의 찻잔 두 개가 식어가고 있었다… (달의 마녀와 친구가 되면 진엔딩)</p>`}
    <div class="row center"><span class="tag">전투 ${st.battles}</span><span class="tag">친구 ${st.befriended.length}종</span><span class="tag">획득 골드 ${st.goldEarned}</span><span class="tag">시드 ${r.seed}</span></div>
    <button class="btn primary" data-act="toTitle">타이틀로</button>
  </section>`;
};

function gameOver() {
  const m = S.meta;
  m.runs++;
  m.best = Math.max(m.best, S.run.floor);
  saveMeta(m);
  clearRun();
  S.battle = null;
  S.screen = 'gameover';
  render();
}

SCREENS.gameover = () => {
  const r = S.run; const st = r.stats;
  return `<section class="panel stack ending">
    <div class="eyebrow">모험 종료</div>
    <h1 style="font-size:32px">등불이 꺼졌다…</h1>
    <div class="cast">${r.party.map((u) => portraitSVG(u.species, 'hurt')).join('')}</div>
    <p>${r.act}막 ${ACT_NAMES[r.act - 1]}에서 쓰러졌다. 하지만 숲에서 만난 인연은 도감에 남는다.</p>
    <div class="row center"><span class="tag">도달 층 ${r.floor}</span><span class="tag">전투 ${st.battles}</span><span class="tag">친구 ${st.befriended.length}종</span><span class="tag">시드 ${r.seed}</span></div>
    <div class="row center"><button class="btn primary" data-act="newGame">다시 도전</button><button class="btn" data-act="toTitle">타이틀로</button></div>
  </section>`;
};

// ── 이벤트 ─────────────────────────────────────────────────
SCREENS.event = () => {
  const ev = eventById(S.ui.eventId);
  const out = S.ui.outcome;
  const run = S.run;
  return `${topbar()}<section class="panel scene">
    <div class="art" aria-hidden="true">${ev.art}</div>
    <div class="stack">
      <h2>${ev.title}</h2>
      <p>${ev.text}</p>
      ${out ? `<p class="result">${out.text}</p><div class="row end"><button class="btn primary" data-act="eventDone">계속 →</button></div>`
    : `<div class="choices">${ev.choices.map((c, i) => {
      const ok = !c.req || c.req(run);
      return `<button class="btn choice" data-act="choose" data-i="${i}" ${ok ? '' : 'disabled'}>${c.label}${ok ? '' : ' <span class="muted small">(조건 부족)</span>'}</button>`;
    }).join('')}</div>`}
    </div>
  </section>`;
};

// ── 상점 ───────────────────────────────────────────────────
SCREENS.shop = () => {
  const shop = S.ui.shop; const run = S.run;
  return `${topbar()}<section class="panel stack">
    <div class="scene" style="grid-template-columns:120px minmax(0,1fr)"><div class="art" style="width:120px;height:120px">${portraitSVG('mimic', 'happy')}</div>
      <div><h2>떠돌이 상점</h2><p class="quote small" style="margin:6px 0 0">“어서 와~ 반짝이는 거 있으면 좀 보여줄래? …아, 돈도 받아!”</p></div></div>
    <div class="shop-grid">${shop.goods.map((g, i) => {
    const info = g.kind === 'item' ? ITEMS[g.id] : g.kind === 'relic' ? RELICS[g.id] : { icon: '♨️', name: '찜질 치료', desc: '동료 전원 부활 + HP 완전 회복.' };
    const owned = g.kind === 'item' && run.items[g.id] ? ` <span class="muted small">(보유 ${run.items[g.id]})</span>` : '';
    return `<div class="panel good${g.sold ? ' sold' : ''}"><div class="head"><span class="ic">${info.icon}</span>${info.name}${owned}</div>
      <div class="small muted">${info.desc}</div>
      <div class="row" style="justify-content:space-between"><span class="price">🪙 ${g.price}</span>
      <button class="btn small" data-act="buy" data-i="${i}" ${g.sold || run.gold < g.price ? 'disabled' : ''}>${g.sold ? '판매 완료' : '구매'}</button></div></div>`;
  }).join('')}</div>
    <div class="row end"><button class="btn primary" data-act="toMap">떠나기 →</button></div>
  </section>`;
};

// ── 휴식 ───────────────────────────────────────────────────
SCREENS.rest = () => {
  const run = S.run;
  return `${topbar()}<section class="panel scene">
    <div class="art" aria-hidden="true">🔥</div>
    <div class="stack">
      <h2>모닥불</h2>
      <p>타닥타닥, 불꽃이 춤춘다. 동료들이 불가에 둘러앉았다. 무엇을 할까?</p>
      <div class="choices">
        <button class="btn choice" data-act="restHeal">😴 푹 쉰다 — 모두 HP 40% 회복, 쓰러진 동료도 일어난다</button>
        <div class="small muted">🗡️ 함께 훈련한다 — 한 명이 레벨 1 상승</div>
        <div class="row">${run.party.map((u) => `<button class="btn small" data-act="restTrain" data-uid="${u.uid}">${u.name} Lv.${u.level}→${u.level + 1}</button>`).join('')}</div>
      </div>
    </div>
  </section>`;
};

// ── 보물 ───────────────────────────────────────────────────
SCREENS.treasure = () => {
  const loot = S.ui.loot;
  return `${topbar()}<section class="panel scene">
    <div class="art" aria-hidden="true">🎁</div>
    <div class="stack">
      <h2>낡은 보물상자</h2>
      <p>이번엔 진짜 상자다. 물지 않는다.</p>
      <div class="row"><span class="tag num">🪙 +${loot.gold}</span>${loot.items.map((i) => `<span class="tag">${ITEMS[i].icon} ${ITEMS[i].name}</span>`).join('')}</div>
      ${loot.relicChoices.length && !S.ui.picked ? `<div class="eyebrow">부적 하나를 챙길 수 있다</div><div class="reward-grid">${loot.relicChoices.map((id) => `<button class="btn relic-card" data-act="treasureRelic" data-id="${id}"><span class="ic">${RELICS[id].icon}</span><b>${RELICS[id].name}</b><span class="small muted">${RELICS[id].desc}</span></button>`).join('')}</div>` : ''}
      <div class="row end"><button class="btn primary" data-act="toMap">계속 →</button></div>
    </div>
  </section>`;
};

// ── 도감 / 도움말 ─────────────────────────────────────────
SCREENS.codex = () => {
  const m = S.meta;
  return `<section class="stack">
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">몬무스 도감</div><h1 style="font-size:28px">친구 ${m.friends.length} / ${Object.keys(SPECIES).length}</h1></div><button class="btn" data-act="toTitle">← 타이틀</button></div>
    <div class="codex">${Object.entries(SPECIES).map(([id, sp]) => {
    const fr = m.friends.includes(id); const seen = m.seen.includes(id);
    const cls = fr ? '' : seen ? 'seen' : 'unknown';
    return `<div class="panel entry ${cls}">${pic(id, fr ? 'happy' : 'normal', fr)}
      <b>${fr || seen ? `${sp.given} · ${sp.name}` : '???'}</b>
      ${fr ? `<span class="small">${ELEMENTS[sp.element].icon} ${sp.role} · 💗 ${ITEMS[sp.gift].icon}</span><span class="small muted">${sp.lore}</span>` : seen ? '<span class="small muted">만난 적 있다. 아직 친구가 아니다.</span>' : '<span class="small muted">아직 만나지 못했다.</span>'}
    </div>`;
  }).join('')}</div>
  </section>`;
};

SCREENS.help = () => `<section class="panel stack help">
  <div class="row" style="justify-content:space-between"><h1 style="font-size:28px">도움말</h1><button class="btn" data-act="toTitle">← 타이틀</button></div>
  <h3>목표</h3>
  <p>3막으로 된 숲을 지나 달의 마녀 녹스에게 닿으세요. 지도에서 갈림길을 고르며 전투, 이벤트, 상점, 모닥불을 거칩니다.</p>
  <h3>싸울까, 친구가 될까</h3>
  <ul>
    <li>몬무스는 <b>HP ❤</b>와 <b>호감도 💗</b>를 가지고 있어요. HP가 0이 되면 도망치고, 호감도가 가득 차면 <b>친구</b>가 되어 동료로 합류할 수 있어요.</li>
    <li>💗 매혹 스킬, 등불지기의 <b>말 걸기</b>, <b>선물</b>로 호감도를 올립니다. 좋아하는 선물은 효과가 3배예요.</li>
    <li>상처 입은 몬무스일수록 마음을 잘 열지만, 공격받으면 호감도가 조금 떨어져요.</li>
    <li>보스는 HP가 절반 이하일 때까지 <b>마음의 벽</b>이 있어요. 먼저 싸운 뒤 마음을 두드리세요.</li>
  </ul>
  <h3>전투 조작</h3>
  <ul>
    <li>테두리가 빛나는 동료를 누르고 스킬을 고른 뒤, 대상을 누르세요. 숫자키 1–5로 스킬, Enter로 턴 종료, Esc로 취소.</li>
    <li>등불지기(당신)는 매 턴 한 번 <b>말 걸기</b>나 <b>아이템</b>을 쓸 수 있어요.</li>
    <li>적 머리 위의 말풍선은 다음 행동 예고예요. 공격 대상을 보고 막거나 회복하세요.</li>
    <li>속성 상성: 🔥불 → 🍃숲 → 💧물 → 🔥불 (1.5배), ✨빛 ↔ 🌙어둠은 서로 1.5배.</li>
  </ul>
  <h3>그 밖에</h3>
  <ul>
    <li>쓰러진 동료는 전투가 끝나도 기절한 채예요. 모닥불이나 불사조 깃털로 일으키세요.</li>
    <li>파티는 3명까지. 꽉 찼을 때 새 친구가 생기면 교체하거나 답례만 받을 수 있어요.</li>
    <li>지도 화면에서 자동 저장됩니다.</li>
  </ul>
</section>`;

// ── 흐름 ───────────────────────────────────────────────────
function saveRun() { if (S.run && !S.run.over) saveRunJson(serializeRun(S.run)); }

function toMap() {
  S.screen = 'map';
  S.battle = null;
  S.ui = {};
  saveRun();
  render();
  window.scrollTo({ top: 0 });
}

function startRun(seed) {
  S.ui = { seed };
  S.screen = 'starter';
  render();
}

function go(nodeId) {
  const run = S.run;
  run.visited = run.visited || [];
  let res;
  try { res = enterNode(run, nodeId); } catch (e) { toast(e.message); return; }
  run.visited.push(nodeId);
  sfx.click();
  switch (res.type) {
    case 'battle':
      if (res.battle.kind === 'boss') return bossIntro(res.battle);
      return startBattle(res.battle);
    case 'shop': S.ui = { shop: res.shop }; S.screen = 'shop'; break;
    case 'rest': S.ui = {}; S.screen = 'rest'; break;
    case 'treasure': S.ui = { loot: res.loot }; S.screen = 'treasure'; sfx.coin(); break;
    case 'event': { const ev = pickEvent(run); S.ui = { eventId: ev.id }; S.screen = 'event'; break; }
  }
  render();
  window.scrollTo({ top: 0 });
}

const ACTIONS = {
  continue() {
    try { S.run = deserializeRun(loadRunJson()); } catch { toast('저장 데이터를 읽을 수 없어요'); clearRun(); return render(); }
    toMap();
  },
  newGame() { startRun(Math.floor(Math.random() * 1e9)); },
  daily() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    startRun(hashString(`moonlit-${key}`) % 1e9);
  },
  pickStarter(el) {
    S.run = newRun(S.ui.seed, el.dataset.id);
    markSeen(el.dataset.id, true);
    sfx.befriend();
    toMap();
  },
  toTitle() { S.screen = 'title'; S.ui = {}; closeModal(); render(); },
  toMap() { toMap(); },
  codex() { S.screen = 'codex'; render(); },
  help() { S.screen = 'help'; render(); },
  toggleSound() { S.meta.sound = !S.meta.sound; setSound(S.meta.sound); saveMeta(S.meta); render(); },
  menu() {
    openModal(() => `<h2>메뉴</h2>
      <div class="stack">
        <div class="small muted">시드 <span class="num">${S.run.seed}</span></div>
        <button class="btn" data-act="toggleSound">${S.meta.sound ? '🔊 소리 끄기' : '🔇 소리 켜기'}</button>
        <button class="btn" data-act="speed">연출 속도: ${S.meta.speed >= 2 ? '빠르게' : '보통'}</button>
        <button class="btn" data-act="helpModal">❔ 도움말</button>
        <button class="btn" data-act="toTitleSave">타이틀로 (${S.screen === 'map' ? '저장됨' : '마지막 지도 시점에서 이어하기'})</button>
        <button class="btn ghost" data-act="abandon">모험 포기하기</button>
      </div>
      <div class="row end"><button class="btn primary" data-act="closeModal">닫기</button></div>`);
  },
  speed() { S.meta.speed = S.meta.speed >= 2 ? 1 : 2; saveMeta(S.meta); ACTIONS.menu(); },
  helpModal() { openModal(() => SCREENS.help().replace('data-act="toTitle"', 'data-act="closeModal"').replace('← 타이틀', '닫기')); },
  toTitleSave() { closeModal(); S.screen = 'title'; render(); },
  abandon() {
    openModal(() => `<h2>정말 포기할까요?</h2><p>이번 모험의 진행이 사라집니다. 도감 기록은 남아요.</p>
      <div class="row end"><button class="btn" data-act="menu">아니요</button><button class="btn primary" data-act="abandonYes">포기하기</button></div>`);
  },
  abandonYes() { clearRun(); S.meta.runs++; saveMeta(S.meta); closeModal(); S.screen = 'title'; render(); },
  closeModal() { closeModal(); },
  faceBoss() { sfx.click(); startBattle(S.ui.battle); },
  relicInfo(el) { const r = RELICS[el.dataset.id]; toast(`${r.icon} ${r.name} — ${r.desc}`); },
  go(el) { go(el.dataset.id); },
  detail(el) { const u = S.run.party.find((x) => x.uid === Number(el.dataset.uid)); if (u) openModal(unitDetail(u)); },
  useOutside(el) {
    const uid = Number(el.dataset.uid);
    try { useItemOutside(S.run, el.dataset.id, uid); sfx.heal(); } catch (e) { return toast(e.message); }
    saveRun();
    const u = S.run.party.find((x) => x.uid === uid);
    render();
    openModal(unitDetail(u));
  },

  // 전투
  select(el) { if (S.ui.busy) return; S.ui.selected = Number(el.dataset.uid); S.ui.pendingSkill = null; S.ui.pendingItem = null; S.ui.pendingTalk = false; sfx.click(); render(); },
  inspect(el) {
    const u = findUnit(S.battle, Number(el.dataset.uid));
    if (!u) return;
    if (u.side === 'ally') return openModal(unitDetail(u));
    const sp = SPECIES[u.species];
    openModal(() => `<div class="detail-head">${pic(u.species, expressionFor(u))}<div class="stack" style="gap:4px">
      <h2>${u.name} <span class="muted small">${sp.name} · Lv.${u.level}${u.elite ? ' · 강적' : ''}</span></h2>
      <div class="row" style="gap:6px">${elemTag(u.element)}<span class="tag">${sp.role}</span><span class="tag">좋아하는 것 ${ITEMS[sp.gift].icon} ${ITEMS[sp.gift].name}</span></div>
      ${hpBar(u.hp, u.maxHp)}${bondBar(u.bond, u.bondMax)}
      <div class="small muted">마음 여는 정도 ×${receptivity(u).toFixed(2)}${u.boss && u.hp > u.maxHp / 2 ? ' (마음의 벽!)' : ''}</div></div></div>
      <div class="skill-list">${unlockedSkills(u).map((s) => skillLine(s)).join('')}</div>
      <p class="small muted" style="margin:0">${sp.lore}</p>
      <div class="row end"><button class="btn" data-act="closeModal">닫기</button></div>`);
  },
  skill(el) {
    const ui = S.ui; const b = S.battle;
    const u = findUnit(b, ui.selected);
    const s = SKILLS[el.dataset.id];
    if (!u || !canAct(b, u)) return;
    ui.pendingItem = null; ui.pendingTalk = false;
    if (needsTarget(s)) {
      const ts = validTargets(b, u, s);
      if (ts.length === 1 && s.target !== 'ally') return runAction(() => allyAct(b, S.run, S.run.rng, u.uid, s.id, ts[0].uid));
      ui.pendingSkill = ui.pendingSkill === s.id ? null : s.id;
      sfx.click();
      return render();
    }
    runAction(() => allyAct(b, S.run, S.run.rng, u.uid, s.id, null));
  },
  target(el) {
    const ui = S.ui; const b = S.battle; const uid = Number(el.dataset.uid);
    if (ui.pendingSkill) { const sk = ui.pendingSkill; return runAction(() => allyAct(b, S.run, S.run.rng, ui.selected, sk, uid)); }
    if (ui.pendingTalk) return runAction(() => keeperTalk(b, S.run, S.run.rng, uid));
    if (ui.pendingItem) { const it = ui.pendingItem; return runAction(() => useItem(b, S.run, S.run.rng, it, uid)); }
  },
  talk() { const ui = S.ui; ui.pendingSkill = null; ui.pendingItem = null; ui.pendingTalk = !ui.pendingTalk; sfx.click(); render(); },
  item(el) {
    const ui = S.ui; const id = el.dataset.id; const it = ITEMS[id];
    ui.pendingSkill = null; ui.pendingTalk = false;
    if (it.target === 'allEnemies' || it.target === 'allAllies' || it.target === 'none') {
      ui.pendingItem = null;
      return runAction(() => useItem(S.battle, S.run, S.run.rng, id, null));
    }
    ui.pendingItem = ui.pendingItem === id ? null : id;
    render();
  },
  cancel() { const ui = S.ui; ui.pendingSkill = ui.pendingItem = null; ui.pendingTalk = false; render(); },
  endTurn() {
    if (S.ui.busy || S.battle.phase !== 'player') return;
    runAction(() => endPlayerTurn(S.battle, S.run, S.run.rng));
  },
  auto() {
    if (S.ui.busy || S.battle.phase !== 'player') return;
    const b = S.battle; const run = S.run;
    const want = run.party.length < run.maxParty || b.kind === 'boss';
    runAction(() => {
      const ev = autoTurn(b, run, run.rng, { friendTarget: befriendTarget(b, run, want) });
      if (b.phase === 'player') ev.push(...endPlayerTurn(b, run, run.rng));
      return ev;
    });
  },

  // 보상
  pickRelic(el) { gainRelic(S.run, el.dataset.id); S.pending.relicPicked = true; sfx.coin(); render(); },
  skipRelic() { S.pending.relicPicked = true; render(); },
  rewardNext() { rewardNext(); },
  acceptRecruit() {
    const r = S.ui.recruit;
    joinParty(S.run, r);
    sfx.befriend();
    toast(`${이가(r.name)} 동료가 되었다!`);
    finishRecruit();
  },
  swapRecruit(el) {
    const r = S.ui.recruit;
    const old = S.run.party.find((u) => u.uid === Number(el.dataset.uid));
    joinParty(S.run, r, old.uid);
    sfx.befriend();
    toast(`${은는(old.name)} 손을 흔들며 숲으로 돌아갔다. ${이가(r.name)} 합류했다!`);
    finishRecruit();
  },
  declineRecruit() {
    const r = S.ui.recruit;
    const g = declineRecruit(S.run, r);
    toast(`${이가(r.name)} 답례로 ${ITEMS[g.gift].icon}${ITEMS[g.gift].name}과 ${g.gold}G를 주었다.`);
    finishRecruit();
  },

  // 이벤트
  choose(el) {
    const ev = eventById(S.ui.eventId);
    const c = ev.choices[Number(el.dataset.i)];
    if (c.req && !c.req(S.run)) return;
    const out = c.run(S.run);
    S.ui.outcome = out;
    sfx.click();
    render();
  },
  eventDone() {
    const out = S.ui.outcome;
    const cont = () => {
      if (out.battle) return startBattle(beginBattle(S.run, out.battle.kind, out.battle.enemies));
      toMap();
    };
    if (out.recruit) { markSeen(out.recruit.species, true); return showRecruit(out.recruit, cont); }
    cont();
  },

  // 상점/휴식/보물
  buy(el) {
    try { const g = buy(S.run, S.ui.shop, Number(el.dataset.i)); sfx.coin(); if (g.kind === 'service') toast('개운하다! 모두 완전히 회복했다.'); } catch (e) { toast(e.message); }
    render();
  },
  restHeal() { restHeal(S.run); sfx.heal(); toast('푹 쉬었다. 기운이 돌아온다.'); toMap(); },
  restTrain(el) { const lv = restTrain(S.run, Number(el.dataset.uid)); sfx.buff(); toast(`훈련 완료! Lv.${lv}`); toMap(); },
  treasureRelic(el) { gainRelic(S.run, el.dataset.id); S.ui.picked = true; sfx.coin(); render(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el);
});

document.addEventListener('click', (e) => {
  if (e.target.classList?.contains('modal-back') && S.modal && !S.ui.recruit) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (S.modal && !S.ui.recruit) return closeModal();
    if (S.screen === 'battle') ACTIONS.cancel();
    return;
  }
  if (S.screen !== 'battle' || S.modal || S.ui.busy) return;
  if (e.key === 'Enter') { e.preventDefault(); ACTIONS.endTurn(); return; }
  const n = Number(e.key);
  if (n >= 1 && n <= 5) {
    const btn = document.querySelectorAll('.skill')[n - 1];
    if (btn && !btn.disabled) ACTIONS.skill(btn);
  }
});

render();
