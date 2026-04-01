/**
 * Activity Types Unit Tests
 *
 * Tests for type guards and utility functions.
 */

import { describe, expect, it } from 'vitest';
import {
  isActivityEvent,
  isErrorResponse,
  isFeedResponseV2,
  type ActivityEvent,
  type ErrorResponse,
  type FeedResponseV2,
} from './activity';

describe('Activity Types', () => {
  describe('isActivityEvent', () => {
    it('should return true when value is a valid ActivityEvent', () => {
      const event: ActivityEvent = {
        id: 1,
        tenantId: 'tenant-uuid',
        actorUserId: 'user-uuid',
        targetUserId: null,
        type: 'vote.cast',
        occurredAt: '2026-01-15T12:00:00Z',
        title: 'User voted',
        payloadJson: { poll_id: 123 },
        visibility: 'public',
        scopeType: 'COMMUNITY',
        scopeId: 'community-uuid',
        sourceRef: 'voting:poll:123',
      };

      expect(isActivityEvent(event)).toBe(true);
    });

    it.each([null, undefined, 'string', 123, true])(
      'should return false when value is %p',
      (value) => {
        expect(isActivityEvent(value)).toBe(false);
      },
    );

    it.each([
      {},
      { id: 1 },
      { id: 1, type: 'vote.cast' },
      { id: 1, type: 'vote.cast', title: 'Test' },
    ])('should return false when required fields are missing: %p', (value) => {
      expect(isActivityEvent(value)).toBe(false);
    });

    it('should return true when minimal required fields are present', () => {
      const minimal = {
        id: 1,
        type: 'vote.cast',
        title: 'Test',
        occurredAt: '2026-01-15T12:00:00Z',
      };
      expect(isActivityEvent(minimal)).toBe(true);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true when value is a valid ErrorResponse', () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'name' },
          requestId: 'req-123',
        },
      };

      expect(isErrorResponse(errorResponse)).toBe(true);
    });

    it('should return true when minimal ErrorResponse fields are present', () => {
      const minimal = {
        error: {
          code: 'ERROR',
          message: 'Something went wrong',
        },
      };
      expect(isErrorResponse(minimal)).toBe(true);
    });

    it.each([null, {}, { message: 'error' }, { error: 'string error' }, { error: null }])(
      'should return false for invalid error response: %p',
      (value) => {
        expect(isErrorResponse(value)).toBe(false);
      },
    );
  });

  describe('isFeedResponseV2', () => {
    it('should return true when value is a valid FeedResponseV2', () => {
      const response: FeedResponseV2 = {
        items: [
          {
            id: 1,
            tenantId: 'tenant-uuid',
            actorUserId: 'user-uuid',
            targetUserId: null,
            type: 'vote.cast',
            occurredAt: '2026-01-15T12:00:00Z',
            title: 'User voted',
            payloadJson: {},
            visibility: 'public',
            scopeType: 'COMMUNITY',
            scopeId: 'community-uuid',
            sourceRef: 'voting:poll:123',
          },
        ],
        nextCursor: 'cursor-abc',
        hasMore: true,
      };

      expect(isFeedResponseV2(response)).toBe(true);
    });

    it('should return true when items is an empty array and hasMore is provided', () => {
      const response: FeedResponseV2 = {
        items: [],
        nextCursor: null,
        hasMore: false,
      };

      expect(isFeedResponseV2(response)).toBe(true);
    });

    it.each([null, {}, { items: 'not-array' }, { items: [] }])(
      'should return false for invalid feed response: %p',
      (value) => {
        expect(isFeedResponseV2(value)).toBe(false);
      },
    );
  });
});

describe('Type Enums', () => {
  const sourceTypes = ['steam', 'minecraft', 'discord', 'custom'] as const;
  const accountLinkStatuses = ['active', 'pending', 'disabled', 'error'] as const;
  const activityEventTypes = [
    'vote.cast',
    'event.created',
    'event.rsvp.changed',
    'post.created',
    'game.achievement',
    'game.playtime',
    'steam.private',
    'minecraft.session',
  ] as const;
  const healthStatuses = ['ok', 'degraded', 'error'] as const;

  it.each(sourceTypes)('should include SourceType value %s', (value) => {
    expect(sourceTypes).toContain(value);
  });

  it.each(accountLinkStatuses)('should include AccountLinkStatus value %s', (value) => {
    expect(accountLinkStatuses).toContain(value);
  });

  it.each(activityEventTypes)('should include ActivityEventType value %s', (value) => {
    expect(activityEventTypes).toContain(value);
  });

  it.each(healthStatuses)('should include HealthStatus value %s', (value) => {
    expect(healthStatuses).toContain(value);
  });
});
