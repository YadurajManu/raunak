"use client";
import { APP_NAME } from "@/lib/constants";
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
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

const schema = z.object({ email: z.email(), password: z.string().min(1) });
const signupSchema = schema.extend({ password: z.string().min(8) });
type Values = z.infer<typeof schema>;

export function AuthForm({
  mode,
  nextPath = "/account",
}: {
  mode: "login" | "signup";
  nextPath?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(mode === "signup" ? signupSchema : schema),
  });

  async function openSession(user: { getIdToken(): Promise<string> }) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: await user.getIdToken(),
        next: nextPath,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not start session.");
    router.push(result.redirectTo || nextPath);
    router.refresh();
  }

  async function submit(values: Values) {
    setBusy(true);
    setMessage("");
    try {
      const auth = await getClientAuth();
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password,
        );
        await sendEmailVerification(result.user, {
          url: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
        });
        await signOut(auth);
        setMessage("Check your inbox to verify your email, then sign in.");
      } else {
        const result = await signInWithEmailAndPassword(
          auth,
          values.email,
          values.password,
        );
        await openSession(result.user);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setMessage("");
    try {
      const auth = await getClientAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await openSession(result.user);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Google sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const email = getValues("email");
    if (!email) {
      setMessage("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(await getClientAuth(), email);
      setMessage("Password reset email sent.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not send reset email.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="m-auth-shell">
      <section className="m-auth-art" aria-label={`Welcome to ${APP_NAME}`}>
        <Link href="/" className="m-logo">
          <span className="m-logo-mark" aria-hidden="true">
            ◔
          </span>
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
          <ThemeToggle />
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
          <button
            type="button"
            disabled={busy}
            onClick={googleSignIn}
            className="m-google-button"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"
              />
              <path
                fill="#EA4335"
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
          {message && (
            <p role="status" className="m-auth-message">
              {message}
            </p>
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
