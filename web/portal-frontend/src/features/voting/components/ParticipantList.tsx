import React from 'react';
import { Label, Text } from '@gravity-ui/uikit';
import type { PollParticipant } from '../types';

export interface ParticipantListProps {
  participants: PollParticipant[];
}

export const ParticipantList: React.FC<ParticipantListProps> = ({ 
  participants 
}) => {
  if (participants.length === 0) {
    return (
      <div className="voting-v2__state-card voting-v2__muted">
        Участники пока не добавлены
      </div>
    );
  }
  
  // Group participants by role
  const participantsByRole: Record<string, PollParticipant[]> = {};
  participants.forEach(participant => {
    if (!participantsByRole[participant.role]) {
      participantsByRole[participant.role] = [];
    }
    participantsByRole[participant.role].push(participant);
  });
  
  const roleOrder = ['owner', 'admin', 'moderator', 'participant', 'observer'];
  const orderedRoles = Object.keys(participantsByRole).sort((a, b) => {
    const indexA = roleOrder.indexOf(a);
    const indexB = roleOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  const statusTheme = {
    pending: 'warning',
    accepted: 'success',
    declined: 'danger',
  } as const;

  return (
    <div className="voting-v2__grid">
      {orderedRoles.map((role) => (
        <div key={role}>
          <Text variant="subheader-1" className="voting-v2__section-title">
            {role} · {participantsByRole[role].length}
          </Text>

          <div className="voting-v2__grid voting-v2__grid--2">
            {participantsByRole[role].map((participant) => (
              <div
                key={participant.user_id}
                className="voting-v2__row"
              >
                <span>{participant.user_id}</span>
                <Label theme={statusTheme[participant.status]} size="xs">
                  {participant.status}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
