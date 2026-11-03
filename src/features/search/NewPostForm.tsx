// Formulaire « Nouvelle publication » : titre et premier message, envoyés comme un fil de forum.
import { useState, type FormEvent } from "react";

interface Props {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onPublish: (title: string, body: string) => Promise<void>;
}

export function NewPostForm({ busy, error, onCancel, onPublish }: Props): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const ready = title.trim().length > 0 && body.trim().length > 0 && !busy;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (ready) void onPublish(title.trim(), body.trim());
  };
  return (
    <form className="fv-compose" onSubmit={submit} aria-label="Nouvelle publication">
      <label className="fv-label" htmlFor="fv-title">Titre du post</label>
      <input id="fv-title" className="fv-input" placeholder="De quoi veux-tu parler ?" maxLength={100}
        value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="fv-label" htmlFor="fv-body">Premier message</label>
      <textarea id="fv-body" className="fv-textarea" rows={4} placeholder="Écris le premier message"
        value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="fv-compose-actions">
        {error && <span className="sx-error">{error}</span>}
        <button type="button" className="fv-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="fv-primary" disabled={!ready}>{busy ? "Publication…" : "Publier"}</button>
      </div>
    </form>
  );
}
