// 전투 엔진. DOM을 전혀 모르는 순수 로직이며,
// 모든 결과를 events 배열로 돌려줘서 UI가 순서대로 연출한다.
import { SKILLS, STATUSES, SPECIES, ITEMS, elementMultiplier } from './data.js';
import { createUnit, unlockedSkills } from './units.js';
import { activeSynergies } from './banter.js';

export const MAX_ENEMIES = 4;
export const TURN_LIMIT = 30; // 이 턴이 지나면 해가 저물어 적이 돌아간다

// ── 조회 도우미 ─────────────────────────────────────────────
export const alive = (u) => u && !u.fainted && !u.gone && u.hp > 0;
export const livingAllies = (b) => b.allies.filter(alive);
export const livingEnemies = (b) => b.enemies.filter(alive);
const sideOf = (b, u) => (u.side === 'ally' ? b.allies : b.enemies);
const foesOf = (b, u) => (u.side === 'ally' ? b.enemies : b.allies);
export const findUnit = (b, uid) => b.allies.find((u) => u.uid === uid) || b.enemies.find((u) => u.uid === uid);
const has = (run, relic) => run.relics.includes(relic);

export function createBattle(run, rng, enemies, kind = 'normal') {
  const b = {
    kind,
    allies: run.party,
    enemies,
    turn: 0,
    phase: 'player',
    acted: [],
    keeperUsed: false,
    befriended: [],
    defeated: [],
    goldBonus: 0,
    events: [],
  };
  for (const u of run.party) { u.st = {}; u.cd = {}; u.intent = null; }
  for (const e of enemies) { e.st = {}; e.cd = {}; e.bond = 0; }

  const ev = [];
  if (has(run, 'turtle')) {
    for (const a of livingAllies(b)) addShield(a, Math.round(8 + a.level * 2.2), ev);
  }
  if (has(run, 'bell')) {
    for (const a of livingAllies(b)) applyStatus(a, 'regen', { turns: 2 }, ev);
  }
  // 인연 효과
  b.synergies = activeSynergies(run.party);
  for (const syn of b.synergies) {
    if (!syn.start) continue;
    ev.push({ type: 'synergy', id: syn.id, name: syn.name });
    for (const eff of syn.start) {
      const targets = livingAllies(b).filter((a) => eff.who === 'all' || syn.members.includes(a.species));
      for (const a of targets) {
        if (eff.shield) addShield(a, shieldValue(a, eff.shield), ev);
        else applyStatus(a, eff.status, { turns: eff.turns }, ev);
      }
    }
  }
  b.events.push(...ev);
  for (const e of enemies) rollIntent(b, rng, e);
  startPlayerTurn(b, run);
  return b;
}

// ── 상태이상 ────────────────────────────────────────────────
function applyStatus(unit, status, eff, ev, src) {
  if (!alive(unit)) return;
  if (status === 'shield') return addShield(unit, eff.value, ev);
  if (status === 'poison') {
    const amt = Math.max(1, Math.round(eff.amount * (src ? Math.max(1, src.atk / 10) : 1)));
    unit.st.poison = (unit.st.poison || 0) + amt;
    ev.push({ type: 'status', uid: unit.uid, status, value: unit.st.poison });
    return;
  }
  const cur = unit.st[status] || 0;
  unit.st[status] = Math.max(cur, eff.turns || 1);
  ev.push({ type: 'status', uid: unit.uid, status, value: unit.st[status] });
}

function addShield(unit, value, ev) {
  unit.st.shield = (unit.st.shield || 0) + value;
  ev.push({ type: 'status', uid: unit.uid, status: 'shield', value: unit.st.shield });
}

function cleanse(unit, ev) {
  let any = false;
  for (const k of Object.keys(unit.st)) {
    if (STATUSES[k]?.bad) { delete unit.st[k]; any = true; }
  }
  if (any) ev.push({ type: 'cleanse', uid: unit.uid });
}

