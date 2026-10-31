// 한 번의 모험(런) 진행을 담당하는 순수 로직
import { createRng } from './rng.js';
import { SPECIES, ITEMS, RELICS, ACT_POOLS, BOSSES, GIFT_IDS } from './data.js';
import { createUnit, refreshStats, gainXp, xpToNext, levelUp, resetUids } from './units.js';
import { generateMap, startNodes, MAP_ROWS } from './map.js';
import { createBattle, alive } from './battle.js';
import { activeSynergies } from './banter.js';

export const ACTS = 3;
export const ACT_NAMES = ['속삭이는 숲', '불꽃 골짜기', '달이 진 성'];
const ACT_BASE_LEVEL = [2, 8, 15];
const BOSS_LEVEL = [7, 13, 20];

function attachRng(run, state) {
  const rng = createRng(run.seed);
  if (state != null) rng.setState(state);
  Object.defineProperty(run, 'rng', { value: rng, enumerable: false, writable: true, configurable: true });
  return run;
}

export function newRun(seed, starterId) {
  resetUids(1);
  const run = {
    version: 1,
    seed,
    act: 1,
    map: null,
    nodeId: null,
    floor: 0,
    party: [],
    maxParty: 3,
    relics: ['lantern'],
    items: { potion: 2, [SPECIES[starterId].gift]: 1 },
    gold: 45,
    stats: { battles: 0, befriended: [], defeated: 0, turns: 0, goldEarned: 0 },
    over: null, // 'win' | 'true' | 'lose'
  };
  attachRng(run);
  run.party.push(createUnit(starterId, 4, 'ally', { relics: run.relics, joinedAt: 0 }));
  run.map = generateMap(run.rng, 1);
  return run;
}

export function serializeRun(run) {
  return JSON.stringify({ ...run, rngState: run.rng.getState() });
}

export function deserializeRun(json) {
  const data = JSON.parse(json);
  const { rngState, ...run } = data;
  attachRng(run, rngState);
  const maxUid = run.party.reduce((m, u) => Math.max(m, u.uid), 0);
  resetUids(maxUid + 1000);
  return run;
}

export function availableNodes(run) {
  if (run.nodeId == null) return startNodes(run.map);
  return run.map.nodes[run.nodeId].next.map((id) => run.map.nodes[id]);
}

export function partyLevel(run) {
  const ls = run.party.map((u) => u.level);
  return Math.round(ls.reduce((a, b) => a + b, 0) / ls.length);
}

// ── 조우 생성 ───────────────────────────────────────────────
export function generateEncounter(run, kind, row) {
  const rng = run.rng;
  const act = run.act;
  const pool = ACT_POOLS[act - 1];
  const base = ACT_BASE_LEVEL[act - 1] + Math.floor(row * 0.85);
  if (kind === 'boss') {
    const boss = createUnit(BOSSES[act - 1], BOSS_LEVEL[act - 1], 'enemy');
    return [boss];
  }
  if (kind === 'elite') {
    const sp = rng.pick(pool);
    const elite = createUnit(sp, base + 2, 'enemy', { elite: true });
    const out = [elite];
    if (act >= 2 || rng.chance(0.4)) out.push(createUnit(rng.pick(pool), base, 'enemy'));
    return out;
  }
  let count;
  if (act === 1) count = row === 0 ? 1 : row <= 2 ? rng.weighted([[1, 1], [2, 2]]) : rng.weighted([[2, 3], [3, 1]]);
  else if (act === 2) count = rng.weighted([[2, 3], [3, 2]]);
  else count = rng.weighted([[2, 2], [3, 3]]);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(createUnit(rng.pick(pool), Math.max(1, base + rng.int(-1, 0)), 'enemy'));
  }
  return out;
}

export function beginBattle(run, kind, enemies) {
  const row = run.nodeId && run.map.nodes[run.nodeId] ? run.map.nodes[run.nodeId].row : 0;
  enemies = enemies || generateEncounter(run, kind, row);
  return createBattle(run, run.rng, enemies, kind);
}

// ── 노드 진입 ───────────────────────────────────────────────
/** 노드로 이동. 반환값은 UI가 처리할 화면 정보. */
export function enterNode(run, nodeId) {
  const ok = availableNodes(run).some((n) => n.id === nodeId);
  if (!ok) throw new Error('갈 수 없는 길입니다');
  run.nodeId = nodeId;
  run.floor++;
  const node = run.map.nodes[nodeId];
  switch (node.type) {
    case 'battle':
    case 'elite':
    case 'boss':
      return { type: 'battle', battle: beginBattle(run, node.type) };
    case 'shop':
      return { type: 'shop', shop: generateShop(run) };
    case 'rest':
      return { type: 'rest' };
    case 'treasure':
      return { type: 'treasure', loot: openTreasure(run) };
    case 'event':
      return { type: 'event' };
  }
  throw new Error('unknown node');
}

