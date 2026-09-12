import { useState, type JSX } from 'react';
import { Widget, widgetIds } from '../components/Widget';
import { navigate } from '../lib/router';

/**
 * 体験ツール（対話ウィジェット）の一覧。教本の該当箇所にも同じものが埋め込まれている。
 *
 * ここに並べた id は、`src/components/widgets/<id>.tsx` を作れば自動で有効になる
 * （`Widget.tsx` がファイルを走査して登録する）。まだ書いていない id は表示されない。
 * つまり**この一覧は「作りたいものの計画表」も兼ねている。**
 */
const GROUPS: { name: string; note: string; ids: string[] }[] = [
  {
    name: '数と確率',
    note: '本文の数式が何を言っているのかを、数値を動かして確かめます',
    ids: ['stats', 'bayes', 'similarity'],
  },
  {
    name: '機械学習の評価',
    note: '混同行列と評価指標は、この試験で最も計算問題が出やすいところです',
    ids: ['confusion', 'roc', 'overfit'],
  },
  {
    name: 'ディープラーニングの部品',
    note: '層を通るとデータの形がどう変わるのか、実際に数を入れて見ます',
    ids: ['activation', 'gradient', 'convolution', 'attention'],
  },
];

export function Tools(): JSX.Element {
  // GROUPS には、これから作るぶんも含めてウィジェットの id を並べてある。
  // そのため先頭のグループが 1 つも実装されていないことがあり、既定で開くと
  // 「この分類のツールはまだ用意されていません」だけの画面になる。
  // 実際にブラウザで開いて見つけた（先頭の「数と確率」が 0 個だった）。
  // 中身のあるグループを初期表示にする。
  const firstFilled = GROUPS.find((g) => g.ids.some((id) => widgetIds.includes(id))) ?? GROUPS[0];
  const [openGroup, setOpenGroup] = useState<string>(firstFilled.name);
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const others = widgetIds.filter((id) => !known.has(id));

  if (widgetIds.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>体験ツール</h1>
          <p className="lead">
            文章だけでは掴みにくいところを、数値を動かして確かめるための道具です。教本の該当セクションにも同じものが埋め込まれます。
          </p>
        </header>
        <section className="section">
          <p className="hint">
            体験ツールはまだ 1 つも用意されていません。
            <code>src/components/widgets/</code> にファイルを追加すると、この画面と教本本文の両方で自動的に使えるようになります。
          </p>
        </section>
        <div className="read-actions">
          <button type="button" className="btn primary" onClick={() => navigate('textbook')}>
            教本を読む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>体験ツール</h1>
        <p className="lead">
          文章だけでは掴みにくいところを、数値を動かして確かめるための道具です。教本の該当セクションにも同じものが埋め込まれています。
        </p>
      </header>

      <div className="chips">
        {GROUPS.map((g) => (
          <button
            key={g.name}
            type="button"
            className={`chip ${openGroup === g.name ? 'on' : ''}`}
            onClick={() => setOpenGroup(g.name)}
          >
            {g.name}（{g.ids.filter((id) => widgetIds.includes(id)).length}）
          </button>
        ))}
      </div>

      {GROUPS.filter((g) => g.name === openGroup).map((g) => {
        const ready = g.ids.filter((id) => widgetIds.includes(id));
        return (
          <section key={g.name} className="section">
            <h2>{g.name}</h2>
            <p className="hint">{g.note}</p>
            {ready.length === 0 && <p className="hint">この分類のツールはまだ用意されていません。</p>}
            {ready.map((id) => (
              <Widget key={id} id={id} />
            ))}
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="section">
          <h2>その他</h2>
          {others.map((id) => (
            <Widget key={id} id={id} />
          ))}
        </section>
      )}
    </div>
  );
}