function turnStartTick(b, run, units, ev) {
  for (const u of units) {
    if (!alive(u)) continue;
    delete u.st.shield;
    for (const [k, def] of Object.entries(STATUSES)) {
      if (def.tick === 'start' && u.st[k]) {
        u.st[k]--;
        if (u.st[k] <= 0) delete u.st[k];
      }
    }
    if (u.st.poison) dealRaw(b, run, u, u.st.poison, 'poison', ev);
    if (alive(u) && u.st.burn) dealRaw(b, run, u, Math.max(1, Math.round(u.maxHp * 0.07)), 'burn', ev);
    if (alive(u) && u.st.regen) heal(u, Math.max(1, Math.round(u.maxHp * 0.08)), ev);
  }
}

function turnEndTick(units) {
  for (const u of units) {
    if (!alive(u)) continue;
    for (const k of Object.keys(u.cd)) if (u.cd[k] > 0) u.cd[k]--;
    if (u.st.poison) { u.st.poison--; if (u.st.poison <= 0) delete u.st.poison; }
    for (const [k, def] of Object.entries(STATUSES)) {
      if (def.tick === 'end' && k !== 'poison' && u.st[k]) {
        u.st[k]--;
        if (u.st[k] <= 0) delete u.st[k];
      }
    }
  }
}

// ── 피해/회복/호감 ──────────────────────────────────────────
function heal(unit, amount, ev) {
  if (!alive(unit)) return 0;
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(amount));
  const healed = unit.hp - before;
  ev.push({ type: 'heal', uid: unit.uid, amount: healed });
  return healed;
}

/** 방어 계산 없이 그대로 HP를 깎는다 (독, 화상, 폭탄 등). */
function dealRaw(b, run, unit, amount, cause, ev) {
  amount = Math.max(1, Math.round(amount));
  unit.hp = Math.max(0, unit.hp - amount);
  ev.push({ type: 'damage', uid: unit.uid, amount, cause });
  if (unit.st.sleep && cause !== 'poison' && cause !== 'burn') { delete unit.st.sleep; ev.push({ type: 'wake', uid: unit.uid }); }
  if (unit.side === 'enemy') loseBond(run, unit, amount, ev);
  checkDown(b, run, unit, ev);
  return amount;
}

function loseBond(run, enemy, dmg, ev) {
  if (has(run, 'heartstone') || enemy.bond <= 0) return;
  const loss = Math.round((dmg / enemy.maxHp) * enemy.bondMax * 0.3);
  if (loss <= 0) return;
  enemy.bond = Math.max(0, enemy.bond - loss);
  ev.push({ type: 'bond', uid: enemy.uid, amount: -loss });
}

function checkDown(b, run, unit, ev) {
  if (unit.hp > 0 || unit.fainted || unit.gone) return;
  if (unit.side === 'ally') {
    unit.fainted = true;
    unit.st = {};
    ev.push({ type: 'faint', uid: unit.uid });
  } else {
    unit.gone = 'fled';
    b.defeated.push(unit);
    ev.push({ type: 'flee', uid: unit.uid, line: SPECIES[unit.species].lines.flee });
  }
}

export function calcDamage(att, def, skill, run, rng, opts = {}) {
  const elem = skill.element || att.element;
  const eMul = elementMultiplier(elem, def.element);
  let atk = att.atk;
  let dmg = skill.power * (atk / 10) * (atk / (atk + def.def * 0.6)) * 1.3;
  dmg *= eMul;
  if (att.st.atkUp) dmg *= 1.35;
  if (att.st.atkDown) dmg *= 0.7;
  if (def.st.defUp) dmg *= 0.65;
  if (def.st.defDown) dmg *= 1.3;
  if (att.side === 'ally' && has(run, 'whetstone')) dmg *= 1.15;
  if (opts.noRandom) return { dmg: Math.max(1, Math.round(dmg)), crit: false, eMul };
  const crit = rng.chance(Math.min(0.3, att.spd / 160));
  if (crit) dmg *= 1.5;
  dmg *= rng.float(0.9, 1.1);
  return { dmg: Math.max(1, Math.round(dmg)), crit, eMul };
}

