/**
 * データの整合性チェック。`npm run check` で実行する。
 *
 * 教本・問題・ドリルは手で書き足していくため、型では防げない食い違いが必ず混ざる。
 * ここで機械的に潰しておくと、あとから「なぜか画面に出ない」を探さずに済む。
 * 新しい不整合の型を見つけたら、直すついでにこのファイルへ検査を足すこと。
 */
import { readFileSync } from 'node:fs';
import { CATEGORIES } from '../src/data/categories';
import { SECTIONS } from '../src/data/textbook';
import { QUESTIONS } from '../src/data/questions';
import { DRILLS } from '../src/data/drills';
import { isKnownCommand } from '../src/lib/mathSymbols';
import { renderCheck } from './render-check';
import { existsSync, readdirSync } from 'node:fs';

const BACKSLASH = String.fromCharCode(92);
const LF = String.fromCharCode(10);

const errors: string[] = [];
const warnings: string[] = [];

const err = (m: string): void => {
  errors.push(m);
};
const warn = (m: string): void => {
  warnings.push(m);
};

/** 重複した ID を探す */
function dupes(label: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) err(`${label}: ID が重複している → ${id}`);
    seen.add(id);
  }
}

const categoryIds = new Set(CATEGORIES.map((c) => c.id));
const sectionIds = new Set(SECTIONS.map((s) => s.id));

// ---- ID の重複 ----
dupes('分野', CATEGORIES.map((c) => c.id));
dupes('教本セクション', SECTIONS.map((s) => s.id));
dupes('確認問題', QUESTIONS.map((q) => q.id));
dupes('ドリル', DRILLS.map((d) => d.id));

// ---- 参照先の存在 ----
for (const s of SECTIONS) {
  if (!categoryIds.has(s.categoryId)) err(`教本 ${s.id}: 存在しない分野 ${s.categoryId}`);
}
for (const q of QUESTIONS) {
  if (!categoryIds.has(q.categoryId)) err(`問題 ${q.id}: 存在しない分野 ${q.categoryId}`);
  if (q.sectionId === undefined) warn(`問題 ${q.id}: sectionId が未設定（教本への復習導線が出ない）`);
  else if (!sectionIds.has(q.sectionId)) err(`問題 ${q.id}: 存在しない節 ${q.sectionId}`);
}
for (const d of DRILLS) {
  if (!categoryIds.has(d.categoryId)) err(`ドリル ${d.id}: 存在しない分野 ${d.categoryId}`);
  if (!sectionIds.has(d.sectionId)) err(`ドリル ${d.id}: 存在しない節 ${d.sectionId}`);
}

// ---- 問題の形 ----
for (const q of QUESTIONS) {
  if (q.choices.length !== 4) err(`問題 ${q.id}: 選択肢が ${q.choices.length} 個（4 個であること）`);
  if (q.answer < 0 || q.answer > 3) err(`問題 ${q.id}: answer が範囲外 ${q.answer}`);
  if (new Set(q.choices).size !== q.choices.length) err(`問題 ${q.id}: 選択肢に重複がある`);
  if (q.explanation.trim() === '') err(`問題 ${q.id}: 解説が空`);
}

