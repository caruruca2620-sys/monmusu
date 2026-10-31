import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { SPECIES, SKILLS, ITEMS, RELICS, STARTERS, ACT_POOLS, elementMultiplier } from '../src/core/data.js';
import { createUnit, xpToNext, gainXp, unlockedSkills } from '../src/core/units.js';
import { generateMap, MAP_ROWS } from '../src/core/map.js';
import {
  createBattle, allyAct, endPlayerTurn, useItem, keeperTalk, usableSkills, livingEnemies, TURN_LIMIT, findUnit,
} from '../src/core/battle.js';
import {
  newRun, serializeRun, deserializeRun, availableNodes, enterNode, finishBattle, joinParty, beginBattle, generateShop, buy,
} from '../src/core/run.js';
import { EVENTS } from '../src/core/events.js';
import { playRun } from '../scripts/simulate.js';
import { portraitSVG } from '../src/ui/portrait.js';

test('같은 시드면 같은 난수열', () => {
  const a = createRng(42); const b = createRng(42);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
  const c = createRng('hello'); const d = createRng('hello');
  assert.equal(c.int(1, 100), d.int(1, 100));
});

test('속성 상성', () => {
  assert.equal(elementMultiplier('fire', 'leaf'), 1.5);
  assert.equal(elementMultiplier('leaf', 'fire'), 0.75);
  assert.equal(elementMultiplier('water', 'fire'), 1.5);
  assert.equal(elementMultiplier('light', 'dark'), 1.5);
  assert.equal(elementMultiplier('dark', 'light'), 1.5);
  assert.equal(elementMultiplier('none', 'fire'), 1);
});

test('데이터 무결성: 스킬·선물·풀 참조가 모두 존재', () => {
  for (const [id, sp] of Object.entries(SPECIES)) {
    for (const s of sp.skills) assert.ok(SKILLS[s], `${id}의 스킬 ${s}`);
    assert.ok(ITEMS[sp.gift]?.gift, `${id}의 선물 ${sp.gift}`);
    for (const k of ['intro', 'join', 'flee', 'gift', 'shy']) assert.ok(sp.lines[k], `${id}.lines.${k}`);
  }
  for (const pool of ACT_POOLS) for (const id of pool) assert.ok(SPECIES[id] && !SPECIES[id].boss);
  for (const s of Object.values(SKILLS)) if (s.summon) assert.ok(SPECIES[s.summon]);
  // 시작 동료는 모두 레벨 4에서 매혹 수단이 있어야 한다
  for (const id of STARTERS) {
    const u = createUnit(id, 4, 'ally');
    assert.ok(unlockedSkills(u).some((s) => SKILLS[s].kind === 'charm'), `${id}는 매혹 스킬이 필요`);
  }
});

test('레벨업으로 능력치가 오른다', () => {
  const u = createUnit('slime', 1, 'ally');
  const hp = u.maxHp;
  const ups = gainXp(u, xpToNext(1) + xpToNext(2));
  assert.equal(ups, 2);
  assert.equal(u.level, 3);
  assert.ok(u.maxHp > hp);
});

test('지도: 모든 칸은 시작에서 닿을 수 있고 보스로 이어진다', () => {
  for (let seed = 0; seed < 60; seed++) {
    const map = generateMap(createRng(seed), 1 + (seed % 3));
    const nodes = map.nodes;
    const starts = Object.values(nodes).filter((n) => n.row === 0);
    assert.ok(starts.length >= 2);
    const reach = new Set();
    const stack = starts.map((n) => n.id);
    while (stack.length) {
      const id = stack.pop();
      if (reach.has(id)) continue;
      reach.add(id);
      stack.push(...nodes[id].next);
    }
    assert.equal(reach.size, Object.keys(nodes).length, `seed ${seed}: 고립된 칸`);
    for (const n of Object.values(nodes)) {
      if (n.id === 'boss') continue;
      assert.ok(n.next.length > 0, `seed ${seed}: 막다른 칸 ${n.id}`);
      for (const nx of n.next) assert.equal(nodes[nx].row, n.row + 1);
      if (n.row === MAP_ROWS - 1) assert.equal(n.type, 'rest');
    }
  }
});

function battleWith(starter, enemySpecies, lvl = 5) {
  const run = newRun(7, starter);
  const enemies = enemySpecies.map((s) => createUnit(s, lvl, 'enemy'));
  const b = createBattle(run, run.rng, enemies, 'normal');
  return { run, b };
}