function hitWithSkill(b, run, rng, att, target, skill, ev) {
  if (!alive(target)) return 0;
  // 회피
  let dodgeChance = target.st.dodge ? 0.5 : 0;
  if (target.side === 'ally' && has(run, 'cloud')) dodgeChance = 1 - (1 - dodgeChance) * 0.88;
  if (dodgeChance && rng.chance(dodgeChance)) {
    ev.push({ type: 'miss', uid: target.uid });
    return 0;
  }
  const { dmg: raw, crit, eMul } = calcDamage(att, target, skill, run, rng);
  let dmg = raw;
  if (target.st.shield) {
    const absorbed = Math.min(target.st.shield, dmg);
    target.st.shield -= absorbed;
    if (target.st.shield <= 0) delete target.st.shield;
    dmg -= absorbed;
    if (absorbed) ev.push({ type: 'block', uid: target.uid, amount: absorbed });
  }
  if (dmg > 0) {
    target.hp = Math.max(0, target.hp - dmg);
    ev.push({ type: 'damage', uid: target.uid, amount: dmg, crit, eff: eMul > 1 ? 'super' : eMul < 1 ? 'weak' : null });
    if (target.st.sleep) { delete target.st.sleep; ev.push({ type: 'wake', uid: target.uid }); }
    if (target.side === 'enemy') loseBond(run, target, dmg, ev);
  }
  if (skill.lifesteal && dmg > 0) heal(att, dmg * skill.lifesteal, ev);
  if (skill.gold && att.side === 'ally') {
    b.goldBonus += skill.gold;
    ev.push({ type: 'gold', uid: att.uid, amount: skill.gold });
  }
  // 가시 팔찌 반사
  if (target.side === 'ally' && has(run, 'thorn') && dmg > 0 && alive(att)) {
    dealRaw(b, run, att, Math.max(2, Math.round(raw * 0.2)), 'thorn', ev);
  }
  checkDown(b, run, target, ev);
  return dmg;
}

export function receptivity(enemy) {
  let r = 1 + 0.6 * (1 - enemy.hp / enemy.maxHp);
  // 보스는 HP가 절반 이하가 되기 전까지 마음의 벽이 있다
  if (enemy.boss && enemy.hp > enemy.maxHp * 0.5) r *= 0.4;
  return r;
}

function synergyMul(run, key) {
  return activeSynergies(run.party).reduce((m, syn) => m * (syn[key] || 1), 1);
}

function charmAmount(run, att, enemy, power) {
  let amt = power * (att.cha / 10) * receptivity(enemy) * synergyMul(run, 'charmMul');
  if (has(run, 'ribbon')) amt *= 1.25;
  if (has(run, 'heartstone')) amt *= 1.4;
  return amt;
}

function gainBond(b, run, enemy, amount, ev, reason) {
  if (!alive(enemy)) return;
  amount = Math.max(1, Math.round(amount));
  const before = enemy.bond;
  enemy.bond = Math.min(enemy.bondMax, enemy.bond + amount);
  ev.push({ type: 'bond', uid: enemy.uid, amount: enemy.bond - before, reason });
  if (enemy.bond >= enemy.bondMax) {
    enemy.gone = 'friend';
    b.befriended.push(enemy);
    ev.push({ type: 'befriend', uid: enemy.uid, line: SPECIES[enemy.species].lines.join });
    if (has(run, 'teacup')) {
      for (const a of livingAllies(b)) heal(a, a.maxHp * 0.25, ev);
    }
  }
}

// ── 스킬 사용 ───────────────────────────────────────────────
export function skillReady(unit, skillId) {
  return !(unit.cd[skillId] > 0);
}

export function usableSkills(b, unit) {
  return unlockedSkills(unit).filter((id) => {
    if (!skillReady(unit, id)) return false;
    const s = SKILLS[id];
    if (s.target === 'fallenAlly') return sideOf(b, unit).some((u) => u.fainted);
    if (s.kind === 'summon') return livingEnemies(b).length < MAX_ENEMIES;
    return true;
  });
}

