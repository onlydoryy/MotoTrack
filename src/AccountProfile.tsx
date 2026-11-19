import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./AccountProfile.css";

const icons: Record<string, string> = {
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  documents: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h6",
  "manage-garage": "M3 21V9l9-6 9 6v12 M7 21V11h10v10 M7 15h10 M7 18h10",
  settings: "M4 7h8 M16 7h4 M4 17h2 M10 17h10 M16 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
};

export default function AccountProfile({ user, onSignOut, page, count, onGarage }: { user: User; onSignOut: () => Promise<void>; page: string; count: number; onGarage: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const savedName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : "";
  const label = savedName || user.email?.split("@")[0] || "My profile";
  const [name, setName] = useState(savedName);
  // Object URLs keep the private image out of account metadata.
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const path = user.id + "/avatar";
  const bucket = supabase?.storage.from("profile-photos");

  useEffect(() => {
    let current = true;
    async function loadPhoto() {
      try {
        const result = await supabase?.storage.from("profile-photos").download(path);
        if (current && result?.data) setPreview(URL.createObjectURL(result.data));
      } finally {
        if (current) setLoadingPhoto(false);
      }
    }
    void loadPhoto().catch(() => {});
    return () => { current = false; };
  }, [path]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !name.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
      if (result.error) throw result.error;
      setName(name.trim());
      setNotice("Display name saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your name.");
    } finally { setBusy(false); }
  }

  async function changePhoto(file: File | null) {
    if (!bucket || busy || loadingPhoto) return;
    setNotice("");
    setError("");
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2097152)) {
      setError("Choose a JPG, PNG or WebP image up to 2 MB.");
      return;
    }
    setBusy(true);
    try {
      if (file) {
        const bitmap = await createImageBitmap(file);
        bitmap.close();
      }
      const result = file ? await bucket.upload(path, file, { upsert: true, cacheControl: "0" }) : await bucket.remove([path]);
      if (result.error) throw result.error;
      setPreview(file ? URL.createObjectURL(file) : "");
      setNotice(file ? "Profile picture saved." : "Profile picture removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your picture.");
    } finally { setBusy(false); }
  }

  const initials = label.trim().split(/\s+/).slice(0, 2).map((part: string) => Array.from(part)[0]).join("").toUpperCase();
  const avatar = <span className="profile-avatar" aria-hidden="true">{preview ? <img src={preview} alt="" /> : initials}</span>;

  return <>
    <div className="profile-bar"><details ref={menu} className="account-menu">
      <summary className="profile-trigger" aria-label={`Account menu for ${label}`}>{avatar}<span>{label}</span><span aria-hidden="true">▾</span></summary>
      <nav aria-label="Account" className="account-links">
        <div className="menu-identity">{avatar}<strong>{label}</strong></div>
        {([["profile", "Profile"], ["documents", "My documents"], ["manage-garage", "Manage garage"], ["settings", "Settings"]] as const).map(([id, title]) =>
          <a key={id} href={`#${id}`} aria-current={page === id ? "page" : undefined} onClick={() => {
            if (menu.current) menu.current.open = false;
            if (page !== "profile") { setName(savedName); setError(""); setNotice(""); }
          }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d={icons[id]} /></svg>{title}</a>)}
        <button type="button" onClick={onSignOut}>Sign out</button>
      </nav>
    </details></div>
    {page === "profile" && <main className="account-page">
      <a className="account-back" href="#garage" onClick={onGarage}>← My Garage</a>
      <h1>Profile</h1>
      <section className="profile-dialog profile-panel">
      <header><h2>{label}</h2><a href="#manage-garage">{count} {count === 1 ? "vehicle" : "vehicles"} in garage</a></header>
      <div className="profile-picture">{avatar}<div>
        <label htmlFor="profile-photo">Profile picture</label>
        <input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || loadingPhoto}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void changePhoto(file); }} />
        <small>JPG, PNG or WebP · Up to 2 MB</small>
        {preview && <button type="button" disabled={busy} onClick={() => void changePhoto(null)}>Remove picture</button>}
      </div></div>
      <form onSubmit={saveName}>
        <label htmlFor="profile-name">Display name</label>
        <input id="profile-name" autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} maxLength={60} required />
        <label htmlFor="profile-email">Account email</label>
        <input id="profile-email" value={user.email ?? ""} readOnly />
        <button className="auth-submit" disabled={busy || !name.trim() || name.trim() === savedName}>Save name</button>
      </form>
      {error && <p role="alert" className="auth-feedback auth-error">{error}</p>}
      {notice && <p role="status" className="auth-feedback auth-success">{notice}</p>}
      </section>
    </main>}
  </>;
}
