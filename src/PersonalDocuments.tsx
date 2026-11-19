import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./lib/supabase";

const columns = "id,category,title,details,expiry,filename";
type DocumentRow = { id: string; category: string; title: string; details: string; expiry: string | null; filename: string | null };
const empty = { id: "", category: "Driving licence", title: "", details: "", expiry: "", filename: null };
function readAttachment(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

export default function PersonalDocuments({ userId }: { userId: string }) {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [draft, setDraft] = useState<DocumentRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const result = await supabase!.from("personal_documents").select(columns).eq("user_id", userId).order("created_at", { ascending: false });
      if (!active) return;
      if (result.error) setError(result.error.message);
      else setRows(result.data);
      setLoading(false);
    }
    void load().catch(() => { if (active) { setError("Could not load documents."); setLoading(false); } });
    return () => { active = false; };
  }, [userId]);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setError(""); setBusy(true);
    try { await action(); }
    catch (err) { setError(err && typeof err === "object" && "message" in err ? String(err.message) : "Could not complete this action."); }
    finally { setBusy(false); }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !draft.title.trim()) return;
    void perform(async () => {
      if (file && (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > 2097152))
        throw new Error("Choose a PDF, JPG or PNG up to 2 MB.");
      const values = { title: draft.title.trim(), category: draft.category, details: draft.details, expiry: draft.expiry || null,
        ...(file ? { filename: file.name, attachment: await readAttachment(file) } : {}) };
      const table = supabase!.from("personal_documents");
      const result = await (draft.id ? table.update(values).eq("id", draft.id) : table.insert(values)).select(columns).single();
      if (result.error) throw result.error;
      setRows(current => draft.id ? current.map(row => row.id === draft.id ? result.data : row) : [result.data, ...current]);
      setDraft(null); setFile(null);
    });
  }
  function download(row: DocumentRow) {
    void perform(async () => {
      const result = await supabase!.from("personal_documents").select("attachment").eq("id", row.id).single();
      if (result.error) throw result.error;
      if (!/^data:(application\/pdf|image\/(jpeg|png));base64,/.test(result.data.attachment)) throw new Error("Invalid attachment.");
      const link = document.createElement("a");
      link.download = row.filename || "document"; link.href = result.data.attachment; link.click();
    });
  }
  function remove(row: DocumentRow) {
    if (!window.confirm(`Delete "${row.title}" and its attachment?`)) return;
    void perform(async () => {
      const result = await supabase!.from("personal_documents").delete().eq("id", row.id);
      if (result.error) throw result.error;
      setRows(current => current.filter(item => item.id !== row.id));
    });
  }
  return <>
    <h1>My documents</h1>
    <p>Keep your driving licence, insurance details and other personal documents here.</p>
    {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
    {draft ? <form className="document-form account-row" onSubmit={save}>
      <fieldset disabled={busy}><legend>{draft.id ? "Edit document" : "Add document"}</legend>
        <label>Document type<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
          {["Driving licence", "Insurance policy", "Other"].map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Title<input required maxLength={120} value={draft.title} placeholder="e.g. Bandit insurance" onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
        <label>Expiry date (optional)<input type="date" value={draft.expiry || ""} onChange={e => setDraft({ ...draft, expiry: e.target.value })} /></label>
        <label>Details (optional)<textarea maxLength={2000} value={draft.details} placeholder="Insurer, policy reference or notes" onChange={e => setDraft({ ...draft, details: e.target.value })} /></label>
        <label>{draft.filename ? "Replace " + draft.filename : "Attachment (optional)"}<input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        <small>PDF, JPG or PNG · Up to 2 MB</small>
        <div className="row-actions"><button disabled={!draft.title.trim()}>Save document</button><button type="button" onClick={() => setDraft(null)}>Cancel</button></div>
      </fieldset>
    </form> : <>
      <button className="button button-primary" disabled={busy || loading} onClick={() => { setFile(null); setDraft(empty); }}>Add document</button>
      {loading ? <p>Loading documents…</p> : !rows.length && !error && <p>No personal documents yet.</p>}
      <div className="account-list">{rows.map(row => <article key={row.id} className="account-row personal-document">
        <h2>{row.title}</h2><small>{row.category}{row.expiry && " · Expires " + row.expiry}</small>
        {row.details && <p>{row.details}</p>}
        <div className="row-actions">
          {row.filename && <button disabled={busy} onClick={() => download(row)}>Download {row.filename}</button>}
          <button disabled={busy} onClick={() => { setFile(null); setDraft(row); }}>Edit</button>
          <button className="danger" disabled={busy} onClick={() => remove(row)}>Delete</button>
        </div>
      </article>)}</div>
    </>}
  </>;
}