export function validTargets(b, unit, skill) {
  switch (skill.target) {
    case 'enemy': {
      const foes = foesOf(b, unit).filter(alive);
      return foes;
    }
    case 'ally': return sideOf(b, unit).filter(alive);
    case 'fallenAlly': return sideOf(b, unit).filter((u) => u.fainted);
    default: return [];
  }
}

export function needsTarget(skill) {
  return skill.target === 'enemy' || skill.target === 'ally' || skill.target === 'fallenAlly';
}

function shieldValue(user, amount) {
  return Math.round(amount * (6 + user.def * 0.8 + user.atk * 0.6));
}

/** 유닛이 스킬을 사용한다. 이벤트 배열을 반환. */
export function performSkill(b, run, rng, actor, skillId, targetUid) {
  const ev = [];
  const skill = SKILLS[skillId];
  ev.push({ type: 'action', uid: actor.uid, skill: skillId });

  if (skill.cd > 0) {
    // cd N = 사용 후 N턴 동안 사용 불가 (턴 끝마다 1 감소)
    const reduce = has(run, 'mooncrystal') && actor.side === 'ally' ? 1 : 0;
    const wait = Math.max(0, skill.cd - reduce);
    if (wait > 0) actor.cd[skillId] = wait + 1;
  }

  // 대상 결정
  const foes = foesOf(b, actor);
  const friends = sideOf(b, actor);
  let targets = [];
  switch (skill.target) {
    case 'enemy': {
      let t = foes.find((u) => u.uid === targetUid && alive(u));
      if (!t) t = foes.find(alive);
      if (t) targets = [t];
      break;
    }
    case 'allEnemies': targets = foes.filter(alive); break;
    case 'ally': {
      let t = friends.find((u) => u.uid === targetUid && alive(u));
      if (!t) t = actor;
      targets = [t];
      break;
    }
    case 'fallenAlly': {
      const t = friends.find((u) => u.uid === targetUid && u.fainted) || friends.find((u) => u.fainted);
      if (t) targets = [t];
      break;
    }
    case 'allAllies': targets = friends.filter(alive); break;
    case 'self': targets = [actor]; break;
  }

  switch (skill.kind) {
    case 'attack':
      for (const t of targets) {
        for (let h = 0; h < skill.hits; h++) {
          if (!alive(t)) break;
          const dealt = hitWithSkill(b, run, rng, actor, t, skill, ev);
          if (h === skill.hits - 1 || !alive(t)) applyEffects(b, run, rng, actor, t, skill, ev, dealt);
        }
      }
      break;
    case 'charm':
      for (const t of targets) {
        if (actor.side === 'ally') {
          gainBond(b, run, t, charmAmount(run, actor, t, skill.power), ev, 'charm');
        } else {
          // 적의 매혹: 넋을 잃고 한 턴 멍해질 수 있다
          if (rng.chance(0.45)) {
            applyStatus(t, 'sleep', { turns: 1 }, ev);
            ev.push({ type: 'text', msg: `${t.name}${josa(t.name, '이', '가')} 넋을 잃었다!` });
          } else {
            ev.push({ type: 'resist', uid: t.uid });
          }
        }
        applyEffects(b, run, rng, actor, t, skill, ev, 0);
      }
      break;
    case 'heal':
      for (const t of targets) {
        if (skill.revive) {
          t.fainted = false;
          t.hp = Math.max(1, Math.round(t.maxHp * skill.revive));
          ev.push({ type: 'revive', uid: t.uid, amount: t.hp });
        } else {
          if (skill.cleanse) cleanse(t, ev);
          heal(t, skill.power * (actor.cha / 10), ev);
        }
      }
      break;
    case 'buff':
    case 'debuff':
      for (const t of targets) {
        if (skill.kind === 'debuff' && t.side !== actor.side && t.st.dodge && rng.chance(0.5)) {
          ev.push({ type: 'miss', uid: t.uid });
          continue;
        }
        applyEffects(b, run, rng, actor, t, skill, ev, 0);
      }
      break;
    case 'summon': {
      const lvl = Math.max(1, actor.level - 3);
      const minion = createUnit(skill.summon, lvl, actor.side);
      minion.summoned = true;
      if (actor.side === 'enemy' && livingEnemies(b).length < MAX_ENEMIES) {
        b.enemies.push(minion);
        rollIntent(b, rng, minion);
        ev.push({ type: 'summon', uid: minion.uid });
      }
      break;
    }
    case 'wait':
      ev.push({ type: 'text', msg: `${actor.name}${josa(actor.name, '은', '는')} 얼굴을 붉히며 머뭇거린다…`, uid: actor.uid, shy: true });
      break;
  }
  return ev;
}

