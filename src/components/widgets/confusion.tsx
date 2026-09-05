import { useState, type JSX } from 'react';

export const widgetId = 'confusion';

/** 0 除算を避けて割合を出す。分母が 0 なら null（画面には「—」と出す） */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/** 割合を百分率の文字列にする。null なら「—」 */
function pct(v: number | null): string {
  if (v === null) return '—';
  return `${Number((v * 100).toFixed(1))} %`;
}

interface Preset {
  name: string;
  note: string;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

/**
 * 混同行列の 4 つの数を動かして、各指標がどう変わるかを確かめる道具。
 *
 * この試験で最も計算問題が出るところなので、
 * **式の形と、分母がどれなのか**を目で覚えられるようにしている。
 * 特に「正解率が高くても役に立たない」不均衡データの場合を、
 * プリセットで一発で作れるようにした。
 */
const PRESETS: Preset[] = [
  { name: '迷惑メール判定', note: '100 通中 20 通が迷惑メール', tp: 18, fp: 7, fn: 2, tn: 73 },
  { name: '見逃しが多い', note: '慎重すぎて拾いきれていない', tp: 8, fp: 2, fn: 12, tn: 78 },
  { name: '誤検知が多い', note: '怪しいものを片端から陽性にした', tp: 19, fp: 40, fn: 1, tn: 40 },
  { name: '不均衡データ', note: '1000 人中 10 人が病気。全員「陰性」と答えた', tp: 0, fp: 0, fn: 10, tn: 990 },
];

export default function ConfusionWidget(): JSX.Element {
  const [tp, setTp] = useState(18);
  const [fp, setFp] = useState(7);
  const [fn, setFn] = useState(2);
  const [tn, setTn] = useState(73);

  const total = tp + fp + fn + tn;
  const accuracy = ratio(tp + tn, total);
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  // F 値は適合率と再現率の調和平均。どちらかが 0 でも 0 除算にならないよう分母で判定する
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);

  const rows: { label: string; v: number; set: (n: number) => void; desc: string }[] = [
    { label: 'TP 真陽性', v: tp, set: setTp, desc: '陽性と判定して、当たり' },
    { label: 'FP 偽陽性', v: fp, set: setFp, desc: '陽性と判定したが、外れ（誤検知）' },
    { label: 'FN 偽陰性', v: fn, set: setFn, desc: '陰性と判定したが、外れ（見逃し）' },
    { label: 'TN 真陰性', v: tn, set: setTn, desc: '陰性と判定して、当たり' },
  ];

  return (
    <>
      <div className="widget-head">
        <h4 className="widget-title">混同行列から、4 つの指標を出してみる</h4>
        <p className="widget-desc">
          4 つの数を動かすと、正解率・適合率・再現率・F 値がどう変わるかが見えます。
          分母がどれなのかを目で覚えてください。
        </p>
      </div>

      <div className="widget-row">
        <span className="widget-field" style={{ minWidth: '5em' }}>
          例を入れる
        </span>
        <span className="chips">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="chip"
              onClick={() => {
                setTp(p.tp);
                setFp(p.fp);
                setFn(p.fn);
                setTn(p.tn);
              }}
            >
              {p.name}
            </button>
          ))}
        </span>
      </div>

      {rows.map((row) => (
        <div className="widget-row" key={row.label}>
          <span className="widget-field" style={{ minWidth: '6em' }}>
            {row.label}
          </span>
          <input
            className="slider"
            type="range"
            min={0}
            max={1000}
            value={row.v}
            onChange={(e) => row.set(Number(e.target.value))}
          />
          <span className="mono" style={{ minWidth: '4em', textAlign: 'right' }}>
            {row.v}
          </span>
        </div>
      ))}

      <table className="widget-table">
        <thead>
          <tr>
            <th />
            <th>実際に陽性</th>
            <th>実際は陰性</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>陽性と判定</td>
            <td className="mono">TP {tp}</td>
            <td className="mono">FP {fp}</td>
          </tr>
          <tr>
            <td>陰性と判定</td>
            <td className="mono">FN {fn}</td>
            <td className="mono">TN {tn}</td>
          </tr>
        </tbody>
      </table>

      <div className="widget-out">
        <div className="out-item">
          <span className="out-label">正解率</span>
          <span className="out-value">{pct(accuracy)}</span>
        </div>
        <div className="out-item">
          <span className="out-label">適合率</span>
          <span className="out-value">{pct(precision)}</span>
        </div>
        <div className="out-item">
          <span className="out-label">再現率</span>
          <span className="out-value">{pct(recall)}</span>
        </div>
        <div className="out-item">
          <span className="out-label">F 値</span>
          <span className="out-value">{pct(f1)}</span>
        </div>
      </div>

      <table className="widget-table">
        <thead>
          <tr>
            <th>指標</th>
            <th>式</th>
            <th>いまの計算</th>
            <th>何を見ているか</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>正解率</td>
            <td className="mono">(TP + TN) / 全体</td>
            <td className="mono">
              ({tp} + {tn}) / {total} ＝ {pct(accuracy)}
            </td>
            <td>全体のうち、当たった割合</td>
          </tr>
          <tr>
            <td>適合率</td>
            <td className="mono">TP / (TP + FP)</td>
            <td className="mono">
              {tp} / ({tp} + {fp}) ＝ {pct(precision)}
            </td>
            <td>陽性と言ったもののうち、当たりの割合</td>
          </tr>
          <tr>
            <td>再現率</td>
            <td className="mono">TP / (TP + FN)</td>
            <td className="mono">
              {tp} / ({tp} + {fn}) ＝ {pct(recall)}
            </td>
            <td>実際に陽性のもののうち、拾えた割合</td>
          </tr>
          <tr>
            <td>F 値</td>
            <td className="mono">適合率と再現率の調和平均</td>
            <td className="mono">
              2 × 適合率 × 再現率 / (適合率 + 再現率) ＝ {pct(f1)}
            </td>
            <td>2 つのバランス</td>
          </tr>
        </tbody>
      </table>

      <p className="widget-note">
        <strong>適合率と再現率は、分子が同じで分母だけが違います。</strong>
        適合率の分母はモデルが陽性と言った全部（TP + FP）、再現率の分母は実際に陽性である全部（TP + FN）です。
        <br />
        「見逃しが多い」を押すと再現率だけが下がり、「誤検知が多い」を押すと適合率だけが下がります。
        <strong>ふつう、一方を上げるともう一方が下がります。</strong>
        <br />
        <strong>「不均衡データ」を押してみてください。</strong>
        全員を「陰性」と答えるだけのモデルなのに、正解率は 99 % になります。
        一方で再現率は 0 %、適合率は分母が 0 になるので計算できません（「—」と出ます）。
        <strong>正解率だけを見てはいけない</strong>のは、このためです。
        <br />
        F 値が相加平均ではなく調和平均なのも、片方が極端に低いモデルを高く評価しないためです。
      </p>
    </>
  );
}
