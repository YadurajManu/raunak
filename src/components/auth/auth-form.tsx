"use client";
import { APP_NAME } from "@/lib/constants";
import { BrandMark } from "@/components/brand-mark";
import { FakeQR, Sticker, TicketShell } from "@/components/marketing/motifs";
import { ThemeToggle } from "@/components/marketing/footer";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

const schema = z.object({ email: z.email(), password: z.string().min(1) });
const signupSchema = schema.extend({ password: z.string().min(8) });
type Values = z.infer<typeof schema>;

export type AuthBanner = {
  type: "error" | "success" | "info";
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
  };
};

function normalizeAuthError(
  error: unknown,
  mode: "login" | "signup",
  emailInput?: string,
  nextPath: string = "/account",
): {
  banner: AuthBanner;
  fieldError?: { field: "email" | "password"; message: string };
} {
  const code = (error as { code?: string })?.code || "";
  const raw = error instanceof Error ? error.message : String(error || "");

  if (
    code === "auth/email-already-in-use" ||
    raw.includes("auth/email-already-in-use")
  ) {
    const emailParam = emailInput
      ? `email=${encodeURIComponent(emailInput)}&`
      : "";
    return {
      banner: {
        type: "error",
        title: "Account Already Exists",
        message: emailInput
          ? `An account for ${emailInput} is already registered. Sign in or reset your password.`
          : "An account with this email address already exists. Please sign in instead.",
        action: {
          label: "Sign in with this email ↗",
          href: `/login?${emailParam}next=${encodeURIComponent(nextPath)}`,
        },
      },
      fieldError: {
        field: "email",
        message: "Email is already registered. Please sign in instead.",
      },
    };
  }

  if (
    code === "auth/invalid-credential" ||
    raw.includes("auth/invalid-credential") ||
    code === "auth/wrong-password" ||
    raw.includes("auth/wrong-password") ||
    code === "auth/user-not-found" ||
    raw.includes("auth/user-not-found")
  ) {
    if (mode === "login") {
      return {
        banner: {
          type: "error",
          title: "Incorrect Credentials",
          message:
            "The email or password you entered is incorrect. Double-check your details or reset your password.",
          action: {
            label: "Forgot password? Send reset link ↗",
            href: "#forgot",
          },
        },
        fieldError: {
          field: "password",
          message: "Incorrect email or password.",
        },
      };
    }
    return {
      banner: {
        type: "error",
        title: "Sign Up Failed",
        message:
          "Could not create account with the provided details. Please try again.",
      },
    };
  }

  if (code === "auth/weak-password" || raw.includes("auth/weak-password")) {
    return {
      banner: {
        type: "error",
        title: "Password Too Weak",
        message:
          "Firebase requires a stronger password. Please use at least 8 characters.",
      },
      fieldError: {
        field: "password",
        message: "Password must be at least 8 characters.",
      },
    };
  }

  if (code === "auth/invalid-email" || raw.includes("auth/invalid-email")) {
    return {
      banner: {
        type: "error",
        title: "Invalid Email Format",
        message: "Please enter a valid email address.",
      },
      fieldError: {
        field: "email",
        message: "Invalid email format.",
      },
    };
  }

  if (
    code === "auth/too-many-requests" ||
    raw.includes("auth/too-many-requests")
  ) {
    return {
      banner: {
        type: "error",
        title: "Too Many Attempts",
        message:
          "Access to this account has been temporarily disabled due to many failed attempts. Please wait a moment and try again.",
      },
    };
  }

  if (code === "auth/user-disabled" || raw.includes("auth/user-disabled")) {
    return {
      banner: {
        type: "error",
        title: "Account Disabled",
        message: "This account has been disabled. Please contact support.",
      },
    };
  }

  if (
    code === "auth/popup-closed-by-user" ||
    raw.includes("auth/popup-closed-by-user")
  ) {
    return {
      banner: {
        type: "info",
        title: "Sign-In Dismissed",
        message:
          "The Google sign-in window was closed before completing authentication.",
      },
    };
  }

  if (
    code === "auth/network-request-failed" ||
    raw.includes("auth/network-request-failed")
  ) {
    return {
      banner: {
        type: "error",
        title: "Network Connection Error",
        message:
          "Could not connect to authentication services. Please verify your internet connection.",
      },
    };
  }

  const cleaned = raw
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(auth\/[^)]+\)\.?/i, "")
    .trim();

  return {
    banner: {
      type: "error",
      title: "Authentication Failed",
      message:
        cleaned ||
        "Something went wrong while processing your request. Please try again.",
    },
  };
}

