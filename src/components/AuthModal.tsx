import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button, TextInput, useToaster, type ToastProps } from "@gravity-ui/uikit";
import {
  beginPasskeyLogin,
  completePasskeyLogin,
  doLogin,
  doSignupAndLogin,
  fetchFormToken,
  ApiError,
  type WebAuthnAssertion,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type AuthModalProps = {
  open?: boolean;
  onClose?: () => void;
};

export default function AuthModal({ open = false, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup" | "mfa">("login");
  const [busy, setBusy] = useState(false);
  const { refreshProfile } = useAuth();

  const [loginFormToken, setLoginFormToken] = useState<string | null>(null);
  const [signupFormToken, setSignupFormToken] = useState<string | null>(null);
  const [loginCooldownUntil, setLoginCooldownUntil] = useState<number | null>(null);
  const [signupCooldownUntil, setSignupCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaDigits, setMfaDigits] = useState<string[]>(Array(6).fill(""));
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suPassword2, setSuPassword2] = useState("");

  const toaster = useToaster();
  const toastSeq = useRef(0);
  const addToast = useCallback(
    (payload: Omit<ToastProps, "name"> & { name?: string }) =>
      toaster.add({
        name: payload.name ?? `auth-${Date.now()}-${toastSeq.current++}`,
        ...payload,
      }),
    [toaster],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const isLogin = mode === "login";
  const title = useMemo(() => {
    if (mode === "signup") return "Регистрация";
    if (mode === "mfa") return "Подтвердите код";
    return "Вход";
  }, [mode]);

  type ErrorResponseData = {
    errors?: { message?: string }[];
    detail?: unknown;
    message?: unknown;
  };

  const extractMessageFromResponse = useCallback((error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null || !("response" in error)) {
      return undefined;
    }
    const response = (error as { response?: { data?: ErrorResponseData } }).response;
    const data = response?.data;
    if (Array.isArray(data?.errors) && typeof data.errors[0]?.message === "string") {
      return data.errors[0].message;
    }
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
    return undefined;
  }, []);

  const getErrorMessage = useCallback(
    (error: unknown, fallback: string): string => {
      const msgFromResponse = extractMessageFromResponse(error);
      if (msgFromResponse) return msgFromResponse;
      if (error instanceof Error && error.message) return error.message;
      if (
        typeof error === "object" &&
        error &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        return (error as { message?: string }).message ?? fallback;
      }
      if (typeof error === "string") return error;
      return fallback;
    },
    [extractMessageFromResponse],
  );

  const loginCooldownLeft = loginCooldownUntil
    ? Math.max(0, Math.ceil((loginCooldownUntil - nowTs) / 1000))
    : 0;
  const signupCooldownLeft = signupCooldownUntil
    ? Math.max(0, Math.ceil((signupCooldownUntil - nowTs) / 1000))
    : 0;

  const loadLoginFormToken = useCallback(async () => {
    try {
      const issued = await fetchFormToken("login");
      setLoginFormToken(issued.token);
      return issued.token;
    } catch (err) {
      const msg = getErrorMessage(err, "Не удалось получить токен формы");
      addToast({ title: msg, theme: "danger" });
      return null;
    }
  }, [addToast, getErrorMessage]);

  const loadSignupFormToken = useCallback(async () => {
    try {
      const issued = await fetchFormToken("register");
      setSignupFormToken(issued.token);
      return issued.token;
    } catch (err) {
      const msg = getErrorMessage(err, "Не удалось получить токен формы");
      addToast({ title: msg, theme: "danger" });
      return null;
    }
  }, [addToast, getErrorMessage]);

  function resetForms() {
    setEmail("");
    setPassword("");
    setMfaDigits(Array(6).fill(""));
    setRecoveryMode(false);
    setSuUsername("");
    setSuEmail("");
    setSuPassword("");
    setSuPassword2("");
    setLoginFormToken(null);
    setSignupFormToken(null);
    setLoginCooldownUntil(null);
    setSignupCooldownUntil(null);
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
    if (open && (mode === "login" || mode === "mfa")) {
      loadLoginFormToken();
    }
  }, [open, mode, loadLoginFormToken]);

  useEffect(() => {
    if (open && mode === "signup") {
      loadSignupFormToken();
    }
  }, [open, mode, loadSignupFormToken]);

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
    if (err) return addToast({ title: err, theme: "warning" });
    setBusy(true);
    try {
      const token = loginFormToken ?? (await loadLoginFormToken());
      const res = await doLogin({ email, password, form_token: token ?? undefined });
      if (!res.ok) {
        if (res.code === "LOGIN_RATE_LIMITED") {
          const retry = (res.retryAfterSeconds ?? 300) * 1000;
          setLoginCooldownUntil(Date.now() + retry);
          addToast({
            title: "Слишком много попыток",
            content: `Попробуйте снова через ${Math.ceil((res.retryAfterSeconds ?? 300))} секунд`,
            theme: "warning",
          });
          return;
        }
        if (res.code === "INVALID_FORM_TOKEN") {
          await loadLoginFormToken();
          addToast({ title: "Обновили токен формы, попробуйте ещё раз", theme: "info" });
          return;
        }
        if (res.code === "MFA_REQUIRED") {
          setMode("mfa");
          addToast({
            title: "Требуется код 2FA",
            theme: "info",
            content: "Введите 6-значный код из приложения.",
          });
          return;
        }
        if (res.code === "INVALID_CREDENTIALS") {
          addToast({ title: "Неверный логин или пароль", theme: "danger" });
          return;
        }
        addToast({ title: res.message ?? "Ошибка входа", theme: "danger" });
        return;
      }
      const p = await refreshProfile();
      if (p) {
        addToast({
          title: "Готово!",
          content: `Здравствуйте, ${p.username}.`,
          theme: "success",
        });
      }
      close();
    } catch (ex: unknown) {
      const msg = extractMessageFromResponse(ex) ?? (ex instanceof Error ? ex.message : undefined);
      const isMfa =
        (ex instanceof ApiError && ex.status === 401 && ex.message === "mfa_required") ||
        (typeof msg === "string" && msg.toLowerCase().includes("mfa"));
      if (isMfa) {
        setMode("mfa");
        addToast({
          title: "Требуется код 2FA",
          theme: "info",
          content: "Введите 6-значный код из приложения.",
        });
      } else {
        addToast({ title: msg || "Ошибка входа", theme: "danger" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateSignup();
    if (err) return addToast({ title: err, theme: "warning" });
    setBusy(true);
    try {
      const token = signupFormToken ?? (await loadSignupFormToken());
      const res = await doSignupAndLogin({
        username: suUsername.trim(),
        email: suEmail.trim(),
        password: suPassword,
        form_token: token ?? undefined,
      });
      if (!res.ok) {
        if (res.code === "REGISTER_RATE_LIMITED") {
          const retry = (res.retryAfterSeconds ?? 600) * 1000;
          setSignupCooldownUntil(Date.now() + retry);
          addToast({
            title: "Слишком много попыток",
            content: `Попробуйте снова через ${Math.ceil((res.retryAfterSeconds ?? 600))} секунд`,
            theme: "warning",
          });
          return;
        }
        if (res.code === "INVALID_FORM_TOKEN") {
          await loadSignupFormToken();
          addToast({ title: "Обновили токен формы, попробуйте ещё раз", theme: "info" });
          return;
        }
        if (res.code === "EMAIL_ALREADY_EXISTS") {
          addToast({ title: "Пользователь с таким e-mail уже есть", theme: "danger" });
          return;
        }
        addToast({ title: res.message ?? "Ошибка регистрации", theme: "danger" });
        return;
      }
      const p = await refreshProfile();
      if (p) {
        addToast({
          title: "Аккаунт создан",
          content: `Добро пожаловать, ${p.username}!`,
          theme: "success",
        });
      }
      close();
    } catch (ex: unknown) {
      const msg = getErrorMessage(ex, "Ошибка регистрации");
      addToast({ title: msg, theme: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = mfaCodeValue();
    const neededLen = recoveryMode ? 8 : 6;
    if (code.length !== neededLen) {
      addToast({
        title: recoveryMode ? "Введите 8-значный код восстановления" : "Введите 6-значный код",
        theme: "warning",
      });
      return;
    }
    setBusy(true);
    try {
      const token = loginFormToken ?? (await loadLoginFormToken());
      const res = await doLogin({ email, password, mfa_code: code, form_token: token ?? undefined });
      if (!res.ok) {
        if (res.code === "LOGIN_RATE_LIMITED") {
          const retry = (res.retryAfterSeconds ?? 300) * 1000;
          setLoginCooldownUntil(Date.now() + retry);
          addToast({
            title: "Слишком много попыток",
            content: `Попробуйте снова через ${Math.ceil((res.retryAfterSeconds ?? 300))} секунд`,
            theme: "warning",
          });
          return;
        }
        if (res.code === "INVALID_FORM_TOKEN") {
          await loadLoginFormToken();
          addToast({ title: "Обновили токен формы, попробуйте ещё раз", theme: "info" });
          return;
        }
        if (res.code === "INVALID_CREDENTIALS") {
          addToast({ title: "Код не подошёл", theme: "danger" });
          return;
        }
        if (res.code === "MFA_REQUIRED") {
          addToast({ title: "Требуется код 2FA", theme: "info" });
          return;
        }
        addToast({ title: res.message ?? "Ошибка входа", theme: "danger" });
        return;
      }
      const p = await refreshProfile();
      if (p) {
        addToast({
          title: "Готово!",
          content: `Здравствуйте, ${p.username}.`,
          theme: "success",
        });
      }
      close();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Код не подошёл");
      addToast({ title: msg, theme: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function onPasskeyLogin() {
    if (!("credentials" in navigator)) {
      addToast({ title: "Passkey не поддерживается", theme: "warning" });
      return;
    }
    setBusy(true);
    try {
      const { request_options } = await beginPasskeyLogin();
      const opts: PublicKeyCredentialRequestOptions =
        (request_options as { publicKey?: PublicKeyCredentialRequestOptions }).publicKey ||
        (request_options as PublicKeyCredentialRequestOptions);
      const decode = (b64: string) =>
        Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      // Normalize options into proper ArrayBuffers
      if (typeof opts.challenge === "string") opts.challenge = decode(opts.challenge);
      if (Array.isArray(opts.allowCredentials)) {
        opts.allowCredentials = opts.allowCredentials.map((c) => ({
          ...c,
          id: typeof c.id === "string" ? decode(c.id) : c.id,
        }));
      }
      const credential = await navigator.credentials.get({ publicKey: opts });
      if (!credential) throw new Error("no_credential");
      if (!(credential instanceof PublicKeyCredential)) {
        throw new Error("unexpected_credential");
      }
      const enc = (buf?: ArrayBuffer | null) =>
        buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : undefined;
      const assertionResponse = credential.response as AuthenticatorAssertionResponse;
      const assertionPayload: WebAuthnAssertion = {
        id: credential.id,
        rawId: enc(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: enc(credential.response.clientDataJSON),
          authenticatorData: enc(assertionResponse.authenticatorData),
          signature: enc(assertionResponse.signature),
          userHandle: enc(assertionResponse.userHandle || undefined),
        },
      };
      await completePasskeyLogin(assertionPayload);
      const p = await refreshProfile();
      if (p) {
        addToast({
          title: "Готово!",
          content: `Здравствуйте, ${p.username}.`,
          theme: "success",
        });
      }
      close();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Не удалось войти по Passkey");
      addToast({ title: msg, theme: "danger" });
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
              disabled={busy || loginCooldownLeft > 0}
            >
              {loginCooldownLeft > 0 ? `Подождите ${loginCooldownLeft}с` : "Войти"}
            </Button>
            <Button
              view="outlined"
              size="l"
              width="max"
              type="button"
              onClick={onPasskeyLogin}
              disabled={busy || loginCooldownLeft > 0}
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
              disabled={busy || signupCooldownLeft > 0}
            >
              {signupCooldownLeft > 0
                ? `Подождите ${signupCooldownLeft}с`
                : "Создать аккаунт"}
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
              <Button
                view="action"
                type="submit"
                loading={busy}
                disabled={busy || loginCooldownLeft > 0}
              >
                {loginCooldownLeft > 0
                  ? `Подождите ${loginCooldownLeft}с`
                  : "Подтвердить код"}
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
