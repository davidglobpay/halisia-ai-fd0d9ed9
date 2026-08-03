import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Download,
  FileLock2,
  Loader2,
  Plus,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  REQUIRED_DOCUMENTS,
  categoryLabel,
  createVaultDocument,
  deleteVaultDocument,
  formatBytes,
  listShares,
  listVaultDocuments,
  revokeShare,
  shareDocument,
  shareState,
  signedVaultUrl,
  updateVaultDocument,
  uploadVaultFile,
  type VaultDocument,
} from "@/lib/vault";

type Props = { propertyId?: string | null; financingId?: string | null };

/**
 * Private document vault: upload readiness documents, track their status and
 * share them with named parties on a time-limited, revocable basis.
 */
export function DocumentVault({ propertyId = null, financingId = null }: Props) {
  const qc = useQueryClient();
  const key = ["vault", propertyId ?? "any", financingId ?? "any"];
  const q = useQuery({
    queryKey: key,
    queryFn: () => listVaultDocuments({ propertyId, financingId }),
  });
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("title");

  const addM = useMutation({
    mutationFn: (input: { label: string; category: string }) =>
      createVaultDocument({ ...input, propertyId, financingId }),
    onSuccess: () => {
      setLabel("");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const docs = q.data ?? [];
  const missing = REQUIRED_DOCUMENTS.filter(
    (r) => !docs.some((d) => d.label.toLowerCase() === r.label.toLowerCase()),
  );
  const uploaded = docs.filter((d) => d.storage_path).length;

  return (
    <section
      data-testid="document-vault"
      className="glass rounded-2xl border border-white/10 p-4"
      aria-label="Secure document vault"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-accent">
          <FileLock2 className="h-3.5 w-3.5" aria-hidden="true" /> Secure document vault
        </div>
        <span className="text-[10px] text-muted-foreground">
          {uploaded}/{docs.length || 0} uploaded
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Files are stored privately and are only reachable through short-lived links you issue to a
        named party. Nothing here is public, and every share can be revoked.
      </p>

      {missing.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-2.5">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-200">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Commonly requested and not yet
            tracked
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => addM.mutate({ label: m.label, category: m.category })}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] hover:bg-white/10"
              >
                + {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) addM.mutate({ label: label.trim(), category });
        }}
      >
        <label className="grid gap-1 text-[11px] flex-1 min-w-[10rem]">
          <span className="text-muted-foreground">Document name</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Consent to transfer"
            className="input !py-1.5 !text-[11px]"
          />
        </label>
        <label className="grid gap-1 text-[11px]">
          <span className="text-muted-foreground">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input !py-1.5 !text-[11px]"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={addM.isPending || !label.trim()}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] text-accent disabled:opacity-50"
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> Track document
        </button>
      </form>

      {q.isLoading && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading vault…
        </div>
      )}
      {addM.error && <p className="mt-2 text-[11px] text-red-300">{(addM.error as Error).message}</p>}

      <ul className="mt-3 grid gap-2">
        {docs.map((d) => (
          <VaultRow key={d.id} doc={d} onChanged={() => qc.invalidateQueries({ queryKey: key })} />
        ))}
      </ul>
      {q.data && docs.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No documents tracked yet. Add one above to start your readiness pack.
        </p>
      )}
    </section>
  );
}

