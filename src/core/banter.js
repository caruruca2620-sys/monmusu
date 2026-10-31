// 인연 효과(파티 시너지)와 지도 위 수다
export const SYNERGIES = [
  {
    id: 'water_plant', name: '물 주는 사이', members: ['slime', 'mandrake'],
    desc: '전투 시작 시 아군 전체 재생 2턴.', start: [{ who: 'all', status: 'regen', turns: 2 }],
    talk: [['slime', '도라야, 물 줄까? 내 몸에서 뽀용~'], ['mandrake', '…고마워. 근데 좀 끈적해.']],
  },
  {
    id: 'foxfire', name: '도깨비불 콤비', members: ['kitsune', 'ghost'],
    desc: '전투 시작 시 두 사람 공격↑ 2턴.', start: [{ who: 'members', status: 'atkUp', turns: 2 }],
    talk: [['ghost', '코하쿠, 오늘 밤에 누구 놀래킬까?'], ['kitsune', '후후, 저 등불지기 어때?']],
  },
  {
    id: 'duet', name: '하늘과 바다의 듀엣', members: ['harpy', 'mermaid'],
    desc: '매혹으로 얻는 호감도 +20%.', charmMul: 1.2,
    talk: [['harpy', '마리나! 화음 넣어줘!'], ['mermaid', '♪ 좋아, 셋에 시작이야~ ♪']],
  },
  {
    id: 'knight_saint', name: '기사와 성녀', members: ['dullahan', 'unicorn'],
    desc: '전투 시작 시 아군 전체에 보호막.', start: [{ who: 'all', shield: 0.9 }],
    talk: [['dullahan', '루미 공, 그대의 등은 이 리제가 지키겠소.'], ['unicorn', '후훗, 머리부터 꼭 챙겨주세요.']],
  },
  {
    id: 'treasure', name: '보물 사냥단', members: ['mimic', 'catsith'],
    desc: '획득 골드 +25%.', goldMul: 1.25,
    talk: [['catsith', '미미, 너 안에 뭐 들었냥?'], ['mimic', '비, 비밀이야! 손 넣지 마!']],
  },
  {
    id: 'hot_cold', name: '냉혈과 열혈', members: ['lamia', 'salamander'],
    desc: '전투 시작 시 두 사람 공격↑ 2턴.', start: [{ who: 'members', status: 'atkUp', turns: 2 }],
    talk: [['lamia', '살라, 조금만 기대도 돼? 따뜻해서…'], ['salamander', '어, 어어!? 마음대로 해!']],
  },
  {
    id: 'stone_web', name: '단단한 거미집', members: ['golem', 'arachne'],
    desc: '전투 시작 시 아군 전체 방어↑.', start: [{ who: 'all', status: 'defUp', turns: 1 }],
    talk: [['arachne', '고로, 팔 좀 빌려줘. 실 감게.'], ['golem', '……팔. 대여. 승인.']],
  },
  {
    id: 'forest_family', name: '숲의 가족', members: ['dryad', 'mandrake'],
    desc: '전투 시작 시 아군 전체 재생 3턴.', start: [{ who: 'all', status: 'regen', turns: 3 }],
    talk: [['dryad', '도라, 땅속은 춥지 않았니?'], ['mandrake', '여, 여왕님…! 괜찮아요!']],
  },
  {
    id: 'flame_kin', name: '불꽃의 권속', members: ['dragon', 'salamander'],
    desc: '전투 시작 시 아군 전체 공격↑ 2턴.', start: [{ who: 'all', status: 'atkUp', turns: 2 }],
    talk: [['salamander', '공주님! 브레스 연습 같이 해요!'], ['dragon', '흥, 따라올 수 있으면 와 봐라!']],
  },
];

export function activeSynergies(party) {
  const here = new Set(party.filter((u) => !u.fainted).map((u) => u.species));
  return SYNERGIES.filter((s) => s.members.every((m) => here.has(m)));
}

// 혼잣말
export const IDLE = {
  slime: ['배고파~ 저 버섯 먹어도 돼?', '뽀용! 오늘도 말랑말랑!'],
  harpy: ['저 위로 날아가서 길 봐줄까?', '삐삐~ 바람 냄새가 좋아!'],
  kitsune: ['꼬리 손질 좀 해줄래? …아무것도 아니야.', '유부 먹고 싶다…'],
  mandrake: ['흙이 촉촉해서 좋다…', '혹시 날 뽑을 생각은 아니지?'],
  lamia: ['해가 좀 더 났으면 좋겠어.', '후아암… 조금만 감고 자도 돼?'],
  arachne: ['네 목도리, 반쯤 떴어.', '이 숲, 실 걸기 좋은 나무가 많네.'],
  dullahan: ['경계 태세 유지! …머리 어디 뒀더라.', '기사는 지치지 않는다. …조금 쉴까.'],
  mermaid: ['♪ 라라~ 다음 호수는 언제 나와?', '발이 없으니까 업어줘~'],
  salamander: ['빨리 다음 싸움 하자! 몸이 근질근질해!', '꼬리가 뜨거워! 기분 좋다는 뜻이야!'],
  ghost: ['나 오늘 세 명 놀래켰어!', '같이 다니니까 하나도 안 외로워.'],
  unicorn: ['다친 곳은 없나요?', '이 길 끝에 빛이 있을 거예요.'],
  mimic: ['방금 반짝이는 거 봤어! 저기!', '뚜껑 안은 비밀이야.'],
  golem: ['……보행. 계속.', '……꽃. 발견. 밟지 않음.'],
  catsith: ['냐아… 졸려.', '그 주머니, 아까보다 가벼워진 것 같지 않냥?'],
  dryad: ['숲이 조금씩 숨을 쉬는구나.', '천 년 만의 산책이로군.'],
  dragon: ['내 보물창고에 넣을 만한 건 없나?', '흥, 걷는 건 귀찮지만 참아주지.'],
  witch: ['…달이 예쁘네.', '목요일엔 차 마시는 거야. 잊지 마.'],
};

/** 지도 화면에서 보여줄 수다 한 토막 (층마다 바뀐다) */
export function pickBanter(run) {
  const living = run.party.filter((u) => !u.fainted);
  if (!living.length) return null;
  const syn = activeSynergies(run.party).filter((s) => s.talk);
  const k = (run.floor * 7 + run.act * 13 + run.seed) >>> 0;
  if (syn.length && k % 3 === 0) {
    const s = syn[k % syn.length];
    return s.talk.map(([sp, line]) => ({ uid: living.find((u) => u.species === sp)?.uid, line })).filter((x) => x.uid != null);
  }
  const u = living[k % living.length];
  const lines = IDLE[u.species] || [];
  if (!lines.length) return null;
  return [{ uid: u.uid, line: lines[(k >> 2) % lines.length] }];
}
