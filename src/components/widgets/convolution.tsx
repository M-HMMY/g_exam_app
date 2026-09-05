import { useState, type JSX } from 'react';

export const widgetId = 'convolution';

/**
 * 畳み込み層の出力サイズとパラメータ数を、設定を動かして確かめる道具。
 *
 * 出力サイズ = (W − F + 2P) / S + 1
 * パラメータ数 = F × F × 入力チャンネル数 × フィルタ枚数 + フィルタ枚数
 *
 * 設定によっては割り切れなかったり、フィルタが入力からはみ出したりする。
 * **そのときに NaN や負の数を画面に出さない**よう、手前で弾いている。
 */
export default function ConvolutionWidget(): JSX.Element {
  const [w, setW] = useState(32);
  const [f, setF] = useState(5);
  const [p, setP] = useState(0);
  const [s, setS] = useState(1);
  const [inCh, setInCh] = useState(3);
  const [filters, setFilters] = useState(16);

  const effective = w - f + 2 * p;
  const fits = effective >= 0;
  const divisible = fits && effective % s === 0;
  const out = fits ? Math.floor(effective / s) + 1 : null;

  const convParams = f * f * inCh * filters + filters;
  // 同じ入出力を全結合層で作った場合。比較のためだけに出す
  const denseParams = out === null ? null : w * w * inCh * (out * out * filters) + out * out * filters;

  const rows: { label: string; v: number; set: (n: number) => void; min: number; max: number }[] = [
    { label: '入力サイズ W', v: w, set: setW, min: 4, max: 128 },
    { label: 'フィルタ F', v: f, set: setF, min: 1, max: 11 },
    { label: 'パディング P', v: p, set: setP, min: 0, max: 5 },
    { label: 'ストライド S', v: s, set: setS, min: 1, max: 4 },
    { label: '入力チャンネル数', v: inCh, set: setInCh, min: 1, max: 64 },
    { label: 'フィルタ枚数', v: filters, set: setFilters, min: 1, max: 128 },
  ];

  return (
    <>
      <div className="widget-head">
        <h4 className="widget-title">畳み込み層の出力サイズとパラメータ数</h4>
        <p className="widget-desc">
          設定を動かすと、出力の大きさとパラメータ数がどう変わるかが見えます。
          <strong>パラメータ数が入力サイズに依存しない</strong>ことを、W を動かして確かめてみてください。
        </p>
      </div>

      {rows.map((row) => (
        <div className="widget-row" key={row.label}>
          <span className="widget-field" style={{ minWidth: '9em' }}>
            {row.label}
          </span>
          <input
            className="slider"
            type="range"
            min={row.min}
            max={row.max}
            value={row.v}
            onChange={(e) => row.set(Number(e.target.value))}
          />
          <span className="mono" style={{ minWidth: '3em', textAlign: 'right' }}>
            {row.v}
          </span>
        </div>
      ))}

      <div className="widget-out">
        <div className="out-item">
          <span className="out-label">出力サイズ</span>
          <span className="out-value">{out === null ? '—' : `${out} × ${out}`}</span>
        </div>
        <div className="out-item">
          <span className="out-label">出力チャンネル数</span>
          <span className="out-value">{filters}</span>
        </div>
        <div className="out-item">
          <span className="out-label">パラメータ数</span>
          <span className="out-value">{convParams.toLocaleString()}</span>
        </div>
      </div>

      <table className="widget-table">
        <thead>
          <tr>
            <th>求めるもの</th>
            <th>式</th>
            <th>いまの計算</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>出力サイズ</td>
            <td className="mono">(W − F + 2P) / S + 1</td>
            <td className="mono">
              ({w} − {f} + {2 * p}) / {s} + 1 ＝ {out === null ? '計算できない' : out}
            </td>
          </tr>
          <tr>
            <td>パラメータ数</td>
            <td className="mono">F × F × 入力ch × 枚数 + 枚数</td>
            <td className="mono">
              {f} × {f} × {inCh} × {filters} + {filters} ＝ {convParams.toLocaleString()}
            </td>
          </tr>
          <tr>
            <td>同じことを全結合層でやると</td>
            <td className="mono">入力の数 × 出力の数 + 出力の数</td>
            <td className="mono">{denseParams === null ? '—' : denseParams.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {!fits && (
        <p className="widget-note">
          <strong>フィルタが入力からはみ出しています。</strong>
          F が W + 2P より大きいので、この設定では畳み込めません。F を小さくするか、P を大きくしてください。
        </p>
      )}
      {fits && !divisible && (
        <p className="widget-note">
          <strong>ストライドで割り切れていません。</strong>
          （W − F + 2P）が S の倍数でないため、端が余ります。ここでは切り捨てて計算しています
          （実装によっては、はみ出す分を切り捨てるか、パディングを足すかが異なります）。
        </p>
      )}

      <p className="widget-note">
        <strong>パディング P を動かすと、出力サイズが変わります。</strong>
        F が奇数のとき、P を (F − 1) / 2 にすると出力サイズが入力と同じに保たれます（S が 1 のとき）。
        F = 5 なら P = 2、F = 3 なら P = 1 です。
        <br />
        <strong>ストライド S を 2 にすると、出力はおよそ半分になります。</strong>
        <br />
        いちばん確かめてほしいのは、
        <strong>入力サイズ W をどれだけ大きくしても、パラメータ数がまったく変わらない</strong>ことです。
        同じフィルタを画像全体で使い回すからで、これを<strong>パラメータの共有</strong>といいます。
        一方、全結合層の欄は W を動かすと爆発的に増えます。畳み込み層が画像に向く理由がここにあります。
      </p>
    </>
  );
}