// ── 전투 보상 ───────────────────────────────────────────────
function goldMul(run) {
  const syn = activeSynergies(run.party).reduce((m, x) => m * (x.goldMul || 1), 1);
  return (run.relics.includes('coin') ? 1.35 : 1) * syn;
}

export function addGold(run, amount) {
  const g = Math.round(amount);
  run.gold += g;
  if (g > 0) run.stats.goldEarned += g;
  return g;
}

export function finishBattle(run, battle) {
  const rng = run.rng;
  const result = { gold: 0, xp: 0, levelUps: [], items: [], relicChoices: [], recruits: [], fled: battle.phase === 'fled' };
  run.stats.turns += battle.turn;
  // 상태 초기화 & 쓰러진 아군은 1 HP로 일어나지 않는다 (휴식/깃털 필요)
  for (const u of run.party) { u.st = {}; u.cd = {}; u.intent = null; }
  if (battle.phase === 'lost') return result;
  if (battle.phase === 'fled') return result;

  run.stats.battles++;
  run.stats.defeated += battle.defeated.length;
  const all = [...battle.defeated, ...battle.befriended].filter((e) => !e.summoned);
  const kindMul = battle.kind === 'boss' ? 2.5 : battle.kind === 'elite' ? 1.6 : 1;
  let xp = all.reduce((s, e) => s + 4 + e.level * 4, 0) * kindMul;
  if (run.relics.includes('compass')) xp *= 1.3;
  result.xp = Math.round(xp);

  const baseGold = battle.kind === 'boss' ? 70 + run.act * 15 : battle.kind === 'elite' ? 28 + run.act * 10 : rng.int(10, 16) + run.act * 4;
  result.gold = addGold(run, (baseGold + battle.goldBonus) * goldMul(run));

  for (const u of run.party) {
    if (!alive(u)) continue;
    const before = u.level;
    const ups = gainXp(u, result.xp, run.relics);
    if (ups) result.levelUps.push({ uid: u.uid, name: u.name, from: before, to: u.level });
  }
  // 등불: 전투 후 회복
  if (run.relics.includes('lantern')) {
    for (const u of run.party) if (alive(u)) u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.08));
  }

  // 아이템 드롭
  if (battle.kind === 'normal' && rng.chance(0.4)) result.items.push(randomItem(rng));
  if (battle.kind === 'elite') {
    result.items.push(randomItem(rng));
    result.relicChoices = relicChoices(run, ['common', 'uncommon'], 3);
  }
  if (battle.kind === 'boss') {
    result.relicChoices = relicChoices(run, ['boss'], 3);
    if (!result.relicChoices.length) result.relicChoices = relicChoices(run, ['uncommon', 'common'], 3);
  }
  for (const it of result.items) run.items[it] = (run.items[it] || 0) + 1;

  // 친구가 된 몬무스
  for (const e of battle.befriended) {
    if (!run.stats.befriended.includes(e.species)) run.stats.befriended.push(e.species);
    result.recruits.push(makeRecruit(run, e.species, Math.max(e.level, partyLevel(run) - 1)));
  }
  return result;
}

export function randomItem(rng) {
  return rng.weighted([
    ['potion', 5], ['feather', 1.5], ['elixir', 1.5], ['bomb', 2], ['smoke', 1], ['perfume', 1.5],
    ...GIFT_IDS.map((g) => [g, 1]),
  ]);
}

export function relicChoices(run, rarities, n) {
  const pool = Object.keys(RELICS).filter((id) => rarities.includes(RELICS[id].rarity) && !run.relics.includes(id));
  return run.rng.shuffle(pool).slice(0, n);
}

export function gainRelic(run, id) {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  if (id === 'crown') run.maxParty = 4;
  for (const u of run.party) refreshStats(u, run.relics);
}

// ── 동료 영입 ───────────────────────────────────────────────
export function makeRecruit(run, species, level) {
  const u = createUnit(species, level, 'ally', { relics: run.relics, joinedAt: run.floor });
  return u;
}

/** 파티에 합류. replaceUid가 있으면 그 동료와 작별. */
export function joinParty(run, recruit, replaceUid = null) {
  if (replaceUid != null) {
    const idx = run.party.findIndex((u) => u.uid === replaceUid);
    if (idx < 0) throw new Error('작별할 동료가 없습니다');
    run.party.splice(idx, 1, recruit);
    return;
  }
  if (run.party.length >= run.maxParty) throw new Error('파티가 가득 찼습니다');
  run.party.push(recruit);
}

/** 영입을 거절하면 답례로 선물과 골드를 받는다 */
export function declineRecruit(run, recruit) {
  const gift = SPECIES[recruit.species].gift;
  run.items[gift] = (run.items[gift] || 0) + 1;
  const g = addGold(run, 10 + run.act * 5);
  return { gift, gold: g };
}

