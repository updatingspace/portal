import { useEffect, useMemo, useState } from "react";
import { Button, Label, Loader, TextInput } from "@gravity-ui/uikit";
import {
  listAuthenticators,
  passkeysBegin,
  passkeysComplete,
  deleteWebAuthnAuthenticators,
  renameWebAuthnAuthenticator,
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

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const bufferDecode = (b64url = "") =>
  Uint8Array.from(atob(b64url.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  ).buffer;

const bufferEncode = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

const prepareCreationOptions = (raw) => {
  const publicKey = raw?.publicKey || raw?.creation_options?.publicKey || raw?.creation_options;
  if (!publicKey) return null;
  const copy = {
    ...publicKey,
    challenge: bufferDecode(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: bufferDecode(publicKey.user.id),
    },
  };
  if (Array.isArray(publicKey.excludeCredentials)) {
    copy.excludeCredentials = publicKey.excludeCredentials.map((cred) => ({
      ...cred,
      id: bufferDecode(cred.id),
    }));
  }
  if (publicKey.authenticatorSelection) {
    copy.authenticatorSelection = { ...publicKey.authenticatorSelection };
  }
  return copy;
};

const credentialToJSON = (cred) => {
  if (!cred) return null;
  return {
    id: cred.id,
    rawId: bufferEncode(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults?.() || {},
    response: {
      attestationObject: bufferEncode(cred.response.attestationObject),
      clientDataJSON: bufferEncode(cred.response.clientDataJSON),
      transports: cred.response.getTransports
        ? cred.response.getTransports()
        : cred.response.transports,
    },
  };
};

export default function PasskeysCard({ profile = null }) {
  const [loading, setLoading] = useState(false);
  const [authenticators, setAuthenticators] = useState([]);
  const [msg, setMsg] = useState("");
  const [supported, setSupported] = useState(true);
  const [nameDrafts, setNameDrafts] = useState({});
  const [newName, setNewName] = useState("Мой Passkey");

  const webauthn = useMemo(
    () => (authenticators || []).filter((a) => a?.type === "webauthn"),
    [authenticators],
  );

  async function reload() {
    setLoading(true);
    setMsg("");
    try {
      const list = await listAuthenticators();
      setAuthenticators(list);
      setSupported(true);
    } catch (e) {
      const m =
        e?.status === 501 || e?.message === "passkeys_not_supported"
          ? "Passkey пока не подключены на сервере."
          : e?.message === "headless_not_authenticated"
            ? "Нужно заново подтвердить учётную запись (reauth) или включить бридж."
            : "Не удалось загрузить список аутентификаторов.";
      setMsg(m);
      if (e?.status === 501 || e?.message === "passkeys_not_supported") {
        setSupported(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function onAddPasskey() {
    setLoading(true);
    setMsg("");
    try {
      if (!("credentials" in navigator) || !navigator.credentials.create) {
        setMsg("Браузер не поддерживает WebAuthn / Passkeys.");
        return;
      }
      const { creation_options } = await passkeysBegin(true);
      const publicKey = prepareCreationOptions(creation_options);
      if (!publicKey) {
        setMsg("Не удалось подготовить данные для Passkey.");
        return;
      }
      const cred = await navigator.credentials.create({ publicKey });
      const json = credentialToJSON(cred);
      await passkeysComplete({
        name: newName || "Passkey",
        credential: json,
        passwordless: true,
      });
      setMsg("Passkey добавлен.");
      setNewName("Мой Passkey");
      await reload();
    } catch (e) {
      if (e?.message === "passkeys_not_supported" || e?.status === 501) {
        setSupported(false);
        setMsg("Passkey пока не поддерживаются на сервере.");
      } else if (e?.name === "NotAllowedError") {
        setMsg("Операция отменена пользователем.");
      } else if (e?.message === "headless_not_authenticated") {
        setMsg(
          "Нужно повторно войти (reauth) или активировать бридж /api/bridge/headless/login.",
        );
      } else if (e?.response?.status === 401) {
        setMsg(
          "Нужно подтвердить действие (reauth). Откройте заново страницу безопасности.",
        );
      } else {
        setMsg(e?.message || "Не удалось создать Passkey.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id) {
    setLoading(true);
    setMsg("");
    try {
      await deleteWebAuthnAuthenticators([id]);
      setMsg("Passkey удалён.");
      await reload();
    } catch (e) {
      const unsupported = e?.message === "passkeys_not_supported" || e?.status === 501;
      setMsg(unsupported ? "Passkey пока не поддерживаются на сервере." : "Не удалось удалить Passkey.");
    } finally {
      setLoading(false);
    }
  }

  async function onRename(id) {
    const nextName = (nameDrafts[id] || "").trim();
    if (!nextName) return;
    setLoading(true);
    setMsg("");
    try {
      await renameWebAuthnAuthenticator(id, nextName);
      setMsg("Название обновлено.");
      setNameDrafts((m) => ({ ...m, [id]: "" }));
      await reload();
    } catch (e) {
      const unsupported = e?.message === "passkeys_not_supported" || e?.status === 501;
      setMsg(
        unsupported
          ? "Passkey пока не поддерживаются на сервере."
          : "Не удалось переименовать Passkey.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!profile?.is_superuser) {
    return (
      <section style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Passkeys</h3>
        <div style={{ opacity: 0.8 }}>
          Управление Passkey временно доступно только администраторам.
        </div>
      </section>
    );
  }

  return (
    <section style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18 }}>Passkeys</h3>
        {loading && <Loader size="s" />}
      </div>

      <div style={{ opacity: 0.8 }}>
        Passkey — аутентификация без пароля (Face ID/Touch ID/Windows Hello) на
        поддерживаемых устройствах.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <TextInput
          size="m"
          placeholder="Название Passkey"
          value={newName}
          onUpdate={setNewName}
          disabled={loading || !supported}
          style={{ minWidth: 200 }}
        />
        <Button view="normal" onClick={onAddPasskey} disabled={loading || !supported}>
          Добавить Passkey
        </Button>
      </div>

      {webauthn?.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {webauthn.map((a) => (
            <div
              key={a.id}
              style={{
                ...row,
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div>
                  <b>{a.name || "Без названия"}</b>{" "}
                  <Label size="s" theme="normal">
                    WebAuthn {a?.is_passwordless ? "· Passkey" : ""}
                  </Label>
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  Создан:{" "}
                  {a.created_at
                    ? new Date(a.created_at * 1000).toLocaleString()
                    : "—"}
                  {a.last_used_at
                    ? ` · Последнее использование: ${new Date(a.last_used_at * 1000).toLocaleString()}`
                    : ""}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <TextInput
                    size="m"
                    placeholder="Новое имя"
                    value={nameDrafts[a.id] || ""}
                    onUpdate={(v) =>
                      setNameDrafts((m) => ({ ...m, [a.id]: v }))
                    }
                  />
                  <Button
                    view="outlined"
                    size="m"
                    onClick={() => onRename(a.id)}
                    disabled={!nameDrafts[a.id]}
                  >
                    Переименовать
                  </Button>
                  <Button
                    view="outlined-danger"
                    size="m"
                    onClick={() => onDelete(a.id)}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ opacity: 0.8 }}>
          {msg || "Пока нет сохранённых Passkey."}
        </div>
      )}

      {msg && webauthn?.length > 0 && <div style={{ opacity: 0.8 }}>{msg}</div>}
    </section>
  );
}

PasskeysCard.defaultProps = {
  profile: null,
};