// ---- 問題が「解かなくても当てられる」形になっていないか ----
// 実際にこれで偏っていた。試験対策として見抜かれる形は、問題として弱い。
{
  const sameText = new Map<string, string[]>();
  for (const q of QUESTIONS) {
    const key = q.question.replace(/\s+/g, '');
    sameText.set(key, [...(sameText.get(key) ?? []), q.id]);
  }
  for (const ids of sameText.values()) {
    if (ids.length > 1) err(`問題文がまったく同じ: ${ids.join(' / ')}`);
  }

  // 完全一致だけでは、数字も選択肢も同じで語だけ言い換えた重複を見逃す。
  // G検定は範囲が広く浅いので、同じモデル名・同じ人名が別の章にも出てくる。
  // 章をまたいだ重複は 1 節ずつ見ている限り気づけないため、機械に数えさせる。
  // 問題文だけで測ると「〜の説明として、最も適切なものはどれか」という定型が
  // 効いて全部が似てしまうので、選択肢も混ぜて測る。
  {
    const grams = (q: (typeof QUESTIONS)[number]): Set<string> => {
      const t = (q.question + [...q.choices].sort().join('')).replace(
        /[\s。、，,．.「」『』（）()]/g,
        '',
      );
      const set = new Set<string>();
      for (let i = 0; i < t.length - 1; i += 1) set.add(t.slice(i, i + 2));
      return set;
    };
    /** 問題文と選択肢に出てくる数を、順序どおりに並べた文字列 */
    const numbers = (q: (typeof QUESTIONS)[number]): string =>
      (q.question + q.choices.join(' ')).match(/[0-9][0-9,.]*/g)?.join('/') ?? '';
    const rows = QUESTIONS.map((q) => ({ q, g: grams(q), nums: numbers(q) }));
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i].g;
        const b = rows[j].g;
        let hit = 0;
        a.forEach((g) => {
          if (b.has(g)) hit += 1;
        });
        const sim = (2 * hit) / (a.size + b.size);
        // 同じ節の中で似るのは、対比のために対で作った問題（直列と並列、暗号化と
        // 署名）なので正常。節をまたいで似ているものが、気づかずに書いた重複。
        const sameSection =
          rows[i].q.sectionId !== undefined && rows[i].q.sectionId === rows[j].q.sectionId;
        // 同じ公式を、理論の節と演習の節で**数値だけ変えて**出すのは意図した
        // 繰返しなので重複ではない（稼働率・損益分岐点・伝送時間など）。
        // 文面が似ていても、出てくる数が違えば別の問題として扱う。
        if (sim >= 0.6 && !sameSection && rows[i].nums === rows[j].nums) {
          warn(
            `問題 ${rows[i].q.id} と ${rows[j].q.id} が別の節でほぼ同じ内容（類似度 ${sim.toFixed(2)}）。` +
              '片方の数値か観点を変える',
          );
        }
      }
    }
  }

  const pos = [0, 0, 0, 0];
  let longest = 0;
  let absoluteInCorrect = 0;
  let absoluteInWrong = 0;
  const absolute = /必ず|すべて|常に|まったく|一切/;
  for (const q of QUESTIONS) {
    pos[q.answer] += 1;
    const lens = q.choices.map((c) => c.length);
    q.choices.forEach((c, i) => {
      if (!absolute.test(c)) return;
      if (i === q.answer) absoluteInCorrect += 1;
      else absoluteInWrong += 1;
    });
    // 正解だけが長いと、読まずに「長いものを選ぶ」で当てられてしまう。
    // ただし 1〜2 文字の差まで数えると実態より大きく出るので、差の大きさで見る。
    const other = Math.max(...lens.filter((_, i) => i !== q.answer));
    if (lens[q.answer] >= other * 1.25 && lens[q.answer] - other >= 5) longest += 1;
    if (lens[q.answer] > other * 1.5 && lens[q.answer] - other >= 8) {
      warn(`問題 ${q.id}: 正解だけが突出して長い（正解 ${lens[q.answer]} 字 / 最長の誤答 ${other} 字）`);
    }
  }
  const n = QUESTIONS.length;
  if (n >= 40) {
    pos.forEach((c, i) => {
      const rate = c / n;
      if (rate < 0.15 || rate > 0.35) {
        warn(`正解の位置が ${'アイウエ'[i]} に偏っている（${c} / ${n} 問）。選択肢を並べ替えて散らすこと`);
      }
    });
    if (longest / n > 0.3) {
      warn(`正解がはっきり長い問題が ${longest} / ${n} 問。誤答も同じ密度で書くこと`);
    }
    if (absoluteInWrong >= 10 && absoluteInCorrect === 0) {
      warn(
        `「必ず」「すべて」などの言い切りが誤答だけに ${absoluteInWrong} 個ある。` +
          'それ自体が手掛かりになるので、正しく言い切れる場面では正解側にも使うこと',
      );
    }
  }
}

