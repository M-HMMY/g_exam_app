import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { MockResult, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { QuestionCard } from '../components/QuestionCard';
import { CATEGORIES, categoryName, EXAM_QUESTIONS, FIELDS, fieldName, fieldOfCategory } from '../data/categories';
import type { FieldId } from '../types';
import { actions } from '../store';
import { navigate } from '../lib/router';
import { choiceIndexOf, useKeys } from '../lib/useKeys';

interface Item {
  qid: string;
  categoryId: string;
  q: Question;
  answer: number;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const toItem = (q: Question): Item => ({ qid: q.id, categoryId: q.categoryId, q, answer: q.answer });

/**
 * 模試の問題を作る。
 *
 * **JDLA は分野別・項目別の出題数を公表していない。** そのため本番の比率は再現できない。
 * ここでは公式シラバスのキーワード数から按分した推定値（categories.ts の `questions`）を
 * 重みにして章ごとに抽選する。学習の重み付けのための目安であって、本番の内訳ではない。
 * 収録が足りない章があれば、その不足分は他章から補って総数だけは合わせる。
 */
function build(count: number): Item[] {
  const weighted = CATEGORIES.filter((c) => c.questions > 0);
  const totalWeight = weighted.reduce((n, c) => n + c.questions, 0);
  const picked: Item[] = [];
  const used = new Set<string>();

  for (const c of weighted) {
    const want = Math.round((count * c.questions) / totalWeight);
    const pool = shuffle(QUESTIONS.filter((q) => q.categoryId === c.id));
    for (const q of pool.slice(0, want)) {
      picked.push(toItem(q));
      used.add(q.id);
    }
  }

  // 端数と、収録が足りない章の不足分を全体から補う
  if (picked.length < count) {
    const rest = shuffle(QUESTIONS.filter((q) => !used.has(q.id)));
    for (const q of rest.slice(0, count - picked.length)) picked.push(toItem(q));
  }
  return shuffle(picked).slice(0, count);
}

/**
 * 分野ごとの正解数。
 *
 * **点数には換算しない。** G検定は合格基準も、分野別の足切りの有無も公表されていないため、
 * 「何点で合格」という形にすると、根拠のない基準をアプリが作り出してしまう。
 * ここでは弱い分野を見つけるための正答率だけを出す。
 */
function fieldScores(items: Item[], answers: (number | null)[]): { id: FieldId; total: number; correct: number }[] {
  return FIELDS.filter((f) => f.questions > 0).map((f) => {
    let total = 0;
    let correct = 0;
    items.forEach((item, i) => {
      if (fieldOfCategory(item.categoryId) !== f.id) return;
      total += 1;
      if (answers[i] === item.answer) correct += 1;
    });
    return { id: f.id, total, correct };
  });
}

interface Config {
  count: number;
  minutes: number;
}

/**
 * 出題セット。本番は 145 問程度で、**オンラインは 100 分、会場は 120 分**と、
 * 同じ問題数のまま時間が違う。1 問あたりオンライン約 41 秒 / 会場約 50 秒。
 * この差がそのまま体感の厳しさになるので、両方を用意する。
 */
const PRESETS: (Config & { label: string; note: string })[] = [
  {
    label: '本番形式（オンライン）',
    count: EXAM_QUESTIONS,
    minutes: 100,
    note: EXAM_QUESTIONS + ' 問 / 100 分。1 問あたり約 41 秒で、いちばん厳しい設定です',
  },
  {
    label: '本番形式（会場）',
    count: EXAM_QUESTIONS,
    minutes: 120,
    note: EXAM_QUESTIONS + ' 問 / 120 分。問題数は同じで、時間が 20 分長くなります',
  },
  { label: 'ハーフ', count: 72, minutes: 50, note: '72 問 / 50 分。本番と同じペースで半分だけ' },
  { label: '短縮', count: 20, minutes: 14, note: '20 問 / 14 分。すきま時間に' },
];

interface Session {
  config: Config;
  items: Item[];
  answers: (number | null)[];
  idx: number;
  startedAt: number;
  /** 採点済みなら経過秒数を保持 */
  finishedAt: number | null;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function Mock(): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reviewing, setReviewing] = useState(false);

  const running = session !== null && session.finishedAt === null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const remaining = session ? session.config.minutes * 60 - (now - session.startedAt) / 1000 : 0;

  const finish = (s: Session) => {
    const elapsed = Math.round((Date.now() - s.startedAt) / 1000);
    const byCategory: MockResult['byCategory'] = {};
    let correct = 0;
    s.items.forEach((item, i) => {
      const ok = s.answers[i] === item.answer;
      if (ok) correct += 1;
      const entry = byCategory[item.categoryId] ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (ok) entry.correct += 1;
      byCategory[item.categoryId] = entry;
      // 未解答も含めて記録し、SRS へ反映する
      actions.answer({ qid: item.qid, categoryId: item.categoryId, correct: ok, mode: 'mock' });
    });
    actions.addMock({
      id: `mock-${Date.now()}`,
      at: Date.now(),
      preset: `${s.items.length} 問 / ${s.config.minutes} 分`,
      total: s.items.length,
      correct,
      elapsed,
      byCategory,
    });
    setSession({ ...s, finishedAt: Date.now() });
    setReviewing(false);
  };

  // 制限時間の到達で自動採点する
  useEffect(() => {
    if (session && session.finishedAt === null && remaining <= 0) finish(session);
    // finish は session を引数に取るため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session]);

  // 1〜4 で選択、← → で前後の問題へ
  useKeys(
    useCallback(
      (key: string) => {
        if (session === null || session.finishedAt !== null) return;
        const choice = choiceIndexOf(key, 4);
        if (choice !== null) {
          setSession((s) => {
            if (s === null) return s;
            const answers = [...s.answers];
            answers[s.idx] = choice;
            return { ...s, answers };
          });
          return;
        }
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          setSession((s) => {
            if (s === null) return s;
            const delta = key === 'ArrowLeft' ? -1 : 1;
            return { ...s, idx: Math.min(s.items.length - 1, Math.max(0, s.idx + delta)) };
          });
        }
      },
      [session],
    ),
  );

  const unanswered = useMemo(
    () => (session ? session.answers.reduce<number[]>((acc, a, i) => (a === null ? [...acc, i] : acc), []) : []),
    [session],
  );

  // ---- 設定画面 ----
  if (!session) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>模試</h1>
          <p className="lead">
            時間制限つきで通しで解きます。途中で正誤は表示されません。時間配分の感覚をつかむことが目的です。
          </p>
        </header>
        <div className="preset-grid">
          {PRESETS.map((p) => {
            const enough = QUESTIONS.length >= p.count;
            return (
              <button
                key={p.label}
                type="button"
                className="action"
                disabled={!enough}
                onClick={() =>
                  setSession({
                    config: { count: p.count, minutes: p.minutes },
                    items: build(p.count),
                    answers: new Array(p.count).fill(null),
                    idx: 0,
                    startedAt: Date.now(),
                    finishedAt: null,
                  })
                }
              >
                <span className="action-title">{p.label}</span>
                <span className="action-sub">
                  {enough ? p.note : `収録問題が不足しています（現在 ${QUESTIONS.length} 問）`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="hint">
          本番は多肢選択式が {EXAM_QUESTIONS} 問程度、オンライン 100 分・会場 120 分です。
          <strong>合格基準は公表されていません。</strong>分野別の足切りがあるかどうかも公表されていないため、
          このアプリは合否を判定しません。代わりに、正答率・時間内に解き切れたか・どの分野が弱いかを出します。
        </p>
        <p className="hint">
          ※ 試験の形式や問題数は改訂されます（2026 年第 1 回で 160 問・120 分から {EXAM_QUESTIONS} 問・100 分へ変わりました）。
          この記述は 2026 年 9 月時点のものです。最新の試験要項は JDLA の公式サイトで確認してください。
        </p>
      </div>
    );
  }

  // ---- 採点結果 ----
  if (session.finishedAt !== null) {
    const correct = session.items.filter((item, i) => session.answers[i] === item.answer).length;
    const rate = Math.round((correct / session.items.length) * 100);
    const elapsed = Math.round((session.finishedAt - session.startedAt) / 1000);
    const scores = fieldScores(session.items, session.answers);
    const blank = session.answers.filter((a) => a === null).length;
    // この試験で問われるのは速度でもある。持ち時間と実際のペースを比べる
    const perQuestion = elapsed / session.items.length;
    const budget = (session.config.minutes * 60) / session.items.length;
    const byCat = new Map<string, { total: number; correct: number }>();
    session.items.forEach((item, i) => {
      const e = byCat.get(item.categoryId) ?? { total: 0, correct: 0 };
      e.total += 1;
      if (session.answers[i] === item.answer) e.correct += 1;
      byCat.set(item.categoryId, e);
    });

    if (reviewing) {
      return (
        <div className="page">
          <header className="page-head">
            <h1>模試の見直し</h1>
            <p className="hint">誤答と未解答を中心に確認してください。</p>
          </header>
          {session.items.map((item, i) => (
            <QuestionCard
              key={item.qid}
              q={item.q}
              selected={session.answers[i]}
              revealed
              onSelect={() => undefined}
              counter={`${i + 1} / ${session.items.length}`}
            />
          ))}
          <div className="read-actions">
            <button type="button" className="btn" onClick={() => setReviewing(false)}>
              結果へ戻る
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="page">
        <header className="page-head">
          <h1>模試の結果</h1>
        </header>
        <div className="cards">
          <div className="card stat">
            <span className="stat-label">得点</span>
            <span className="stat-value">
              {correct} / {session.items.length}
            </span>
            <span className="stat-sub">正答率 {rate}%</span>
          </div>
          <div className="card stat">
            <span className="stat-label">所要時間</span>
            <span className="stat-value">{formatTime(elapsed)}</span>
            <span className="stat-sub">制限 {session.config.minutes} 分</span>
          </div>
          <div className="card stat">
            <span className="stat-label">解答のペース</span>
            <span className="stat-value">{Math.round(perQuestion)} 秒 / 問</span>
            <span className="stat-sub">
              {blank > 0
                ? `未解答が ${blank} 問。持ち時間は 1 問 ${Math.round(budget)} 秒です`
                : `全問に解答。持ち時間 1 問 ${Math.round(budget)} 秒に対して${perQuestion <= budget ? '間に合っています' : '超えています'}`}
            </span>
          </div>
        </div>

        <section className="section">
          <h2>分野別の正答率</h2>
          <p className="hint">
            <strong>G検定の合格基準は公表されていません。</strong>分野別の足切りの有無も公表されていないため、
            このアプリは合否を判定せず、点数への換算もしません。この表は、どちらの分野に時間を使うべきかを
            決めるためのものです。
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>分野</th>
                  <th>正解 / 出題</th>
                  <th>正答率</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((f) => (
                  <tr key={f.id} className={f.total > 0 && f.correct / f.total < 0.6 ? 'low' : ''}>
                    <td>{fieldName(f.id)}</td>
                    <td>
                      {f.correct} / {f.total}
                    </td>
                    <td>{f.total === 0 ? '出題なし' : `${Math.round((f.correct / f.total) * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section">
          <h2>章別の結果</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>分野</th>
                  <th>正解 / 出題</th>
                  <th>正答率</th>
                </tr>
              </thead>
              <tbody>
                {[...byCat.entries()]
                  .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
                  .map(([cat, e]) => (
                    <tr key={cat} className={e.correct / e.total < 0.6 ? 'low' : ''}>
                      <td>{categoryName(cat)}</td>
                      <td>
                        {e.correct} / {e.total}
                      </td>
                      <td>{Math.round((e.correct / e.total) * 100)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="read-actions">
          <button type="button" className="btn primary" onClick={() => setReviewing(true)}>
            解説を見て復習する
          </button>
          <button type="button" className="btn" onClick={() => setSession(null)}>
            もう一度受ける
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate('stats')}>
            成績分析へ
          </button>
        </div>
      </div>
    );
  }

  // ---- 受験中 ----
  const item = session.items[session.idx];
  const setAnswer = (choice: number) => {
    const answers = [...session.answers];
    answers[session.idx] = choice;
    setSession({ ...session, answers });
  };
  const move = (delta: number) => {
    const idx = Math.min(session.items.length - 1, Math.max(0, session.idx + delta));
    setSession({ ...session, idx });
  };

  return (
    <div className="page">
      <div className={`exam-bar ${remaining < 300 ? 'urgent' : ''}`}>
        <span className="exam-timer">残り {formatTime(remaining)}</span>
        <span className="exam-count">
          解答済み {session.answers.filter((a) => a !== null).length} / {session.items.length}
        </span>
        <button type="button" className="btn small" onClick={() => finish(session)}>
          採点する
        </button>
      </div>

      <QuestionCard
        q={item.q}
        selected={session.answers[session.idx]}
        revealed={false}
        onSelect={setAnswer}
        counter={`${session.idx + 1} / ${session.items.length}`}
        hideResult
      />

      <div className="exam-nav">
        <button type="button" className="btn" disabled={session.idx === 0} onClick={() => move(-1)}>
          ← 前の問題
        </button>
        <button
          type="button"
          className="btn"
          disabled={session.idx === session.items.length - 1}
          onClick={() => move(1)}
        >
          次の問題 →
        </button>
      </div>
      <p className="kbd-hint">
        <kbd>1</kbd>〜<kbd>4</kbd> で選択、<kbd>←</kbd> <kbd>→</kbd> で問題を移動できます
      </p>

      <section className="section">
        <h2>解答状況</h2>
        <div className="grid-nav">
          {session.items.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`grid-cell ${session.answers[i] !== null ? 'filled' : ''} ${i === session.idx ? 'current' : ''}`}
              onClick={() => setSession({ ...session, idx: i })}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {unanswered.length > 0 && <p className="hint">未解答が {unanswered.length} 問あります。</p>}
      </section>
    </div>
  );
}
