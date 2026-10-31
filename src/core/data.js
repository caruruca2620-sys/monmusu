// ─────────────────────────────────────────────────────────────
//  달빛 숲의 몬무스 — 게임 데이터
//  모든 캐릭터, 스킬, 아이템은 이 게임을 위해 새로 만든 오리지널입니다.
// ─────────────────────────────────────────────────────────────

export const ELEMENTS = {
  fire: { name: '불', icon: '🔥', color: '#ff7a59' },
  water: { name: '물', icon: '💧', color: '#4fa8ff' },
  leaf: { name: '숲', icon: '🍃', color: '#5cc36a' },
  light: { name: '빛', icon: '✨', color: '#f5c542' },
  dark: { name: '어둠', icon: '🌙', color: '#9b7bff' },
  none: { name: '무', icon: '⚪', color: '#b8b2a7' },
};

// 공격 속성 → 방어 속성 배율
export function elementMultiplier(atk, def) {
  if (atk === 'none' || def === 'none') return 1;
  const beats = { fire: 'leaf', leaf: 'water', water: 'fire' };
  if (beats[atk] === def) return 1.5;
  if (beats[def] === atk) return 0.75;
  if ((atk === 'light' && def === 'dark') || (atk === 'dark' && def === 'light')) return 1.5;
  return 1;
}

// ── 상태 이상 ────────────────────────────────────────────────
// tick: 'start' = 자기 턴 시작에 감소 (상대 턴을 막아주는 방어형)
//       'end'   = 자기 턴 끝에 감소
export const STATUSES = {
  poison: { name: '독', icon: '☠️', tick: 'end', bad: true, desc: '턴 시작마다 중첩만큼 피해. 중첩이 1씩 줄어든다.' },
  burn: { name: '화상', icon: '🔥', tick: 'end', bad: true, desc: '턴 시작마다 최대 HP의 7% 피해.' },
  sleep: { name: '수면', icon: '💤', tick: 'end', bad: true, desc: '행동할 수 없다. 피해를 받으면 깨어난다.' },
  atkDown: { name: '공격↓', icon: '🔻', tick: 'end', bad: true, desc: '주는 피해 30% 감소.' },
  defDown: { name: '방어↓', icon: '💔', tick: 'end', bad: true, desc: '받는 피해 30% 증가.' },
  atkUp: { name: '공격↑', icon: '💪', tick: 'end', bad: false, desc: '주는 피해 35% 증가.' },
  regen: { name: '재생', icon: '🌱', tick: 'end', bad: false, desc: '턴 시작마다 최대 HP의 8% 회복.' },
  defUp: { name: '방어↑', icon: '🛡️', tick: 'start', bad: false, desc: '받는 피해 35% 감소.' },
  taunt: { name: '도발', icon: '🎯', tick: 'start', bad: false, desc: '적이 이 대상을 우선 공격한다.' },
  dodge: { name: '회피', icon: '💨', tick: 'start', bad: false, desc: '공격을 50% 확률로 피한다.' },
  shield: { name: '보호막', icon: '🔰', tick: 'clear', bad: false, desc: '피해를 대신 흡수한다. 자기 턴 시작에 사라진다.' },
};

// ── 스킬 ────────────────────────────────────────────────────
// kind: attack | charm | heal | buff | debuff | summon | wait
// target: enemy | allEnemies | ally | allAllies | self | fallenAlly
const S = (id, o) => ({ id, hits: 1, cd: 0, power: 0, effects: [], ...o });

