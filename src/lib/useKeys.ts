import { useEffect } from 'react';

/**
 * 画面全体のキーボードショートカット。
 * 入力欄にフォーカスがあるときと、修飾キーを伴うときは何もしない
 * （ブラウザ標準の操作を奪わないため）。
 */
export function useKeys(handler: (key: string) => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      handler(e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler]);
}

/** 「1」〜「4」が押されたら 0〜3 を返す。それ以外は null */
export function choiceIndexOf(key: string, max = 4): number | null {
  const n = Number(key);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}
