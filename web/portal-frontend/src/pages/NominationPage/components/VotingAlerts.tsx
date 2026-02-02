import React from 'react';
import { Link } from 'react-router-dom';

type VotingAlertsProps = {
  isVotingClosed: boolean;
  deadlineLabel: string | null;
  canVoteNow: boolean;
  needsTelegramLink: boolean;
};

export const VotingAlerts: React.FC<VotingAlertsProps> = ({
  isVotingClosed,
  deadlineLabel,
  canVoteNow,
  needsTelegramLink,
}) => (
  <>
    {isVotingClosed && (
      <div className="status-block status-block-warning">
        <div className="status-title">Голосование завершено</div>
        <p className="text-muted mb-0">
          {deadlineLabel ? `Дедлайн: ${deadlineLabel}. ` : ''}
          Кнопки для отправки голоса отключены, карточки можно листать.
        </p>
      </div>
    )}

    {!isVotingClosed && !canVoteNow && (
      <div className="status-block status-block-warning">
        <div className="status-title">
          {needsTelegramLink ? 'Нужна привязка Telegram' : 'Требуется авторизация'}
        </div>
        <p className="text-muted mb-0">
          {needsTelegramLink ? (
            <>
              Привяжите Telegram во вкладке «Профиль», чтобы участвовать в голосовании.
              {' '}
              <Link to="/profile">Открыть профиль</Link>
            </>
          ) : (
            'Войдите во вкладке «Профиль», чтобы проголосовать. Пока можно изучить варианты.'
          )}
        </p>
      </div>
    )}
  </>
);