function applyEffects(b, run, rng, actor, target, skill, ev) {
  for (const eff of skill.effects) {
    if (eff.chance != null && !rng.chance(eff.chance)) continue;
    let t = target;
    if (eff.on === 'randomAlly') {
      const pool = sideOf(b, actor).filter(alive);
      t = rng.pick(pool);
    }
    if (!alive(t)) continue;
    if (eff.status === 'shield') {
      addShield(t, shieldValue(actor, eff.amount), ev);
    } else {
      applyStatus(t, eff.status, eff, ev, actor);
    }
  }
}

// ── 플레이어 턴 ─────────────────────────────────────────────
export function canAct(b, unit) {
  return b.phase === 'player' && alive(unit) && unit.side === 'ally' && !b.acted.includes(unit.uid) && !unit.st.sleep;
}

export function allyAct(b, run, rng, uid, skillId, targetUid) {
  const actor = findUnit(b, uid);
  if (!canAct(b, actor)) throw new Error('이 유닛은 지금 행동할 수 없습니다');
  if (!usableSkills(b, actor).includes(skillId)) throw new Error('사용할 수 없는 스킬');
  const ev = performSkill(b, run, rng, actor, skillId, targetUid);
  b.acted.push(uid);
  checkEnd(b, ev);
  return ev;
}

/** 등불지기(플레이어)의 행동: 말 걸기 */
export function keeperTalk(b, run, rng, targetUid) {
  if (b.keeperUsed || b.phase !== 'player') throw new Error('이번 턴엔 이미 행동했습니다');
  const t = findUnit(b, targetUid);
  if (!t || t.side !== 'enemy' || !alive(t)) throw new Error('대상이 없습니다');
  const ev = [{ type: 'keeper', action: 'talk', uid: t.uid }];
  let amt = t.bondMax * 0.09 * receptivity(t);
  if (has(run, 'ribbon')) amt *= 1.25;
  gainBond(b, run, t, amt, ev, 'talk');
  b.keeperUsed = true;
  checkEnd(b, ev);
  return ev;
}

