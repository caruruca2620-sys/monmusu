// 지도 위 ❓ 칸에서 일어나는 이야기들
import { ITEMS, RELICS, SPECIES } from './data.js';
import { createUnit, gainXp, xpToNext } from './units.js';
import { addGold, gainRelic, relicChoices, partyLevel, makeRecruit } from './run.js';

const living = (run) => run.party.filter((u) => !u.fainted);
const addItem = (run, id, n = 1) => { run.items[id] = (run.items[id] || 0) + n; return `${ITEMS[id].icon} ${ITEMS[id].name} ×${n} 획득`; };
const hasItem = (run, id) => run.items[id] > 0;
const takeItem = (run, id) => { run.items[id]--; if (run.items[id] <= 0) delete run.items[id]; };

function healAll(run, frac) {
  for (const u of living(run)) u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * frac));
}
function hurtAll(run, frac) {
  for (const u of living(run)) u.hp = Math.max(1, u.hp - Math.round(u.maxHp * frac));
}
function reviveAll(run, frac) {
  for (const u of run.party) if (u.fainted) { u.fainted = false; u.hp = Math.max(1, Math.round(u.maxHp * frac)); }
}
function xpAll(run, amount) {
  const ups = [];
  for (const u of living(run)) {
    const before = u.level;
    if (gainXp(u, amount, run.relics)) ups.push(`${u.name} Lv.${before}→${u.level}`);
  }
  return ups.length ? ` (${ups.join(', ')})` : '';
}
function recruitOf(run, species) {
  return makeRecruit(run, species, Math.max(2, partyLevel(run)));
}
function eliteOf(run, species, bonus = 2) {
  return [createUnit(species, partyLevel(run) + bonus, 'enemy', { elite: true })];
}

