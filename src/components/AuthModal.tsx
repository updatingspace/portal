import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button, TextInput, useToaster } from "@gravity-ui/uikit";
import {
  beginPasskeyLogin,
  completePasskeyLogin,
  doLogin,
  doSignupAndLogin,
  ApiError,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function AuthModal({ open = false, onClose }) {
  const [mode, setMode] = useState<"login" | "signup" | "mfa">("login");
  const [busy, setBusy] = useState(false);
  const { refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaDigits, setMfaDigits] = useState<string[]>(Array(6).fill(""));
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suPassword2, setSuPassword2] = useState("");

  const toaster = useToaster();
  const isLogin = mode === "login";
  const isMfa = mode === "mfa";
  const title = useMemo(() => {
    if (mode === "signup") return "Регистрация";
    if (mode === "mfa") return "Подтвердите код";
    return "Вход";
  }, [mode]);

  function resetForms() {
    setEmail("");
    setPassword("");
    setMfaDigits(Array(6).fill(""));
    setRecoveryMode(false);
    setSuUsername("");
    setSuEmail("");
    setSuPassword("");
    setSuPassword2("");
  }

  function close() {
    resetForms();
    setBusy(false);
    onClose?.();
  }

  useEffect(() => {
    if (!open) {
      resetForms();
      setMode("login");
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    setMfaDigits(Array(recoveryMode ? 8 : 6).fill(""));
  }, [recoveryMode]);

  const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  function validateLogin(): string | null {
    if (!email.trim()) return "Укажите email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Неверный формат email.";
    if (!password) return "Введите пароль.";
    if (password.length < 8) return "Минимальная длина пароля — 8 символов.";
    return null;
  }

  function validateSignup(): string | null {
    if (!suUsername.trim()) return "Укажите имя пользователя.";
    if (!suEmail.trim()) return "Укажите email.";
    if (!emailOk(suEmail)) return "Неверный формат email.";
    if (!suPassword) return "Введите пароль.";
    if (suPassword.length < 8) return "Минимальная длина пароля — 8 символов.";
    if (suPassword2 !== suPassword) return "Пароли не совпадают.";
    return null;
  }

  function mfaCodeValue() {
    return mfaDigits.join("").replace(/\s+/g, "");
  }

  function setDigit(idx: number, val: string) {
    setMfaDigits((arr) =>
      arr.map((d, i) => (i === idx ? val.replace(/\D/g, "").slice(0, 1) : d)),
    );
  }

  async function onLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateLogin();
    if (err) return toaster.add({ title: err, theme: "warning" });
    setBusy(true);
    try {
      await doLogin({ email, password });
      const p = await refreshProfile();
      if (p) {
        toaster.add({
          title: "Готово!",
          content: `Здравствуйте, ${p.username}.`,
          theme: "success",
        });
      }
      close();
    } catch (ex: any) {
      const r = ex?.response;
      const msg =
        r?.data?.errors?.[0]?.message ||
        r?.data?.detail ||
        r?.data?.message ||
        ex?.message;
      const isMfa =
        (ex instanceof ApiError && ex.status === 401 && ex.message === "mfa_required") ||
        (typeof msg === "string" && msg.toLowerCase().includes("mfa"));
      if (isMfa) {
        setMode("mfa");
        toaster.add({
          title: "Требуется код 2FA",
          theme: "info",
          content: "Введите 6-значный код из приложения.",
        });
      } else {
        toaster.add({ title: msg || "Ошибка входа", theme: "danger" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateSignup();
    if (err) return toaster.add({ title: err, theme: "warning" });
    setBusy(true);
    try {
      await doSignupAndLogin({
        username: suUsername.trim(),
        email: suEmail.trim(),
        password: suPassword,
      });
      const p = await refreshProfile();
      if (p) {
        toaster.add({
          title: "Аккаунт создан",
          content: `Добро пожаловать, ${p.username}!`,
          theme: "success",
        });
      }
      close();
    } catch (ex: any) {
      const r = ex?.response;
      const msg =
        r?.data?.errors?.[0]?.message ||
        r?.data?.detail ||
        r?.data?.message ||
        "Ошибка регистрации";
      toaster.add({ title: msg, theme: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = mfaCodeValue();
    const neededLen = recoveryMode ? 8 : 6;
    if (code.length !== neededLen) {
      toaster.add({
        title: recoveryMode ? "Введите 8-значный код восстановления" : "Введите 6-значный код",
        theme: "warning",
      });
      return;
    }
    setBusy(true);
    try {
      await doLogin({ email, password, mfa_code: code });
      const p = await refreshProfile();
      if (p) {
        toaster.add({
          title: "Готово!",
          content: `Здравствуйте, ${p.username}.`,
          theme: "success",
        });
      }
      close();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Код не подошёл";
      toaster.add({ title: msg, theme: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function onPasskeyLogin() {
    if (!("credentials" in navigator)) {
      toaster.add({ title: "Passkey не поддерживается", theme: "warning" });
      return;
    }
    setBusy(true);
    try {
      const { request_options } = await beginPasskeyLogin();
      const opts = request_options?.publicKey || request_options;
      const decode = (b64?: string) =>
        b64 ? Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)) : undefined;
      // Normalize options into proper ArrayBuffers
      if (opts.challenge) opts.challenge = decode(opts.challenge);
      if (Array.isArray(opts.allowCredentials)) {
        opts.allowCredentials = opts.allowCredentials.map((c: any) => ({
          ...c,
          id: decode(c.id),
        }));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cred: any = await navigator.credentials.get({ publicKey: opts });
      if (!cred) throw new Error("no_credential");
      const enc = (buf?: ArrayBuffer | null) =>
        buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : undefined;
      const credential = {
        id: cred.id,
        rawId: enc(cred.rawId),
        type: cred.type,
        response: {
          clientDataJSON: enc(cred.response.clientDataJSON),
          authenticatorData: enc(
            (cred.response as AuthenticatorAssertionResponse).authenticatorData,
          ),
          signature: enc((cred.response as AuthenticatorAssertionResponse).signature),
          userHandle: enc((cred.response as AuthenticatorAssertionResponse).userHandle || undefined),
        },
      };
      await completePasskeyLogin(credential);
      const p = await refreshProfile();
      if (p) {
        toaster.add({
          title: "Готово!",
          content: `Здравствуйте, ${p.username}.`,
          theme: "success",
        });
      }
      close();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Не удалось войти по Passkey";
      toaster.add({ title: msg, theme: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      aria-labelledby="auth-modal-title"
      style={{ "--g-modal-width": "520px" }}
    >
      <div style={{ padding: 24, display: "grid", gap: 16 }}>
        <h3 id="auth-modal-title" style={{ margin: 0 }}>
          {title}
        </h3>

        {isLogin ? (
          <form onSubmit={onLoginSubmit} style={{ display: "grid", gap: 12 }}>
            <TextInput
              size="l"
              label="Email"
              value={email}
              onUpdate={setEmail}
              name="joutak__email_login"
              autoComplete="email"
              autoFocus
              disabled={busy}
            />
            <TextInput
              size="l"
              type="password"
              label="Пароль"
              value={password}
              onUpdate={setPassword}
              name="joutak__password"
              autoComplete="current-password"
              disabled={busy}
            />
            <Button
              view="action"
              size="l"
              loading={busy}
              width="max"
              type="submit"
            >
              Войти
            </Button>
            <Button
              view="outlined"
              size="l"
              width="max"
              type="button"
              onClick={onPasskeyLogin}
              disabled={busy}
            >
              Войти с Passkey
            </Button>

            <Button
              view="outlined"
              size="l"
              width="max"
              onClick={() => setMode("signup")}
            >
              Нет аккаунта? Зарегистрируйтесь
            </Button>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 4,
              }}
            >
              <Button view="flat" onClick={close}>
                Закрыть
              </Button>
            </div>
          </form>
        ) : mode === "signup" ? (
          <form onSubmit={onSignupSubmit} style={{ display: "grid", gap: 12 }}>
            <TextInput
              size="l"
              label="Никнейм"
              value={suUsername}
              onUpdate={setSuUsername}
              name="joutak__username"
              autoComplete="username"
              disabled={busy}
            />
            <TextInput
              size="l"
              type="email"
              label="Email"
              value={suEmail}
              onUpdate={setSuEmail}
              name="joutak__email"
              autoComplete="email"
              disabled={busy}
            />
            <TextInput
              size="l"
              type="password"
              label="Пароль"
              value={suPassword}
              onUpdate={setSuPassword}
              name="joutak__password"
              autoComplete="new-password"
              disabled={busy}
            />
            <TextInput
              size="l"
              type="password"
              label="Повторите пароль"
              value={suPassword2}
              onUpdate={setSuPassword2}
              name="joutak__password2"
              autoComplete="new-password"
              disabled={busy}
            />
            <Button
              view="action"
              size="l"
              loading={busy}
              width="max"
              type="submit"
            >
              Создать аккаунт
            </Button>
            <Button
              view="outlined"
              size="l"
              width="max"
              onClick={() => setMode("login")}
            >
              У меня уже есть аккаунт
            </Button>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 4,
              }}
            >
              <Button view="flat" onClick={close}>
                Закрыть
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={onMfaSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={{ color: "#555", fontSize: 14 }}>
              У вас подключена 2FA. Введите 6-значный код из приложения-аутентификатора.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${recoveryMode ? 8 : 6}, minmax(0, 1fr))`,
                gap: 8,
              }}
            >
              {mfaDigits.slice(0, recoveryMode ? 8 : 6).map((d, idx) => (
                <input
                  key={idx}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !d && idx > 0) {
                      (e.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
                    }
                  }}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    const lastIndex = (recoveryMode ? 8 : 6) - 1;
                    if (target.value && idx < lastIndex) {
                      (target.nextElementSibling as HTMLInputElement | null)?.focus();
                    }
                  }}
                  style={{
                    fontSize: 24,
                    textAlign: "center",
                    padding: "12px 0",
                    borderRadius: 10,
                    border: "1px solid #cfd8e3",
                    outline: "none",
                    width: "100%",
                    minWidth: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button
                view="outlined"
                size="m"
                onClick={() => setRecoveryMode((v) => !v)}
                disabled={busy}
              >
                {recoveryMode ? "Использовать код из приложения" : "Потерял доступ, код восстановления"}
              </Button>
              <Button view="flat" onClick={() => setMode("login")} disabled={busy}>
                Назад
              </Button>
              <Button view="action" type="submit" loading={busy}>
                Подтвердить код
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

AuthModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};
