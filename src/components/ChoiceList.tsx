import type { JSX } from 'react';

export const CHOICE_LABELS = ['ア', 'イ', 'ウ', 'エ', 'オ'];

interface Props {
  choices: readonly string[];
  /** 選択済みの添字。未選択は null */
  selected: number | null;
  /** 正解の添字。正誤を伏せる場合は null */
  answer: number | null;
  /** 解答が確定して正誤を表示している状態か */
  revealed: boolean;
  onSelect: (index: number) => void;
}

export function ChoiceList({ choices, selected, answer, revealed, onSelect }: Props): JSX.Element {
  return (
    <ul className="choices">
      {choices.map((c, i) => {
        const classes = ['choice'];
        if (selected === i) classes.push('selected');
        if (revealed && answer !== null) {
          if (i === answer) classes.push('correct');
          else if (selected === i) classes.push('wrong');
        }
        return (
          <li key={i}>
            <button
              type="button"
              className={classes.join(' ')}
              onClick={() => onSelect(i)}
              disabled={revealed}
              aria-pressed={selected === i}
            >
              <span className="choice-label">{CHOICE_LABELS[i]}</span>
              <span className="choice-text">{c}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
