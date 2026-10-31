// localStorage 래퍼. 사파리 사생활 모드 등에서 실패해도 게임은 계속된다.
const META_KEY = 'monmusu.meta.v1';
const RUN_KEY = 'monmusu.run.v1';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, val) {
  try { if (val == null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { /* 무시 */ }
}

export function loadMeta() {
  const def = { seen: [], friends: [], runs: 0, wins: 0, trueEnds: 0, best: 0, sound: true, speed: 1 };
  try { return { ...def, ...(JSON.parse(read(META_KEY)) || {}) }; } catch { return def; }
}
export function saveMeta(meta) { write(META_KEY, JSON.stringify(meta)); }

export function loadRunJson() { return read(RUN_KEY); }
export function saveRunJson(json) { write(RUN_KEY, json); }
export function clearRun() { write(RUN_KEY, null); }
