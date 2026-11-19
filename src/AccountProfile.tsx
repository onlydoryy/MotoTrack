import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./AccountProfile.css";

export default function AccountProfile({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
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

  return <div className="profile-bar">
    <button className="profile-trigger" aria-label={`Open profile for ${label}`} aria-haspopup="dialog"
      onClick={() => { setName(savedName); setNotice(""); setError(""); dialog.current?.showModal(); }}>
      {avatar}<span>{label}</span>
    </button>
    <dialog ref={dialog} className="profile-dialog" aria-labelledby="profile-title" onCancel={event => { if (busy) event.preventDefault(); }}>
      <header><h2 id="profile-title">My profile</h2><button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Close</button></header>
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
      <footer><button type="button" disabled={busy} onClick={onSignOut}>Sign out</button></footer>
    </dialog>
  </div>;
}
