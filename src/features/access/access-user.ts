// Nom affiché d'un utilisateur : nom global Discord, sinon identifiant.
export function displayName(user: { global_name?: string | null; username: string }): string {
  return user.global_name ?? user.username;
}
