import { useEffect, useState } from 'react';

import type { CommandHistoryState } from './history';
import { CommandHistory } from './history';

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const useCommandHistoryState = (history: CommandHistory): CommandHistoryState => {
  const [state, setState] = useState<CommandHistoryState>(history.getState());

  useEffect(() => history.subscribe(setState), [history]);

  return state;
};

export const useCommandHotkeys = (
  history: CommandHistory,
  options: { enabled?: boolean; onHandled?: (action: 'undo' | 'redo') => void } = {},
): void => {
  const { enabled = true, onHandled } = options;

  useEffect(() => {
    if (!enabled) return undefined;
    const handleKeydown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const isUndo = (event.metaKey || event.ctrlKey) && key === 'z' && !event.shiftKey;
      const isRedo = (event.metaKey || event.ctrlKey) && (key === 'y' || (key === 'z' && event.shiftKey));
      if (isUndo && history.canUndo()) {
        event.preventDefault();
        history.undo().catch(() => {});
        onHandled?.('undo');
      } else if (isRedo && history.canRedo()) {
        event.preventDefault();
        history.redo().catch(() => {});
        onHandled?.('redo');
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [enabled, history, onHandled]);
};
