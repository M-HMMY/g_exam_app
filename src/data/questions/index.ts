import type { Question } from '../../types';
import { aWhatQuestions } from './a-what';
import { bTrendQuestions } from './b-trend';
import { cMathQuestions } from './c-math';
import { dMlQuestions } from './d-ml';
import { eDlQuestions } from './e-dl';
import { fLayerQuestions } from './f-layer';
import { gSeqQuestions } from './g-seq';
import { hRecogQuestions } from './h-recog';
import { iGenQuestions } from './i-gen';
import { jSocialQuestions } from './j-social';
import { kLawQuestions } from './k-law';
import { lEthicsQuestions } from './l-ethics';

/** 確認問題の全体。入門編は前提をそろえる章なので確認問題を持たない。 */
export const QUESTIONS: Question[] = [
  ...aWhatQuestions,
  ...bTrendQuestions,
  ...cMathQuestions,
  ...dMlQuestions,
  ...eDlQuestions,
  ...fLayerQuestions,
  ...gSeqQuestions,
  ...hRecogQuestions,
  ...iGenQuestions,
  ...jSocialQuestions,
  ...kLawQuestions,
  ...lEthicsQuestions,
];

export const questionById = (id: string): Question | undefined => QUESTIONS.find((q) => q.id === id);

export const questionsOfCategory = (categoryId: string): Question[] =>
  QUESTIONS.filter((q) => q.categoryId === categoryId);

export const questionsOfSection = (sectionId: string): Question[] =>
  QUESTIONS.filter((q) => q.sectionId === sectionId);
