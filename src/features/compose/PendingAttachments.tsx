// Aperçus des fichiers en attente, au-dessus de la saisie : vignette (image) ou icône, nom, taille, retirer.
import { formatSize } from "./attachments";
import type { PendingFile } from "./use-pending-files";

interface Props {
  files: PendingFile[];
  onRemove: (id: string) => void;
}

const FILE_ICON = "M6 3h8l4 4v14H6zM14 3v4h4";

export function PendingAttachments({ files, onRemove }: Props): React.JSX.Element {
  return (
    <div className="att-list" role="list" aria-label="Fichiers joints">
      {files.map((f) => (
        <div className="att" role="listitem" key={f.id}>
          {f.previewUrl ? (
            <img className="att-thumb" src={f.previewUrl} alt="" />
          ) : (
            <span className="att-thumb" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                <path d={FILE_ICON} />
              </svg>
            </span>
          )}
          <span className="att-meta">
            <span className="att-name" title={f.file.name}>{f.file.name}</span>
            <span className="att-size">{formatSize(f.file.size)}</span>
          </span>
          <button className="att-remove" aria-label={`Retirer ${f.file.name}`} onClick={() => onRemove(f.id)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
