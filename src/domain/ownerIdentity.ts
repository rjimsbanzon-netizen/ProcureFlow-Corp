import type {User} from '../types/procurement';

/** Historical usernames and names retain ownership of older PR records after profile edits. */
export function ownsRequisition(record: Record<string, unknown>, user:User | null | undefined):boolean {
  if(!user) return false;
  const requesterUsername=record.requestedByUsername;
  if(typeof requesterUsername==='string' && requesterUsername){
    const aliases=user.usernameAliases ?? [];
    return requesterUsername === user.username || aliases.includes(requesterUsername);
  }
  const requesterName=record.requestedBy;
  return typeof requesterName==='string' &&
    (requesterName===user.name || (user.nameAliases ?? []).includes(requesterName));
}