function VaultRow({ doc, onChanged }: { doc: VaultDocument; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [openShare, setOpenShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (f: File) => {
    setBusy(true);
    setErr(null);
    try {
      await uploadVaultFile(doc.id, f);
      onChanged();
    } catch (e) {
      setErr((e as Error).message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openFile = async () => {
    setErr(null);
    try {
      const url = await signedVaultUrl(doc);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr((e as Error).message || "Could not open the file");
    }
  };

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid="vault-document">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium">{doc.label}</div>
          <div className="text-[10px] text-muted-foreground">
            {categoryLabel(doc.category)}
            {doc.file_name ? ` · ${doc.file_name} · ${formatBytes(doc.size_bytes)}` : " · no file yet"}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Document status"
            value={doc.status}
            onChange={async (e) => {
              await updateVaultDocument(doc.id, { status: e.target.value });
              onChanged();
            }}
            className="input !py-1 !text-[10px] w-28"
          >
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Delete document"
            onClick={async () => {
              if (!confirm(`Remove "${doc.label}" and its file?`)) return;
              await deleteVaultDocument(doc);
              onChanged();
            }}
            className="text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-3 w-3" aria-hidden="true" />
          )}
          {doc.storage_path ? "Replace file" : "Upload file"}
        </button>
        {doc.storage_path && (
          <button
            type="button"
            onClick={openFile}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px]"
          >
            <Download className="h-3 w-3" aria-hidden="true" /> Open securely
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpenShare((v) => !v)}
          disabled={!doc.storage_path}
          title={doc.storage_path ? undefined : "Upload a file before sharing"}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] text-accent disabled:opacity-40"
        >
          <Share2 className="h-3 w-3" aria-hidden="true" /> Share & track
        </button>
      </div>
      {err && <p className="mt-1.5 text-[10px] text-red-300">{err}</p>}
      {openShare && <ShareManager documentId={doc.id} />}
    </li>
  );
}

function ShareManager({ documentId }: { documentId: string }) {
  const qc = useQueryClient();
  const key = ["vault-shares", documentId];
  const q = useQuery({ queryKey: key, queryFn: () => listShares(documentId) });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [purpose, setPurpose] = useState("Financing review");
  const [days, setDays] = useState(7);
  const [link, setLink] = useState("");

  const shareM = useMutation({
    mutationFn: () =>
      shareDocument({
        documentId,
        partyName: name.trim(),
        partyEmail: email.trim(),
        organisation: org.trim() || null,
        purpose: purpose.trim() || null,
        expiresInDays: days,
      }),
    onSuccess: (r) => {
      setLink(r.link);
      setName("");
      setEmail("");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && email.trim()) shareM.mutate();
        }}
      >
        <input
          aria-label="Recipient name"
          placeholder="Recipient name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input !py-1 !text-[11px]"
        />
        <input
          aria-label="Recipient email"
          type="email"
          placeholder="Recipient email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input !py-1 !text-[11px]"
        />
        <input
          aria-label="Organisation"
          placeholder="Organisation (bank, SACCO…)"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          className="input !py-1 !text-[11px]"
        />
        <input
          aria-label="Purpose"
          placeholder="Purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="input !py-1 !text-[11px]"
        />
        <label className="grid gap-1 text-[10px] text-muted-foreground">
          Access expires after
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="input !py-1 !text-[11px]"
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={shareM.isPending || !name.trim() || !email.trim()}
            className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] text-accent disabled:opacity-50"
          >
            {shareM.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Share2 className="h-3 w-3" aria-hidden="true" />
            )}
            Grant access
          </button>
        </div>
      </form>
      {shareM.error && (
        <p className="mt-1.5 text-[10px] text-red-300">{(shareM.error as Error).message}</p>
      )}
      {link && (
        <div className="mt-2 rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-2 text-[10px]">
          <div className="text-emerald-200">Secure link created — send it only to this party.</div>
          <input readOnly value={link} className="input !py-1 !text-[10px] mt-1 w-full" />
        </div>
      )}

      <ul className="mt-2 grid gap-1.5">
        {(q.data ?? []).map((s) => {
          const state = shareState(s);
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px]"
            >
              <span className="min-w-0">
                <span className="text-foreground">{s.party_name}</span>{" "}
                <span className="text-muted-foreground">
                  · {s.party_email}
                  {s.organisation ? ` · ${s.organisation}` : ""}
                  {s.purpose ? ` · ${s.purpose}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={
                    state === "active"
                      ? "text-emerald-300"
                      : state === "expired"
                        ? "text-amber-300"
                        : "text-muted-foreground line-through"
                  }
                >
                  {state}
                  {s.expires_at ? ` · until ${new Date(s.expires_at).toLocaleDateString("en-KE")}` : ""}
                </span>
                {state === "active" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await revokeShare(s.id);
                      qc.invalidateQueries({ queryKey: key });
                    }}
                    className="text-red-300 hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
