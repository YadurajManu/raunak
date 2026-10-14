"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

const schema = z.object({ email: z.email(), password: z.string().min(1) });
const signupSchema = schema.extend({ password: z.string().min(8) });
type Values = z.infer<typeof schema>;

export function AuthForm({ mode, nextPath = "/dashboard" }: { mode: "login" | "signup"; nextPath?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<Values>({ resolver: zodResolver(mode === "signup" ? signupSchema : schema) });

  async function openSession(user: { getIdToken(): Promise<string> }) {
    const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await user.getIdToken() }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not start session.");
    router.push(nextPath); router.refresh();
  }

  async function submit(values: Values) {
    setBusy(true); setMessage("");
    try {
      const auth = await getClientAuth();
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, values.email, values.password);
        await sendEmailVerification(result.user);
        await signOut(auth);
        setMessage("Check your inbox to verify your email, then sign in.");
      } else {
        const result = await signInWithEmailAndPassword(auth, values.email, values.password);
        await openSession(result.user);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function googleSignIn() {
    setBusy(true); setMessage("");
    try { const auth = await getClientAuth(); const result = await signInWithPopup(auth, new GoogleAuthProvider()); await openSession(result.user); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Google sign-in failed."); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    const email = getValues("email");
    if (!email) { setMessage("Enter your email address first."); return; }
    setBusy(true);
    try { await sendPasswordResetEmail(await getClientAuth(), email); setMessage("Password reset email sent."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not send reset email."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
    <Link href="/" className="mb-12 text-xl font-semibold">Eventra</Link>
    <h1 className="text-3xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
    <p className="mt-2 text-zinc-600 dark:text-zinc-400">{mode === "login" ? "Sign in to manage events and tickets." : "Start organizing your next event."}</p>
    <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-5">
      <div><label htmlFor="email" className="block text-sm font-medium">Email</label><input id="email" type="email" autoComplete="email" {...register("email")} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700" /><p role="alert" className="text-sm text-red-600">{errors.email?.message}</p></div>
      <div><label htmlFor="password" className="block text-sm font-medium">Password</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...register("password")} className="mt-2 w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 dark:border-zinc-700" /><p role="alert" className="text-sm text-red-600">{errors.password?.message}</p></div>
      <button disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50">{mode === "login" ? "Sign in" : "Sign up"}</button>
    </form>
    <button type="button" disabled={busy} onClick={googleSignIn} className="mt-4 rounded-xl border border-zinc-300 px-4 py-3 font-medium dark:border-zinc-700">Continue with Google</button>
    {mode === "login" && <button type="button" onClick={resetPassword} className="mt-5 text-left text-sm text-indigo-600 dark:text-indigo-400">Forgot password?</button>}
    <p className="mt-6 text-sm">{mode === "login" ? <>New here? <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="text-indigo-600 dark:text-indigo-400">Create an account</Link></> : <>Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="text-indigo-600 dark:text-indigo-400">Sign in</Link></>}</p>
    {message && <p role="status" className="mt-5 rounded-xl bg-zinc-100 p-4 text-sm dark:bg-zinc-800">{message}</p>}
  </main>;
}
