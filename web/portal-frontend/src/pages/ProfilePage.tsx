import { useCallback, useEffect, useMemo, useState } from "react";
import { toaster } from "@gravity-ui/uikit/toaster-singleton";
import { me, sessionMe, type AccountProfile, type SessionMe } from "../services/api";
import { logger } from "../utils/logger";

import AvatarCard from "../components/account/AvatarCard";
import ProfileCard from "../components/account/ProfileCard";
import EmailCard from "../components/account/EmailCard";
import PasswordCard from "../components/account/PasswordCard";
import SessionsCard from "../components/account/SessionsCard";
import MfaCard from "../components/account/MfaCard";
import PasskeysCard from "../components/account/PasskeysCard";
import OauthCard from "../components/account/OauthCard";
import { useAuthUI } from "../contexts/AuthUIContext";

const DEFAULT_ID_FRONTEND = "https://id.updspace.com";

const normalizeIdAccountUrl = (base?: string | null): string | null => {
  const raw = (base || "").trim();
  const resolved = raw || DEFAULT_ID_FRONTEND;
  try {
    const url = new URL(resolved);
    url.pathname = "/account";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

function SkeletonLine({ width = "100%", height = 12 }) {
  return (
    <div
      className="skeleton-line"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

function SkeletonBlock({ minHeight = 160 }) {
  return (
    <div
      className="skeleton-block"
      style={{
        minHeight,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
      aria-hidden="true"
    >
      <SkeletonLine width="40%" />
      <SkeletonLine />
      <SkeletonLine width="80%" />
      <SkeletonLine width="60%" />
    </div>
  );
}

function AccountSecuritySkeleton() {
  return (
    <div
      className="container py-4"
      style={{ maxWidth: 960, display: "grid", gap: 24 }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="skeleton-block"
        style={{
          minHeight: 120,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <SkeletonLine width="30%" height={18} />
        <SkeletonLine width="60%" />
      </div>

      <SkeletonBlock minHeight={220} />
      <SkeletonBlock minHeight={160} />
      <SkeletonBlock minHeight={160} />
      <SkeletonBlock minHeight={220} />
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionMe | null>(null);
  const [loading, setLoading] = useState(true);
  const { openAuthModal } = useAuthUI();

  const loadProfile = useCallback(
    async (
      reason: "init" | "manual" = "init",
      cancelledRef?: { current: boolean },
    ) => {
      setLoading(true);
      logger.info("Loading profile", {
        area: "profile",
        event: "load",
        data: { reason },
      });
      const failureTitle =
        reason === "manual"
          ? "Не удалось обновить профиль"
          : "Ошибка загрузки профиля";
      let sessionPayload: SessionMe | null = null;
      try {
        sessionPayload = await sessionMe();
      } catch (sessionError) {
        if (!cancelledRef?.current) {
          logger.warn("Session info load failed", {
            area: "profile",
            event: "session_load",
            data: { reason },
            error: sessionError,
          });
        }
      }
      try {
        const p = await me();
        if (cancelledRef?.current) return;
        setSessionInfo(sessionPayload);
        setProfile(p);
        logger.info("Profile loaded", {
          area: "profile",
          event: "load",
          data: { reason, hasProfile: Boolean(p), hasSession: Boolean(sessionPayload) },
        });
      } catch (e) {
        if (cancelledRef?.current) return;
        setSessionInfo(sessionPayload);
        setProfile(null);
        toaster.add({ name: `profile-${reason}`, title: failureTitle, theme: "danger" });
        logger.warn("Profile load failed", {
          area: "profile",
          event: "load",
          data: { reason, hasSession: Boolean(sessionPayload) },
          error: e,
        });
      }
      if (!cancelledRef?.current) {
        setLoading(false);
      }
    },
    [],
  );

  const reload = useCallback(() => loadProfile("manual"), [loadProfile]);

  useEffect(() => {
    const cancelled = { current: false };
    (async () => {
      try {
        await loadProfile("init", cancelled);
      } catch (e) {
        logger.error("Unexpected error while loading profile", {
          area: "profile",
          event: "load",
          data: { reason: "init" },
          error: e,
        });
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, [loadProfile]);

  const tenantMembership = useMemo(() => {
    if (!sessionInfo) return null;
    if (sessionInfo.tenant_membership) return sessionInfo.tenant_membership;
    const memberships = sessionInfo.id_profile?.memberships;
    if (!Array.isArray(memberships)) return null;
    const tenantId = sessionInfo.tenant?.id;
    const tenantSlug = sessionInfo.tenant?.slug;
    return (
      memberships.find((m) =>
        (tenantId && String(m?.tenant_id) === String(tenantId)) ||
        (tenantSlug && String(m?.tenant_slug) === String(tenantSlug)),
      ) || null
    );
  }, [sessionInfo]);

  const isSystemAdmin = useMemo(() => {
    const flags = sessionInfo?.user?.master_flags as { system_admin?: unknown } | undefined;
    const fromFlags = flags?.system_admin === true;
    return fromFlags || profile?.is_superuser === true;
  }, [sessionInfo, profile]);

  const isTenantAdmin = useMemo(() => {
    const role = (tenantMembership?.base_role || "").toString().toLowerCase();
    return isSystemAdmin || role === "admin" || role === "owner";
  }, [tenantMembership, isSystemAdmin]);

  const idAccountUrl = useMemo(
    () => normalizeIdAccountUrl(sessionInfo?.id_frontend_base_url),
    [sessionInfo?.id_frontend_base_url],
  );

  if (loading) return <AccountSecuritySkeleton />;

  return (
    <div
      className="container py-4"
      style={{ maxWidth: 960, display: "grid", gap: 24 }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {!profile && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openAuthModal("login")}
          >
            Войти / зарегистрироваться
          </button>
        )}
      </div>

      <AvatarCard
        profile={profile}
        onUpdated={reload}
        systemAdmin={isSystemAdmin}
        tenantAdmin={isTenantAdmin}
        tenantRole={tenantMembership?.base_role || null}
        tenantStatus={tenantMembership?.status || null}
        idAccountUrl={idAccountUrl}
      />
      <ProfileCard profile={profile} onUpdated={reload} />
      <EmailCard />
      <PasswordCard />
      <MfaCard profile={profile} />
      {isSystemAdmin ? <PasskeysCard profile={profile} isSystemAdmin={isSystemAdmin} /> : null}
      <OauthCard />
      <SessionsCard />
    </div>
  );
}