// ---- 問題文が本番で読み切れる長さか ----
// 本番は 145 問 / 100 分（オンライン）で 1 問あたり約 41 秒しかない。
// 読むだけで時間を使い切る問題は、練習として不誠実になる。
for (const q of QUESTIONS) {
  const len = q.question.replace(/\s/g, '').length;
  if (len > 160) err(`問題 ${q.id}: 問題文が ${len} 字（本番は 1 問 約 41 秒。120 字までを目安に切り詰める）`);
  else if (len > 120) warn(`問題 ${q.id}: 問題文が ${len} 字とやや長い（1 問 約 41 秒で読める長さに）`);
}

// ---- 図の題の「N つ」と、実際の数の食い違い ----
// 「2 つのアプローチ」と題した図に 3 分岐が描いてある、という食い違いが実際に出た。
// CLAUDE.md が挙げる「図の名前と中身の食い違い」の型で、読者は数を数えて覚えるので
// そのまま誤記憶になる。数える対象は図の種類で変わる。
//   compare … 左右の見出し（actors）の数
//   tree    … 最上位の数、または 1 段下がった子の数
//   その他   … 要素の数
{
  const NUM = /([0-9０-９]+)\s*つ/;
  const KEYS = new Set(['title', 'top', 'bottom', 'x', 'y', 'note', 'actors', 'caption']);
  const toNum = (t: string): number =>
    Number(t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));

  for (const s of SECTIONS) {
    let type: string | null = null;
    let title: string | null = null;
    let actors = 0;
    let top = 0;
    let children = 0;

    const close = (): void => {
      if (type === null || title === null) {
        type = null;
        title = null;
        return;
      }
      const m = NUM.exec(title);
      if (m !== null) {
        const want = toNum(m[1]);
        const ok =
          type === 'compare'
            ? actors === 0 || want === actors
            : type === 'tree'
              ? want === top || want === children
              : top === 0 || want === top;
        if (!ok) {
          const actual = type === 'compare' ? `左右の見出し ${actors} 個` : `要素 ${top} 個`;
          warn(`教本 ${s.id}: 図の題「${title}」は ${want} つと言っているが、${actual}`);
        }
      }
      type = null;
      title = null;
    };

    for (const raw of s.body.split(LF)) {
      const t = raw.trim();
      if (t.startsWith('```')) {
        if (type !== null) close();
        else if (t.startsWith('```diagram:')) {
          type = t.slice('```diagram:'.length);
          title = null;
          actors = 0;
          top = 0;
          children = 0;
        }
        continue;
      }
      if (type === null || t === '') continue;
      const d = /^([a-z]+):\s*(.*)$/.exec(t);
      if (d !== null && KEYS.has(d[1])) {
        if (d[1] === 'title') title = d[2];
        if (d[1] === 'actors') actors = d[2].split('|').filter((x) => x.trim() !== '').length;
        continue;
      }
      const indent = /^\s*/.exec(raw)![0].length;
      if (indent === 0) top += 1;
      else if (indent <= 2) children += 1;
    }
    close();
  }
}

