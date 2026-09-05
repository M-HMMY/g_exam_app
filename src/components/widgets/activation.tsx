import { useState, type JSX } from 'react';

export const widgetId = 'activation';

interface Fn {
  id: string;
  name: string;
  /** 関数そのもの */
  f: (x: number) => number;
  /** その微分（傾き） */
  d: (x: number) => number;
  range: string;
  maxSlope: string;
  note: string;
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const FNS: Fn[] = [
  {
    id: 'sigmoid',
    name: 'シグモイド関数',
    f: sigmoid,
    d: (x) => sigmoid(x) * (1 - sigmoid(x)),
    range: '0 から 1',
    maxSlope: '0.25',
    note: '出力を 0〜1 に押し込めるので確率として読める。ただし傾きが最大でも 0.25 しかない',
  },
  {
    id: 'tanh',
    name: 'tanh 関数',
    f: (x) => Math.tanh(x),
    d: (x) => 1 - Math.tanh(x) ** 2,
    range: '−1 から 1',
    maxSlope: '1',
    note: '出力の中心が 0 になる。傾きの最大値が 1 なので、シグモイドより勾配消失が起きにくい',
  },
  {
    id: 'relu',
    name: 'ReLU 関数',
    f: (x) => Math.max(0, x),
    d: (x) => (x > 0 ? 1 : 0),
    range: '0 以上',
    maxSlope: '1',
    note: '正の側で傾きがちょうど 1。何回掛けても 1 のままなので勾配が消えない。負の側は 0 で止まる',
  },
  {
    id: 'leaky',
    name: 'Leaky ReLU 関数',
    f: (x) => (x > 0 ? x : 0.1 * x),
    d: (x) => (x > 0 ? 1 : 0.1),
    range: '制限なし',
    maxSlope: '1',
    note: '負の側にもわずかな傾き（ここでは 0.1）を持たせて、ノードが学習しなくなるのを防ぐ',
  },
];

/** グラフの描画範囲 */
const X_MIN = -6;
const X_MAX = 6;
const Y_MIN = -1.4;
const Y_MAX = 1.6;
const W = 320;
const H = 200;

const sx = (x: number): number => ((x - X_MIN) / (X_MAX - X_MIN)) * W;
const sy = (y: number): number => H - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * H;

/** 折れ線の d 属性を作る。値が有限でない点は飛ばす */
function path(fn: (x: number) => number): string {
  const parts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / 120;
    const y = fn(x);
    if (!Number.isFinite(y)) continue;
    const cy = Math.max(-10, Math.min(H + 10, sy(y)));
    parts.push(`${parts.length === 0 ? 'M' : 'L'} ${sx(x).toFixed(1)} ${cy.toFixed(1)}`);
  }
  return parts.join(' ');
}

/**
 * 活性化関数とその傾きを並べて描き、
 * 「傾きを層の数だけ掛け合わせると何が起きるか」を数値で見せる道具。
 *
 * 勾配消失問題は式で説明しても腹に落ちにくいので、
 * **0.25 を n 回掛けるとどうなるか**を実際に出す。
 */
export default function ActivationWidget(): JSX.Element {
  const [id, setId] = useState('sigmoid');
  const [layers, setLayers] = useState(10);

  const fn = FNS.find((x) => x.id === id) ?? FNS[0];
  const maxSlope = Number(fn.maxSlope);
  const stacked = Math.pow(maxSlope, layers);
  // 極端に小さい値は指数表記のほうが読みやすい
  const stackedText = stacked >= 0.0001 ? String(Number(stacked.toFixed(6))) : stacked.toExponential(2);

  return (
    <>
      <div className="widget-head">
        <h4 className="widget-title">活性化関数と、その傾き</h4>
        <p className="widget-desc">
          実線が関数そのもの、破線がその<strong>傾き</strong>です。
          勾配消失問題は、この<strong>傾きを層の数だけ掛け合わせる</strong>ことで起きます。
        </p>
      </div>

      <div className="widget-row">
        <span className="widget-field" style={{ minWidth: '5em' }}>
          関数
        </span>
        <span className="chips">
          {FNS.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`chip ${id === x.id ? 'on' : ''}`}
              onClick={() => setId(x.id)}
            >
              {x.name}
            </button>
          ))}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="200"
        role="img"
        aria-label={`${fn.name}のグラフと、その傾きのグラフ`}
        style={{ display: 'block', margin: '0.6rem 0' }}
      >
        <line x1={0} y1={sy(0)} x2={W} y2={sy(0)} stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <line x1={sx(0)} y1={0} x2={sx(0)} y2={H} stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <line
          x1={0}
          y1={sy(1)}
          x2={W}
          y2={sy(1)}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.15"
          strokeDasharray="2 3"
        />
        <path d={path(fn.f)} fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d={path(fn.d)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.55"
          strokeDasharray="5 4"
        />
      </svg>

      <div className="widget-out">
        <div className="out-item">
          <span className="out-label">出力の範囲</span>
          <span className="out-value">{fn.range}</span>
        </div>
        <div className="out-item">
          <span className="out-label">傾きの最大値</span>
          <span className="out-value">{fn.maxSlope}</span>
        </div>
      </div>

      <div className="widget-row">
        <span className="widget-field" style={{ minWidth: '9em' }}>
          さかのぼる層の数
        </span>
        <input
          className="slider"
          type="range"
          min={1}
          max={30}
          value={layers}
          onChange={(e) => setLayers(Number(e.target.value))}
        />
        <span className="mono" style={{ minWidth: '3em', textAlign: 'right' }}>
          {layers}
        </span>
      </div>

      <div className="widget-out">
        <div className="out-item">
          <span className="out-label">傾きを {layers} 回掛けると</span>
          <span className="out-value mono">{stackedText}</span>
        </div>
      </div>

      <p className="widget-note">
        {fn.note}
        <br />
        <strong>シグモイドを選んで、層の数を増やしてみてください。</strong>
        傾きの最大値が 0.25 なので、10 層さかのぼるだけで、直すべき量がほぼ 0 になります。
        入力に近い層には何も届きません。これが<strong>勾配消失問題</strong>です。
        <br />
        <strong>ReLU に切り替えると、何層さかのぼっても 1 のまま</strong>です。
        ReLU が広まった理由が、この 1 行に表れています。
        <br />
        なお、ここで掛けているのは<strong>傾きの最大値</strong>です。実際にはもっと小さい値が掛かることも多いので、
        現実の勾配消失はこれより速く進みます。
      </p>
    </>
  );
}
