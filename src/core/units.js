import { SPECIES, SKILLS } from './data.js';

let uidCounter = 1;
export function resetUids(n = 1) { uidCounter = n; }
export function nextUid() { return uidCounter++; }

// 스킬 해금 레벨: 1, 1, 3, 5, 8
export const SKILL_UNLOCK = [1, 1, 3, 5, 8];

export function unlockedSkills(unit) {
  const sp = SPECIES[unit.species];
  return sp.skills.filter((_, i) => unit.level >= SKILL_UNLOCK[Math.min(i, SKILL_UNLOCK.length - 1)]);
}

export function xpToNext(level) {
  return 10 + level * 7;
}

function rawStat(sp, key, level) {
  return sp.base[key] + sp.grow[key] * (level - 1);
}

/**
 * 종족과 레벨로 유닛을 만든다.
 * side: 'ally' | 'enemy'
 */
export function createUnit(speciesId, level, side = 'enemy', opts = {}) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error(`unknown species ${speciesId}`);
  const unit = {
    uid: nextUid(),
    species: speciesId,
    name: opts.name || sp.given,
    level,
    xp: 0,
    element: sp.element,
    side,
    boss: !!sp.boss,
    elite: !!opts.elite,
    maxHp: 1, hp: 1, atk: 1, def: 1, cha: 1, spd: 1,
    cd: {},
    st: {},
    bond: 0,
    bondMax: 1,
    fainted: false,
    intent: null,
    joinedAt: opts.joinedAt ?? null,
  };
  refreshStats(unit, opts.relics || []);
  unit.hp = unit.maxHp;
  return unit;
}

/** 레벨/부적 변경 후 능력치를 다시 계산 (HP 비율 유지). */
export function refreshStats(unit, relics = []) {
  const sp = SPECIES[unit.species];
  const ratio = unit.maxHp > 1 ? unit.hp / unit.maxHp : 1;
  const eliteMul = unit.elite ? 1.35 : 1;
  let maxHp = rawStat(sp, 'hp', unit.level) * eliteMul;
  // 보스가 동료가 되면 '보스 보정'이 사라진다 (여전히 든든하다)
  if (unit.boss && unit.side === 'ally') maxHp *= 0.42;
  if (unit.side === 'ally' && relics.includes('acorn')) maxHp *= 1.12;
  unit.maxHp = Math.round(maxHp);
  unit.atk = Math.round(rawStat(sp, 'atk', unit.level) * (unit.elite ? 1.12 : 1));
  unit.def = Math.round(rawStat(sp, 'def', unit.level) * (unit.elite ? 1.1 : 1));
  unit.cha = Math.round(rawStat(sp, 'cha', unit.level));
  unit.spd = Math.round(rawStat(sp, 'spd', unit.level));
  // 호감도 최대치는 자신의 매력에 비례 → 레벨이 올라도 균형 유지
  unit.bondMax = Math.round(sp.bond * 1.5 * (unit.cha / sp.base.cha) * (unit.elite ? 1.3 : 1));
  if (!unit.fainted) unit.hp = Math.max(1, Math.round(unit.maxHp * ratio));
  else unit.hp = 0;
}

export function skillById(id) {
  const s = SKILLS[id];
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}

/** 경험치를 주고, 레벨업 횟수를 반환 */
export function gainXp(unit, amount, relics = []) {
  if (unit.fainted) return 0;
  unit.xp += amount;
  let ups = 0;
  while (unit.xp >= xpToNext(unit.level)) {
    unit.xp -= xpToNext(unit.level);
    levelUp(unit, relics);
    ups++;
  }
  return ups;
}

export function levelUp(unit, relics = []) {
  const before = unit.maxHp;
  unit.level += 1;
  refreshStats(unit, relics);
  // 레벨업 시 늘어난 최대 HP만큼 회복
  if (!unit.fainted) unit.hp = Math.min(unit.maxHp, unit.hp + (unit.maxHp - before));
}
