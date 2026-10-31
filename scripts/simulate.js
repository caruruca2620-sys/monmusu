// 헤드리스 자동 플레이로 밸런스를 점검한다.
//   node scripts/simulate.js [판 수] [--verbose]
import { STARTERS, SPECIES } from '../src/core/data.js';
import {
  newRun, availableNodes, enterNode, finishBattle, joinParty, declineRecruit,
  restHeal, restTrain, buy, gainRelic, advanceAct, isPartyWiped, beginBattle,
} from '../src/core/run.js';
import { endPlayerTurn } from '../src/core/battle.js';
import { autoTurn, befriendTarget } from '../src/core/ai.js';
import { pickEvent } from '../src/core/events.js';

export function playRun(seed, starter, { log = () => {}, friendly = true } = {}) {
  const run = newRun(seed, starter);
  const rng = run.rng;
  const info = { seed, starter, result: null, act: 1, floor: 0, recruits: 0, bossFriends: 0, maxLevel: 0 };

  const handleRecruits = (recruits) => {
    for (const r of recruits) {
      if (run.party.length < run.maxParty) { joinParty(run, r); info.recruits++; continue; }
      const weakest = run.party.reduce((m, u) => (u.level < m.level ? u : m));
      if (r.level > weakest.level || SPECIES[r.species].boss) { joinParty(run, r, weakest.uid); info.recruits++; } else declineRecruit(run, r);
    }
  };

  const fight = (battle) => {
    let guard = 0;
    const wantFriends = friendly && (run.party.length < run.maxParty || battle.kind === 'boss');
    while (battle.phase === 'player') {
      const ft = befriendTarget(battle, run, wantFriends);
      autoTurn(battle, run, rng, { friendTarget: ft });
      if (battle.phase === 'player') endPlayerTurn(battle, run, rng);
      if (++guard > 200) { if (process.env.DBG) console.log(JSON.stringify([...battle.allies, ...battle.enemies].map((u) => [u.name, u.level, u.hp, u.maxHp, u.st, u.gone, u.fainted]))); throw new Error(`battle did not end (seed ${seed})`); }
    }
    const res = finishBattle(run, battle);
    if (battle.phase === 'lost') return false;
    if (res.relicChoices.length) gainRelic(run, res.relicChoices[0]);
    handleRecruits(res.recruits);
    if (battle.kind === 'boss' && battle.befriended.length) info.bossFriends++;
    return battle;
  };

  while (!run.over) {
    const opts = availableNodes(run);
    const avgHp = run.party.reduce((a, u) => a + (u.fainted ? 0 : u.hp / u.maxHp), 0) / run.party.length;
    const pref = (n) => {
      if (n.type === 'rest') return avgHp < 0.6 ? 10 : 1;
      if (n.type === 'elite') return avgHp > 0.75 ? 4 : 0.2;
      if (n.type === 'shop') return run.gold > 90 ? 5 : 0.5;
      if (n.type === 'event') return 3;
      return 2;
    };
    const node = opts.reduce((m, n) => (pref(n) + rng.next() > pref(m) + rng.next() ? n : m));
    const res = enterNode(run, node.id);
    info.floor++;
    log(`[막${run.act}] ${node.type} (Lv ${run.party.map((u) => `${u.name}${u.level}`).join(',')} ${run.gold}G)`);
    if (res.type === 'battle') {
      const b = fight(res.battle);
      if (!b) { run.over = 'lose'; break; }
      if (node.type === 'boss') {
        const r = advanceAct(run, b.befriended.some((e) => e.boss));
        if (r.ending) break;
      }
    } else if (res.type === 'rest') {
      const avg = run.party.reduce((a, u) => a + (u.fainted ? 0 : u.hp / u.maxHp), 0) / run.party.length;
      if (avg < 0.7 || run.party.some((u) => u.fainted)) restHeal(run);
      else restTrain(run, run.party.reduce((m, u) => (u.level < m.level ? u : m)).uid);
    } else if (res.type === 'shop') {
      const shop = res.shop;
      shop.goods.forEach((g, i) => {
        if (g.kind === 'relic' && run.gold >= g.price) buy(run, shop, i);
      });
      shop.goods.forEach((g, i) => {
        if (g.kind === 'item' && ['potion', 'feather'].includes(g.id) && run.gold >= g.price + 10) buy(run, shop, i);
      });
    } else if (res.type === 'treasure') {
      if (res.loot.relicChoices.length) gainRelic(run, res.loot.relicChoices[0]);
    } else if (res.type === 'event') {
      const ev = pickEvent(run);
      const choices = ev.choices.filter((c) => !c.req || c.req(run));
      const recruitFirst = choices.find((c) => c.req) || rng.pick(choices);
      const out = recruitFirst.run(run);
      if (out.recruit) handleRecruits([out.recruit]);
      if (out.battle) {
        const b = fight(beginBattle(run, out.battle.kind, out.battle.enemies));
        if (!b) { run.over = 'lose'; break; }
      }
    }
    if (isPartyWiped(run)) { run.over = 'lose'; break; }
  }
  info.result = run.over;
  info.act = run.act;
  info.maxLevel = Math.max(...run.party.map((u) => u.level));
  info.party = run.party.map((u) => `${SPECIES[u.species].name}${u.level}`).join(' ');
  info.relics = run.relics.length;
  return info;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const n = Number(process.argv[2]) || 300;
  const verbose = process.argv.includes('--verbose');
  const friendly = !process.argv.includes('--hostile');
  const results = [];
  for (let i = 0; i < n; i++) {
    const starter = STARTERS[i % STARTERS.length];
    results.push(playRun(1000 + i, starter, { friendly, log: verbose ? console.log : () => {} }));
  }
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  const wins = results.filter((r) => r.result === 'win' || r.result === 'true');
  const trueEnd = results.filter((r) => r.result === 'true');
  const byAct = [1, 2, 3].map((a) => results.filter((r) => r.result === 'lose' && r.act === a).length);
  console.log(`판 수: ${n}`);
  console.log(`클리어: ${pct(wins.length)} (진엔딩 ${pct(trueEnd.length)})`);
  console.log(`패배 위치: 1막 ${pct(byAct[0])} / 2막 ${pct(byAct[1])} / 3막 ${pct(byAct[2])}`);
  console.log(`평균 영입: ${(results.reduce((a, r) => a + r.recruits, 0) / n).toFixed(2)}, 보스 친구: ${(results.reduce((a, r) => a + r.bossFriends, 0) / n).toFixed(2)}`);
  console.log(`평균 최고 레벨: ${(results.reduce((a, r) => a + r.maxLevel, 0) / n).toFixed(1)}`);
  for (const s of STARTERS) {
    const rs = results.filter((r) => r.starter === s);
    console.log(`  ${SPECIES[s].name}: 클리어 ${((rs.filter((r) => r.result !== 'lose').length / rs.length) * 100).toFixed(0)}%`);
  }
  if (verbose) console.log(results.slice(0, 5));
}
