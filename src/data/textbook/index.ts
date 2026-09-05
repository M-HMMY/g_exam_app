import type { TextbookSection } from '../../types';
import { intro } from './intro';
import { aWhat } from './a-what';
import { bTrend } from './b-trend';
import { cMath } from './c-math';
import { dMl } from './d-ml';
import { eDl } from './e-dl';
import { fLayer } from './f-layer';
import { gSeq } from './g-seq';
import { hRecog } from './h-recog';
import { iGen } from './i-gen';
import { jSocial } from './j-social';
import { kLaw } from './k-law';
import { lEthics } from './l-ethics';

/**
 * 教本の全セクション。CATEGORIES の並び順に対応させている。
 *
 * ファイルは章ごとに 1 つ。複数人（エージェント）で並行して書くとき、
 * 1 ファイル 1 担当にすると衝突しないため。
 */
export const SECTIONS: TextbookSection[] = [
  ...intro,
  ...aWhat,
  ...bTrend,
  ...cMath,
  ...dMl,
  ...eDl,
  ...fLayer,
  ...gSeq,
  ...hRecog,
  ...iGen,
  ...jSocial,
  ...kLaw,
  ...lEthics,
];

export const sectionById = (id: string): TextbookSection | undefined => SECTIONS.find((s) => s.id === id);

export const sectionsOfCategory = (categoryId: string): TextbookSection[] =>
  SECTIONS.filter((s) => s.categoryId === categoryId);

export const totalMinutes = SECTIONS.reduce((sum, s) => sum + s.minutes, 0);
