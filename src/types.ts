/** アプリ全体で使う型定義 */

/**
 * シラバスの大分類。
 * 公式シラバスは【技術分野】と【法律・倫理分野】の 2 分野構成で、その前に入門編を置く。
 */
export type FieldId = 'intro' | 'tech' | 'law';

/** 中分類（シラバスの「項目」相当）。教本の章と問題のタグを兼ねる */
export interface Category {
  id: string;
  field: FieldId;
  /** 表示名（例: 線形代数） */
  name: string;
  /** 一行説明 */
  summary: string;
  /** この章が公式シラバスのどの項目に当たるか（例: 技術分野 7〜10）。章の扉に出す */
  syllabus: string;
  /** 本番のおおよその出題数の推定値。JDLA は内訳を公表していない（categories.ts の注記を参照） */
  questions: number;
  /**
   * 章の扉に出す導入文（Markdown）。この章で何をやり、なぜ必要で、
   * どれくらい力を入れるべきかを、節を読む前に伝える。
   */
  intro: string;
}

/** 教本の 1 セクション（＝ひとつの学習単位） */
export interface TextbookSection {
  id: string;
  categoryId: string;
  title: string;
  /** 学習の狙い。一覧に出す */
  goal: string;
  /** 本文。Markdown サブセット（見出し/表/箇条書き/コード/強調/$数式$） */
  body: string;
  /** 目安学習時間（分） */
  minutes: number;
}

/**
 * 確認問題（多肢選択式）。
 * G検定は全問が多肢選択式なので、問題の型はこれ 1 つだけ。
 * 本番は 1 問あたり約 41 秒（145 問 / 100 分）しかないため、
 * 問題文は本番で読み切れる長さに収めること。
 */
export interface Question {
  id: string;
  categoryId: string;
  /** 関連する教本セクション（解説からの復習導線に使う）。全問に付けるのが望ましい */
  sectionId?: string;
  question: string;
  /** コード断片（Python / NumPy / PyTorch）。等幅・行番号付きで表示する */
  code?: string;
  choices: [string, string, string, string];
  /** 正解の添字（0=ア, 1=イ, 2=ウ, 3=エ） */
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  /** 体感難易度 1（易）〜3（難） */
  level: 1 | 2 | 3;
  /**
   * 出典。公式例題や引用元がある場合に設定する。
   * 実際の試験問題は非公開なので、原則はオリジナルの練習問題（未設定）。
   */
  source?: string;
}

/** 解答履歴の 1 レコード */
export interface AttemptLog {
  qid: string;
  categoryId: string;
  correct: boolean;
  /** epoch ms */
  at: number;
  /** 出題モード */
  mode: 'practice' | 'review' | 'mock' | 'check' | 'drill';
}

/** SRS（間隔反復）のカード状態。SM-2 を簡略化したもの */
export interface SrsCard {
  qid: string;
  categoryId: string;
  /** 難易度係数 */
  ease: number;
  /** 次回までの間隔（日） */
  interval: number;
  /** 連続正解数 */
  streak: number;
  /** 次回出題日時 epoch ms */
  due: number;
  /** 総解答回数 */
  reps: number;
  lapses: number;
}

/** 模試 1 回分の結果 */
export interface MockResult {
  id: string;
  at: number;
  /** 出題セットの名前（例: 本番形式 145 問） */
  preset: string;
  total: number;
  correct: number;
  /** 所要時間（秒） */
  elapsed: number;
  /** 分野別の正誤 */
  byCategory: Record<string, { total: number; correct: number }>;
}

/**
 * 節ごとの理解度。読了フラグだけでは「読んだが自信がない節」を拾えないため、
 * 3 段階で記録して復習の優先順位に使う。
 */
export type Understanding = 1 | 2 | 3;

/** localStorage に保存する状態のすべて */
export interface AppState {
  version: number;
  /** 読了した教本セクション ID */
  readSections: string[];
  logs: AttemptLog[];
  srs: Record<string, SrsCard>;
  mocks: MockResult[];
  /** 教本の栞（最後に開いたセクション） */
  bookmark?: string;
  /** セクション ID ごとの読了日時（epoch ms）。「今日の進捗」の集計に使う */
  readAt?: Record<string, number>;
  /** 試験日（YYYY-MM-DD）。未設定ならカウントダウン非表示 */
  examDate?: string;
  /** 表示テーマ。既定は 'auto'（OS 追従） */
  theme?: 'light' | 'dark' | 'auto';
  /**
   * セクション ID ごとの理解度（1=もう一度読みたい / 2=だいたい分かった / 3=だいじょうぶ）。
   * 記録がない読了済みの節は「水準は未記録」として扱う。
   */
  understanding?: Record<string, Understanding>;
}
