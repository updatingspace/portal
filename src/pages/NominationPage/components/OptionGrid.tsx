import React from 'react';
import { Button } from '@gravity-ui/uikit';

type OptionGridProps = {
  children: React.ReactNode;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageCount: number;
  currentPageIndex: number;
};

export const OptionGrid: React.FC<OptionGridProps> = ({
  children,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  pageCount,
  currentPageIndex,
}) => (
  <div className="option-grid-shell my-4">
    <div className="d-flex align-items-center gap-3 option-grid-shell-row">
      <Button onClick={onPrev} disabled={!canGoPrev}>
        {'<'}
      </Button>

      <div className="option-grid option-grid-roomy">
        {children}
      </div>

      <Button onClick={onNext} disabled={!canGoNext}>
        {'>'}
      </Button>
    </div>
    {pageCount > 1 && (
      <div className="option-grid-page text-muted small">
        Страница {currentPageIndex + 1} из {pageCount}
      </div>
    )}
  </div>
);
