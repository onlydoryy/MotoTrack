import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "./lib/supabase";
import App from "./App";
import "./AuthGate.css";

type Mode = "login" | "register";

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const client = supabase;
    if (!client) { setChecking(false); return; }
    client.auth.getSession().then(({ data, error: authError }) => {
      if (!active) return;
      setSession(data.session);
      if (authError) setError(authError.message);
      setChecking(false);
    }).catch((reason: unknown) => {
      if (active) { setError(reason instanceof Error ? reason.message : "Could not initialise your session."); setChecking(false); }
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const client = supabase;
    if (!client) { setError("Supabase is not configured."); return; }
    setError("");
    setMessage("");
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    if (mode === "register" && password !== String(fields.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Please use a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error: authError } = await client.auth.signUp({ email, password });
        if (authError) throw authError;
        if (!data.session) setMessage("Check your inbox for the confirmation email, then return here to sign in.");
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signOut();
    if (authError) window.alert(authError.message);
  }

  if (!hasSupabaseConfig) return (
    <div className="auth-screen"><div className="auth-card">
      <div className="auth-brand"><span className="auth-brand-mark">M</span><span>Moto<span>Track</span></span></div>
      <h1 style={{ marginTop: 28 }}>Setup required</h1>
      <p className="auth-description">MotoTrack cannot read its Supabase connection settings. In the project root, check your <code>.env.local</code> file has <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> set to your project values, then restart <code>npm run dev</code>.</p>
    </div></div>
  );
  if (checking) return <div className="auth-loading">Loading MotoTrack…</div>;
  if (session) return (
    <>
      <div className="auth-account-bar">
        <span>Signed in as <strong>{session.user.email}</strong></span>
        <button type="button" onClick={signOut}>Sign out</button>
      </div>
      <div className="auth-local-notice">Vehicle records are still saved on this browser, not yet linked to your account.</div>
      <App />
    </>
  );

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><span className="auth-brand-mark">M</span><span>Moto<span>Track</span></span></div>
        <p className="auth-eyebrow">YOUR DIGITAL GARAGE</p>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-description">{mode === "login" ? "Sign in to continue to MotoTrack." : "Get started with your vehicle management account."}</p>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email address</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          <label htmlFor="auth-password">Password</label>
          <input id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required />
          {mode === "register" && <><label htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required /></>}
          {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
          {message && <p className="auth-feedback auth-success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="auth-switch">{mode === "login" ? "New to MotoTrack?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button>
        </p>
      </div>
    </div>
  );
}