// ---- 別の文字体系の混入 ----
// 日本語の文章に、ハングルやキリル文字が 1 文字だけ紛れ込むことが実際に起きた
// （「データ」の「デ」がハングルに、「短い」がキリル文字に）。
// 見た目では気づきにくく、検索にも引っかからないので機械に数えさせる。
{
  // ギリシャ文字は対象外。αβ 法・ε-greedy・β-VAE のように、
  // 日本語の技術用語の一部として正当に使われるため。
  const STRAY = /[가-힣ᄀ-ᇿЀ-ӿ]/;
  const scan = (label: string, text: string): void => {
    for (const line of text.split(LF)) {
      const m = STRAY.exec(line);
      if (m === null) continue;
      err(`${label}: 日本語以外の文字体系が混ざっている（${m[0]}）→ ${line.trim().slice(0, 50)}`);
    }
  };
  for (const s of SECTIONS) {
    scan(`教本 ${s.id}`, s.title);
    scan(`教本 ${s.id}`, s.goal);
    scan(`教本 ${s.id}`, s.body);
  }
  for (const q of QUESTIONS) {
    scan(`問題 ${q.id}`, q.question);
    scan(`問題 ${q.id}`, q.explanation);
    q.choices.forEach((c) => scan(`問題 ${q.id}`, c));
  }
}

// ---- 節の骨格 ----
// 「# この節のまとめ」「> **試験のポイント**」「> **よくある勘違い**」は
// digest.ts が直前チェックシートへ機械的に抜き出す。書式を崩すと拾われないので、
// 崩れていないかではなく「そもそも在るか」をここで数える。
for (const s of SECTIONS) {
  const body = s.body;
  if (!body.includes('# ざっくり言うと')) warn(`教本 ${s.id}: 「# ざっくり言うと」がない`);
  if (!body.includes('# この節のまとめ')) warn(`教本 ${s.id}: 「# この節のまとめ」がない（チェックシートに載らない）`);
  if (!body.includes('> **試験のポイント**')) warn(`教本 ${s.id}: 「> **試験のポイント**」がない`);
  // 1 問 約 41 秒の試験なので、一問一答は速度対策そのもの。薄い節を数える。
  const quizzes = body.split(LF).filter((l) => l.includes('::')).length;
  if (quizzes === 0) warn(`教本 ${s.id}: quiz ブロックがない（この試験では一問一答が速度対策になる）`);
  else if (quizzes < 4) warn(`教本 ${s.id}: 一問一答が ${quizzes} 問と少ない（目安は 5 問以上）`);
}

// ---- ドリルは実際に生成して確かめる（乱数なので複数回試す） ----
for (const d of DRILLS) {
  for (let i = 0; i < 200; i++) {
    const item = d.generate();
    if (item.choices.length !== 4) {
      err(`ドリル ${d.id}: 選択肢が ${item.choices.length} 個になる場合がある`);
      break;
    }
    if (new Set(item.choices).size !== item.choices.length) {
      err(`ドリル ${d.id}: 選択肢が重複する場合がある → ${item.choices.join(' / ')}`);
      break;
    }
    if (item.answer < 0 || item.answer >= item.choices.length) {
      err(`ドリル ${d.id}: answer が範囲外になる場合がある`);
      break;
    }
  }
}

// ---- 本文の記法 ----
const KNOWN_DIAGRAMS = new Set(['flow', 'stack', 'tree', 'matrix', 'cycle', 'seq', 'bits', 'compare']);
/**
 * ```widget: で呼べるウィジェットの id。`src/components/widgets/*.tsx` の
 * ファイル名がそのまま id になる（Widget.tsx が同じ規則で自動登録している）。
 * 手で並べると足したときに更新し忘れるので、ディレクトリを直接読む。
 */
const KNOWN_WIDGETS = new Set(
  existsSync('src/components/widgets')
    ? readdirSync('src/components/widgets')
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => f.replace(/\.tsx$/, ''))
    : [],
);
/** 本文リンクで飛べるページ（ハッシュルータの第 1 要素） */
const KNOWN_PAGES = new Set([
  'home',
  'textbook',
  'tools',
  'practice',
  'drill',
  'sheet',
  'review',
  'mock',
  'stats',
  'settings',
]);

const fence = new RegExp('^```(.*)$');

