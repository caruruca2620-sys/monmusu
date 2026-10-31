// 막(Act)마다 갈림길이 있는 지도를 만든다.
export const MAP_ROWS = 7; // 보스 전 층 수
export const MAP_COLS = 4;

export const NODE_TYPES = {
  battle: { name: '야생 몬무스', icon: '🐾' },
  elite: { name: '강한 기척', icon: '💢' },
  event: { name: '수상한 곳', icon: '❓' },
  shop: { name: '떠돌이 상점', icon: '🛍️' },
  rest: { name: '모닥불', icon: '🔥' },
  treasure: { name: '보물', icon: '🎁' },
  boss: { name: '숲의 주인', icon: '👑' },
};

export function generateMap(rng, act) {
  const nodes = new Map(); // key "r,c"
  const key = (r, c) => `${r},${c}`;
  const get = (r, c) => {
    const k = key(r, c);
    if (!nodes.has(k)) nodes.set(k, { id: k, row: r, col: c, type: null, next: [] });
    return nodes.get(k);
  };

  const starts = rng.shuffle([0, 1, 2, 3]).slice(0, 3);
  // 경로 4개: 시작점 3개 + 하나는 겹치게
  const paths = [...starts, rng.pick(starts)];
  const edges = new Set();
  for (let c of paths) {
    let node = get(0, c);
    for (let r = 1; r < MAP_ROWS; r++) {
      let nc = Math.min(MAP_COLS - 1, Math.max(0, c + rng.int(-1, 1)));
      // 교차 방지: (r-1,c)→(r,nc)와 반대 방향 간선이 있으면 직진
      if (nc !== c && edges.has(`${r - 1},${nc}>${r},${c}`)) nc = c;
      const nxt = get(r, nc);
      const ek = `${r - 1},${c}>${r},${nc}`;
      if (!edges.has(ek)) { edges.add(ek); node.next.push(nxt.id); }
      node = nxt;
      c = nc;
    }
  }
  const boss = { id: 'boss', row: MAP_ROWS, col: 1.5, type: 'boss', next: [] };
  for (const n of nodes.values()) if (n.row === MAP_ROWS - 1) n.next.push('boss');
  nodes.set('boss', boss);

  // 타입 배정
  for (const n of nodes.values()) {
    if (n.type) continue;
    if (n.row === 0) n.type = 'battle';
    else if (n.row === MAP_ROWS - 1) n.type = 'rest';
    else if (n.row === 3) n.type = 'treasure';
    else {
      const w = [['battle', 46], ['event', 24]];
      if (n.row >= 2) w.push(['elite', act === 1 ? 10 : 14], ['shop', 11]);
      if (n.row >= 2 && n.row !== MAP_ROWS - 2) w.push(['rest', 7]);
      n.type = rng.weighted(w);
    }
  }
  // 같은 줄에 상점/휴식이 너무 몰리지 않게 정리
  for (let r = 1; r < MAP_ROWS - 1; r++) {
    const row = [...nodes.values()].filter((n) => n.row === r);
    for (const t of ['shop', 'rest', 'elite']) {
      const same = row.filter((n) => n.type === t);
      for (let i = 1; i < same.length; i++) same[i].type = rng.pick(['battle', 'event']);
    }
  }
  const list = [...nodes.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  return { act, nodes: Object.fromEntries(list.map((n) => [n.id, n])) };
}

export function startNodes(map) {
  return Object.values(map.nodes).filter((n) => n.row === 0);
}
