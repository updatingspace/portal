import { useCallback, useEffect, useState } from "react";
import { toaster } from "@gravity-ui/uikit/toaster-singleton";
import { me, type AccountProfile } from "../services/api";
import { logger } from "../utils/logger";

import AccountHero from "../components/account/AccountHero";
import ProfileCard from "../components/account/ProfileCard";
import EmailCard from "../components/account/EmailCard";
import PasswordCard from "../components/account/PasswordCard";
import SessionsCard from "../components/account/SessionsCard";
import MfaCard from "../components/account/MfaCard";
import PasskeysCard from "../components/account/PasskeysCard";
import OauthCard from "../components/account/OauthCard";
import { useAuthUI } from "../contexts/AuthUIContext";

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
      try {
        const p = await me();
        if (cancelledRef?.current) return;
        setProfile(p);
        logger.info("Profile loaded", {
          area: "profile",
          event: "load",
          data: { reason, hasProfile: Boolean(p) },
        });
      } catch (e) {
        if (cancelledRef?.current) return;
        setProfile(null);
        toaster.add({ name: `profile-${reason}`, title: failureTitle, theme: "danger" });
        logger.warn("Profile load failed", {
          area: "profile",
          event: "load",
          data: { reason },
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

      <AccountHero profile={profile} />
      <ProfileCard profile={profile} onUpdated={reload} />
      <EmailCard />
      <PasswordCard />
      <MfaCard profile={profile} />
      {profile?.is_superuser ? <PasskeysCard profile={profile} /> : null}
      <OauthCard />
      <SessionsCard />
    </div>
  );
}
