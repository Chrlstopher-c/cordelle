// Styles partagés des écrans d'accès, repris des maquettes Connexion (couleurs via les tokens de tokens.css).
import type { CSSProperties } from "react";

export const CARD_STYLE: CSSProperties = {
  width: 420,
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: 32,
  borderRadius: "var(--r-xl)",
  background: "var(--surface-raised)",
  boxShadow: "0 24px 60px rgba(0,0,0,.45)",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

export const TITLE_STYLE: CSSProperties = { margin: 0, fontSize: 22, fontWeight: 700, textAlign: "center" };

export const MUTED_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-small)",
  color: "var(--text-muted)",
  lineHeight: 1.45,
  textAlign: "center",
};

export const ERROR_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-small)",
  color: "var(--danger-text)",
  textAlign: "center",
};

export const LABEL_STYLE: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: ".03em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

export const FIELD_STYLE: CSSProperties = {
  height: 42,
  width: "100%",
  boxSizing: "border-box",
  padding: "0 12px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--border)",
  background: "var(--surface-frame)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 14.5,
  outline: "none",
};

export const CTA_STYLE: CSSProperties = {
  height: 44,
  width: "100%",
  borderRadius: "var(--r-sm)",
  background: "var(--accent)",
  color: "#fff",
  fontFamily: "inherit",
  fontWeight: 600,
  fontSize: 15,
  border: 0,
  cursor: "pointer",
};

export const LINK_STYLE: CSSProperties = {
  padding: 0,
  border: 0,
  background: "none",
  color: "var(--accent-text)",
  fontFamily: "inherit",
  fontSize: "var(--fs-small)",
  cursor: "pointer",
};

export const SECONDARY_STYLE: CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: "var(--r-sm)",
  border: 0,
  background: "var(--surface-selected)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
