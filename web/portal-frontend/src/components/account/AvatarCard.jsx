import { useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Avatar, Button, Label, useToaster } from "@gravity-ui/uikit";

import { deleteAvatar, uploadAvatar } from "../../services/api";

const cardStyle = {
  border: "1px solid #dbe7ff",
  background: "linear-gradient(180deg, #ffffff 0%, #f6f8ff 100%)",
  borderRadius: 14,
  padding: 18,
  display: "grid",
  gap: 12,
  boxShadow: "0 12px 26px rgba(0, 74, 173, 0.12)",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

/**
 * @param {{
 *   profile?: import("../../services/api").AccountProfile | null;
 *   onUpdated?: (() => void) | null;
 *   systemAdmin?: boolean;
 *   tenantAdmin?: boolean;
 *   tenantRole?: string | null;
 *   tenantStatus?: string | null;
 *   idAccountUrl?: string | null;
 * }} props
 */
export default function AvatarCard({
  profile,
  onUpdated,
  systemAdmin = false,
  tenantAdmin = false,
  tenantRole = null,
  tenantStatus = null,
  idAccountUrl = null,
}) {
  const { add } = useToaster();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef(null);

  const avatarUrl = profile?.avatar_url || "";
  const avatarSource = profile?.avatar_source || "none";
  const gravatarEnabled = profile?.avatar_gravatar_enabled !== false;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const displayName =
    fullName || profile?.username || profile?.nickname || "Anonymous";
  const email = profile?.email || "";
  const emailVerified = profile?.email_verified === true;
  const readOnly = !profile;

  const badge = useMemo(() => {
    if (avatarSource === "upload") return { text: "Своя фотография", theme: "success" };
    if (avatarSource === "gravatar") return { text: "Gravatar", theme: "info" };
    if (!gravatarEnabled) return { text: "Без фото", theme: "warning" };
    return { text: "Инициалы", theme: "normal" };
  }, [avatarSource, gravatarEnabled]);

  const roleBadges = useMemo(() => {
    const badges = [];
    if (systemAdmin) {
      badges.push({ key: "sys", text: "Системный администратор", theme: "warning" });
    }
    if (tenantAdmin || tenantRole) {
      const normalizedRole = (tenantRole || "").toString();
      const isAdmin = tenantAdmin || normalizedRole.toLowerCase() === "admin";
      const text = isAdmin ? "Администратор тенанта" : normalizedRole ? `Роль: ${normalizedRole}` : "";
      if (text) badges.push({ key: "tenant-role", text, theme: isAdmin ? "info" : "normal" });
    }
    if (tenantStatus && tenantStatus !== "active") {
      badges.push({ key: "tenant-status", text: `Статус: ${tenantStatus}`, theme: "danger" });
    }
    return badges;
  }, [systemAdmin, tenantAdmin, tenantRole, tenantStatus]);
  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      add({
        name: "avatar-too-big",
        title: "Файл слишком большой",
        content: "Мы принимаем изображения до 6 МБ.",
        theme: "warning",
      });
      event.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const { message } = await uploadAvatar(file);
      add({
        name: "avatar-uploaded",
        title: "Аватар",
        content: message || "Фото обновлено",
        theme: "success",
      });
      onUpdated?.();
    } catch (error) {
      add({
        name: "avatar-upload-failed",
        title: "Не удалось загрузить фото",
        content: error?.message || "Попробуйте другое изображение",
        theme: "danger",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const onRemove = async () => {
    setRemoving(true);
    try {
      const { message } = await deleteAvatar();
      add({
        name: "avatar-removed",
        title: "Аватар",
        content: message || "Фото убрали, вернулись к инициалам",
        theme: "info",
      });
      onUpdated?.();
    } catch (error) {
      add({
        name: "avatar-remove-failed",
        title: "Не удалось удалить фото",
        content: error?.message || "Попробуйте позже",
        theme: "danger",
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Ваш профиль</h3>
          {roleBadges.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {roleBadges.map((b) => (
                <Label key={b.key} size="s" theme={b.theme}>
                  {b.text}
                </Label>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {idAccountUrl ? (
            <Button
              view="outlined-info"
              size="m"
              href={idAccountUrl}
              target="_blank"
              rel="noreferrer"
            >
              Открыть в ID
            </Button>
          ) : null}
          <Button
            view="outlined"
            size="m"
            onClick={() => inputRef.current?.click()}
            loading={uploading}
            disabled={readOnly}
          >
            Загрузить фото
          </Button>
          <Button
            view="flat"
            size="m"
            onClick={onRemove}
            loading={removing}
            disabled={removing || readOnly}
          >
            Убрать / отключить
          </Button>
          <input
            type="file"
            accept="image/*"
            ref={inputRef}
            style={{ display: "none" }}
            onChange={onFileChange}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(96px, 120px) 1fr",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ justifySelf: "center", textAlign: "center" }}>
          <Avatar
            size="xl"
            imgUrl={avatarUrl || undefined}
            text={displayName}
            view="outlined"
            title={displayName}
          />
          <div style={{ marginTop: 8 }}>
            <Label size="xs" theme={badge.theme}>
              {badge.text}
            </Label>
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{displayName}</div>
          {email && (
            <div
              style={{
                opacity: 0.9,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span>
                Email: <b>{email}</b>
              </span>
              {emailVerified ? (
                <Label size="s" theme="success">
                  Подтверждён
                </Label>
              ) : (
                <Label size="s" theme="danger">
                  Не подтверждён
                </Label>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

AvatarCard.propTypes = {
  profile: PropTypes.shape({
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    username: PropTypes.string,
    nickname: PropTypes.string,
    avatar_url: PropTypes.string,
    avatar_source: PropTypes.string,
    avatar_gravatar_enabled: PropTypes.bool,
    email: PropTypes.string,
    email_verified: PropTypes.bool,
  }),
  onUpdated: PropTypes.func,
  systemAdmin: PropTypes.bool,
  tenantAdmin: PropTypes.bool,
  tenantRole: PropTypes.string,
  tenantStatus: PropTypes.string,
  idAccountUrl: PropTypes.string,
};