export const SKILLS = Object.fromEntries([
  // 공용
  S('struggle', { name: '발버둥', kind: 'attack', target: 'enemy', power: 6, desc: '필사적으로 휘두른다.' }),
  S('hesitate', { name: '망설임', kind: 'wait', target: 'self', desc: '얼굴을 붉히며 머뭇거린다…' }),

  // 슬라임
  S('slime_tackle', { name: '말랑 박치기', kind: 'attack', target: 'enemy', power: 13, desc: '통통 튀어 부딪친다.' }),
  S('slime_wall', { name: '젤리 방벽', kind: 'buff', target: 'self', cd: 2, effects: [{ status: 'shield', amount: 1.0 }, { status: 'taunt', turns: 1 }], desc: '공격력 비례 보호막을 두르고 적을 도발한다.' }),
  S('slime_hug', { name: '끈적 포옹', kind: 'charm', target: 'enemy', power: 18, effects: [{ status: 'atkDown', turns: 1, chance: 0.5 }], desc: '말랑하게 꼭 안아준다. 50%로 공격↓.' }),
  S('slime_absorb', { name: '흡수', kind: 'attack', target: 'enemy', power: 13, cd: 2, lifesteal: 0.6, desc: '피해의 60%만큼 회복.' }),

  // 하피
  S('harpy_flurry', { name: '깃털 연타', kind: 'attack', target: 'enemy', power: 5, hits: 3, desc: '날카로운 깃털로 3회 공격.' }),
  S('harpy_gust', { name: '돌풍', kind: 'attack', target: 'allEnemies', power: 8, cd: 2, desc: '적 전체에 바람을 일으킨다.' }),
  S('harpy_song', { name: '하늘의 노래', kind: 'charm', target: 'allEnemies', power: 9, cd: 1, desc: '맑은 노래로 적 전체의 마음을 흔든다.' }),
  S('harpy_soar', { name: '날아오르기', kind: 'buff', target: 'self', cd: 2, effects: [{ status: 'dodge', turns: 1 }, { status: 'atkUp', turns: 2 }], desc: '회피와 공격↑를 얻는다.' }),

  // 여우
  S('fox_fire', { name: '여우불', kind: 'attack', target: 'enemy', power: 13, effects: [{ status: 'burn', turns: 2, chance: 0.5 }], desc: '푸른 도깨비불. 50%로 화상.' }),
  S('fox_bewitch', { name: '홀리기', kind: 'charm', target: 'enemy', power: 24, desc: '꼬리를 살랑이며 홀린다.' }),
  S('fox_illusion', { name: '환영 분신', kind: 'buff', target: 'ally', cd: 2, effects: [{ status: 'dodge', turns: 1 }], desc: '아군 하나에게 환영을 씌워 회피를 부여.' }),
  S('fox_ninetails', { name: '구미 화염', kind: 'attack', target: 'allEnemies', power: 13, cd: 3, effects: [{ status: 'burn', turns: 2, chance: 0.7 }], desc: '아홉 갈래 불꽃이 적 전체를 덮친다.' }),

  // 맨드레이크
  S('mandra_whip', { name: '뿌리 채찍', kind: 'attack', target: 'enemy', power: 12, desc: '뿌리로 찰싹.' }),
  S('mandra_heal', { name: '새싹 치유', kind: 'heal', target: 'ally', power: 22, desc: '아군 하나를 회복.' }),
  S('mandra_scream', { name: '비명', kind: 'debuff', target: 'allEnemies', cd: 3, effects: [{ status: 'sleep', turns: 1, chance: 0.45 }], desc: '귀를 찢는 비명! 45%로 적을 기절(수면).' }),
  S('mandra_scent', { name: '꽃향기', kind: 'charm', target: 'enemy', power: 15, effects: [{ status: 'regen', turns: 2, on: 'randomAlly' }], desc: '달콤한 향기로 매혹. 무작위 아군 재생.' }),
  S('mandra_photo', { name: '광합성', kind: 'buff', target: 'allAllies', cd: 3, effects: [{ status: 'regen', turns: 3 }], desc: '아군 전체에 재생 3턴.' }),

  // 라미아
  S('lamia_fang', { name: '독니', kind: 'attack', target: 'enemy', power: 8, effects: [{ status: 'poison', amount: 4 }], desc: '물어서 독 4 부여.' }),
  S('lamia_coil', { name: '휘감기', kind: 'attack', target: 'enemy', power: 13, cd: 1, effects: [{ status: 'atkDown', turns: 1 }], desc: '꼬리로 조여 공격↓.' }),
  S('lamia_gaze', { name: '뱀의 눈', kind: 'charm', target: 'enemy', power: 18, effects: [{ status: 'sleep', turns: 1, chance: 0.3 }], desc: '깊은 눈동자로 매혹. 30%로 수면.' }),
  S('lamia_shed', { name: '탈피', kind: 'heal', target: 'self', power: 18, cd: 3, cleanse: true, desc: '나쁜 상태를 벗어던지고 회복.' }),

  // 아라크네
  S('arachne_bind', { name: '실 묶기', kind: 'attack', target: 'enemy', power: 7, effects: [{ status: 'sleep', turns: 1, chance: 0.35 }], desc: '실로 묶는다. 35%로 행동 불능.' }),
  S('arachne_sting', { name: '독침', kind: 'attack', target: 'enemy', power: 10, effects: [{ status: 'poison', amount: 3 }], desc: '독 3 부여.' }),
  S('arachne_cradle', { name: '실뜨기 놀이', kind: 'charm', target: 'enemy', power: 19, desc: '같이 실뜨기 하자!' }),
  S('arachne_fort', { name: '거미집 요새', kind: 'buff', target: 'allAllies', cd: 3, effects: [{ status: 'defUp', turns: 1 }], desc: '아군 전체에 방어↑.' }),

  // 듀라한
  S('dulla_slash', { name: '대검 베기', kind: 'attack', target: 'enemy', power: 17, desc: '묵직한 일격.' }),
  S('dulla_oath', { name: '기사의 맹세', kind: 'buff', target: 'self', cd: 2, effects: [{ status: 'taunt', turns: 1 }, { status: 'defUp', turns: 1 }], desc: '도발하고 방어↑.' }),
  S('dulla_headthrow', { name: '머리 던지기', kind: 'attack', target: 'enemy', power: 30, cd: 3, desc: '……정말 던졌다. 강력한 일격.' }),
  S('dulla_bow', { name: '정중한 인사', kind: 'charm', target: 'enemy', power: 15, desc: '머리를 벗어 공손히 인사한다.' }),

  // 인어
  S('mer_splash', { name: '물보라', kind: 'attack', target: 'allEnemies', power: 7, desc: '적 전체에 물을 끼얹는다.' }),
  S('mer_lullaby', { name: '자장가', kind: 'debuff', target: 'enemy', cd: 2, effects: [{ status: 'sleep', turns: 1, chance: 0.8 }], desc: '80%로 적을 재운다.' }),
  S('mer_healsong', { name: '치유의 노래', kind: 'heal', target: 'allAllies', power: 11, cd: 1, desc: '아군 전체를 회복.' }),
  S('mer_pearl', { name: '진주 선물', kind: 'charm', target: 'enemy', power: 20, desc: '반짝이는 진주를 건넨다.' }),

  // 살라만더
  S('sala_claw', { name: '화염 발톱', kind: 'attack', target: 'enemy', power: 14, effects: [{ status: 'burn', turns: 2, chance: 0.35 }], desc: '35%로 화상.' }),
  S('sala_breath', { name: '불꽃 숨결', kind: 'attack', target: 'allEnemies', power: 10, cd: 2, desc: '적 전체 화염 공격.' }),
  S('sala_rage', { name: '열혈', kind: 'buff', target: 'self', cd: 3, effects: [{ status: 'atkUp', turns: 3 }], desc: '공격↑ 3턴.' }),
  S('sala_cheer', { name: '뜨거운 응원', kind: 'charm', target: 'enemy', power: 13, effects: [{ status: 'atkUp', turns: 2, on: 'randomAlly' }], desc: '매혹하고 무작위 아군에게 공격↑.' }),

  // 유령
  S('ghost_touch', { name: '오싹한 손길', kind: 'attack', target: 'enemy', power: 9, effects: [{ status: 'defDown', turns: 2 }], desc: '방어↓ 부여.' }),
  S('ghost_fade', { name: '사라지기', kind: 'buff', target: 'self', cd: 1, effects: [{ status: 'dodge', turns: 1 }], desc: '스르르… 회피.' }),
  S('ghost_boo', { name: '깜짝이야!', kind: 'charm', target: 'enemy', power: 12, effects: [{ status: 'atkDown', turns: 1 }], desc: '놀래키며 장난. 공격↓.' }),
  S('ghost_drain', { name: '영혼 흡수', kind: 'attack', target: 'enemy', power: 13, cd: 2, lifesteal: 0.5, element: 'dark', desc: '피해의 50% 회복.' }),

  // 유니콘
  S('uni_horn', { name: '성스러운 뿔', kind: 'attack', target: 'enemy', power: 12, desc: '빛나는 뿔로 찌른다.' }),
  S('uni_veil', { name: '빛의 장막', kind: 'buff', target: 'allAllies', cd: 2, effects: [{ status: 'shield', amount: 0.8 }], desc: '아군 전체에 보호막.' }),
  S('uni_heal', { name: '치유의 빛', kind: 'heal', target: 'ally', power: 24, cleanse: true, desc: '아군 하나 회복 및 정화.' }),
  S('uni_smile', { name: '순수한 미소', kind: 'charm', target: 'enemy', power: 18, desc: '눈부신 미소.' }),
  S('uni_revive', { name: '재생의 빛', kind: 'heal', target: 'fallenAlly', power: 0, cd: 5, revive: 0.4, desc: '쓰러진 아군을 40% HP로 부활.' }),

  // 미믹
  S('mimic_chomp', { name: '덥석!', kind: 'attack', target: 'enemy', power: 16, desc: '뚜껑으로 덥석.' }),
  S('mimic_shiny', { name: '반짝반짝', kind: 'charm', target: 'enemy', power: 22, cd: 1, desc: '안에 든 보물을 살짝 보여준다.' }),
  S('mimic_lid', { name: '뚜껑 닫기', kind: 'buff', target: 'self', cd: 2, effects: [{ status: 'shield', amount: 1.6 }], desc: '단단한 보호막.' }),
  S('mimic_greed', { name: '탐욕의 이빨', kind: 'attack', target: 'enemy', power: 11, gold: 4, desc: '명중 시 골드 4 획득.' }),

  // 골렘
  S('golem_punch', { name: '바위 주먹', kind: 'attack', target: 'enemy', power: 16, desc: '쿵!' }),
  S('golem_harden', { name: '단단해지기', kind: 'buff', target: 'self', cd: 2, effects: [{ status: 'defUp', turns: 1 }, { status: 'taunt', turns: 1 }], desc: '방어↑, 도발.' }),
  S('golem_quake', { name: '지진', kind: 'attack', target: 'allEnemies', power: 11, cd: 2, desc: '적 전체 공격.' }),
  S('golem_flower', { name: '꽃 건네기', kind: 'charm', target: 'enemy', power: 17, desc: '커다란 손으로 작은 꽃을 내민다.' }),

  // 캣시
  S('cat_scratch', { name: '할퀴기', kind: 'attack', target: 'enemy', power: 7, hits: 2, desc: '2회 공격.' }),
  S('cat_steal', { name: '슬쩍하기', kind: 'attack', target: 'enemy', power: 8, gold: 6, desc: '명중 시 골드 6 획득.' }),
  S('cat_purr', { name: '골골송', kind: 'charm', target: 'enemy', power: 20, desc: '그르릉… 골골…' }),
  S('cat_nap', { name: '고양이 낮잠', kind: 'buff', target: 'self', cd: 3, effects: [{ status: 'regen', turns: 3 }, { status: 'dodge', turns: 1 }], desc: '재생과 회피.' }),

  // 보스: 드라이어드
  S('dryad_vine', { name: '덩굴 채찍', kind: 'attack', target: 'enemy', power: 15, desc: '거대한 덩굴이 휘몰아친다.' }),
  S('dryad_bloom', { name: '만개', kind: 'heal', target: 'allAllies', power: 14, cd: 3, desc: '꽃이 피며 동료 전체 회복.' }),
  S('dryad_summon', { name: '숲의 부름', kind: 'summon', target: 'self', cd: 4, summon: 'mandrake', desc: '맨드레이크를 불러낸다.' }),
  S('dryad_spore', { name: '포자 폭풍', kind: 'attack', target: 'allEnemies', power: 10, cd: 2, effects: [{ status: 'poison', amount: 3 }], desc: '전체 공격 + 독.' }),

  // 보스: 용 공주
  S('dragon_claw', { name: '용의 발톱', kind: 'attack', target: 'enemy', power: 20, desc: '강철도 찢는 발톱.' }),
  S('dragon_inferno', { name: '업화', kind: 'attack', target: 'allEnemies', power: 16, cd: 3, effects: [{ status: 'burn', turns: 2, chance: 0.6 }], desc: '모든 것을 태우는 불꽃.' }),
  S('dragon_roar', { name: '포효', kind: 'debuff', target: 'allEnemies', cd: 3, effects: [{ status: 'atkDown', turns: 2 }, { status: 'defDown', turns: 2 }], desc: '전체 공격↓·방어↓.' }),
  S('dragon_summon', { name: '권속 소환', kind: 'summon', target: 'self', cd: 4, summon: 'salamander', desc: '살라만더를 부른다.' }),

  // 보스: 달의 마녀
  S('witch_moonbeam', { name: '월광', kind: 'attack', target: 'enemy', power: 22, element: 'dark', desc: '차가운 달빛이 꿰뚫는다.' }),
  S('witch_eclipse', { name: '월식', kind: 'attack', target: 'allEnemies', power: 15, cd: 3, effects: [{ status: 'sleep', turns: 1, chance: 0.3 }], desc: '세상이 어두워진다. 30%로 수면.' }),
  S('witch_drain', { name: '흡혈 키스', kind: 'attack', target: 'enemy', power: 18, cd: 2, lifesteal: 0.8, desc: '피해의 80% 회복.' }),
  S('witch_summon', { name: '망령 소환', kind: 'summon', target: 'self', cd: 3, summon: 'ghost', desc: '유령을 불러낸다.' }),
  S('witch_curse', { name: '저주', kind: 'debuff', target: 'enemy', cd: 2, effects: [{ status: 'defDown', turns: 2 }, { status: 'poison', amount: 6 }], desc: '방어↓와 독 6.' }),
].map((s) => [s.id, s]));

