import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { Button, Label, Loader, Modal, Text, TextInput, useToaster } from "@gravity-ui/uikit";
import {
  fetchMfaStatus,
  beginTotp,
  confirmTotp,
  disableTotp,
  regenerateRecoveryCodes,
} from "../../services/api";

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

export default function MfaCard({ profile }) {
  const toaster = useToaster();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const has2fa = status?.has_totp === true;

  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  const recoveryLeft = useMemo(() => status?.recovery_codes_left ?? 0, [status]);

  async function loadStatus() {
    setLoading(true);
    try {
      const data = await fetchMfaStatus();
      setStatus(data);
    } catch (e) {
      toaster.add({
        title: "2FA",
        content: "Не удалось загрузить статус 2FA.",
        theme: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function startSetup() {
    setLoading(true);
    try {
      const data = await beginTotp();
      setSetup(data);
      setRecoveryCodes(null);
      setCode("");
    } catch (e) {
      toaster.add({
        title: "2FA",
        content: "Не удалось начать настройку TOTP.",
        theme: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setConfirming(true);
    try {
      const res = await confirmTotp(code.trim());
      setRecoveryCodes(res?.recovery_codes || null);
      toaster.add({
        title: "2FA",
        content: "TOTP включена.",
        theme: "success",
      });
      setSetup(null);
      setCode("");
      await loadStatus();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.code ||
        "Код не принят. Проверьте и попробуйте снова.";
      toaster.add({ title: msg, theme: "danger" });
    } finally {
      setConfirming(false);
    }
  }

  async function onDisable() {
    setLoading(true);
    try {
      await disableTotp();
      toaster.add({ title: "2FA отключена", theme: "info" });
      setRecoveryCodes(null);
      setSetup(null);
      await loadStatus();
    } catch (err) {
      toaster.add({
        title: "2FA",
        content: "Не удалось отключить TOTP.",
        theme: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  async function onRegenerateRecovery() {
    setRegenBusy(true);
    try {
      const codes = await regenerateRecoveryCodes();
      setRecoveryCodes(codes);
      toaster.add({
        title: "Новые коды восстановления",
        content: "Сохраните их в надёжном месте. Старые коды стали недействительными.",
        theme: "info",
      });
      await loadStatus();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Не удалось сгенерировать новые коды.";
      toaster.add({ title: msg, theme: "danger" });
    } finally {
      setRegenBusy(false);
    }
  }

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <h3 style={{ margin: 0, fontSize: 18 }}>
          Двухфакторная аутентификация (TOTP)
        </h3>
        {loading ? (
          <Loader size="s" />
        ) : has2fa ? (
          <Label theme="success" size="m">
            Включена
          </Label>
        ) : (
          <Label theme="normal" size="m">
            Выключена
          </Label>
        )}
      </div>

      <div style={{ opacity: 0.8 }}>
        Используйте приложение-аутентификатор (Google Authenticator, 1Password и
        т.п.) для генерации одноразовых кодов.
      </div>

      {setup ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Отсканируйте QR или введите ключ вручную
            </div>
            <div
              style={{ background: "#fff", padding: 12, borderRadius: 8 }}
              dangerouslySetInnerHTML={{ __html: setup.svg }}
            />
            <div style={{ opacity: 0.8, fontSize: 12, marginTop: 6 }}>
              Резервный ключ: <code>{setup.secret}</code>
            </div>
          </div>
          <form
            onSubmit={onConfirm}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <TextInput
              size="l"
              label="Код из приложения"
              value={code}
              onUpdate={setCode}
              name="totp_code"
              autoComplete="one-time-code"
            />
            <Button view="action" type="submit" loading={confirming}>
              Подтвердить
            </Button>
            <Button view="flat" type="button" onClick={() => setSetup(null)}>
              Отмена
            </Button>
          </form>
        </div>
      ) : has2fa ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <b>2FA активна.</b> Осталось кодов восстановления: {recoveryLeft}.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button view="outlined-danger" onClick={onDisable} disabled={loading}>
              Отключить TOTP
            </Button>
            <Button view="outlined" onClick={onRegenerateRecovery} disabled={regenBusy}>
              Сгенерировать новые коды
            </Button>
            <Button view="flat" onClick={() => setInfoOpen(true)}>
              Как использовать
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button view="normal" onClick={startSetup} disabled={loading}>
            Включить 2FA
          </Button>
          <Button view="flat" onClick={() => setInfoOpen(true)}>
            Инструкция
          </Button>
        </div>
      )}

      {recoveryCodes?.length ? (
        <div
          style={{
            background: "#0f172a",
            color: "#e2e8f0",
            padding: 12,
            borderRadius: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Коды восстановления
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            {recoveryCodes.map((c) => (
              <code key={c} style={{ padding: 4, background: "#111827", borderRadius: 6 }}>
                {c}
              </code>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
            Сохраните коды в надёжном месте. Они нужны, если потеряете доступ к приложению-аутентификатору.
          </div>
        </div>
      ) : null}

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        style={{ "--g-modal-width": "520px" }}
      >
        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          <h4 style={{ margin: 0 }}>Как настроить 2FA</h4>
          <Text>
            1. Нажмите «Включить 2FA» и отсканируйте QR-код в приложении-аутентификаторе
            (Google Authenticator, 1Password и т.п.).
          </Text>
          <Text>2. Введите одноразовый код из приложения, чтобы подтвердить включение.</Text>
          <Text>
            3. Сохраните коды восстановления. Они понадобятся, если потеряете устройство или доступ к приложению.
          </Text>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button view="action" onClick={() => setInfoOpen(false)}>
              Понятно
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

MfaCard.propTypes = {
  profile: PropTypes.shape({
    has_2fa: PropTypes.bool,
  }),
};

MfaCard.defaultProps = {
  profile: null,
};
