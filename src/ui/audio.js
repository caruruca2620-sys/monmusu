// 아주 작은 WebAudio 효과음. 외부 파일 없음.
let ctx = null;
let enabled = true;
export function setSound(on) { enabled = on; }

function ac() {
  if (!ctx) {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.08, type = 'sine', vol = 0.08, when = 0, slide = 0) {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.05, 'triangle', 0.05),
  hit: () => tone(180, 0.12, 'square', 0.05, 0, -90),
  crit: () => { tone(240, 0.14, 'sawtooth', 0.06, 0, -140); tone(120, 0.12, 'square', 0.04, 0.05); },
  miss: () => tone(900, 0.08, 'sine', 0.03, 0, 400),
  heal: () => { tone(523, 0.1, 'sine', 0.05); tone(784, 0.14, 'sine', 0.05, 0.07); },
  heart: () => { tone(880, 0.07, 'sine', 0.05); tone(1175, 0.1, 'sine', 0.05, 0.06); },
  befriend: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.09)),
  flee: () => tone(400, 0.25, 'triangle', 0.05, 0, -300),
  faint: () => tone(220, 0.4, 'sine', 0.06, 0, -160),
  buff: () => tone(700, 0.1, 'triangle', 0.04, 0, 300),
  coin: () => { tone(1320, 0.06, 'square', 0.03); tone(1760, 0.1, 'square', 0.03, 0.05); },
  win: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.12)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.06, i * 0.16)),
};
