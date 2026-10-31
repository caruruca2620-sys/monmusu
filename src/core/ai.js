// 간단한 자동 플레이 AI.
// 1) 시뮬레이터에서 밸런스 검증용으로, 2) 게임 안의 '자동 전투' 버튼으로 쓰인다.
import { SKILLS, SPECIES, ITEMS } from './data.js';
import {
  alive, livingAllies, livingEnemies, usableSkills, validTargets, canAct,
  allyAct, keeperTalk, useItem, calcDamage, needsTarget,
} from './battle.js';

/** 친구로 삼을 적을 고른다 (파티에 없는 종족, 호감도 높은 순). */
export function befriendTarget(b, run, wantFriends) {
  if (!wantFriends) return null;
  const enemies = livingEnemies(b);
  const owned = new Set(run.party.map((u) => u.species));
  const cands = enemies.filter((e) => !owned.has(e.species) || e.boss);
  if (!cands.length) return null;
  return cands.reduce((m, e) => (e.bond / e.bondMax > m.bond / m.bondMax ? e : m));
}

function lowestHp(units) {
  return units.reduce((m, u) => (u.hp / u.maxHp < m.hp / m.maxHp ? u : m));
}

/** 한 아군의 행동을 정한다: { skill, target } */
export function chooseAllyAction(b, run, unit, opts = {}) {
  const skills = usableSkills(b, unit).map((id) => SKILLS[id]);
  const allies = livingAllies(b);
  const enemies = livingEnemies(b);
  let friendT = opts.friendTarget && alive(opts.friendTarget) ? opts.friendTarget : null;
  // 보스는 마음의 벽이 있으니 HP를 절반까지 깎은 뒤에 매혹한다
  if (friendT && friendT.boss && friendT.hp > friendT.maxHp * 0.5) friendT = null;
  const hurt = lowestHp(allies);
  let best = null;
  let bestScore = -Infinity;

  for (const s of skills) {
    let score = 0;
    let target = null;
    switch (s.kind) {
      case 'heal':
        if (s.target === 'fallenAlly') { score = 90; target = b.allies.find((u) => u.fainted)?.uid; break; }
        if (s.target === 'allAllies') {
          const missing = allies.reduce((a, u) => a + (1 - u.hp / u.maxHp), 0);
          score = Math.max(0, missing - 0.3 * allies.length) * 90;
        } else {
          target = hurt.uid;
          score = Math.max(0, 1 - hurt.hp / hurt.maxHp - 0.25) * 140;
          if (s.target === 'self') { target = unit.uid; score = Math.max(0, 1 - unit.hp / unit.maxHp - 0.3) * 110 + (unit.st.poison || unit.st.burn ? 10 : 0); }
        }
        break;
      case 'charm':
        if (!friendT) { score = -1; break; }
        target = friendT.uid;
        score = 40 + s.power;
        if (s.target === 'allEnemies') score = 30 + s.power * enemies.length * 0.8;
        break;
      case 'attack': {
        const pool = enemies.filter((e) => e !== friendT);
        if (!pool.length) { score = -5; break; }
        const est = (e) => calcDamage(unit, e, s, run, null, { noRandom: true }).dmg * s.hits;
        if (s.target === 'allEnemies') {
          score = pool.reduce((a, e) => a + Math.min(e.hp, est(e)), 0) * 1.0;
          if (friendT) score -= est(friendT) * 1.5;
        } else {
          // 쓰러뜨릴 수 있는 적을 우선
          let tBest = null; let tScore = -Infinity;
          for (const e of pool) {
            const d = est(e);
            const sc = Math.min(e.hp, d) + (d >= e.hp ? 15 : 0) + (e.intent && SKILLS[e.intent.skill]?.kind === 'attack' ? 3 : 0);
            if (sc > tScore) { tScore = sc; tBest = e; }
          }
          target = tBest.uid; score = tScore;
        }
        score = score * 1.2 + 4;
        break;
      }
      case 'buff': {
        const tgt = s.target === 'ally' ? hurt : unit;
        const fresh = s.effects.some((eff) => !(tgt.st[eff.status]));
        score = fresh ? 14 + (s.target === 'allAllies' ? allies.length * 5 : 0) : 0;
        if (s.effects.some((e) => e.status === 'taunt') && allies.length > 1) score += 6;
        target = tgt.uid;
        break;
      }
      case 'debuff':
        score = 12 + (s.target === 'allEnemies' ? enemies.length * 6 : 4);
        target = (friendT && enemies.find((e) => e !== friendT)) ? enemies.find((e) => e !== friendT).uid : enemies[0]?.uid;
        break;
      default: score = 0;
    }
    if (needsTarget(s) && target == null) continue;
    if (score > bestScore) { bestScore = score; best = { skill: s.id, target }; }
  }
  if (!best) best = { skill: skills[0]?.id || 'struggle', target: validTargets(b, unit, SKILLS[skills[0]?.id || 'struggle'])[0]?.uid };
  return best;
}

/** 등불지기 행동. 실행하면 events, 아무것도 안 하면 null */
export function keeperAct(b, run, rng, opts = {}) {
  if (b.keeperUsed) return null;
  const allies = livingAllies(b);
  const fallen = b.allies.find((u) => u.fainted);
  if (fallen && run.items.feather && (allies.length <= 1 || b.kind !== 'normal')) return useItem(b, run, rng, 'feather', fallen.uid);
  const hurt = allies.length ? lowestHp(allies) : null;
  if (hurt && hurt.hp / hurt.maxHp < 0.3 && run.items.potion) return useItem(b, run, rng, 'potion', hurt.uid);
  if (allies.length >= 2 && allies.filter((u) => u.hp / u.maxHp < 0.45).length >= 2 && run.items.elixir) return useItem(b, run, rng, 'elixir');
  const ft = opts.friendTarget;
  if (ft && alive(ft) && !(ft.boss && ft.hp > ft.maxHp * 0.5)) {
    const fav = SPECIES[ft.species].gift;
    if (run.items[fav] && (!ft.boss || ft.hp <= ft.maxHp * 0.5)) return useItem(b, run, rng, fav, ft.uid);
    return keeperTalk(b, run, rng, ft.uid);
  }
  if (b.kind !== 'normal' && run.items.bomb && livingEnemies(b).length >= 2) return useItem(b, run, rng, 'bomb');
  return null;
}

/** 현재 플레이어 턴의 남은 행동을 모두 자동으로 처리 */
export function autoTurn(b, run, rng, opts = {}) {
  const ev = [];
  const k = keeperAct(b, run, rng, opts);
  if (k) ev.push(...k);
  for (const u of b.allies) {
    if (b.phase !== 'player') break;
    if (!canAct(b, u)) continue;
    const ft = opts.friendTarget && alive(opts.friendTarget) ? opts.friendTarget : null;
    const act = chooseAllyAction(b, run, u, { ...opts, friendTarget: ft });
    ev.push(...allyAct(b, run, rng, u.uid, act.skill, act.target));
  }
  return ev;
}

export { ITEMS };
