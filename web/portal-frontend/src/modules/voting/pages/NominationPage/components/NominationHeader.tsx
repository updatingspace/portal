import React from 'react';
import { Link } from 'react-router-dom';

import type { Nomination } from '../../../../../data/nominations';

type NominationHeaderProps = {
  nomination: Nomination;
  votesListLink: string;
};

export const NominationHeader: React.FC<NominationHeaderProps> = ({
  nomination,
  votesListLink,
}) => (
  <header className="mb-3">
    <div className="mt-3">
      <Link to={votesListLink}>← Назад к голосованиям</Link>
    </div>
    <h1 className="page-title">{nomination.title}</h1>
    <p className="text-muted">
      В ходе данного голосования вам доступен выбор одной игры из представленных вариантов. После выбора и
      подтверждения ваш голос будет зафиксирован и учтен в общем счете. Изменения в своем голосе вы можете
      осуществлять до завершения процедуры голосования.
    </p>

    {nomination.description && <p className="mb-3">{nomination.description}</p>}
  </header>
);
