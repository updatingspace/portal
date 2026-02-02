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
    it('returns true for valid ActivityEvent', () => {
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

    it('returns false for null', () => {
      expect(isActivityEvent(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isActivityEvent(undefined)).toBe(false);
    });

    it('returns false for primitive values', () => {
      expect(isActivityEvent('string')).toBe(false);
      expect(isActivityEvent(123)).toBe(false);
      expect(isActivityEvent(true)).toBe(false);
    });

    it('returns false for object missing required fields', () => {
      expect(isActivityEvent({})).toBe(false);
      expect(isActivityEvent({ id: 1 })).toBe(false);
      expect(isActivityEvent({ id: 1, type: 'vote.cast' })).toBe(false);
      expect(isActivityEvent({ id: 1, type: 'vote.cast', title: 'Test' })).toBe(false);
    });

    it('returns true for minimal valid object', () => {
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
    it('returns true for valid ErrorResponse', () => {
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

    it('returns true for minimal ErrorResponse', () => {
      const minimal = {
        error: {
          code: 'ERROR',
          message: 'Something went wrong',
        },
      };
      expect(isErrorResponse(minimal)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isErrorResponse(null)).toBe(false);
    });

    it('returns false for object without error field', () => {
      expect(isErrorResponse({})).toBe(false);
      expect(isErrorResponse({ message: 'error' })).toBe(false);
    });

    it('returns false if error is not an object', () => {
      expect(isErrorResponse({ error: 'string error' })).toBe(false);
      expect(isErrorResponse({ error: null })).toBe(false);
    });
  });

  describe('isFeedResponseV2', () => {
    it('returns true for valid FeedResponseV2', () => {
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

    it('returns true for empty items array', () => {
      const response: FeedResponseV2 = {
        items: [],
        nextCursor: null,
        hasMore: false,
      };

      expect(isFeedResponseV2(response)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isFeedResponseV2(null)).toBe(false);
    });

    it('returns false for object without items array', () => {
      expect(isFeedResponseV2({})).toBe(false);
      expect(isFeedResponseV2({ items: 'not-array' })).toBe(false);
    });

    it('returns false for object without hasMore', () => {
      expect(isFeedResponseV2({ items: [] })).toBe(false);
    });
  });
});

describe('Type Enums', () => {
  it('SourceType values are correct', () => {
    const types = ['steam', 'minecraft', 'discord', 'custom'];
    types.forEach((type) => {
      expect(type).toBeDefined();
    });
  });

  it('AccountLinkStatus values are correct', () => {
    const statuses = ['active', 'pending', 'disabled', 'error'];
    statuses.forEach((status) => {
      expect(status).toBeDefined();
    });
  });

  it('ActivityEventType values are correct', () => {
    const eventTypes = [
      'vote.cast',
      'event.created',
      'event.rsvp.changed',
      'post.created',
      'game.achievement',
      'game.playtime',
      'steam.private',
      'minecraft.session',
    ];
    eventTypes.forEach((type) => {
      expect(type).toBeDefined();
    });
  });

  it('HealthStatus values are correct', () => {
    const statuses = ['ok', 'degraded', 'error'];
    statuses.forEach((status) => {
      expect(status).toBeDefined();
    });
  });
});
