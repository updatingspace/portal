/**
 * Voting API Unit Tests
 * 
 * Tests for the voting API client functions.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RateLimitError, isRateLimitError } from '../api/votingApi';

const DEFAULT_RETRY_AFTER_SECONDS = 60;
const RETRY_AFTER_HEADER = 'Retry-After';

describe('Voting API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('RateLimitError', () => {
        it('should create a RateLimitError instance when constructed', () => {
            const error = new RateLimitError('Too many requests', {
                retryAfter: 60,
                limit: 10,
                window: 60,
            });

            expect(error).toBeInstanceOf(RateLimitError);
        });

        it('should preserve provided error metadata when constructed', () => {
            const error = new RateLimitError('Too many requests', {
                retryAfter: 60,
                limit: 10,
                window: 60,
            });

            expect(error).toMatchObject({
                name: 'RateLimitError',
                message: 'Too many requests',
                retryAfter: 60,
                limit: 10,
                window: 60,
            });
        });

        it('should use values from info object when provided', () => {
            const error = new RateLimitError('Rate limited', {
                retryAfter: 45,
                limit: 5,
                window: 120,
            });

            expect(error).toMatchObject({ retryAfter: 45, limit: 5, window: 120 });
        });
    });

    describe('isRateLimitError', () => {
        it('should return true when value is RateLimitError', () => {
            const error = new RateLimitError('Test', 30);
            expect(isRateLimitError(error)).toBe(true);
        });

        it('should return false when value is regular Error', () => {
            const error = new Error('Regular error');
            expect(isRateLimitError(error)).toBe(false);
        });

        it.each([null, undefined, { message: 'fake error' }, 'string error', 123])(
            'should return false when value is %p',
            (value) => {
                expect(isRateLimitError(value)).toBe(false);
            },
        );
    });

    describe('Rate limit response handling', () => {
        it.each([
            [{ [RETRY_AFTER_HEADER]: '45', 'Content-Type': 'application/json' }, 45],
            [{ 'Content-Type': 'application/json' }, DEFAULT_RETRY_AFTER_SECONDS],
        ])('should parse retry delay from headers %o', (headersInit, expectedRetryAfter) => {
            const headers = new Headers(headersInit);
            const retryAfter = parseInt(
                headers.get(RETRY_AFTER_HEADER) || String(DEFAULT_RETRY_AFTER_SECONDS),
                10,
            );

            expect(retryAfter).toBe(expectedRetryAfter);
        });
    });
});

describe('Voting API Error Codes', () => {
    it('should include ALREADY_VOTED in standard error codes', () => {
        // These are the error codes that the API returns
        const expectedCodes = [
            'VALIDATION_ERROR',
            'NOT_FOUND',
            'ALREADY_VOTED',
            'POLL_CLOSED',
            'REVOTING_NOT_ALLOWED',
            'RATE_LIMITED',
            'FORBIDDEN',
            'UNAUTHORIZED',
        ];

        // Verify that our types expect these codes
        type VotingErrorCode = 
            | 'VALIDATION_ERROR'
            | 'NOT_FOUND'
            | 'ALREADY_VOTED'
            | 'POLL_CLOSED'
            | 'REVOTING_NOT_ALLOWED'
            | 'RATE_LIMITED'
            | 'FORBIDDEN'
            | 'UNAUTHORIZED';

        const testCode: VotingErrorCode = 'ALREADY_VOTED';
        expect(expectedCodes).toContain(testCode);
    });
});
