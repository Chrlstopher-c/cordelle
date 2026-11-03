export function CallView({ channelId }: { guildId: string | null; channelId: string }): React.JSX.Element {
  return <div style={{ padding: 24 }}>Appel {channelId} (à venir)</div>;
}