// ── 휴식 ────────────────────────────────────────────────────
export function restHeal(run) {
  for (const u of run.party) {
    if (u.fainted) { u.fainted = false; u.hp = Math.round(u.maxHp * 0.4); }
    else u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.4));
  }
}

export function restTrain(run, uid) {
  const u = run.party.find((x) => x.uid === uid);
  if (!u) throw new Error('없는 동료');
  if (u.fainted) { u.fainted = false; u.hp = 1; }
  u.xp = 0;
  levelUp(u, run.relics);
  u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.15));
  return u.level;
}

// ── 보물 ────────────────────────────────────────────────────
export function openTreasure(run) {
  const rng = run.rng;
  const loot = { gold: addGold(run, (rng.int(25, 40) + run.act * 10) * goldMul(run)), items: [], relicChoices: relicChoices(run, ['common', 'uncommon'], 2) };
  const it = randomItem(rng);
  run.items[it] = (run.items[it] || 0) + 1;
  loot.items.push(it);
  return loot;
}

// ── 상점 ────────────────────────────────────────────────────
export function generateShop(run) {
  const rng = run.rng;
  const goods = [];
  const seen = new Set();
  const always = ['potion', 'feather'];
  for (const id of always) { goods.push({ kind: 'item', id, price: ITEMS[id].price + run.act * 3 }); seen.add(id); }
  while (goods.length < 6) {
    const id = randomItem(rng);
    if (seen.has(id)) continue;
    seen.add(id);
    goods.push({ kind: 'item', id, price: ITEMS[id].price + run.act * 3 });
  }
  for (const id of relicChoices(run, ['common', 'uncommon'], 2)) {
    goods.push({ kind: 'relic', id, price: RELICS[id].rarity === 'uncommon' ? 105 : 80 });
  }
  goods.push({ kind: 'service', id: 'heal', price: 30 + run.act * 10 });
  return { goods };
}

export function buy(run, shop, index) {
  const g = shop.goods[index];
  if (!g || g.sold) throw new Error('품절');
  if (run.gold < g.price) throw new Error('골드가 부족합니다');
  run.gold -= g.price;
  g.sold = g.kind !== 'item' ? true : false;
  if (g.kind === 'item') run.items[g.id] = (run.items[g.id] || 0) + 1;
  else if (g.kind === 'relic') gainRelic(run, g.id);
  else if (g.kind === 'service') {
    for (const u of run.party) { u.fainted = false; u.hp = u.maxHp; }
  }
  return g;
}

// ── 막 전환 ─────────────────────────────────────────────────
export function nodeRow(run) {
  return run.nodeId ? run.map.nodes[run.nodeId].row : -1;
}

export function isBossNode(run) {
  return run.nodeId === 'boss';
}

/** 보스 처치 후 다음 막으로. 마지막 막이면 엔딩 */
export function advanceAct(run, bossBefriended) {
  if (run.act >= ACTS) {
    run.over = bossBefriended ? 'true' : 'win';
    return { ending: run.over };
  }
  run.act++;
  run.map = generateMap(run.rng, run.act);
  run.nodeId = null;
  // 막 사이 휴식: 전원 부활 및 회복
  for (const u of run.party) { u.fainted = false; u.hp = u.maxHp; }
  return { act: run.act };
}

export function isPartyWiped(run) {
  return run.party.every((u) => u.fainted || u.hp <= 0);
}

export { MAP_ROWS, xpToNext };

/** 전투 밖(지도)에서 회복 아이템 사용 */
export function useItemOutside(run, itemId, uid) {
  if (!(run.items[itemId] > 0)) throw new Error('아이템이 없습니다');
  const u = run.party.find((x) => x.uid === uid);
  if (itemId === 'potion') {
    if (!u || u.fainted) throw new Error('쓰러지지 않은 동료에게만 쓸 수 있습니다');
    if (u.hp >= u.maxHp) throw new Error('이미 HP가 가득합니다');
    u.hp = Math.min(u.maxHp, u.hp + Math.max(20, Math.round(u.maxHp * 0.45)));
  } else if (itemId === 'feather') {
    if (!u || !u.fainted) throw new Error('쓰러진 동료에게만 쓸 수 있습니다');
    u.fainted = false;
    u.hp = Math.round(u.maxHp * 0.5);
  } else if (itemId === 'elixir') {
    for (const x of run.party) if (!x.fainted) x.hp = Math.min(x.maxHp, x.hp + Math.round(x.maxHp * 0.25));
  } else {
    throw new Error('전투 중에만 쓸 수 있습니다');
  }
  run.items[itemId]--;
  if (run.items[itemId] <= 0) delete run.items[itemId];
}
