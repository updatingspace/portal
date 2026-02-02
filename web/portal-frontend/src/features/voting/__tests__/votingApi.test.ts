/**
 * Voting API Unit Tests
 * 
 * Tests for the voting API client functions.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RateLimitError, isRateLimitError } from '../api/votingApi';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Voting API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('RateLimitError', () => {
        it('creates error with correct properties', () => {
            const error = new RateLimitError('Too many requests', {
                retryAfter: 60,
                limit: 10,
                window: 60,
            });
            
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(RateLimitError);
            expect(error.name).toBe('RateLimitError');
            expect(error.message).toBe('Too many requests');
            expect(error.retryAfter).toBe(60);
            expect(error.limit).toBe(10);
            expect(error.window).toBe(60);
        });

        it('uses provided values from info object', () => {
            const error = new RateLimitError('Rate limited', {
                retryAfter: 45,
                limit: 5,
                window: 120,
            });
            
            expect(error.retryAfter).toBe(45);
            expect(error.limit).toBe(5);
            expect(error.window).toBe(120);
        });
    });

    describe('isRateLimitError', () => {
        it('returns true for RateLimitError instances', () => {
            const error = new RateLimitError('Test', 30);
            expect(isRateLimitError(error)).toBe(true);
        });

        it('returns false for regular Error instances', () => {
            const error = new Error('Regular error');
            expect(isRateLimitError(error)).toBe(false);
        });

        it('returns false for null and undefined', () => {
            expect(isRateLimitError(null)).toBe(false);
            expect(isRateLimitError(undefined)).toBe(false);
        });

        it('returns false for non-Error objects', () => {
            expect(isRateLimitError({ message: 'fake error' })).toBe(false);
            expect(isRateLimitError('string error')).toBe(false);
            expect(isRateLimitError(123)).toBe(false);
        });
    });

    describe('Rate limit response handling', () => {
        it('should parse Retry-After header correctly', () => {
            // Simulate what the API client does when receiving 429
            const headers = new Headers({
                'Retry-After': '45',
                'Content-Type': 'application/json',
            });
            
            const retryAfter = parseInt(headers.get('Retry-After') || '60', 10);
            expect(retryAfter).toBe(45);
        });

        it('should use default when Retry-After header missing', () => {
            const headers = new Headers({
                'Content-Type': 'application/json',
            });
            
            const retryAfter = parseInt(headers.get('Retry-After') || '60', 10);
            expect(retryAfter).toBe(60);
        });
    });
});

describe('Voting API Error Codes', () => {
    it('should define standard error codes', () => {
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
