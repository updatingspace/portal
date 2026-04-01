/**
 * VoteButton Component
 * 
 * Enhanced action button for submitting votes with loading states, success animation, and revoke capability.
 * 
 * Features:
 * - Loading spinner during mutation
 * - Success checkmark animation (micro-interaction)
 * - Disabled states with tooltip explanations
 * - Revoke button for allow_revoting scenarios
 * - Error state handling
 */

import React, { useState, useEffect } from 'react';
import { Button, Loader, Icon, Tooltip } from '@gravity-ui/uikit';
import { Check, Xmark } from '@gravity-ui/icons';
import type { VoteAction } from '../types';

export interface VoteButtonProps {
  optionId: string;
  nominationId: string;
  pollId: string;
  isSelected: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  disabledReason?: string;
  onVote: (vote: VoteAction) => void;
  onRevoke: (voteId: string) => void;
  existingVoteId?: string;
  children: React.ReactNode;
  size?: 's' | 'm' | 'l' | 'xl';
  className?: string;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  optionId,
  nominationId,
  pollId,
  isSelected,
  isDisabled = false,
  isLoading = false,
  isSuccess = false,
  isError = false,
  disabledReason,
  onVote,
  onRevoke,
  existingVoteId,
  children,
  size = 'm',
  className = '',
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Show success animation briefly
  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);
  
  const handleClick = () => {
    if (isSelected && existingVoteId) {
      onRevoke(existingVoteId);
    } else {
      onVote({ pollId, nominationId, optionId });
    }
  };

  const isButtonDisabled = isDisabled || isLoading || showSuccess;
  
  const button = (
    <Button
      onClick={handleClick}
      disabled={isButtonDisabled}
      view={isSelected ? 'action' : 'outlined'}
      size={size}
      className={`vote-button ${showSuccess ? 'vote-button--success' : ''} ${isError ? 'vote-button--error' : ''} ${className}`}
      aria-label={isSelected ? 'Голос отдан' : 'Проголосовать'}
    >
      {isLoading ? (
        <>
          <Loader size="s" />
          <span>Обработка...</span>
        </>
      ) : showSuccess ? (
        <>
          <Icon data={Check} size={16} />
          <span>Проголосовано!</span>
        </>
      ) : (
        <>
          {children}
          {isSelected && (
            <Icon data={Check} size={14} />
          )}
        </>
      )}
    </Button>
  );
  
  // Error indicator
  const errorIndicator = isError && (
    <div className="vote-button-error" role="alert">
      <Icon data={Xmark} size={16} />
      <span>Ошибка голосования</span>
    </div>
  );
  
  // Wrap with tooltip if disabled
  if (isButtonDisabled && disabledReason) {
    return (
      <div className="vote-button-group">
        <Tooltip content={disabledReason}>
          {button}
        </Tooltip>
        {errorIndicator}
      </div>
    );
  }
  
  return (
    <div className="vote-button-group">
      {button}
      {errorIndicator}
    </div>
  );
};