test('공격하면 HP가 줄고, 스킬 재사용 대기가 지켜진다', () => {
  const { run, b } = battleWith('kitsune', ['golem']);
  const fox = run.party[0];
  const golem = b.enemies[0];
  const hp = golem.hp;
  allyAct(b, run, run.rng, fox.uid, 'fox_fire', golem.uid);
  assert.ok(golem.hp < hp);
  assert.throws(() => allyAct(b, run, run.rng, fox.uid, 'fox_fire', golem.uid), /행동할 수 없/);
  // 환영 분신(cd 2): 쓰고 나면 2턴 동안 못 쓴다
  endPlayerTurn(b, run, run.rng);
  if (b.phase !== 'player') return;
  if (!fox.fainted && !fox.st.sleep) {
    allyAct(b, run, run.rng, fox.uid, 'fox_illusion', fox.uid);
    for (let t = 0; t < 2 && b.phase === 'player'; t++) {
      endPlayerTurn(b, run, run.rng);
      if (b.phase === 'player' && !fox.fainted) assert.ok(!usableSkills(b, fox).includes('fox_illusion'), `턴 +${t + 1}`);
    }
    if (b.phase === 'player') {
      endPlayerTurn(b, run, run.rng);
      if (b.phase === 'player' && !fox.fainted) assert.ok(usableSkills(b, fox).includes('fox_illusion'));
    }
  }
});

test('좋아하는 선물과 매혹으로 친구가 된다', () => {
  const { run, b } = battleWith('kitsune', ['harpy'], 3);
  const harpy = b.enemies[0];
  run.items.honey = 5;
  let guard = 0;
  while (b.phase === 'player' && guard++ < 20) {
    if (run.items.honey) useItem(b, run, run.rng, 'honey', harpy.uid);
    const fox = run.party[0];
    if (b.phase === 'player' && !fox.fainted && !fox.st.sleep && !b.acted.includes(fox.uid)) {
      allyAct(b, run, run.rng, fox.uid, 'fox_bewitch', harpy.uid);
    }
    if (b.phase === 'player') endPlayerTurn(b, run, run.rng);
  }
  assert.equal(b.phase, 'won');
  assert.equal(b.befriended.length, 1);
  const res = finishBattle(run, b);
  assert.equal(res.recruits.length, 1);
  joinParty(run, res.recruits[0]);
  assert.equal(run.party.length, 2);
  assert.equal(run.party[1].side, 'ally');
});

test('말 걸기는 한 턴에 한 번', () => {
  const { run, b } = battleWith('slime', ['mandrake']);
  keeperTalk(b, run, run.rng, b.enemies[0].uid);
  assert.ok(b.enemies[0].bond > 0);
  assert.throws(() => keeperTalk(b, run, run.rng, b.enemies[0].uid));
});

test('끝나지 않는 전투는 해가 지면 끝난다', () => {
  const { run, b } = battleWith('mandrake', ['slime'], 1);
  run.party[0].hp = run.party[0].maxHp = 99999;
  b.enemies[0].hp = b.enemies[0].maxHp = 99999;
  let guard = 0;
  while (b.phase === 'player' && guard++ < TURN_LIMIT + 5) endPlayerTurn(b, run, run.rng);
  assert.equal(b.phase, 'won');
  assert.ok(b.turn <= TURN_LIMIT);
});

test('보스를 친구로 만들면 소환된 권속도 떠난다', () => {
  const run = newRun(3, 'kitsune');
  run.party[0].hp = run.party[0].maxHp = 99999;
  const b = beginBattle(run, 'boss');
  const boss = b.enemies[0];
  const minion = createUnit('mandrake', 3, 'enemy');
  minion.summoned = true;
  b.enemies.push(minion);
  boss.hp = Math.floor(boss.maxHp * 0.3);
  boss.bond = boss.bondMax - 1;
  keeperTalk(b, run, run.rng, boss.uid);
  assert.equal(boss.gone, 'friend');
  assert.equal(minion.gone, 'left');
  assert.equal(b.phase, 'won');
});

test('저장 후 불러오면 같은 미래가 펼쳐진다', () => {
  const run = newRun(1234, 'slime');
  const json = serializeRun(run);
  const copy = deserializeRun(json);
  const a = availableNodes(run)[0].id;
  const r1 = enterNode(run, a);
  const r2 = enterNode(copy, a);
  assert.equal(r1.type, r2.type);
  if (r1.type === 'battle') {
    assert.deepEqual(r1.battle.enemies.map((e) => [e.species, e.level]), r2.battle.enemies.map((e) => [e.species, e.level]));
  }
  assert.equal(run.rng.next(), copy.rng.next());
});

