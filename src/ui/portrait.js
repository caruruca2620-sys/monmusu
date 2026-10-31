// 몬무스 초상화를 SVG로 그린다. 외부 이미지 없이 모두 코드로 생성.
// expression: normal | happy | hurt | shy | love | sleep | angry
import { SPECIES } from '../core/data.js';

// ── 색 도우미 ───────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
export function shade(hex, amt) {
  // amt < 0 어둡게, > 0 밝게
  const c = hexToRgb(hex);
  return rgbToHex(c.map((v) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
}

const MIRROR = 'transform="translate(120,0) scale(-1,1)"';
const both = (svg) => `<g>${svg}</g><g ${MIRROR}>${svg}</g>`;

// ── 머리카락 ────────────────────────────────────────────────
function hairBack(style, c, d) {
  const st = `fill="${c}" stroke="${d}" stroke-width="1.2" stroke-linejoin="round"`;
  switch (style) {
    case 'long':
      return `<path ${st} d="M35 50 C28 72 28 96 31 112 L89 112 C92 96 92 72 85 50 Z"/>`;
    case 'wavy':
      return `<path ${st} d="M35 50 C26 66 32 76 27 88 C23 98 31 104 28 114 L92 114 C89 104 97 98 93 88 C88 76 94 66 85 50 Z"/>`;
    case 'twin':
      return both(`<path ${st} d="M40 44 C22 42 12 64 15 92 C16 102 22 108 24 106 C22 92 28 72 42 58 Z"/>`) +
        both(`<circle cx="40" cy="44" r="3.4" fill="#ff5c8a" stroke="${shade('#ff5c8a', -0.3)}" stroke-width="1"/>`);
    case 'pony':
      return `<path ${st} d="M78 38 C102 36 108 66 98 96 C96 80 92 66 80 56 Z"/><path ${st} d="M36 52 C33 64 35 74 38 78 L82 78 C85 74 87 64 84 52 Z"/>` +
        `<ellipse cx="81" cy="40" rx="4" ry="3" fill="#5b6ee1"/>`;
    case 'bob':
    case 'drip':
      return `<path ${st} d="M35 52 C29 70 32 84 38 88 L82 88 C88 84 91 70 85 52 Z"/>`;
    case 'messy':
      return `<path ${st} d="M35 52 C30 66 30 78 34 86 L40 80 L44 88 L76 88 L80 80 L86 86 C90 78 90 66 85 52 Z"/>`;
    default: // short
      return `<path ${st} d="M36 52 C33 64 35 74 38 78 L82 78 C85 74 87 64 84 52 Z"/>`;
  }
}

function hairFront(style, c, d) {
  const st = `fill="${c}" stroke="${d}" stroke-width="1.2" stroke-linejoin="round"`;
  let fringe;
  if (style === 'messy') {
    fringe = 'M34 64 C30 38 44 28 60 29 C76 28 90 38 86 64 L83 52 L79 58 L76 46 L71 54 L67 44 L61 53 L56 43 L51 54 L47 45 L43 57 L39 50 L37 60 Z';
  } else if (style === 'bob' || style === 'drip') {
    fringe = 'M34 68 C30 38 44 29 60 30 C76 29 90 38 86 68 C84 58 82 52 80 48 C74 50 68 50 64 46 C60 50 52 51 46 48 C40 52 37 60 34 68 Z';
  } else if (style === 'pony') {
    fringe = 'M35 62 C32 38 46 30 60 30 C74 30 88 38 85 62 L82 52 C78 46 70 44 64 46 L58 50 L56 44 C48 44 42 48 38 54 Z';
  } else {
    fringe = 'M34 66 C31 38 45 29 60 30 C75 29 89 38 86 66 L83 56 C81 50 77 47 73 47 L70 53 L66 46 L61 52 L56 46 L51 53 L48 47 C43 47 39 51 37 57 Z';
  }
  let out = `<path ${st} d="${fringe}"/>`;
  // 옆머리
  if (style === 'long' || style === 'wavy' || style === 'twin' || style === 'pony') {
    const side = style === 'wavy'
      ? `<path ${st} d="M36 56 C32 70 37 80 33 92 C31 98 33 104 30 108 L37 106 C40 96 38 88 41 78 C43 70 41 62 40 58 Z"/>`
      : `<path ${st} d="M36 56 C33 72 34 90 31 104 L38 101 C40 90 40 74 40 59 Z"/>`;
    out = both(side) + out;
  }
  if (style === 'drip') {
    out += `<path fill="${c}" opacity="0.9" d="M38 64 C37 70 36 74 38 78 C40 74 40 70 39 64 Z"/><path fill="${c}" opacity="0.9" d="M82 62 C83 70 84 76 82 80 C80 76 80 70 81 62 Z"/>`;
  }
  // 머리 광택
  out += `<path d="M46 36 C52 33 60 32 66 33" stroke="${shade(c, 0.45)}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  return out;
}

// ── 얼굴 ────────────────────────────────────────────────────
function eyes(expr, eye, look) {
  const lash = '#2a1f2d';
  const L = 50, R = 70, Y = 63;
  const slit = look.features.includes('slitEyes');
  const one = (x, mirror) => {
    switch (expr) {
      case 'happy':
        return `<path d="M${x - 4.5} ${Y + 1} Q${x} ${Y - 5} ${x + 4.5} ${Y + 1}" stroke="${lash}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      case 'sleep':
        return `<path d="M${x - 4.5} ${Y} Q${x} ${Y + 3.5} ${x + 4.5} ${Y}" stroke="${lash}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
      case 'hurt': {
        const s = mirror ? -1 : 1;
        return `<path d="M${x - 4 * s} ${Y - 3.5} L${x + 3 * s} ${Y} L${x - 4 * s} ${Y + 3.5}" stroke="${lash}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      default: {
        const dx = expr === 'shy' ? 1.6 : 0;
        const pupil = slit
          ? `<ellipse cx="${x + dx}" cy="${Y + 0.6}" rx="0.9" ry="3.6" fill="#140b10"/>`
          : `<ellipse cx="${x + dx}" cy="${Y + 0.8}" rx="2.2" ry="3" fill="${shade(eye, -0.55)}"/>`;
        const hl = expr === 'love'
          ? `<path d="M${x + dx} ${Y + 2.6} l-2.6 -2.6 a1.5 1.5 0 0 1 2.6 -1.6 a1.5 1.5 0 0 1 2.6 1.6 Z" fill="#ff5c8a"/>`
          : `<circle cx="${x - 1.4 + dx}" cy="${Y - 1.8}" r="1.5" fill="#fff"/><circle cx="${x + 1.6 + dx}" cy="${Y + 2.4}" r="0.7" fill="#fff" opacity="0.8"/>`;
        return `<ellipse cx="${x}" cy="${Y}" rx="4.3" ry="5.6" fill="#fff"/>` +
          `<ellipse cx="${x + dx}" cy="${Y + 0.3}" rx="3.7" ry="5.1" fill="${eye}"/>` +
          `<ellipse cx="${x + dx}" cy="${Y + 2.4}" rx="2.6" ry="2.2" fill="${shade(eye, 0.35)}" opacity="0.6"/>` +
          pupil + hl +
          `<path d="M${x - 5} ${Y - 4} Q${x} ${Y - 7.6} ${x + 5} ${Y - 4.2}" stroke="${lash}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
      }
    }
  };
  let out = one(L, false) + one(R, true);
  if (expr === 'angry') {
    out += `<path d="M45 55 L54 57.5" stroke="${lash}" stroke-width="1.8" stroke-linecap="round"/><path d="M75 55 L66 57.5" stroke="${lash}" stroke-width="1.8" stroke-linecap="round"/>`;
  } else if (expr === 'hurt' || expr === 'shy') {
    out += `<path d="M46 55.5 L54 54.5" stroke="${lash}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/><path d="M74 55.5 L66 54.5" stroke="${lash}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>`;
  }
  return out;
}

function mouth(expr, look) {
  const c = '#7a2f3a';
  let m;
  switch (expr) {
    case 'happy':
    case 'love':
      m = `<path d="M55.5 73.5 Q60 80 64.5 73.5 Z" fill="${c}"/><path d="M57.5 76.5 Q60 78.5 62.5 76.5" fill="#ff8fa3"/>`;
      break;
    case 'hurt':
      m = `<path d="M55 76 Q57 74 59 76 Q61 78 63 76 Q64.5 74.5 65.5 76" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
      break;
    case 'shy':
      m = `<path d="M58 75.5 Q60 74.5 62 75.5" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
      break;
    case 'sleep':
      m = `<ellipse cx="60" cy="76" rx="1.6" ry="1.2" fill="${c}"/>`;
      break;
    case 'angry':
      m = `<path d="M56 76.5 Q60 73.5 64 76.5" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      break;
    default:
      m = `<path d="M56.5 74.5 Q60 77.8 63.5 74.5" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
  if (look.features.includes('fangs') && expr !== 'sleep') {
    m += `<path d="M57.5 75.2 L58.5 78 L59.5 75.6 Z M60.5 75.6 L61.5 78 L62.5 75.2 Z" fill="#fff"/>`;
  }
  return m;
}

function blush(expr) {
  const strong = expr === 'shy' || expr === 'love';
  const op = strong ? 0.75 : expr === 'happy' ? 0.5 : 0.32;
  let out = `<ellipse cx="44.5" cy="71" rx="4.6" ry="2.3" fill="#ff7a9a" opacity="${op}"/><ellipse cx="75.5" cy="71" rx="4.6" ry="2.3" fill="#ff7a9a" opacity="${op}"/>`;
  if (strong) {
    out += both(`<path d="M41.5 69.5 L40.5 72.5 M44.5 69.5 L43.5 72.5 M47.5 69.5 L46.5 72.5" stroke="#e0476f" stroke-width="0.9" stroke-linecap="round"/>`);
  }
  if (expr === 'hurt') {
    out += `<path d="M84 50 C86 54 88 57 86 59 C84 61 81 59 82 56 C82.5 54 83.5 52 84 50 Z" fill="#8fd3ff" stroke="#4fa8ff" stroke-width="0.8"/>`;
  }
  return out;
}

// ── 종족 특징 ───────────────────────────────────────────────
const BEHIND = {
  wings: (lk) => both(`<path fill="${lk.hair}" stroke="${shade(lk.hair, -0.35)}" stroke-width="1.2" stroke-linejoin="round" d="M34 98 C14 94 2 74 4 52 C10 62 14 66 18 66 C10 58 8 46 12 38 C18 52 22 58 26 60 C22 50 22 42 26 36 C30 54 36 72 42 92 Z"/><path d="M14 56 C20 66 28 76 36 88 M22 50 C26 62 32 74 38 86" stroke="${shade(lk.hair, -0.25)}" stroke-width="1" fill="none"/>`),
  dragonWings: () => both(`<path fill="#8d1b26" stroke="#4a0a12" stroke-width="1.3" stroke-linejoin="round" d="M36 96 L6 40 L10 62 L16 52 L19 70 L25 60 L27 80 L33 74 Z"/><path d="M6 40 L33 74 M16 52 L30 80 M25 60 L33 84" stroke="#4a0a12" stroke-width="1" fill="none"/>`),
  foxTails: (lk) => {
    const t = (rot) => `<g transform="rotate(${rot} 60 122)"><path fill="${lk.hair}" stroke="${shade(lk.hair, -0.35)}" stroke-width="1.2" d="M60 122 C38 104 40 50 60 24 C80 50 82 104 60 122 Z"/><path fill="#fff6e8" stroke="${shade(lk.hair, -0.2)}" stroke-width="0.8" d="M60 24 C53 33 51 40 52 45 C56 42 64 42 68 45 C69 40 67 33 60 24 Z"/></g>`;
    return t(-54) + t(54) + t(-30) + t(30);
  },
  catTail: (lk) => `<path d="M88 112 C104 104 108 86 100 76 C96 70 98 62 104 62" stroke="${lk.hair}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  spiderLegs: () => both(`<path d="M38 96 L16 74 L6 92 M40 100 L12 92 L4 112 M38 92 L22 62 L8 68" stroke="#3a2850" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="74" r="2" fill="#c03080"/><circle cx="12" cy="92" r="2" fill="#c03080"/><circle cx="22" cy="62" r="2" fill="#c03080"/>`),
  vines: () => both(`<path d="M30 118 C26 100 34 92 28 80 C24 72 28 64 34 62" stroke="#2e6b34" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M28 80 C22 78 20 74 22 70 C26 72 28 76 28 80 Z M30 98 C24 98 22 94 23 90 C27 92 30 94 30 98 Z" fill="#5cc36a"/>`),
  moon: () => `<path d="M18 30 A18 18 0 1 0 40 8 A14 14 0 1 1 18 30 Z" fill="#fff3b0" opacity="0.85"/>`,
  chest: () => `<path d="M22 44 L98 44 L102 18 C80 8 40 8 18 18 Z" fill="#9c6b30" stroke="#5c3a12" stroke-width="1.5"/><path d="M22 44 L98 44" stroke="#f5c542" stroke-width="3"/><path d="M28 44 L31 50 L34 44 L37 50 L40 44 M80 44 L83 50 L86 44 L89 50 L92 44" fill="#fff" stroke="#ddd" stroke-width="0.6"/><path d="M18 18 C40 8 80 8 102 18" stroke="#f5c542" stroke-width="2.5" fill="none"/>`,
};

const FRONT_BODY = {
  armor: () => both(`<path d="M24 104 C24 94 32 90 42 92 C44 98 42 104 38 108 Z" fill="#8a8fa8" stroke="#3c3f58" stroke-width="1.3"/><circle cx="31" cy="99" r="1.3" fill="#e8e8f0"/>`) + `<path d="M50 92 L60 104 L70 92" stroke="#c9a227" stroke-width="2" fill="none"/>`,
  scales: () => both(`<path d="M30 104 q3 -3 6 0 q3 -3 6 0 M33 109 q3 -3 6 0 q3 -3 6 0" stroke="#2f8f7a" stroke-width="1.2" fill="none"/>`),
  chest: () => `<rect x="14" y="100" width="92" height="22" rx="3" fill="#9c6b30" stroke="#5c3a12" stroke-width="1.5"/><path d="M14 106 L106 106" stroke="#f5c542" stroke-width="2.5"/><rect x="55" y="103" width="10" height="9" rx="2" fill="#f5c542" stroke="#a87b16" stroke-width="1"/><circle cx="60" cy="108" r="1.3" fill="#5c3a12"/>`,
  pearl: () => `<path d="M46 96 Q60 104 74 96" stroke="#fff" stroke-width="0" fill="none"/>` + [48, 54, 60, 66, 72].map((x, i) => `<circle cx="${x}" cy="${96 + (i === 2 ? 3 : i % 2 ? 2 : 0)}" r="2" fill="#fdfcf7" stroke="#d9cfe0" stroke-width="0.6"/>`).join(''),
  runes: () => `<path d="M40 104 L46 98 L52 104 M68 104 L74 98 L80 104" stroke="#4dd0e1" stroke-width="1.6" fill="none" opacity="0.9"/>`,
};

const HEAD_TOP = {
  foxEars: (lk) => both(`<path d="M40 44 L33 15 L54 33 Z" fill="${lk.hair}" stroke="${shade(lk.hair, -0.35)}" stroke-width="1.2" stroke-linejoin="round"/><path d="M41 40 L36.5 22 L50 33.5 Z" fill="#fff1e6"/>`),
  catEars: (lk) => both(`<path d="M39 42 L36 20 L53 33 Z" fill="${lk.hair}" stroke="${shade(lk.hair, -0.4)}" stroke-width="1.2" stroke-linejoin="round"/><path d="M40.5 38 L38.5 25.5 L48.5 33.5 Z" fill="#ffb3c6"/>`),
  horseEars: (lk) => both(`<path d="M40 40 C32 32 32 24 34 20 C40 24 45 30 46 36 Z" fill="${lk.skin}" stroke="${shade(lk.hair, -0.25)}" stroke-width="1.1"/><path d="M39 36 C36 31 35.5 27 36 24 C39 27 42 30 43 34 Z" fill="#ffc8d8"/>`),
  horn: () => `<path d="M56.5 34 L60 4 L63.5 34 Z" fill="#ffe08a" stroke="#c99a2e" stroke-width="1.1" stroke-linejoin="round"/><path d="M57.5 28 L62.5 26 M58.3 21 L61.9 19.5 M59 14 L61.2 13" stroke="#c99a2e" stroke-width="1.1"/>`,
  smallHorns: () => both(`<path d="M45 37 L41 25 L51 33 Z" fill="#ffcf9e" stroke="#b5651d" stroke-width="1.1" stroke-linejoin="round"/>`),
  dragonHorns: () => both(`<path d="M45 36 C36 30 32 18 38 8 C38 18 42 24 51 31 Z" fill="#3a2a2a" stroke="#1b1010" stroke-width="1.1" stroke-linejoin="round"/>`),
  sprout: () => `<path d="M60 31 L60 20" stroke="#4c9a3a" stroke-width="2" stroke-linecap="round"/><path d="M60 22 C52 12 43 15 45 22 C50 25 56 25 60 22 Z" fill="#6fcf5a" stroke="#3d7a2c" stroke-width="1"/><path d="M60 20 C66 9 77 11 75 18 C71 22 65 22 60 20 Z" fill="#8be06f" stroke="#3d7a2c" stroke-width="1"/>`,
  leafCrown: () => [30, 42, 54, 66, 78, 90].map((x, i) => {
    const y = 34 - Math.sin((i / 5) * Math.PI) * 6;
    return `<path d="M${x} ${y} C${x - 5} ${y - 6} ${x - 2} ${y - 12} ${x} ${y - 14} C${x + 2} ${y - 12} ${x + 5} ${y - 6} ${x} ${y} Z" fill="${i % 2 ? '#a1d65b' : '#5cc36a'}" stroke="#2e6b34" stroke-width="1"/>`;
  }).join('') + `<circle cx="60" cy="24" r="3" fill="#ff8fb8" stroke="#c0396b" stroke-width="0.8"/>`,
  tiara: () => `<path d="M48 35 L51 28 L55 33 L60 25 L65 33 L69 28 L72 35 Z" fill="#ffd166" stroke="#b5891a" stroke-width="1"/><circle cx="60" cy="30" r="1.8" fill="#e63946"/>`,
  witchHat: () => `<ellipse cx="60" cy="34" rx="36" ry="7.5" fill="#2b1747" stroke="#120724" stroke-width="1.3"/><path d="M40 33 C44 20 52 10 62 2 C66 6 74 6 80 12 C74 12 70 14 68 18 C74 22 78 28 80 33 Z" fill="#2b1747" stroke="#120724" stroke-width="1.3" stroke-linejoin="round"/><path d="M41 31 C54 34 66 34 79 31" stroke="#e63946" stroke-width="3.5" fill="none"/><path d="M67 22 l1.4 3 3.2 0.4 -2.4 2.2 0.7 3.2 -2.9 -1.6 -2.9 1.6 0.7 -3.2 -2.4 -2.2 3.2 -0.4 Z" fill="#ffe66d"/>`,
  feather: () => `<g transform="rotate(30 80 36)"><ellipse cx="80" cy="26" rx="4" ry="11" fill="#f2b84b" stroke="#a8741c" stroke-width="1"/><path d="M80 15 L80 38" stroke="#a8741c" stroke-width="1"/></g>`,
  flameHair: () => `<path d="M48 31 C46 22 50 18 52 12 C54 20 56 22 56 28 C58 22 60 18 62 10 C64 18 66 24 66 29 C68 24 70 22 72 16 C74 24 74 28 72 32 Z" fill="#ffb000" stroke="#ff4d2e" stroke-width="1.2" stroke-linejoin="round"/>`,
  pearl: () => `<circle cx="81" cy="42" r="3.2" fill="#fdfcf7" stroke="#d9cfe0" stroke-width="0.8"/><circle cx="80" cy="41" r="1" fill="#fff"/><path d="M84 40 C88 38 90 42 88 44" stroke="#48cae4" stroke-width="1.5" fill="none"/>`,
  wisp: () => `<path d="M100 34 C94 30 96 22 100 14 C101 20 106 22 106 28 C106 33 103 35 100 34 Z" fill="#9db4ff" opacity="0.85"/><circle cx="100.5" cy="29" r="2.2" fill="#e8eeff"/>`,
};

const FACE_EXTRA = {
  spiderEyes: () => [[53, 48.5], [57, 46.5], [63, 46.5], [67, 48.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.25" fill="#c03080"/><circle cx="${x - 0.35}" cy="${y - 0.4}" r="0.4" fill="#fff"/>`).join(''),
  scales: () => both(`<path d="M37.5 72 q1.6 -1.6 3.2 0 M38 75.5 q1.6 -1.6 3.2 0" stroke="#2f8f7a" stroke-width="0.9" fill="none"/>`),
  stone: () => `<path d="M40 66 L44 70 L42 74 M80 62 L77 66 L79 70" stroke="#6d6457" stroke-width="1" fill="none"/>`,
  runes: () => both(`<path d="M41 74 L43.5 70 L46 74" stroke="#4dd0e1" stroke-width="1.2" fill="none"/>`),
  finEars: () => both(`<path d="M37.5 58 L25 50 L28.5 60 L23 68 L37.5 66 Z" fill="#7fd8e8" stroke="#2a9d8f" stroke-width="1" stroke-linejoin="round" opacity="0.95"/>`),
  slime: () => `<ellipse cx="48" cy="44" rx="6" ry="3.5" fill="#fff" opacity="0.45" transform="rotate(-20 48 44)"/>`,
};

// ── 조립 ────────────────────────────────────────────────────
export function portraitSVG(speciesId, expr = 'normal', opts = {}) {
  const sp = SPECIES[speciesId];
  const lk = sp.look;
  const f = new Set(lk.features);
  const hairC = lk.hair;
  const hairD = shade(lk.hair, -0.35);
  const skin = lk.skin;
  const skinD = shade(skin, -0.2);
  const skinAlpha = lk.skinAlpha ?? 1;
  const outfit = lk.outfit;
  const headLift = f.has('floatingHead') ? -7 : 0;

  let back = '';
  for (const k of ['moon', 'chest', 'wings', 'dragonWings', 'foxTails', 'catTail', 'spiderLegs', 'vines']) {
    if (f.has(k) && BEHIND[k]) back += BEHIND[k](lk);
  }

  // 몸
  let body;
  if (f.has('ghost')) {
    body = `<path d="M30 120 C30 104 34 94 46 90 L74 90 C86 94 90 104 90 120 C86 114 82 118 78 113 C74 119 70 114 66 119 C62 114 58 119 54 114 C50 119 46 114 42 119 C38 113 34 118 30 120 Z" fill="${outfit}" stroke="${shade(outfit, -0.3)}" stroke-width="1.2" opacity="0.85"/>`;
  } else if (f.has('slime')) {
    body = `<path d="M22 120 C22 100 36 90 60 89 C84 90 98 100 98 120 Z" fill="${outfit}" stroke="${shade(outfit, -0.3)}" stroke-width="1.2" opacity="0.92"/>` +
      `<path d="M32 104 C32 110 30 114 33 116 C36 114 35 110 34 104 Z M86 100 C86 108 88 112 85 114 C82 112 83 106 84 100 Z" fill="${skin}" opacity="0.8"/>`;
  } else {
    body = `<path d="M18 120 C18 100 32 91 60 90 C88 91 102 100 102 120 Z" fill="${outfit}" stroke="${shade(outfit, -0.35)}" stroke-width="1.2"/>` +
      `<path d="M48 91 L60 101 L72 91" fill="none" stroke="${shade(outfit, -0.25)}" stroke-width="1.5"/>`;
  }
  const neck = f.has('floatingHead')
    ? `<rect x="54" y="82" width="12" height="11" fill="${skin}" stroke="${skinD}" stroke-width="1"/><ellipse cx="60" cy="82" rx="7" ry="2.2" fill="#9fb3ff" opacity="0.9"/><ellipse cx="60" cy="${80 + headLift}" rx="10" ry="3" fill="#b9c6ff" opacity="0.35"/>`
    : `<rect x="54" y="80" width="12" height="13" fill="${skin}" fill-opacity="${skinAlpha}" stroke="${skinD}" stroke-width="1"/>`;

  let bodyFront = '';
  for (const k of Object.keys(FRONT_BODY)) if (f.has(k)) bodyFront += FRONT_BODY[k](lk);

  const head = `<ellipse cx="60" cy="60" rx="23.5" ry="24.5" fill="${skin}" fill-opacity="${skinAlpha}" stroke="${skinD}" stroke-width="1.2"/>`;

  let faceExtra = '';
  for (const k of Object.keys(FACE_EXTRA)) if (f.has(k)) faceExtra += FACE_EXTRA[k](lk);
  let top = '';
  for (const k of Object.keys(HEAD_TOP)) if (f.has(k)) top += HEAD_TOP[k](lk);

  const z = expr === 'sleep' ? `<text x="88" y="40" font-size="12" font-weight="700" fill="#7b8cff" font-family="sans-serif">z</text><text x="96" y="30" font-size="9" font-weight="700" fill="#7b8cff" font-family="sans-serif">z</text>` : '';
  const heart = expr === 'love' ? `<path d="M96 30 l-5 -5 a3 3 0 0 1 5 -3.2 a3 3 0 0 1 5 3.2 Z" fill="#ff5c8a"/>` : '';

  const backHair = `<g transform="translate(0 ${headLift})">${hairBack(lk.hairStyle, hairC, hairD)}</g>`;
  const headGroup = `<g transform="translate(0 ${headLift})">${head}${eyes(expr, lk.eye, lk)}${blush(expr)}${mouth(expr, lk)}${hairFront(lk.hairStyle, hairC, hairD)}${faceExtra}${top}${z}${heart}</g>`;

  const id = opts.id ? ` id="${opts.id}"` : '';
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return `<svg${id}${cls} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sp.name} ${sp.given}">${back}${backHair}${body}${neck}${bodyFront}${headGroup}</svg>`;
}

/** 전투 상황에 맞는 표정 */
export function expressionFor(unit) {
  if (unit.fainted) return 'hurt';
  if (unit.st?.sleep) return 'sleep';
  if (unit.gone === 'friend') return 'love';
  if (unit.gone === 'fled') return 'hurt';
  if (unit.side === 'enemy') {
    const br = unit.bond / unit.bondMax;
    if (br >= 0.85) return 'love';
    if (br >= 0.55) return 'shy';
    if (unit.hp / unit.maxHp < 0.3) return 'hurt';
    if (unit.boss && br < 0.2) return 'angry';
    return 'normal';
  }
  if (unit.hp / unit.maxHp < 0.3) return 'hurt';
  return 'normal';
}
