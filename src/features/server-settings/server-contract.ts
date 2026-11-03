// Types du contrat d'administration (copie de crates/contract/src/server.rs, en attendant la régénération des bindings).
import type { User } from "../../contract/bindings";

export type Snowflake = string;

export interface GuildDetail {
  id: Snowflake; name: string; description: string | null; icon_url: string | null; banner_url: string | null;
  owner_id: Snowflake; member_count: number | null; online_count: number | null; permissions: string;
}
export interface GuildEdit { name?: string; description?: string | null }
export interface Role {
  id: Snowflake; name: string; color: number; hoist: boolean; mentionable: boolean; position: number;
  permissions: string; managed: boolean;
}
export interface RoleEdit {
  name?: string; color?: number; hoist?: boolean; mentionable?: boolean; permissions?: string;
}
export interface MemberSummary {
  user: User; nick: string | null; roles: Snowflake[]; joined_at: string | null; timed_out_until: string | null;
}
export interface Ban { user: User; reason: string | null }
export interface Invite {
  code: string; inviter: User | null; channel_id: Snowflake; channel_name: string | null; uses: number;
  max_uses: number; created_at: string | null; expires_at: string | null;
}
export interface ServerEmoji { id: Snowflake; name: string; animated: boolean; creator: string | null; image_url: string }
export interface AutomodRule {
  id: Snowflake; name: string; enabled: boolean; trigger_type: number; keywords: string[]; actions: number[];
  exempt_roles: Snowflake[]; exempt_channels: Snowflake[];
}
export interface Integration { id: Snowflake; name: string; kind: string; enabled: boolean; account_name: string | null }
export interface AuditChange { key: string; old: string | null; new: string | null }
export interface AuditEntry {
  id: Snowflake; action_type: number; actor: User | null; target_id: Snowflake | null; reason: string | null;
  changes: AuditChange[]; created_ms: number;
}
export interface ChannelDetail {
  id: Snowflake; guild_id: Snowflake | null; name: string; topic: string | null; nsfw: boolean; rate_limit_per_user: number;
}
export interface ChannelEdit { name?: string; topic?: string; nsfw?: boolean; rate_limit_per_user?: number }
export type NewChannelKind = "text" | "voice";