for (const s of SECTIONS) {
  const lines = s.body.split(LF);
  let open: string | null = null;
  let quizBuf: string[] = [];

  for (const line of lines) {
    const m = fence.exec(line.trim());
    if (m) {
      if (open === null) {
        open = m[1].trim();
        quizBuf = [];
        const lang = open;
        if (lang.startsWith('diagram:')) {
          const t = lang.slice('diagram:'.length);
          if (!KNOWN_DIAGRAMS.has(t)) err(`教本 ${s.id}: 未知の図の種類 ${t}`);
        }
        if (lang.startsWith('widget:')) {
          const w = lang.slice('widget:'.length);
          if (!KNOWN_WIDGETS.has(w)) err(`教本 ${s.id}: 未登録のウィジェット ${w}`);
        }
      } else {
        if (open === 'quiz') {
          if (quizBuf.length === 0) err(`教本 ${s.id}: 空の quiz ブロック`);
          for (const q of quizBuf) {
            if (!q.includes('::')) err(`教本 ${s.id}: quiz の行に :: がない → ${q.slice(0, 30)}`);
          }
        }
        open = null;
      }
      continue;
    }
    if (open === 'quiz' && line.trim() !== '') quizBuf.push(line.trim());
  }
  if (open !== null) err(`教本 ${s.id}: 閉じていないコードフェンス（${open || '言語指定なし'}）`);
}

// ---- 図の中の書式 ----
// 図は Markdown を通らないので、`**強調**` を書くとアスタリスクがそのまま出る。
// compare は「1 行 1 セル、偶数行が左・奇数行が右」なので、要素が奇数だと対にならない。
const DIRECTIVE_KEYS = new Set(['title', 'top', 'bottom', 'x', 'y', 'note', 'actors', 'caption']);
for (const s of SECTIONS) {
  let type: string | null = null;
  let items = 0;
  for (const raw of s.body.split(LF)) {
    const t = raw.trim();
    if (t.startsWith('```')) {
      if (type !== null) {
        if (type === 'compare' && items % 2 === 1) {
          err(`教本 ${s.id}: compare の要素が奇数個なので左右が対にならない（1 行 1 セルで書く）`);
        }
        type = null;
      } else if (t.startsWith('```diagram:')) {
        type = t.slice('```diagram:'.length);
        items = 0;
      }
      continue;
    }
    if (type === null || t === '') continue;
    const m = /^([a-z]+):/.exec(t);
    if (m && DIRECTIVE_KEYS.has(m[1])) continue;
    items++;
    if (t.includes('**')) err(`教本 ${s.id}: 図の中の ** は強調にならずそのまま出る → ${t.slice(0, 40)}`);
  }
}

// ---- 本文リンクの飛び先 ----
// 飛び先が実在するかだけでは、**別の節を指してしまった**誤りを捕まえられない。
// 実際に「[誤差関数の節](textbook/i-3)」のように、ラベルと飛び先が食い違った例が出た。
// そこで、ラベルが他の節のタイトルと一致しているのに別の節を指している場合を警告する。
const titleToId = new Map(SECTIONS.map((s) => [s.title, s.id]));
const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
for (const s of SECTIONS) {
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(s.body)) !== null) {
    const label = m[1].replace(/\*\*/g, '').trim();
    const to = m[2];
    const [pathPart] = to.split('?');
    const [page, param] = pathPart.split('/');
    if (!KNOWN_PAGES.has(page)) {
      err(`教本 ${s.id}: 存在しないページへのリンク ${to}`);
      continue;
    }
    if (page !== 'textbook' || param === undefined) continue;
    if (!sectionIds.has(param)) {
      err(`教本 ${s.id}: 存在しない節へのリンク ${to}`);
      continue;
    }
    const byTitle = titleToId.get(label);
    if (byTitle !== undefined && byTitle !== param) {
      err(`教本 ${s.id}: リンクのラベル「${label}」は節 ${byTitle} のタイトルなのに ${param} を指している`);
    }
    // 節へのリンクに「〜の章」というラベルを付けると、読者は章の扉に飛べると思う。
    // 章の扉へは飛べないので、ラベルを節の話に直すか、リンクを外す。
    if (/章$/.test(label)) {
      warn(`教本 ${s.id}: リンクのラベル「${label}」が章を指しているが、飛び先は節 ${param}。章の扉へは飛べない`);
    }
  }
}