// ── 종족 ────────────────────────────────────────────────────
// base: 레벨 1 능력치, grow: 레벨당 증가량
// look: 초상화 생성 파라미터
export const SPECIES = {
  slime: {
    name: '슬라임', given: '포요', element: 'water', role: '탱커',
    base: { hp: 62, atk: 10, def: 9, cha: 11, spd: 6 }, grow: { hp: 8.5, atk: 1.7, def: 1.6, cha: 1.2, spd: 0.4 },
    skills: ['slime_tackle', 'slime_hug', 'slime_wall', 'slime_absorb'],
    gift: 'candy', bond: 100,
    look: { skin: '#8fd3ff', skinAlpha: 0.85, hair: '#5ab8ff', hairStyle: 'drip', eye: '#1d5fa8', outfit: '#3e8fd9', features: ['slime'] },
    lines: {
      intro: '뽀용~? 너 맛있는 냄새 나!',
      join: '헤헤, 이제 친구지? 같이 갈래!',
      flee: '뽀요오옹… 흐물흐물…',
      gift: '와아! 달콤한 별사탕! 녹아버릴 것 같아~',
      shy: '왜, 왜 그렇게 쳐다봐…? 몸이 막 출렁거려…',
    },
    lore: '숲속 샘물에서 태어난 말랑한 소녀. 무엇이든 일단 먹어보고 판단한다.',
  },
  harpy: {
    name: '하피', given: '피피', element: 'leaf', role: '연속 공격',
    base: { hp: 44, atk: 11, def: 6, cha: 11, spd: 14 }, grow: { hp: 6, atk: 2, def: 0.9, cha: 1.3, spd: 1 },
    skills: ['harpy_flurry', 'harpy_song', 'harpy_gust', 'harpy_soar'],
    gift: 'honey', bond: 95,
    look: { skin: '#ffe0c7', hair: '#7bc96f', hairStyle: 'messy', eye: '#2f7d32', outfit: '#f2b84b', features: ['wings', 'feather'] },
    lines: {
      intro: '삐삐! 여긴 내 하늘이야!',
      join: '좋아, 너랑 같이 날아줄게!',
      flee: '삐이이~ 다음엔 안 질 거야!',
      gift: '꿀! 꿀이다! 너 진짜 좋은 녀석이구나!',
      shy: '깃털이… 자꾸 부풀어…! 보지 마!',
    },
    lore: '노래를 좋아하는 숲의 하피. 반짝이는 것과 꿀을 보면 참지 못한다.',
  },
  kitsune: {
    name: '여우', given: '코하쿠', element: 'fire', role: '마법·매혹',
    base: { hp: 46, atk: 12, def: 7, cha: 14, spd: 10 }, grow: { hp: 6.5, atk: 2.1, def: 1, cha: 1.8, spd: 0.7 },
    skills: ['fox_fire', 'fox_bewitch', 'fox_illusion', 'fox_ninetails'],
    gift: 'tofu', bond: 110,
    look: { skin: '#ffe6d1', hair: '#ff9a3c', hairStyle: 'long', eye: '#c2410c', outfit: '#e04848', features: ['foxEars', 'foxTails'] },
    lines: {
      intro: '후후, 길 잃은 인간인가? 재밌겠네.',
      join: '흐응… 특별히 따라가 줄게. 고마워하라고?',
      flee: '쳇, 오늘은 봐줄게!',
      gift: '유, 유부…!? 이건 반칙이야… 꼬리가 멋대로…!',
      shy: '꼬, 꼬리 흔드는 거 아니거든!',
    },
    lore: '도깨비불을 부리는 여우 소녀. 장난을 좋아하지만 의리는 깊다.',
  },
  mandrake: {
    name: '맨드레이크', given: '도라', element: 'leaf', role: '치유',
    base: { hp: 48, atk: 8, def: 8, cha: 11, spd: 7 }, grow: { hp: 7, atk: 1.3, def: 1.2, cha: 1.3, spd: 0.4 },
    skills: ['mandra_heal', 'mandra_whip', 'mandra_scent', 'mandra_photo', 'mandra_scream'],
    gift: 'flower', bond: 95,
    look: { skin: '#f3e2c4', hair: '#8a5a3b', hairStyle: 'bob', eye: '#6b8e23', outfit: '#6fae4f', features: ['sprout'] },
    lines: {
      intro: '나, 나를 뽑으려는 거지!? 소리 지를 거야!',
      join: '…너라면, 화분에 옮겨 심어줘도 괜찮아.',
      flee: '꺄아아아악——!!',
      gift: '꽃… 나한테? 친구들이랑 같은 냄새가 나…',
      shy: '잎사귀가 빨개졌잖아… 네 탓이야.',
    },
    lore: '땅속에서 잠자다 깨어난 겁 많은 식물 소녀. 비명은 정말로 위험하다.',
  },
  lamia: {
    name: '라미아', given: '세르펜', element: 'dark', role: '독',
    base: { hp: 54, atk: 11, def: 8, cha: 12, spd: 9 }, grow: { hp: 7.5, atk: 1.9, def: 1.2, cha: 1.4, spd: 0.6 },
    skills: ['lamia_fang', 'lamia_coil', 'lamia_gaze', 'lamia_shed'],
    gift: 'fish', bond: 110,
    look: { skin: '#f7dccb', hair: '#2f8f7a', hairStyle: 'long', eye: '#d4a017', outfit: '#3b6e5f', features: ['scales', 'slitEyes'] },
    lines: {
      intro: '어머, 따뜻한 손님이네. 조금만 감아봐도 될까?',
      join: '추운 밤엔 네 곁이 좋겠어. 같이 가자.',
      flee: '쉬익… 기억해 둘게.',
      gift: '신선한 생선… 너, 날 잘 아는구나?',
      shy: '그렇게 보면… 비늘이 곤두서잖아.',
    },
    lore: '느긋한 뱀 소녀. 추위를 많이 타서 따뜻한 것에 감기는 버릇이 있다.',
  },
  arachne: {
    name: '아라크네', given: '아라', element: 'leaf', role: '방해',
    base: { hp: 50, atk: 10, def: 9, cha: 11, spd: 8 }, grow: { hp: 7, atk: 1.7, def: 1.4, cha: 1.3, spd: 0.5 },
    skills: ['arachne_sting', 'arachne_bind', 'arachne_cradle', 'arachne_fort'],
    gift: 'yarn', bond: 105,
    look: { skin: '#efe0f0', hair: '#4a3860', hairStyle: 'twin', eye: '#c03080', outfit: '#6a4c93', features: ['spiderEyes', 'spiderLegs'] },
    lines: {
      intro: '내 거미줄에 걸렸네? 나가고 싶으면 놀아줘.',
      join: '좋아, 네 옷은 내가 짜 줄게. 평생.',
      flee: '실이 엉켰잖아—!',
      gift: '털실! 이 색… 너무 예뻐. 뭐 떠줄까?',
      shy: '여덟 개 눈이 다 너만 보잖아… 곤란해.',
    },
    lore: '뜨개질이 취미인 거미 소녀. 그녀의 실은 강철보다 질기고 비단보다 부드럽다.',
  },
  dullahan: {
    name: '듀라한', given: '리제', element: 'dark', role: '기사',
    base: { hp: 60, atk: 13, def: 11, cha: 9, spd: 6 }, grow: { hp: 8.5, atk: 2.2, def: 1.7, cha: 1, spd: 0.3 },
    skills: ['dulla_slash', 'dulla_oath', 'dulla_headthrow', 'dulla_bow'],
    gift: 'tea', bond: 120,
    look: { skin: '#f0e6e0', hair: '#c9c9d9', hairStyle: 'pony', eye: '#5b6ee1', outfit: '#3c3f58', features: ['floatingHead', 'armor'] },
    lines: {
      intro: '멈춰라! 이 길은 내가 지킨다!',
      join: '기사의 이름으로 맹세하지. 그대의 검이 되겠다.',
      flee: '크윽… 머리가 어디 갔지…?',
      gift: '이, 이건 최고급 홍차…! 기사의 품위를 아는군.',
      shy: '머, 머리가 뜨거워져서 떨어질 것 같아…!',
    },
    lore: '머리를 들고 다니는 고지식한 기사. 자주 머리를 두고 와서 곤란해한다.',
  },
  mermaid: {
    name: '인어', given: '마리나', element: 'water', role: '치유·수면',
    base: { hp: 46, atk: 9, def: 7, cha: 13, spd: 9 }, grow: { hp: 6.5, atk: 1.5, def: 1, cha: 1.6, spd: 0.6 },
    skills: ['mer_healsong', 'mer_splash', 'mer_lullaby', 'mer_pearl'],
    gift: 'shell', bond: 100,
    look: { skin: '#e6f4ff', hair: '#ff8fb8', hairStyle: 'wavy', eye: '#2a9d8f', outfit: '#48cae4', features: ['finEars', 'pearl'] },
    lines: {
      intro: '♪ 호숫가의 노래를 들으러 왔니? ♪',
      join: '네 여행의 노래를 내가 불러줄게.',
      flee: '물속으로 퐁당~!',
      gift: '예쁜 조개껍질! 바다 소리가 들려…',
      shy: '♪ 두근두근… 아, 노래가 꼬였어…',
    },
    lore: '숲 깊은 곳 달빛 호수에 사는 인어. 그녀의 노래는 상처를 아물게 한다.',
  },
  salamander: {
    name: '살라만더', given: '살라', element: 'fire', role: '딜러',
    base: { hp: 52, atk: 13, def: 8, cha: 9, spd: 10 }, grow: { hp: 7, atk: 2.3, def: 1.2, cha: 1, spd: 0.7 },
    skills: ['sala_claw', 'sala_breath', 'sala_rage', 'sala_cheer'],
    gift: 'honey', bond: 100,
    look: { skin: '#ffd8b8', hair: '#ff4d2e', hairStyle: 'messy', eye: '#ffb000', outfit: '#8a2b17', features: ['smallHorns', 'flameHair'] },
    lines: {
      intro: '하앗! 불타오르는 승부다!',
      join: '좋아! 너랑이면 더 뜨거워질 수 있겠어!',
      flee: '내 불꽃이 꺼졌어…!',
      gift: '꿀!? 달달한 거 엄청 좋아해! 에헤헤!',
      shy: '얼굴이 뜨거운 건 원래 그래! 진짜야!',
    },
    lore: '불꽃처럼 열정적인 도마뱀 소녀. 화가 나도 기뻐도 꼬리가 타오른다.',
  },
  ghost: {
    name: '유령', given: '유유', element: 'dark', role: '회피·약화',
    base: { hp: 42, atk: 11, def: 6, cha: 12, spd: 12 }, grow: { hp: 5.5, atk: 1.9, def: 0.9, cha: 1.5, spd: 0.8 },
    skills: ['ghost_touch', 'ghost_boo', 'ghost_fade', 'ghost_drain'],
    gift: 'candy', bond: 95,
    look: { skin: '#eef3ff', skinAlpha: 0.9, hair: '#d8e2ff', hairStyle: 'long', eye: '#7b8cff', outfit: '#cdd6ff', features: ['ghost', 'wisp'] },
    lines: {
      intro: '우~ 라~ 메~ 시~ 야~! …안 무서워?',
      join: '나 계속 혼자였거든. 같이 있어도 돼?',
      flee: '스르르르… 사라질게…',
      gift: '사탕! 나 먹을 수는 없지만… 기뻐!',
      shy: '나 투명한데 왜 빨개지는 거야…!',
    },
    lore: '외로움을 많이 타는 유령. 놀래키는 게 인사인 줄 안다.',
  },
  unicorn: {
    name: '유니콘', given: '루미', element: 'light', role: '수호',
    base: { hp: 50, atk: 10, def: 9, cha: 13, spd: 9 }, grow: { hp: 7, atk: 1.6, def: 1.4, cha: 1.6, spd: 0.6 },
    skills: ['uni_heal', 'uni_horn', 'uni_veil', 'uni_smile', 'uni_revive'],
    gift: 'flower', bond: 115,
    look: { skin: '#fff5f0', hair: '#f3f0ff', hairStyle: 'wavy', eye: '#b06ee8', outfit: '#ffffff', features: ['horn', 'horseEars'] },
    lines: {
      intro: '마음이 맑은 자만 지나갈 수 있어요.',
      join: '당신의 마음, 투명하고 따뜻하네요. 함께할게요.',
      flee: '부디… 그 마음을 잃지 마세요.',
      gift: '들꽃… 이렇게 고운 꽃은 처음이에요.',
      shy: '뿔이… 반짝거리는 건 기분 탓이에요.',
    },
    lore: '숲의 빛을 지키는 유니콘. 상처 입은 자를 그냥 지나치지 못한다.',
  },
  mimic: {
    name: '미믹', given: '미미', element: 'none', role: '골드·폭딜',
    base: { hp: 52, atk: 13, def: 10, cha: 12, spd: 5 }, grow: { hp: 7, atk: 2.1, def: 1.5, cha: 1.4, spd: 0.3 },
    skills: ['mimic_chomp', 'mimic_greed', 'mimic_shiny', 'mimic_lid'],
    gift: 'gem', bond: 105,
    look: { skin: '#ffe2cc', hair: '#ffcc33', hairStyle: 'bob', eye: '#ff6b00', outfit: '#9c6b30', features: ['chest'] },
    lines: {
      intro: '보물상자인 줄 알았지? 안타깝게도… 나야!',
      join: '내 안의 보물, 너한테만 보여줄게.',
      flee: '뚜껑 꽉 닫고 도망!',
      gift: '보석이다아아! 내 안에 넣어둘래!',
      shy: '뚜, 뚜껑 열지 마! 지금 얼굴 이상하단 말야!',
    },
    lore: '보물상자에 사는 소녀. 반짝이는 것을 모으는 게 삶의 낙.',
  },
  golem: {
    name: '골렘', given: '고로', element: 'none', role: '탱커',
    base: { hp: 66, atk: 12, def: 12, cha: 8, spd: 3 }, grow: { hp: 9.5, atk: 1.9, def: 1.8, cha: 0.9, spd: 0.2 },
    skills: ['golem_punch', 'golem_harden', 'golem_quake', 'golem_flower'],
    gift: 'gem', bond: 115,
    look: { skin: '#c9c1b3', hair: '#8d8576', hairStyle: 'short', eye: '#4dd0e1', outfit: '#6d6457', features: ['runes', 'stone'] },
    lines: {
      intro: '……침입자. 확인. ……작다.',
      join: '……보호 대상, 갱신. 너.',
      flee: '……기능, 일시 정지.',
      gift: '……반짝임. 감지. ……기쁨, 이라는 것.',
      shy: '……과열. 원인 불명. ……너?',
    },
    lore: '고대 유적을 지키던 돌 소녀. 말수는 적지만 꽃을 아주 좋아한다.',
  },
  catsith: {
    name: '캣시', given: '나비', element: 'light', role: '도적',
    base: { hp: 44, atk: 12, def: 7, cha: 12, spd: 15 }, grow: { hp: 6, atk: 2, def: 1, cha: 1.4, spd: 1 },
    skills: ['cat_scratch', 'cat_steal', 'cat_purr', 'cat_nap'],
    gift: 'fish', bond: 100,
    look: { skin: '#fff0e0', hair: '#2b2b2b', hairStyle: 'short', eye: '#7ed957', outfit: '#f4f4f4', features: ['catEars', 'catTail'] },
    lines: {
      intro: '냐앙? 그 주머니, 뭐 들었어?',
      join: '흥, 밥 주면 따라가는 거야. 너라서가 아니라.',
      flee: '냐아앙! 기억해 둔다!',
      gift: '생선…! 너, 좋은 인간이구냥!',
      shy: '골골… 아, 아니야! 이건 그냥 숨소리야!',
    },
    lore: '달빛 아래 지붕을 걷는 고양이 요정. 반짝이는 것은 일단 훔친다.',
  },

  // ── 보스 ──
  dryad: {
    name: '드라이어드', given: '실바', element: 'leaf', role: '숲의 여왕', boss: true,
    base: { hp: 160, atk: 10, def: 10, cha: 12, spd: 6 }, grow: { hp: 13, atk: 1.6, def: 1.4, cha: 1.2, spd: 0.4 },
    skills: ['dryad_vine', 'dryad_spore', 'dryad_bloom', 'dryad_summon'],
    gift: 'flower', bond: 230,
    look: { skin: '#e9f5d9', hair: '#3f8f3f', hairStyle: 'long', eye: '#a1d65b', outfit: '#2e6b34', features: ['leafCrown', 'vines'] },
    lines: {
      intro: '내 숲을 어지럽히는 자… 뿌리째 돌려보내 주마.',
      join: '…오랜만에 햇살 같은 마음을 봤구나. 내 숲의 축복을 주마.',
      flee: '숲이… 잠시 쉬어야겠구나.',
      gift: '내 숲에서 자란 꽃이로구나. …고맙다.',
      shy: '이 나이에 설레다니… 나이테가 하나 늘겠구나.',
    },
    lore: '천 년을 산 숲의 여왕. 달빛이 흐려진 뒤로 숲을 지키느라 지쳐 있다.',
  },
  dragon: {
    name: '용', given: '이그니스', element: 'fire', role: '불꽃 공주', boss: true,
    base: { hp: 210, atk: 13, def: 12, cha: 11, spd: 8 }, grow: { hp: 15, atk: 1.9, def: 1.6, cha: 1.2, spd: 0.5 },
    skills: ['dragon_claw', 'dragon_inferno', 'dragon_roar', 'dragon_summon'],
    gift: 'gem', bond: 270,
    look: { skin: '#ffe0cc', hair: '#c1121f', hairStyle: 'long', eye: '#ffb703', outfit: '#6a040f', features: ['dragonHorns', 'dragonWings', 'tiara'] },
    lines: {
      intro: '감히 용의 둥지에 발을 들이다니! 재로 만들어 주마!',
      join: '…흥! 네가 마음에 든 게 아니라, 네 보물이 마음에 든 거다!',
      flee: '두, 두고 보자! 이건 전략적 후퇴다!',
      gift: '이 광채…! 내 보물창고 제일 높은 곳에 두겠다!',
      shy: '이, 이 열기는 브레스 준비일 뿐이다!',
    },
    lore: '화산 둥지의 용 공주. 보물을 모으는 것이 자존심이자 외로움의 증표.',
  },
  witch: {
    name: '달의 마녀', given: '녹스', element: 'dark', role: '최종 보스', boss: true, frenzy: true,
    base: { hp: 290, atk: 15, def: 12, cha: 12, spd: 9 }, grow: { hp: 17, atk: 2.1, def: 1.6, cha: 1.2, spd: 0.6 },
    skills: ['witch_moonbeam', 'witch_curse', 'witch_eclipse', 'witch_drain', 'witch_summon'],
    gift: 'tea', bond: 320,
    look: { skin: '#f4ecff', hair: '#1b1035', hairStyle: 'long', eye: '#e63946', outfit: '#2d1b4e', features: ['witchHat', 'fangs', 'moon'] },
    lines: {
      intro: '달빛은 내 것이다. 아무도… 다시는 날 떠나지 못하게.',
      join: '…차를, 같이 마셔줄래? 아주 오랜만이야, 누군가와.',
      flee: '달이… 기울어…',
      gift: '홍차… 옛날에 누군가와 마셨던 그 향이야.',
      shy: '왜… 나 같은 걸 보고 웃는 거야.',
    },
    lore: '숲의 달빛을 삼킨 마녀. 혼자 남겨지는 것이 두려워 모든 빛을 가둬버렸다.',
  },
};