export const EVENTS = [
  {
    id: 'shrine', title: '이끼 낀 신사', art: '⛩️', acts: [1, 2, 3],
    text: '오래된 신사가 숲속에 숨어 있다. 새전함 위에 작은 여우 석상이 이쪽을 바라본다.',
    choices: [
      {
        label: '두 손 모아 기도한다',
        run(run) {
          if (run.rng.chance(0.6)) { healAll(run, 0.35); return { text: '따스한 바람이 불어온다. 모두의 상처가 아물었다. (HP 35% 회복)' }; }
          hurtAll(run, 0.1);
          return { text: '석상의 눈이 반짝… 하더니 아무 일도 없었다. 괜히 오싹해서 모두 지쳤다. (HP 10% 감소)' };
        },
      },
      {
        label: '새전함에 20G를 넣는다', req: (run) => run.gold >= 20,
        run(run) {
          run.gold -= 20;
          const r = relicChoices(run, ['common'], 1)[0];
          if (!r) return { text: '방울이 딸랑 울렸다. 마음이 편안해진다.' + xpAll(run, 10) };
          gainRelic(run, r);
          return { text: `석상의 입에서 무언가 툭 떨어졌다! ${RELICS[r].icon} ${RELICS[r].name} 획득` };
        },
      },
      { label: '조용히 지나간다', run: () => ({ text: '뒤에서 "켄!" 하는 소리가 들린 것 같다.' }) },
    ],
  },
  {
    id: 'baby_harpy', title: '둥지에서 떨어진 아기 새', art: '🪺', acts: [1, 2],
    text: '나무 아래에서 깃털 뭉치가 삐약거린다. 아기 하피다! 저 위에서 엄마를 닮은 하피가 걱정스레 내려다본다.',
    choices: [
      {
        label: '나무를 타고 둥지에 올려준다',
        run(run) {
          hurtAll(run, 0.12);
          return { text: '긁히고 넘어졌지만 무사히 돌려보냈다. 엄마 하피가 꿀을 잔뜩 던져준다! ' + addItem(run, 'honey', 2) + ' (HP 12% 감소)' };
        },
      },
      {
        label: '🍯 꿀단지를 나눠준다', req: (run) => hasItem(run, 'honey'),
        run(run) {
          takeItem(run, 'honey');
          return { text: '꿀을 핥아먹은 아기 새가 쑥 자랐다…? 아니, 언니였다! "고마워! 은혜는 갚을게!"', recruit: recruitOf(run, 'harpy') };
        },
      },
      { label: '못 본 척한다', run: () => ({ text: '삐약 소리가 한참 귓가에 맴돌았다.' }) },
    ],
  },
  {
    id: 'mushroom', title: '빛나는 버섯 군락', art: '🍄', acts: [1, 2, 3],
    text: '반딧불처럼 빛나는 버섯들이 둥글게 자라 있다. 빨간 것, 파란 것… 맛있어 보인다.',
    choices: [
      {
        label: '빨간 버섯을 동료에게 먹인다',
        run(run) {
          const u = run.rng.pick(living(run));
          if (!u) return { text: '먹을 동료가 없다…' };
          if (run.rng.chance(0.55)) {
            const before = u.level;
            gainXp(u, xpToNext(u.level) - u.xp, run.relics);
            return { text: `${u.name}의 몸이 번쩍 빛났다! Lv.${before} → Lv.${u.level}` };
          }
          u.hp = Math.max(1, u.hp - Math.round(u.maxHp * 0.3));
          return { text: `${u.name}의 얼굴이 초록색이 되었다… (HP 30% 감소)` };
        },
      },
      { label: '파란 버섯을 챙긴다', run: (run) => ({ text: '약효가 있어 보인다. ' + addItem(run, 'potion') }) },
      { label: '그냥 간다', run: () => ({ text: '버섯들이 아쉬운 듯 깜빡거렸다.' }) },
    ],
  },
  {
    id: 'hotspring', title: '숲속 노천온천', art: '♨️', acts: [1, 2, 3],
    text: '김이 모락모락 피어오르는 온천을 발견했다. 원숭이 한 마리가 수건을 머리에 얹고 있다.',
    choices: [
      { label: '다 같이 몸을 담근다', run(run) { healAll(run, 1); return { text: '으아아… 천국이다. 모두의 HP가 가득 찼다!' }; } },
      { label: '온천 달걀을 삶아 판다', run(run) { const g = addGold(run, 30 + run.act * 10); return { text: `지나가던 여행자들에게 날개 돋친 듯 팔렸다! ${g}G 획득` }; } },
    ],
  },
  {
    id: 'moonlake', title: '달빛 호수의 노래', art: '🌊', acts: [1, 2, 3],
    text: '♪ 고요한 호수 위로 노랫소리가 번진다. 바위 위에 앉은 인어가 눈을 감고 노래하고 있다.',
    choices: [
      { label: '노래를 끝까지 듣는다', run(run) { reviveAll(run, 0.3); healAll(run, 0.3); return { text: '노래가 마음속 깊이 스며든다. 쓰러졌던 동료도 눈을 떴다. (부활 + HP 30% 회복)' }; } },
      {
        label: '🐚 조개껍질을 선물한다', req: (run) => hasItem(run, 'shell'),
        run(run) {
          takeItem(run, 'shell');
          return { text: '"바다의 소리…! 이걸 들려준 사람은 네가 처음이야." 인어가 물결을 타고 다가왔다.', recruit: recruitOf(run, 'mermaid') };
        },
      },
      { label: '박수를 친다', run: (run) => ({ text: '인어가 깜짝 놀라 물속으로 숨었다. 대신 진주알 몇 개가 떠올랐다. ' + `${addGold(run, 20)}G 획득` }) },
    ],
  },
  {
    id: 'talking_chest', title: '말하는 보물상자', art: '🧰', acts: [1, 2, 3],
    text: '길 한복판에 금테 두른 보물상자가 있다. 다가가자 안에서 "…크흡" 하고 숨 참는 소리가 들린다.',
    choices: [
      {
        label: '힘껏 연다',
        run(run) {
          if (run.rng.chance(0.5)) {
            const g = addGold(run, 50 + run.act * 15);
            return { text: `진짜 보물이었다! ${g}G 획득. …아까 그 소리는 뭐였지?` };
          }
          return { text: '"꺄악! 열지 말랬잖아!" 상자가 덥석 물어온다!', battle: { enemies: eliteOf(run, 'mimic', 1), kind: 'elite' } };
        },
      },
      {
        label: '똑똑, 노크한다',
        run(run) {
          return { text: '"…누구세요?" 수줍은 목소리와 함께 뚜껑이 살짝 열리더니, 반짝이는 것을 하나 내밀었다. ' + addItem(run, 'gem') };
        },
      },
      {
        label: '💎 보석을 넣어준다', req: (run) => hasItem(run, 'gem'),
        run(run) {
          takeItem(run, 'gem');
          return { text: '"이, 이건…! 너 좋은 사람이구나!" 뚜껑이 활짝 열리며 소녀가 튀어나왔다.', recruit: recruitOf(run, 'mimic') };
        },
      },
    ],
  },
  {
    id: 'lost_head', title: '굴러다니는 투구', art: '⛑️', acts: [2, 3],
    text: '투구를 쓴 머리 하나가 데굴데굴 굴러와 발치에서 멈췄다. "실례한다. 내 몸을… 보지 못했나?"',
    choices: [
      {
        label: '몸을 함께 찾아준다',
        run(run) {
          hurtAll(run, 0.15);
          return { text: '해질녘까지 숲을 헤맨 끝에 머리 없는 갑옷을 찾았다! "이 은혜, 기사의 이름으로 갚겠다!" (HP 15% 감소)', recruit: recruitOf(run, 'dullahan') };
        },
      },
      {
        label: '푹신해 보인다. 베개로 쓴다',
        run(run) {
          healAll(run, 0.25);
          return { text: '잠시 꿀잠을 잤다. (HP 25% 회복) …눈을 뜨자, 머리를 되찾은 기사가 칼을 뽑고 있다!', battle: { enemies: eliteOf(run, 'dullahan', 1), kind: 'elite' } };
        },
      },
      { label: '길을 알려주고 떠난다', run: (run) => ({ text: '"고맙다! 언젠가 차라도 대접하지." ' + addItem(run, 'tea') }) },
    ],
  },
  {
    id: 'fox_wedding', title: '여우비 내리는 날', art: '🌦️', acts: [1, 2],
    text: '해가 쨍쨍한데 비가 내린다. 숲 저편에서 등불을 든 여우들의 혼례 행렬이 지나간다.',
    choices: [
      { label: '몰래 구경한다', run: (run) => ({ text: '행렬 끝의 꼬마 여우가 몰래 무언가를 쥐여줬다. ' + addItem(run, 'tofu', 2) }) },
      { label: '축하의 노래를 부른다', run: (run) => ({ text: '여우들이 꼬리를 흔들며 축복을 내렸다.' + xpAll(run, 12 + run.act * 10) + ' (경험치 획득)' }) },
      {
        label: '🥟 유부를 축의금으로 낸다', req: (run) => hasItem(run, 'tofu'),
        run(run) {
          takeItem(run, 'tofu');
          return { text: '"유부라니, 센스 있는 인간이네!" 들러리 여우 한 명이 행렬에서 빠져나왔다.', recruit: recruitOf(run, 'kitsune') };
        },
      },
    ],
  },
  {
    id: 'ruin_altar', title: '고대 유적의 제단', art: '🗿', acts: [2, 3],
    text: '룬 문자가 새겨진 제단이 희미하게 빛난다. 제단 옆에는 돌로 된 소녀가 무릎을 꿇고 잠들어 있다.',
    choices: [
      { label: '힘을 구한다 (HP를 바친다)', run(run) { hurtAll(run, 0.25); return { text: '룬이 붉게 타올랐다! 힘이 솟는다.' + xpAll(run, 20 + run.act * 12) + ' (HP 25% 감소)' }; } },
      {
        label: '💐 들꽃을 바친다', req: (run) => hasItem(run, 'flower'),
        run(run) {
          takeItem(run, 'flower');
          return { text: '돌 소녀의 눈에 푸른빛이 켜졌다. "……꽃. ……따뜻함. ……따라간다."', recruit: recruitOf(run, 'golem') };
        },
      },
      {
        label: '제단을 조사한다',
        run(run) {
          const r = relicChoices(run, ['uncommon'], 1)[0];
          if (r && run.rng.chance(0.5)) { gainRelic(run, r); return { text: `제단 틈새에서 오래된 물건을 찾았다. ${RELICS[r].icon} ${RELICS[r].name} 획득!` }; }
          return { text: '제단이 웅웅 울리더니 돌 소녀가 눈을 떴다. "……침입자."', battle: { enemies: eliteOf(run, 'golem', 1), kind: 'elite' } };
        },
      },
    ],
  },
  {
    id: 'ghost_story', title: '모닥불 괴담회', art: '🕯️', acts: [2, 3],
    text: '누군가 모닥불 앞에서 괴담을 들려주고 있다. 그런데 이야기꾼의 발이… 없다?',
    choices: [
      { label: '이야기를 듣는다', run: (run) => ({ text: '오싹하지만 재밌었다. 모두 조금 성장한 기분이다.' + xpAll(run, 15 + run.act * 8) }) },
      {
        label: '더 무서운 이야기를 해준다',
        run(run) {
          if (run.rng.chance(0.55)) return { text: '"히익…! 너, 너 대단하다… 같이 다니면서 이야기 더 해줘!"', recruit: recruitOf(run, 'ghost') };
          return { text: '이야기꾼이 너무 무서워서 사탕을 떨어뜨리고 사라졌다. ' + addItem(run, 'candy', 2) };
        },
      },
    ],
  },
  {
    id: 'cat_meeting', title: '달밤의 고양이 집회', art: '🐈‍⬛', acts: [1, 2, 3],
    text: '공터에 고양이들이 동그랗게 모여 있다. 가운데엔 모자를 쓴 고양이 요정이 연설 중이다. "…그래서 인간의 주머니는…"',
    choices: [
      {
        label: '🐟 생선을 바친다', req: (run) => hasItem(run, 'fish'),
        run(run) {
          takeItem(run, 'fish');
          return { text: '"냐! 공물을 바칠 줄 아는 인간이구냥. 특별히 집사로 임명한다!"', recruit: recruitOf(run, 'catsith') };
        },
      },
      {
        label: '슬쩍 구경한다',
        run(run) {
          if (run.rng.chance(0.5)) {
            const lost = Math.min(run.gold, 25);
            run.gold -= lost;
            return { text: `정신 차려보니 지갑이 가벼워졌다. (${lost}G 잃음)` };
          }
          return { text: '고양이들이 다가와 부비적댄다. 행운이 따를 것 같다. ' + addItem(run, 'fish') };
        },
      },
      { label: '살금살금 지나간다', run: () => ({ text: '수십 개의 눈동자가 지켜보는 게 느껴졌다.' }) },
    ],
  },
  {
    id: 'web_bridge', title: '거미줄 흔들다리', art: '🕸️', acts: [1, 2],
    text: '계곡 위에 거미줄로 엮은 다리가 걸려 있다. 다리 한가운데서 누군가 뜨개질을 하고 있다.',
    choices: [
      { label: '그냥 건넌다', run: (run) => ({ text: '"남의 작품을 함부로 밟다니!"', battle: { enemies: eliteOf(run, 'arachne', 0), kind: 'elite' } }) },
      {
        label: '🧶 털실을 건넨다', req: (run) => hasItem(run, 'yarn'),
        run(run) {
          takeItem(run, 'yarn');
          return { text: '"와, 이 색 갖고 싶었어! 너 목도리 떠 줄게. 아니, 그냥 같이 갈래!"', recruit: recruitOf(run, 'arachne') };
        },
      },
      { label: '뜨개질 구경을 한다', run: (run) => ({ text: '한참 구경하다 보니 손재주를 배운 것 같다.' + xpAll(run, 10 + run.act * 6) }) },
    ],
  },
  {
    id: 'shooting_star', title: '별똥별', art: '🌠', acts: [1, 2, 3],
    text: '하늘을 가르며 별똥별이 떨어진다. 소원을 하나 빌 수 있을 것 같다.',
    choices: [
      { label: '부자가 되게 해주세요', run: (run) => ({ text: `발밑에서 반짝이는 것이 굴러왔다. ${addGold(run, 45 + run.act * 15)}G 획득` }) },
      { label: '모두 건강하게 해주세요', run(run) { reviveAll(run, 1); healAll(run, 1); return { text: '따스한 별빛이 모두를 감쌌다. 완전히 회복했다!' }; } },
      { label: '친구가 많이 생기게 해주세요', run: (run) => ({ text: '주머니가 묵직해졌다. ' + addItem(run, 'perfume') + ', ' + addItem(run, run.rng.pick(['candy', 'honey', 'flower', 'fish', 'gem'])) }) },
    ],
  },
  {
    id: 'unicorn_spring', title: '유니콘의 샘', art: '🦄', acts: [2, 3],
    text: '맑은 샘가에 하얀 뿔을 가진 소녀가 상처 입은 새를 돌보고 있다.',
    choices: [
      {
        label: '함께 새를 돌본다',
        run(run) {
          if (run.party.some((u) => u.species === 'unicorn')) return { text: '"고마워요." 소녀가 미소 지었다.' + xpAll(run, 15) };
          return { text: '"…당신, 마음이 맑은 사람이군요. 저도 함께 가도 될까요?"', recruit: recruitOf(run, 'unicorn') };
        },
      },
      { label: '샘물을 마신다', run(run) { healAll(run, 0.5); return { text: '몸 속까지 맑아지는 기분이다. (HP 50% 회복)' }; } },
    ],
  },
  {
    id: 'salamander_forge', title: '도마뱀 대장간', art: '⚒️', acts: [2],
    text: '용암이 흐르는 바위틈에서 살라만더가 망치질을 하고 있다. "어이! 거기 너! 풀무질 좀 도와줄래?"',
    choices: [
      {
        label: '풀무질을 돕는다',
        run(run) {
          hurtAll(run, 0.1);
          if (!run.relics.includes('whetstone')) { gainRelic(run, 'whetstone'); return { text: '땀을 뻘뻘 흘렸지만 보답으로 숫돌을 받았다! 🪨 숫돌 획득 (HP 10% 감소)' }; }
          return { text: `땀을 뻘뻘 흘렸다. 품삯으로 ${addGold(run, 40)}G를 받았다. (HP 10% 감소)` };
        },
      },
      {
        label: '🍯 꿀단지로 응원한다', req: (run) => hasItem(run, 'honey'),
        run(run) {
          takeItem(run, 'honey');
          return { text: '"꿀!! 너 최고야! 결심했어, 너랑 모험 떠날래!"', recruit: recruitOf(run, 'salamander') };
        },
      },
      { label: '덥다. 떠난다', run: () => ({ text: '"쳇, 근성 없긴!"' }) },
    ],
  },
];

export function pickEvent(run) {
  const seen = run.seenEvents || (run.seenEvents = []);
  const pool = EVENTS.filter((e) => e.acts.includes(run.act) && !seen.includes(e.id));
  const list = pool.length ? pool : EVENTS.filter((e) => e.acts.includes(run.act));
  const ev = run.rng.pick(list);
  seen.push(ev.id);
  return ev;
}

export function eventById(id) {
  return EVENTS.find((e) => e.id === id);
}

export function speciesName(id) { return SPECIES[id].name; }