// ---- 数式のバックスラッシュ落ち ----
// TS のテンプレートリテラル／文字列の中では `\` を 2 つ重ねる必要がある。
// 忘れると `\sum` が `sum` になって画面に出てしまうので、それを検出する。
const COMMANDS = [
  'sum', 'prod', 'int', 'partial', 'nabla', 'infty', 'frac', 'sqrt',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'eta', 'theta', 'lambda',
  'mu', 'sigma', 'tau', 'phi', 'psi', 'omega', 'Sigma', 'Delta', 'Omega',
  'times', 'cdot', 'approx', 'propto', 'hat', 'bar', 'mathbf', 'mathbb', 'mid',
];
const mathSpan = /\$([^$\n]+)\$/g;
const cmdRe = /\\([A-Za-z]+)/g;

/** 本文から数式の断片を集める（行内の `$...$` と ```math フェンスの中身） */
function mathPieces(text: string): string[] {
  const pieces: string[] = [];
  let m: RegExpExecArray | null;
  mathSpan.lastIndex = 0;
  while ((m = mathSpan.exec(text)) !== null) pieces.push(m[1]);
  let inMath = false;
  for (const line of text.split(LF)) {
    const t = line.trim();
    if (t.startsWith('```')) {
      inMath = t === '```math';
      continue;
    }
    if (inMath && t !== '') pieces.push(t);
  }
  return pieces;
}

const checkMath = (label: string, text: string): void => {
  for (const expr of mathPieces(text)) {
    for (const cmd of COMMANDS) {
      const at = expr.indexOf(cmd);
      if (at < 0) continue;
      if (expr[at - 1] === BACKSLASH) continue;
      // 変数名の一部（例: gamma の中の mu）を拾わないよう、前後が英字なら見送る
      const before = expr[at - 1] ?? '';
      const after = expr[at + cmd.length] ?? '';
      if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) continue;
      warn(`${label}: 数式の ${cmd} にバックスラッシュがない（$ の中で ${BACKSLASH}${BACKSLASH}${cmd} と書く）→ ${expr}`);
    }
    // 表に無い命令は、記号にならずに名前がそのまま画面へ出る
    cmdRe.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = cmdRe.exec(expr)) !== null) {
      if (!isKnownCommand(c[1])) {
        err(`${label}: 数式に未知の命令 ${BACKSLASH}${c[1]}（記号にならず名前が表示される。src/lib/mathSymbols.ts に足すこと）→ ${expr}`);
      }
    }
  }
};
for (const s of SECTIONS) checkMath(`教本 ${s.id}`, s.body);
for (const q of QUESTIONS) {
  checkMath(`問題 ${q.id}`, q.question);
  checkMath(`問題 ${q.id}`, q.explanation);
  q.choices.forEach((c) => checkMath(`問題 ${q.id}`, c));
}

