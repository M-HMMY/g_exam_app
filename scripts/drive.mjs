// 開発サーバのアプリを、実際にブラウザで開いて操作する。
//
// なぜこれが要るか：`npm run check` は React で描画までするが、それは
// 「描ける」ことしか見ていない。クリックしたとき何が起きるかは見ていない。
// このスクリプトを書いたことで、確認問題の解答が学習記録へ二重登録される
// 不具合が実際に見つかった（Practice.tsx で actions.answer を setSession の
// 更新関数の中で呼んでいた。StrictMode では更新関数が 2 回走る）。
// 検査でもビルドでも型でも捕まらない種類の不具合で、押してみるしかなかった。
//
// なぜ Playwright を入れないか：このリポジトリの方針が「ランタイム依存は
// React だけ」なので、開発用でも重い依存は足したくない。Node 24 には
// WebSocket が組み込みで入っているため、Chrome DevTools Protocol へ
// 直接つなげば追加インストールなしで済む。Edge は Windows に最初からある。
//
// 使い方：
//   1. 別の端末で `npm run dev` を起動しておく
//   2. node scripts/drive.mjs
//
// 別の画面を見たいときは、いちばん下の「筋書き」だけ書き換える。

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
// vite は 5173 が埋まっていると 5174、5175 と繰り上がる。
// 別のアプリの開発サーバを同時に立てていると起きるので、環境変数で渡せるようにする。
//   DEV_PORT=5175 node scripts/drive.mjs
const BASE = `http://localhost:${process.env.DEV_PORT ?? 5173}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Edge を headless で起動して DevTools につなぐ ---

const profile = mkdtempSync(join(tmpdir(), 'drive-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    // 使い捨てのプロファイルにしないと、ふだん使いの Edge が開いているときに
    // 起動が奪われて DevTools につながらない。
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function debuggerUrl() {
  // 起動直後は /json/list がまだ応答しない。数秒ぶんだけ待つ。
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* まだ起動中 */
    }
    await sleep(250);
  }
  throw new Error('DevTools につながらなかった。Edge のパスを確かめること');
}

const ws = new WebSocket(await debuggerUrl());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const waiting = new Map();
const errors = [];

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
    return;
  }
  // 画面は出ているのにコンソールだけ荒れている、という状態を見逃さないため、
  // 例外と console.error を拾っておく。React の警告もここに出る。
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
};

function send(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => waiting.set(n, r));
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.result?.exceptionDetails) {
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  }
  return res.result?.result?.value;
}

// --- 操作のことば ---

/** ハッシュルータなので、location.hash を書き換えれば画面が変わる。 */
async function go(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(700);
}

/** いま画面に出ている文字。空行を潰して読みやすくする。 */
function visible() {
  return evaluate(
    `(() => {
       const t = document.querySelector('.page')?.innerText ?? document.body.innerText;
       return t.replace(/\\n{2,}/g, '\\n').trim();
     })()`,
  );
}

/**
 * 文字で要素を探して押す。セレクタではなく見えている文字で指すのは、
 * 画面の作りが変わっても筋書きを書き直さずに済むため。
 * 見つからなければ 'NOT_FOUND' が返る（例外にしない。押せなかったこと自体が結果）。
 */
function click(text, tag = 'button') {
  return evaluate(
    `(() => {
       const els = [...document.querySelectorAll(${JSON.stringify(tag)})];
       const el = els.find((e) => e.innerText.trim().includes(${JSON.stringify(text)}));
       if (!el) return 'NOT_FOUND';
       el.click();
       return 'OK';
     })()`,
  );
}

/** 選択肢（ア〜エ）の n 番目を押す。確認問題と模試で使う。 */
function choose(n) {
  return evaluate(
    `(() => {
       const b = [...document.querySelectorAll('button')]
         .filter((x) => /^[アイウエ]/.test(x.innerText.trim()));
       if (!b[${n}]) return 'NO_CHOICES';
       b[${n}].click();
       return 'OK';
     })()`,
  );
}

const report = [];
const show = (title, body) => report.push(`\n===== ${title} =====\n${body}`);

// ============================================================
// 筋書き — ここだけ書き換えて使う
// ============================================================

await send('Page.enable');
await send('Runtime.enable');
await evaluate(`location.href = ${JSON.stringify(BASE + '/#/home')}`);
await sleep(1500);

// 1. 教本の節が出るか。ウィジェットを埋め込んだ節を選ぶと一度に両方見られる。
await go('#/textbook/d-ml-6');
show('教本 d-ml-6', (await visible()).slice(0, 800));

// 2. 埋め込んだウィジェット（混同行列）が実際に反応するか。
const picked = await click('適合率');
await sleep(300);
show('ウィジェットを押したあと', `click=${picked}
` + (await visible()).slice(-700));

// 3. 確認問題を 1 問解いて、採点と解説まで出るか。
//    クエリはルータの定義に合わせること（?cat=。?category= ではない）。
await evaluate(`location.href = ${JSON.stringify(BASE + '/#/practice?cat=d-ml')}`);
await sleep(1500);
show('確認問題の設定画面', (await visible()).slice(0, 300));

await click('開始');
await sleep(800);
show('出題', (await visible()).slice(0, 400));

await choose(0);
await sleep(300);
await click('解答する');
await sleep(800);
show('採点後', (await visible()).slice(0, 900));

// 4. 法律・倫理の章も見る。表と図が多く、崩れやすい。
await go('#/textbook/k-law-3');
show('教本 k-law-3', (await visible()).slice(0, 600));

// 5. 体験ツールの一覧。
await go('#/tools');
show('体験ツール', (await visible()).slice(0, 700));

// ============================================================

show('コンソールエラー', errors.length ? errors.join('\n') : '(なし)');
console.log(report.join('\n'));

ws.close();
edge.kill();