/** 등불지기 행동: 아이템 사용 */
export function useItem(b, run, rng, itemId, targetUid) {
  if (b.keeperUsed || b.phase !== 'player') throw new Error('이번 턴엔 이미 행동했습니다');
  if (!(run.items[itemId] > 0)) throw new Error('아이템이 없습니다');
  const item = ITEMS[itemId];
  const ev = [{ type: 'keeper', action: 'item', item: itemId, uid: targetUid }];
  const t = targetUid != null ? findUnit(b, targetUid) : null;

  if (item.gift) {
    if (!t || t.side !== 'enemy' || !alive(t)) throw new Error('선물할 대상이 없습니다');
    const sp = SPECIES[t.species];
    const fav = sp.gift === itemId;
    let frac = fav ? (t.boss ? 0.3 : 0.45) : 0.15;
    if (t.boss && t.hp > t.maxHp * 0.5) frac *= 0.5;
    if (fav) ev.push({ type: 'speech', uid: t.uid, line: sp.lines.gift });
    gainBond(b, run, t, t.bondMax * frac, ev, fav ? 'favorite' : 'gift');
  } else {
    switch (itemId) {
      case 'potion':
        if (!t || !alive(t) || t.side !== 'ally') throw new Error('대상 오류');
        heal(t, Math.max(20, t.maxHp * 0.45), ev);
        break;
      case 'feather':
        if (!t || !t.fainted) throw new Error('쓰러진 아군이 필요합니다');
        t.fainted = false;
        t.hp = Math.round(t.maxHp * 0.5);
        ev.push({ type: 'revive', uid: t.uid, amount: t.hp });
        break;
      case 'elixir':
        for (const a of livingAllies(b)) { cleanse(a, ev); heal(a, a.maxHp * 0.25, ev); }
        break;
      case 'bomb':
        for (const e of livingEnemies(b)) dealRaw(b, run, e, 14 + run.act * 14 + e.maxHp * 0.08, 'bomb', ev);
        break;
      case 'perfume':
        for (const e of livingEnemies(b)) gainBond(b, run, e, e.bondMax * 0.15 * (e.boss && e.hp > e.maxHp * 0.5 ? 0.5 : 1), ev, 'perfume');
        break;
      case 'smoke':
        if (b.kind === 'boss') throw new Error('보스에게서는 도망칠 수 없다!');
        b.phase = 'fled';
        ev.push({ type: 'escape' });
        break;
      default:
        throw new Error('알 수 없는 아이템');
    }
  }
  run.items[itemId]--;
  if (run.items[itemId] <= 0) delete run.items[itemId];
  b.keeperUsed = true;
  checkEnd(b, ev);
  return ev;
}

function checkEnd(b, ev) {
  if (b.phase === 'won' || b.phase === 'lost' || b.phase === 'fled') return;
  // 보스가 사라지면 소환된 권속도 함께 떠난다
  if (b.kind === 'boss' && b.enemies.some((e) => e.boss && e.gone) && !b.enemies.some((e) => e.boss && alive(e))) {
    const minions = livingEnemies(b).filter((e) => e.summoned);
    for (const m of minions) { m.gone = 'left'; ev.push({ type: 'leave', uid: m.uid }); }
    if (minions.length) ev.push({ type: 'text', msg: '주인을 따라 권속들도 흩어졌다.' });
  }
  if (livingEnemies(b).length === 0) {
    b.phase = 'won';
    ev.push({ type: 'won' });
  } else if (livingAllies(b).length === 0) {
    b.phase = 'lost';
    ev.push({ type: 'lost' });
  }
}

export function startPlayerTurn(b, run) {
  b.turn++;
  b.acted = [];
  b.keeperUsed = false;
  const ev = [{ type: 'turn', side: 'ally', turn: b.turn }];
  turnStartTick(b, run, b.allies, ev);
  // 잠든 아군은 자동으로 행동 완료 처리
  for (const a of livingAllies(b)) if (a.st.sleep) b.acted.push(a.uid);
  b.phase = 'player';
  checkEnd(b, ev);
  b.events.push(...ev);
  return ev;
}