export const STARTERS = ['slime', 'kitsune', 'mandrake'];
export const BOSSES = ['dryad', 'dragon', 'witch'];

// 막(Act)별 등장 몬무스
export const ACT_POOLS = [
  ['slime', 'harpy', 'mandrake', 'arachne', 'catsith', 'kitsune'],
  ['lamia', 'salamander', 'mermaid', 'mimic', 'harpy', 'golem', 'kitsune'],
  ['dullahan', 'ghost', 'unicorn', 'golem', 'lamia', 'mimic', 'catsith'],
];

// ── 아이템 ──────────────────────────────────────────────────
export const ITEMS = {
  potion: { name: '회복 약초', icon: '🌿', price: 22, target: 'ally', desc: '아군 하나의 HP를 45% 회복.' },
  feather: { name: '불사조 깃털', icon: '🪶', price: 45, target: 'fallenAlly', desc: '쓰러진 아군을 50% HP로 일으킨다.' },
  elixir: { name: '만병통치약', icon: '🧪', price: 38, target: 'allAllies', desc: '아군 전체 정화 + HP 25% 회복.' },
  bomb: { name: '꽈리 폭탄', icon: '💣', price: 30, target: 'allEnemies', desc: '적 전체에 큰 피해 (막이 오를수록 강해짐).' },
  smoke: { name: '연막 구슬', icon: '💨', price: 26, target: 'none', desc: '일반·정예 전투에서 도망친다.' },
  perfume: { name: '달빛 향수', icon: '🌸', price: 34, target: 'allEnemies', desc: '적 전체의 호감도 +15%.' },
  // 선물 (호감도 아이템)
  candy: { name: '별사탕', icon: '🍬', price: 16, target: 'enemy', gift: true, desc: '선물. 슬라임·유령이 좋아한다.' },
  honey: { name: '꿀단지', icon: '🍯', price: 16, target: 'enemy', gift: true, desc: '선물. 하피·살라만더가 좋아한다.' },
  tofu: { name: '유부', icon: '🥟', price: 16, target: 'enemy', gift: true, desc: '선물. 여우가 정말 좋아한다.' },
  flower: { name: '들꽃 다발', icon: '💐', price: 16, target: 'enemy', gift: true, desc: '선물. 맨드레이크·유니콘·드라이어드가 좋아한다.' },
  fish: { name: '말린 생선', icon: '🐟', price: 16, target: 'enemy', gift: true, desc: '선물. 캣시·라미아가 좋아한다.' },
  yarn: { name: '털실 뭉치', icon: '🧶', price: 16, target: 'enemy', gift: true, desc: '선물. 아라크네가 좋아한다.' },
  tea: { name: '홍차 세트', icon: '🫖', price: 18, target: 'enemy', gift: true, desc: '선물. 듀라한·달의 마녀가 좋아한다.' },
  shell: { name: '조개껍질', icon: '🐚', price: 16, target: 'enemy', gift: true, desc: '선물. 인어가 좋아한다.' },
  gem: { name: '반짝이 보석', icon: '💎', price: 20, target: 'enemy', gift: true, desc: '선물. 미믹·골렘·용이 좋아한다.' },
};
export const GIFT_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].gift);

