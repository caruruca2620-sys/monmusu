// ES 모듈들을 하나의 HTML 파일로 묶는다 (외부 번들러 없이).
//   node scripts/build.js  →  dist/monmusu.html
// 각 모듈을 자기만의 함수 스코프로 감싸고, import를 구조 분해로 바꿔 의존 순서대로 잇는다.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'src/ui/app.js');

const order = [];
const seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  const re = /^import\s+[\s\S]*?\s+from\s+['"](.+?)['"];?/gm;
  let m;
  while ((m = re.exec(src))) visit(resolve(dirname(file), m[1]));
  order.push(file);
}
visit(entry);

const modName = (file) => '__m_' + relative(root, file).replace(/[^\w]/g, '_');
const chunks = order.map((file) => {
  let src = readFileSync(file, 'utf8');
  const exportsList = [];
  // import { a, b as c } from './x.js'  →  const { a, b: c } = __m_x;
  src = src.replace(/^import\s+\{([\s\S]*?)\}\s+from\s+['"](.+?)['"];?/gm, (_, names, from) => {
    const dep = modName(resolve(dirname(file), from));
    const list = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = ${dep};`;
  });
  src = src.replace(/^export\s+\{([^}]*)\};?\s*$/gm, (_, names) => {
    exportsList.push(...names.split(',').map((n) => n.trim()).filter(Boolean));
    return '';
  });
  src = src.replace(/^export\s+((?:async\s+)?function\s*\*?\s*|const\s+|let\s+|class\s+)([A-Za-z_$][\w$]*)/gm, (_, kw, name) => {
    exportsList.push(name);
    return kw + name;
  });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`처리하지 못한 import/export: ${relative(root, file)}`);
  return `// ── ${relative(root, file)} ──\nconst ${modName(file)} = (() => {\n${src}\nreturn { ${exportsList.join(', ')} };\n})();`;
});

const js = `(() => {\n'use strict';\n${chunks.join('\n')}\n})();`;
const css = readFileSync(resolve(root, 'styles.css'), 'utf8');
const html = `<title>달빛 숲의 몬무스</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap">
<style>
${css}
</style>
<main id="app"></main>
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/monmusu.html'), html);
console.log(`dist/monmusu.html (${(html.length / 1024).toFixed(1)} KB, 모듈 ${order.length}개)`);