export function AuthForm({
  mode,
  nextPath = "/account",
  initialEmail = "",
}: {
  mode: "login" | "signup";
  nextPath?: string;
  initialEmail?: string;
}) {
  const router = useRouter();
  const [banner, setBanner] = useState<AuthBanner | null>(null);
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(mode === "signup" ? signupSchema : schema),
    defaultValues: {
      email: initialEmail || "",
      password: "",
    },
  });

  async function openSession(user: { getIdToken(): Promise<string> }) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: await user.getIdToken(),
        next: nextPath,
        rememberMe,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not start session.");
    router.replace(result.redirectTo || nextPath);
    router.refresh();
  }

  async function submit(values: Values) {
    setBusy(true);
    setBanner(null);
    try {
      const auth = await getClientAuth();
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password,
        );
        await openSession(result.user);
      } else {
        const result = await signInWithEmailAndPassword(
          auth,
          values.email,
          values.password,
        );
        await openSession(result.user);
      }
    } catch (error) {
      const { banner: errBanner, fieldError } = normalizeAuthError(
        error,
        mode,
        values.email,
        nextPath,
      );
      setBanner(errBanner);
      if (fieldError) {
        setError(fieldError.field, {
          type: "manual",
          message: fieldError.message,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setBanner(null);
    try {
      const auth = await getClientAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await openSession(result.user);
    } catch (error) {
      const { banner: errBanner } = normalizeAuthError(
        error,
        mode,
        undefined,
        nextPath,
      );
      setBanner(errBanner);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const email = getValues("email");
    if (!email) {
      setBanner({
        type: "error",
        title: "Email Required",
        message:
          "Please enter your email address first so we know where to send the reset link.",
      });
      setError("email", {
        type: "manual",
        message: "Enter your email address first.",
      });
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(await getClientAuth(), email);
      setBanner({
        type: "success",
        title: "Password Reset Link Sent",
        message: `We've sent a password reset link to ${email}. Check your inbox and spam folder.`,
      });
    } catch (error) {
      const { banner: errBanner, fieldError } = normalizeAuthError(
        error,
        mode,
        email,
        nextPath,
      );
      setBanner(errBanner);
      if (fieldError) {
        setError(fieldError.field, {
          type: "manual",
          message: fieldError.message,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="m-auth-shell">
      <section className="m-auth-art" aria-label={`Welcome to ${APP_NAME}`}>
        <Link href="/" className="m-logo">
          <BrandMark className="m-logo-mark" />
          {APP_NAME}
        </Link>
        <div className="m-auth-art-copy">
          <p className="m-mono">GOOD PEOPLE. GREAT EVENTS.</p>
          <h1>
            Make room
            <br />
            for a little
            <br />
            <em className="m-serif">{APP_NAME.toLowerCase()}.</em>
          </h1>
          <p>
            Throw the event.
            <br />
            We’ll handle the door.
          </p>
        </div>
        <TicketShell
          className="m-auth-ticket"
          stub={
            <div className="m-auth-ticket-stub">
              <span className="m-mono">YOUR NEXT GREAT IDEA</span>
              <FakeQR size={66} />
            </div>
          }
        >
          <div className="m-auth-ticket-body">
            <span className="m-mono">THIS ONE’S ON US</span>
            <h2>
              Your first event.
              <br />
              <em className="m-serif">Free to host.</em>
            </h2>
            <Sticker>ADMIT ONE GREAT IDEA ↗</Sticker>
          </div>
        </TicketShell>
        <p className="m-auth-art-foot m-mono">
          MADE IN INDIA. MADE FOR GETTING TOGETHER.
        </p>
      </section>
      <section className="m-auth-form-panel">
        <div className="m-auth-top">
          <Link href="/" className="m-auth-back">
            ← Back to {APP_NAME}
          </Link>
          <ThemeToggle compact />
        </div>
        <div className="m-auth-form-wrap">
          <p className="m-eyebrow">
            {mode === "login"
              ? "YOUR SEAT IS SAVED"
              : "LET’S MAKE SOMETHING HAPPEN"}
          </p>
          <h2>
            {mode === "login" ? (
              <>
                Good to have
                <br />
                you <em className="m-serif">back.</em>
              </>
            ) : (
              <>
                Your next event
                <br />
                starts <em className="m-serif">here.</em>
              </>
            )}
          </h2>
          <p className="m-auth-subhead">
            {mode === "login"
              ? "Sign in to your events, your crew, and your tickets."
              : "Your first event is free to host. No card needed."}
          </p>
          <label className="m-auth-consent">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={busy}
            />
            <span>Remember me on this device for 14 days</span>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={googleSignIn}
            className="m-google-button"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="var(--google-blue)"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
              />
              <path
                fill="var(--google-green)"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="var(--google-yellow)"
                d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"
              />
              <path
                fill="var(--google-red)"
                d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
              />
            </svg>
            Continue with Google
          </button>
          <div className="m-auth-divider">
            <span>OR, THE CLASSIC WAY</span>
          </div>
          <form onSubmit={handleSubmit(submit)} className="m-auth-form">
            <div className="m-auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <span id="email-error" role="alert" className="m-field-error">
                  {errors.email.message}
                </span>
              )}
            </div>
            <div className="m-auth-field">
              <div className="m-password-label">
                <label htmlFor="password">Password</label>
                {mode === "login" && (
                  <button type="button" disabled={busy} onClick={resetPassword}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="m-password-input">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "signup"
                      ? "At least 8 characters"
                      : "Your password"
                  }
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <span
                  id="password-error"
                  role="alert"
                  className="m-field-error"
                >
                  {errors.password.message}
                </span>
              )}
            </div>
            {mode === "signup" && (
              <label className="m-auth-consent">
                <input type="checkbox" required />
                <span>
                  I agree to the <Link href="/terms">Terms</Link> and{" "}
                  <Link href="/privacy">Privacy Policy</Link>.
                </span>
              </label>
            )}
            <button disabled={busy} className="m-button m-auth-submit">
              {busy
                ? "Just a moment…"
                : mode === "login"
                  ? "Sign in"
                  : "Create your free account"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          {banner && (
            <div
              role={banner.type === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`m-auth-alert m-auth-alert--${banner.type}`}
            >
              <div className="m-auth-alert-icon" aria-hidden="true">
                {banner.type === "success" && (
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    width="18"
                    height="18"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {banner.type === "error" && (
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    width="18"
                    height="18"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {banner.type === "info" && (
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    width="18"
                    height="18"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="m-auth-alert-body">
                <p className="m-auth-alert-title">{banner.title}</p>
                <p className="m-auth-alert-text">{banner.message}</p>
                {banner.action && (
                  <div className="m-auth-alert-action">
                    {banner.action.href === "#forgot" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={resetPassword}
                        className="m-auth-alert-btn"
                      >
                        {banner.action.label}
                      </button>
                    ) : (
                      <Link
                        href={banner.action.href || "#"}
                        className="m-auth-alert-link"
                      >
                        {banner.action.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <p className="m-auth-switch">
            {mode === "login" ? (
              <>
                New around here?{" "}
                <Link href={`/signup?next=${encodeURIComponent(nextPath)}`}>
                  Create an account ↗
                </Link>
              </>
            ) : (
              <>
                Already part of the crew?{" "}
                <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
                  Sign in ↗
                </Link>
              </>
            )}
          </p>
          <p className="m-auth-fine">A little less admin. A lot more event.</p>
        </div>
        <div className="m-auth-bottom">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