// ── 부적 (패시브 유물) ───────────────────────────────────────
export const RELICS = {
  lantern: { name: '낡은 등불', icon: '🏮', rarity: 'start', desc: '전투 후 아군 전체 HP 8% 회복.' },
  acorn: { name: '도토리 목걸이', icon: '🌰', rarity: 'common', desc: '아군 최대 HP +12%.' },
  ribbon: { name: '빨간 리본', icon: '🎀', rarity: 'common', desc: '매혹으로 얻는 호감도 +25%.' },
  whetstone: { name: '숫돌', icon: '🪨', rarity: 'common', desc: '아군이 주는 피해 +15%.' },
  turtle: { name: '거북 등껍질', icon: '🐢', rarity: 'common', desc: '전투 시작 시 아군 전체에 보호막.' },
  coin: { name: '행운의 동전', icon: '🪙', rarity: 'common', desc: '획득 골드 +35%.' },
  bell: { name: '은방울꽃', icon: '🔔', rarity: 'common', desc: '전투 시작 시 아군 전체 재생 2턴.' },
  teacup: { name: '이 빠진 찻잔', icon: '☕', rarity: 'uncommon', desc: '친구가 될 때마다 아군 전체 HP 25% 회복.' },
  thorn: { name: '가시 팔찌', icon: '🌹', rarity: 'uncommon', desc: '아군이 공격받으면 공격자에게 반사 피해.' },
  cloud: { name: '구름 깃털', icon: '☁️', rarity: 'uncommon', desc: '아군이 항상 12% 확률로 공격을 피한다.' },
  compass: { name: '별 나침반', icon: '🧭', rarity: 'uncommon', desc: '전투 경험치 +30%.' },
  mooncrystal: { name: '달의 결정', icon: '🔮', rarity: 'boss', desc: '모든 스킬 재사용 대기 -1.' },
  crown: { name: '작은 왕관', icon: '👑', rarity: 'boss', desc: '파티 정원 +1 (최대 4명).' },
  heartstone: { name: '하트 스톤', icon: '💗', rarity: 'boss', desc: '매혹 +40%, 공격해도 호감도가 줄지 않는다.' },
};