/** 플레이어 턴 종료 → 적 턴 진행 → 다음 플레이어 턴 시작. */
export function endPlayerTurn(b, run, rng) {
  if (b.phase !== 'player') throw new Error('플레이어 턴이 아닙니다');
  const ev = [];
  turnEndTick(b.allies);
  b.phase = 'enemy';
  ev.push({ type: 'turn', side: 'enemy', turn: b.turn });
  turnStartTick(b, run, b.enemies, ev);
  checkEnd(b, ev);

  const order = livingEnemies(b).slice().sort((x, y) => y.spd - x.spd);
  for (const e of order) {
    if (b.phase !== 'enemy') break;
    if (!alive(e)) continue;
    if (e.st.sleep) { ev.push({ type: 'sleeping', uid: e.uid }); continue; }
    if (!e.intent) rollIntent(b, rng, e);
    let { skill, target } = e.intent;
    // 대상이 사라졌으면 다시 고른다
    const sk = SKILLS[skill];
    if (sk.target === 'enemy') {
      const t = findUnit(b, target);
      if (!alive(t)) target = pickTarget(b, rng, e)?.uid;
    }
    ev.push(...performSkill(b, run, rng, e, skill, target));
    checkEnd(b, ev);
    // 광폭화: HP 절반 이하의 최종 보스는 한 번 더 행동한다
    if (b.phase === 'enemy' && alive(e) && SPECIES[e.species].frenzy && e.hp <= e.maxHp * 0.5 && !e.st.sleep) {
      if (!e.frenzied) { e.frenzied = true; ev.push({ type: 'text', msg: `${e.name}의 눈이 붉게 빛난다! 달이 차오른다…`, uid: e.uid }); }
      const extra = rollIntent(b, rng, e);
      if (extra.skill !== 'hesitate') ev.push(...performSkill(b, run, rng, e, extra.skill, extra.target));
      checkEnd(b, ev);
    }
  }
  if (b.phase === 'enemy' && b.turn >= TURN_LIMIT) {
    for (const e of livingEnemies(b)) { e.gone = 'left'; ev.push({ type: 'leave', uid: e.uid }); }
    ev.push({ type: 'text', msg: '해가 저물었다… 몬무스들이 하품을 하며 돌아간다.' });
    b.phase = 'won';
    ev.push({ type: 'won' });
    return ev;
  }
  if (b.phase === 'enemy') {
    turnEndTick(b.enemies);
    for (const e of livingEnemies(b)) rollIntent(b, rng, e);
    ev.push(...startPlayerTurn(b, run));
  }
  return ev;
}

// ── 적 AI ──────────────────────────────────────────────────
function pickTarget(b, rng, enemy) {
  const allies = livingAllies(b);
  if (!allies.length) return null;
  const taunters = allies.filter((a) => a.st.taunt);
  if (taunters.length) return rng.pick(taunters);
  if (rng.chance(0.35)) return allies.reduce((m, a) => (a.hp / a.maxHp < m.hp / m.maxHp ? a : m));
  return rng.pick(allies);
}

export function rollIntent(b, rng, enemy) {
  const bondRatio = enemy.bond / enemy.bondMax;
  if (bondRatio >= 0.6 && rng.chance(0.25 + (bondRatio - 0.6))) {
    enemy.intent = { skill: 'hesitate', target: null };
    return enemy.intent;
  }
  const options = [];
  for (const id of usableSkills(b, enemy)) {
    const s = SKILLS[id];
    let w = 1;
    if (s.kind === 'attack') w = s.target === 'allEnemies' ? 2.4 : 3;
    else if (s.kind === 'heal') {
      const hurt = livingEnemies(b).some((x) => x.hp < x.maxHp * 0.6);
      w = hurt ? 2.5 : 0;
    } else if (s.kind === 'buff') {
      const already = s.effects.every((eff) => enemy.st[eff.status]);
      w = already ? 0 : 1.2;
    } else if (s.kind === 'summon') w = enemy.hp < enemy.maxHp * 0.85 ? 2.2 : 0.6;
    else if (s.kind === 'charm') w = 0.7;
    else if (s.kind === 'debuff') w = 1.3;
    if (s.cd >= 2) w *= 1.2; // 큰 기술은 쓸 수 있을 때 쓰자
    if (w > 0) options.push([id, w]);
  }
  const skill = options.length ? rng.weighted(options) : 'struggle';
  const sk = SKILLS[skill];
  let target = null;
  if (sk.target === 'enemy') target = pickTarget(b, rng, enemy)?.uid ?? null;
  if (sk.target === 'ally') {
    const mates = livingEnemies(b);
    target = mates.reduce((m, a) => (a.hp / a.maxHp < m.hp / m.maxHp ? a : m)).uid;
  }
  enemy.intent = { skill, target };
  return enemy.intent;
}

// 받침 유무에 따른 조사 선택
export function josa(word, withBatchim, without) {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return without;
  return (ch - 0xac00) % 28 ? withBatchim : without;
}
