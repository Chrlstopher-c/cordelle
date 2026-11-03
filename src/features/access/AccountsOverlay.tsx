export function AccountsOverlay({ onClose }: { onClose: () => void }): React.JSX.Element {
  return <div style={{ padding: 24 }} onClick={onClose}>Comptes (à venir)</div>;
}