// ---- 1 問ごとに見る偏り ----
// 上の検査は全体の比率で見ているため、「全体では 10% だが、その 10% は
// 確かに直すべき問題」という状態を素通りする。どの問題かが分からないと
// 直しようがないので、1 問ごとに見て id を出す。
{
  const own = QUESTIONS.filter((q) => q.source === undefined && q.choices.length === 4);

  /** 同じ型の注意が大量に出ると全部読み飛ばされるので、多いときはまとめる */
  const group = (label: string, items: string[]): void => {
    if (items.length === 0) return;
    if (items.length <= 10) {
      items.forEach(warn);
      return;
    }
    warn(`${label}（${items.length} 件。ひどい順に 10 件だけ表示）`);
    items.slice(0, 10).forEach((m) => warn('    ' + m));
  };

  // 正解だけが長いと、読まずに「長いものを選ぶ」で当てられる。
  // 数式は 1 文字ぶんに潰してから数える（$\frac{1}{2}$ は見た目には短い）。
  {
    const width = (s: string): number => s.replace(/\$[^$]*\$/g, '#').replace(/\s/g, '').length;
    const found: { diff: number; msg: string }[] = [];
    for (const q of own) {
      const lens = q.choices.map(width);
      const other = Math.max(...lens.filter((_, i) => i !== q.answer));
      const mine = lens[q.answer];
      // **比で測ってはいけない。** 以前は「1.3 倍かつ 6 字差」で見ていたが、
      // 長い選択肢どうしだと 40 字 / 34 字が 1.18 倍にしかならず素通りする。
      // そうして漏れたものが積み上がり、435 問のうち 107 問で正解が最長に
      // なっていた。「いちばん長いものを選ぶ」だけで当たる率は 24.6 %。
      // 選択肢の長さの分布から計算した期待値は 7.0 % なので 3.5 倍である。
      // 受験者がやるのは比の計算ではなく見比べなので、**字数の差**で見る。
      if (mine - other >= 5) {
        found.push({ diff: mine - other, msg: `問題 ${q.id}: 正解 ${mine} 字 / 最長の誤答 ${other} 字` });
      }
    }
    found.sort((a, b) => b.diff - a.diff);
    group('正解だけが突出して長い。誤答も同じ密度で書くこと', found.map((f) => f.msg));
  }

  // 言い切りが誤答にだけ出ていると、言い切りの有無が手掛かりになる。
  // 全体の個数で見ていると、正解側にも言い切りがある問題があるだけで隠れてしまう。
  // **「3 つすべて」では緩すぎた。** 2 つ消去できれば残りは二択になり、
  // それだけで正答率が 25 % から 50 % に上がる。レビューでも 2 つの例が
  // 繰り返し指摘されたので、2 つ以上で数える。
  //
  // 「すべて」は数え方が難しい。「すべてのデータ点から距離を測る」のような
  // ただの記述まで拾ってしまうので、断定を強める語だけを見る。
  {
    // 「常に」は部分一致だと「非常に」「通常に」まで拾ってしまうので、直前の字で除く。
    const absolute = /必ず|(?<![非通日])常に|まったく|全く|一切|絶対|例外なく|いかなる場合|どのような場合|どんな場合|一律|あらゆる/;
    const found: string[] = [];
    for (const q of own) {
      const wrong = q.choices.filter((_, i) => i !== q.answer).filter((c) => absolute.test(c)).length;
      if (wrong >= 2 && !absolute.test(q.choices[q.answer])) {
        found.push(`問題 ${q.id}: 誤答 ${wrong} つに言い切りがあり、正解にはない`);
      }
    }
    group('言い切りが誤答側にだけ出ている', found);
  }

  // 「本文で挙げられているものはどれか」は、知識ではなく直前の記載を覚えているかを
  // 問う形になっていて、教本を閉じた受験者には答えようがない。
  // 実際に 3 問あり、いずれも「〜として適切なものはどれか」に直せた。
  {
    const found: string[] = [];
    for (const q of own) {
      // 「本文」だけで見ると、文字列照合の「本文（探索される側の文字列）」まで
      // 拾ってしまう。記載を指す動詞と組になっているときだけ数える。
      if (/(本文|教本|この節)(で|に)(挙げ|述べ|示さ|説明さ|書か)/.test(q.question)) {
        found.push(`問題 ${q.id}: 設問が教本の記載そのものを指している（「${q.question.slice(0, 24)}…」）`);
      }
    }
    group('教材内の記載を探させる設問になっている。知識を問う形にすること', found);
  }
}