test('상점: 골드가 부족하면 살 수 없다', () => {
  const run = newRun(5, 'kitsune');
  const shop = generateShop(run);
  run.gold = 0;
  assert.throws(() => buy(run, shop, 0), /골드/);
  run.gold = 999;
  buy(run, shop, 0);
  assert.ok(run.items[shop.goods[0].id] >= 1);
});

test('모든 이벤트 선택지가 예외 없이 실행된다', () => {
  for (const ev of EVENTS) {
    ev.choices.forEach((c, i) => {
      for (let s = 0; s < 4; s++) {
        const run = newRun(100 + s, 'kitsune');
        run.act = ev.acts[0];
        run.gold = 500;
        for (const k of Object.keys(ITEMS)) run.items[k] = 2;
        if (c.req) assert.ok(c.req(run), `${ev.id}#${i} 조건`);
        const out = c.run(run);
        assert.ok(out && typeof out.text === 'string' && out.text.length > 0, `${ev.id}#${i}`);
        assert.ok(!out.text.includes('undefined') && !out.text.includes('NaN'), `${ev.id}#${i}: ${out.text}`);
        if (out.battle) assert.ok(out.battle.enemies.length > 0);
        if (out.recruit) assert.equal(out.recruit.side, 'ally');
      }
    });
  }
});

test('초상화: 모든 종족·표정이 깨끗한 SVG를 만든다', () => {
  for (const id of Object.keys(SPECIES)) {
    for (const e of ['normal', 'happy', 'hurt', 'shy', 'love', 'sleep', 'angry']) {
      const svg = portraitSVG(id, e);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.ok(!/undefined|NaN/.test(svg), `${id}/${e}`);
      const opens = (svg.match(/<g[\s>]/g) || []).length;
      const closes = (svg.match(/<\/g>/g) || []).length;
      assert.equal(opens, closes, `${id}/${e} <g> 짝`);
    }
  }
});

test('부적 설명이 모두 있다', () => {
  for (const r of Object.values(RELICS)) assert.ok(r.name && r.desc && r.icon);
});

test('자동 플레이 40판이 오류 없이 끝난다', () => {
  let wins = 0;
  for (let i = 0; i < 40; i++) {
    const r = playRun(9000 + i, STARTERS[i % 3]);
    assert.ok(['win', 'true', 'lose'].includes(r.result));
    if (r.result !== 'lose') wins++;
  }
  // 너무 쉽거나 불가능하지 않은지 대략 확인
  assert.ok(wins >= 2 && wins <= 32, `클리어 ${wins}/40`);
});

test('전투 중 적 수는 최대 4', () => {
  const run = newRun(77, 'golem' in SPECIES ? 'slime' : 'slime');
  run.party[0].hp = run.party[0].maxHp = 99999;
  run.act = 3;
  const b = beginBattle(run, 'boss');
  let guard = 0;
  while (b.phase === 'player' && guard++ < 25) {
    endPlayerTurn(b, run, run.rng);
    assert.ok(livingEnemies(b).length <= 4);
  }
  assert.ok(findUnit(b, b.enemies[0].uid));
});

test('인연 효과: 짝이 모두 있으면 전투 시작 효과가 걸린다', async () => {
  const { activeSynergies, SYNERGIES, pickBanter } = await import('../src/core/banter.js');
  const { makeRecruit } = await import('../src/core/run.js');
  for (const syn of SYNERGIES) for (const m of syn.members) assert.ok(SPECIES[m], `${syn.id}: ${m}`);
  const run = newRun(11, 'slime');
  assert.equal(activeSynergies(run.party).length, 0);
  run.party.push(makeRecruit(run, 'mandrake', 4));
  assert.deepEqual(activeSynergies(run.party).map((s) => s.id), ['water_plant']);
  const b = beginBattle(run, 'normal');
  assert.ok(run.party.every((u) => u.st.regen), '재생이 걸려야 한다');
  assert.ok(b.events.some((e) => e.type === 'synergy'));
  // 기절한 동료는 인연에 포함되지 않는다
  run.party[1].fainted = true;
  assert.equal(activeSynergies(run.party).length, 0);
  // 수다는 언제나 파티원의 말이다
  run.party[1].fainted = false;
  for (let f = 0; f < 12; f++) {
    run.floor = f;
    const lines = pickBanter(run);
    assert.ok(lines.length >= 1);
    for (const l of lines) assert.ok(run.party.some((u) => u.uid === l.uid) && l.line);
  }
});
