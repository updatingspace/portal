import { z } from 'zod';

const envSchema = z.object({
  VITE_BFF_BASE_URL: z.string().optional(),
  VITE_API_BASE_URL: z.string().optional(),
  VITE_LOGIN_PATH: z.string().optional(),
  VITE_TENANT_HINT: z.string().optional(),
  VITE_SUPPORT_TRACKER_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

const raw = parsed.success ? parsed.data : {};

export const env = {
  apiBaseUrl:
    (raw.VITE_BFF_BASE_URL?.trim() || raw.VITE_API_BASE_URL?.trim() || '/api/v1').replace(/\/$/, ''),
  loginPath: raw.VITE_LOGIN_PATH?.trim() || '/api/v1/auth/login',
  tenantHint: raw.VITE_TENANT_HINT?.trim() || null,
  supportTrackerUrl:
    raw.VITE_SUPPORT_TRACKER_URL?.trim() || 'https://github.com/updatingspace/aef-vote/issues/new',
} as const;