// ---- 実際に描いてみる ----
// 記法としては正しくても、描くと崩れている場合がある（強調の中の数式など）。
for (const p of renderCheck()) err(p);

// ---- 集計して表示 ----
const sectionsPerCategory = new Map<string, number>();
for (const s of SECTIONS) sectionsPerCategory.set(s.categoryId, (sectionsPerCategory.get(s.categoryId) ?? 0) + 1);
const emptyChapters = CATEGORIES.filter((c) => !sectionsPerCategory.has(c.id));

const chars = SECTIONS.reduce((n, s) => n + s.body.length, 0);
const linked = QUESTIONS.filter((q) => q.sectionId !== undefined).length;

console.log('--- 収録状況 ---');
console.log(`教本      : ${SECTIONS.length} 節 / ${chars.toLocaleString()} 字（未着手の章 ${emptyChapters.length}）`);
console.log(`確認問題  : ${QUESTIONS.length} 問（節にひも付き ${linked} 問）`);
console.log(`計算ドリル: ${DRILLS.length} 種類`);
if (emptyChapters.length > 0) {
  console.log(`未着手の章: ${emptyChapters.map((c) => c.name).join('、')}`);
}

console.log('');

// ---- 姉妹アプリと共有する入れ物に、アプリ固有の名前が付いているか ----
//
// **localStorage も Cache Storage もオリジン単位**なので、
// github.io に姉妹アプリを並べると 1 つの入れ物を共有する。
//   - localStorage のキーがぶつかれば、学習記録が混ざる
//   - サービスワーカーの activate が「自分以外」を消せば、隣のキャッシュまで巻き添えになる
//
// **★ 実際に起きていた**（2026 年 9 月 19 日に発見）。
// このアプリを含む 5 本が activate で「自分以外を全部消す」形になっていて、
// **開くたびに姉妹アプリのオフラインキャッシュを消していた。**
// 型でもビルドでも止まらず、8 本を並べて見比べて初めて分かった。
//
// 接頭辞は**いま使っているものを動かさない**こと。付け替えると、
// すでに配布したキャッシュを一度捨てることになる。
{
  const OWN_PREFIX = 'g-exam-app-';
  try {
    const sw = readFileSync('public/sw.js', 'utf8');
    const m = sw.match(/const CACHE_PREFIX = '([^']*)'/);
    if (!m) {
      err('public/sw.js: CACHE_PREFIX がありません。キャッシュ名がオリジンの中でアプリ固有になっていません');
    } else if (m[1] !== OWN_PREFIX) {
      err(`public/sw.js: CACHE_PREFIX が ${m[1]}。このアプリの接頭辞は ${OWN_PREFIX} です`);
    }
    if (!/startsWith\(CACHE_PREFIX\)/.test(sw)) {
      err(
        'public/sw.js: activate が startsWith(CACHE_PREFIX) で絞っていません。' +
          'オリジンを共有する姉妹アプリのキャッシュまで消します',
      );
    }
  } catch {
    /* sw.js が無いなら飛ばす */
  }
  try {
    const st = readFileSync('src/lib/storage.ts', 'utf8');
    const m = st.match(/const KEY = '([^']*)'/);
    if (m && !m[1].startsWith(OWN_PREFIX)) {
      err(`src/lib/storage.ts: localStorage のキーが ${m[1]}。${OWN_PREFIX} で始めてください`);
    }
  } catch {
    /* storage.ts が無いなら飛ばす */
  }
}

if (warnings.length > 0) {
  console.log(`--- 注意 ${warnings.length} 件 ---`);
  warnings.forEach((w) => console.log('  ' + w));
  console.log('');
}
if (errors.length === 0) {
  console.log('整合性チェック: エラーなし');
} else {
  console.log(`--- エラー ${errors.length} 件 ---`);
  errors.forEach((e) => console.log('  ' + e));
  process.exit(1);
}
