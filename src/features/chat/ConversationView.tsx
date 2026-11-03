export function ConversationView({ channelId }: { guildId: string | null; channelId: string }): React.JSX.Element {
  return <div style={{ padding: 24, color: "var(--text-faint)" }}>Conversation {channelId} (à venir)</div>;
}
