import {cloudRequest} from './cloud';

export type AccountPerson = {
  id:string; username:string; name:string; role:string; department:string;
  companyName:string; bio:string; discoverable:boolean; avatar:string;
  positions?:string[]; displayPosition?:string; memberType?:'Employee'|'Admin'|'Supplier';
};
export type AccountProfile = AccountPerson & {
  email:string; emailVerified:boolean; requestedPosition:string;
  /** Optional for compatibility with older Workers; never contains API credentials. */
  emailDeliveryConfigured?:boolean;
};
export type DirectMessage = {
  id:string; sender_id:string; recipient_id:string; body:string; created_at:string; read_at:string|null;
};
export type Conversation = AccountPerson & {lastBody:string|null;lastAt:string|null;unread:number};

export const accountAPI = {
  profile: async() => (await cloudRequest('/account/profile') as {profile:AccountProfile}).profile,
  updateProfile: async(input:{name:string;username:string;bio:string;discoverable:boolean}) =>
    cloudRequest('/account/profile',{method:'PUT',body:JSON.stringify(input)}),
  updateAvatar: async(avatar:string) => cloudRequest('/account/avatar',{method:'PUT',body:JSON.stringify({avatar})}),
  removeAvatar: async() => cloudRequest('/account/avatar',{method:'DELETE'}),
  changePassword: async(currentPassword:string,newPassword:string) => cloudRequest('/account/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})}),
  sendVerification: async(email:string) => cloudRequest('/account/email/request',{method:'POST',body:JSON.stringify({email})}),
  verifyEmail: async(code:string) => cloudRequest('/account/email/verify',{method:'POST',body:JSON.stringify({code})}),
  directory: async(q:string, type:'all'|'employees' = 'all') => (await cloudRequest(`/account/directory?q=${encodeURIComponent(q)}${type === 'employees' ? '&type=employees' : ''}`) as {people:AccountPerson[]}).people,
  person: async(id:string) => (await cloudRequest(`/account/people/${encodeURIComponent(id)}`) as {person:AccountPerson}).person,
  conversations: async() => (await cloudRequest('/account/conversations') as {conversations:Conversation[]}).conversations,
  messages: async(id:string) => (await cloudRequest(`/account/messages/${encodeURIComponent(id)}`) as {messages:DirectMessage[];peer:AccountPerson}),
  markRead: async(id:string) => cloudRequest(`/account/messages/${encodeURIComponent(id)}/read`,{method:'POST'}),
  sendMessage: async(id:string,body:string) => cloudRequest(`/account/messages/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify({body})}),
};
