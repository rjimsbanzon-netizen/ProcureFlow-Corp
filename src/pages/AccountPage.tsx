import { useEffect, useState, type FormEvent } from 'react';
import { accountAPI, type AccountProfile } from '../services/account';
import { CLOUD_API_BASE, cloudRequest, mapCloudUser } from '../services/cloud';
import { DB } from '../store/state';
import { renderApp } from '../core/renderBridge';
import { showToast } from '../services/toast';
import { getEffectivePosition, loadStaffAssignments, STAFF_ASSIGNMENTS_UPDATED, type StaffAssignment } from '../domain/staffPositions';
import { activeActingResponsibilities } from '../domain/effectiveDelegation';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-[#a64f32] focus:ring-2 focus:ring-[#a64f32]/15';
const labelClass = 'block text-xs font-bold uppercase tracking-[0.12em] text-slate-600 mb-1.5';
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('') || 'PF';
}

export default function AccountPage() {
  const [profile,setProfile] = useState<AccountProfile|null>(null);
  const [staffAssignments,setStaffAssignments] = useState<StaffAssignment[]>([]);
  const [activeSection,setActiveSection] = useState<'information'|'photo'|'email'|'password'|null>(null);
  const [form,setForm] = useState({name:'',username:'',bio:'',discoverable:true});
  const [email,setEmail] = useState('');
  const [code,setCode] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [sending,setSending] = useState(false);
  const [verifying,setVerifying] = useState(false);
  const [uploadingPhoto,setUploadingPhoto] = useState(false);
  const [changingPassword,setChangingPassword] = useState(false);
  const [passwords,setPasswords] = useState({current:'',next:'',confirm:''});
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');

  async function load() {
    const fresh = await accountAPI.profile();
    setProfile(fresh);setForm({name:fresh.name,username:fresh.username,bio:fresh.bio,discoverable:fresh.discoverable});
    setEmail(fresh.email);setLoading(false);
  }
  useEffect(() => { let active = true; if(!CLOUD_API_BASE){setLoading(false);return;}
    void accountAPI.profile().then(result=>{if(!active)return;setProfile(result);setForm({name:result.name,username:result.username,bio:result.bio,discoverable:result.discoverable});setEmail(result.email);setLoading(false);})
      .catch(e=>{if(active){setError(e instanceof Error?e.message:'Unable to load profile.');setLoading(false);}});
    return()=>{active=false;};
  }, []);
  // Reuse the formal staff-appointment data for the profile job title.
  // Registration requests must never be displayed as granted positions.
  const accountId=DB.currentUser?.id||'';
  const accountRole=DB.currentUser?.role||'';
  useEffect(()=>{
    if(!accountId || accountRole==='Admin' || accountRole==='Supplier')return;
    let active=true;
    const refresh=()=>{void loadStaffAssignments(accountId,true).then(items=>{if(active)setStaffAssignments(items);}).catch(()=>{});};
    refresh();
    window.addEventListener(STAFF_ASSIGNMENTS_UPDATED,refresh);
    window.addEventListener('procureflow:delegation-updated',refresh);
    return()=>{active=false;window.removeEventListener(STAFF_ASSIGNMENTS_UPDATED,refresh);window.removeEventListener('procureflow:delegation-updated',refresh);};
  },[accountId,accountRole]);
  async function save(e:FormEvent) {
    e.preventDefault();setSaving(true);setError('');setMessage('');
    try {
      await accountAPI.updateProfile(form);
      const fresh = await cloudRequest('/auth/me') as {user:Record<string,unknown>};
      const mapped = mapCloudUser(fresh.user);
      const existing = DB.currentUser;
      if(existing){Object.assign(existing,{name:mapped.name,username:mapped.username,usernameAliases:mapped.usernameAliases,nameAliases:mapped.nameAliases});}
      const account = DB.users.find(u=>u.id===existing?.id);
      if(account){account.name=mapped.name;account.username=mapped.username;}
      setMessage('Your profile was saved.');
      showToast('Profile updated successfully.', 'success');
      await load();renderApp();
    } catch(e) {setError(e instanceof Error?e.message:'Unable to update profile.');}
    finally {setSaving(false);}
  }
  async function sendEmail(e:FormEvent) {
    e.preventDefault();setSending(true);setError('');setMessage('');
    try {await accountAPI.sendVerification(email);setMessage('A verification code was sent to your email. It expires in 10 minutes.');}
    catch(e){
      const detail=e instanceof Error?e.message:'Could not send code.';
      if (/not configured|Gmail OAuth secrets|email verification is not configured/i.test(detail)) {
        setProfile(current=>current?{...current,emailDeliveryConfigured:false}:current);
        setError('Verification emails are unavailable until Admin connects the ProcureFlow Gmail account to the Cloudflare Worker.');
      } else setError(detail);
    }
    finally{setSending(false);}
  }
  async function verify(e:FormEvent) {
    e.preventDefault();setVerifying(true);setError('');setMessage('');
    try {await accountAPI.verifyEmail(code);setCode('');await load();
      if(DB.currentUser)DB.currentUser.email=email.trim().toLowerCase();
      setMessage('Email address successfully verified.');}
    catch(e){setError(e instanceof Error?e.message:'Could not verify email.');}
    finally{setVerifying(false);}
  }
  async function uploadPhoto(file:File) {
    setError('');setMessage('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024) {
      setError('Choose a PNG, JPEG, or WebP image smaller than 5 MB.');return;
    }
    setUploadingPhoto(true);
    try {
      const bitmap=await createImageBitmap(file);
      try {
        const canvas=document.createElement('canvas');
        canvas.width=192;canvas.height=192;
        const ctx=canvas.getContext('2d');
        if (!ctx) throw new Error('Image processing is unavailable in this browser.');
        const square=Math.min(bitmap.width,bitmap.height);
        ctx.drawImage(bitmap,(bitmap.width-square)/2,(bitmap.height-square)/2,square,square,0,0,192,192);
        let avatar='';
        for (const quality of [0.8,0.65,0.5,0.35]) {
          avatar=canvas.toDataURL('image/jpeg',quality);
          if (avatar.length<=80000) break;
        }
        if (avatar.length>80000) throw new Error('Image is still too large after resizing.');
        await accountAPI.updateAvatar(avatar);
        setProfile(previous=>previous?{...previous,avatar}:previous);
        window.dispatchEvent(new CustomEvent('procureflow:avatar-updated',{detail:avatar}));
        setMessage('Profile picture updated.');
        showToast('Profile photo updated.', 'success');
        renderApp();
      } finally {bitmap.close();}
    } catch(e) {setError(e instanceof Error?e.message:'Unable to upload photo.');}
    finally {setUploadingPhoto(false);}
  }
  async function removePhoto() {
    setUploadingPhoto(true);setError('');setMessage('');
    try {await accountAPI.removeAvatar();setProfile(previous=>previous?{...previous,avatar:''}:previous);window.dispatchEvent(new CustomEvent('procureflow:avatar-updated',{detail:''}));setMessage('Profile picture removed.');renderApp();}
    catch(e) {setError(e instanceof Error?e.message:'Unable to remove photo.');}
    finally {setUploadingPhoto(false);}
  }
  async function changePassword(e:FormEvent) {
    e.preventDefault();setError('');setMessage('');
    if (passwords.next!==passwords.confirm) {setError('New passwords do not match.');return;}
    if (passwords.next.length<10) {setError('Use at least 10 characters for your new password.');return;}
    setChangingPassword(true);
    try {
      await accountAPI.changePassword(passwords.current,passwords.next);
      setPasswords({current:'',next:'',confirm:''});
      setMessage('Password updated. Your other signed-in sessions were closed.');
      showToast('Password changed successfully.', 'success');
    } catch(e) {setError(e instanceof Error?e.message:'Could not change password.');}
    finally {setChangingPassword(false);}
  }
  if(!CLOUD_API_BASE) return <section className="rounded-2xl border border-amber-200 bg-white p-6"><h2 className="font-bold text-xl">My Account</h2><p className="mt-2 text-sm text-slate-600">Account editing and email verification require signing in to the Cloudflare-connected system.</p></section>;
  if(loading) return <div className="rounded-2xl bg-white border p-6 text-slate-500">Loading your profile…</div>;
  if(!profile) return <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-6"><h2 className="text-lg font-bold text-slate-900">Could not load your account</h2><p className="mt-2 text-sm text-slate-600">{error || 'Your profile is unavailable. Please refresh the page to try again.'}</p><button type="button" onClick={()=>{setLoading(true);setError('');void load().catch(e=>{setError(e instanceof Error?e.message:'Unable to load profile.');setLoading(false);});}} className="mt-4 rounded-xl bg-[#a64f32] px-4 py-2 text-sm font-semibold text-white">Retry</button></section>;
  const settings = [
    {key: 'information', label: 'Profile Information', description: 'Name, username and directory preferences', icon: 'fa-id-card'},
    {key: 'photo', label: 'Profile Picture', description: 'Upload, change or remove your photo', icon: 'fa-camera'},
    {key: 'email', label: 'Email Verification', description: 'Verify or update your email address', icon: 'fa-envelope-circle-check'},
    {key: 'password', label: 'Change Password', description: 'Update your account password securely', icon: 'fa-lock'}
  ] as const;
  // The role name is always based on an existing account role or staff assignment.
  // Temporary coverage is display-only here and never changes the user's actual permissions.
  const user=DB.currentUser;
  const effective=user?getEffectivePosition(user,staffAssignments):null;
  const acting=activeActingResponsibilities()[0];
  const department=profile?.department||user?.department||'';
  let roleLabel='Employee';
  if(profile?.role==='Admin'||user?.role==='Admin')roleLabel='Admin';
  else if(profile?.role==='Supplier'||user?.role==='Supplier')roleLabel='Supplier';
  else if(['Procurement Head','Procurement Officer','Operations Officer'].includes(profile?.role||''))roleLabel=profile!.role;
  else if(effective?.source==='assignment')roleLabel=effective.name==='Head' ? (effective.department && effective.department!=='Unassigned department' ? `${effective.department} Head` : 'Department Head') : effective.name;
  else if(user?.role && user.role!=='Employee')roleLabel=user.role;
  const jobTitle=acting?`Acting ${acting.role}`:roleLabel;
  const jobDepartment=acting?.department && acting.department!=='*'?acting.department:department;
  const positionLabel=[jobTitle,jobDepartment].filter(Boolean).join(' · ');
  const profileName=profile?.name?.trim()||user?.name||'My Account';
  const completionItems=[Boolean(profile?.name?.trim()),Boolean(profile?.username?.trim()),Boolean(profile?.bio?.trim()),Boolean(profile?.avatar),Boolean(profile?.emailVerified)];
  const profilePercent=Math.round(completionItems.filter(Boolean).length/completionItems.length*100);
  return <section className="mx-auto max-w-6xl space-y-5 pb-8">
    <header className="rounded-[22px] border border-[#e8ded3] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        <button
          type="button"
          aria-label="Open profile picture settings"
          title="Change profile picture"
          onClick={()=>{setActiveSection('photo');setError('');setMessage('');}}
          className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#f9e9df] bg-[#f6ece4] text-3xl font-bold text-[#a64f32] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a64f32] sm:h-28 sm:w-28"
        >
          {profile?.avatar?<img src={profile.avatar} alt="Your profile picture" className="h-full w-full object-cover"/>:<span>{initials(profileName)}</span>}
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-900/70 py-1 text-center text-[10px] font-semibold text-white transition-transform group-hover:translate-y-0 group-focus-visible:translate-y-0"><i className="fa-solid fa-camera mr-1"/>Change</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a64f32]">My Account</p>
          <h2 className="break-words text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{profileName}</h2>
          <p className="mt-2 text-sm font-medium text-slate-600 sm:text-base">{positionLabel || 'Account position not assigned'}</p>
          {profile?.username&&<p className="mt-1 text-xs text-slate-500">@{profile.username}</p>}
        </div>
      </div>
    </header>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[#e8ded3] bg-white px-5 py-4 text-sm text-slate-700 shadow-sm sm:px-7" aria-label="Account status summary">
      <span className="inline-flex items-center gap-2"><i aria-hidden="true" className={`fa-solid ${profile?.emailVerified?'fa-circle-check text-emerald-600':'fa-circle-exclamation text-amber-600'}`}/>{profile?.emailVerified?'Email verified':'Email not verified'}</span>
      <span aria-hidden="true" className="hidden text-slate-300 sm:inline">•</span>
      <span className="inline-flex items-center gap-2"><i aria-hidden="true" className="fa-solid fa-chart-pie text-[#a64f32]"/>Profile <strong className="font-bold text-[#a64f32]">{profilePercent}%</strong> complete</span>
      <span aria-hidden="true" className="hidden text-slate-300 sm:inline">•</span>
      <span className="inline-flex items-center gap-2"><i aria-hidden="true" className={`fa-solid ${profile?.discoverable?'fa-users text-slate-500':'fa-eye-slash text-slate-500'}`}/>{profile?.discoverable?'Visible in People Search':'Hidden from People Search'}</span>
    </div>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {message&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
    <nav aria-label="Account settings" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {settings.map(setting=><button
        key={setting.key}
        type="button"
        aria-expanded={activeSection===setting.key}
        aria-controls={`account-panel-${setting.key}`}
        onClick={()=>{setActiveSection(current=>current===setting.key?null:setting.key);setError('');setMessage('');}}
        className={`flex min-h-[148px] w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition sm:p-5 ${activeSection===setting.key?'border-[#a64f32] bg-[#fbf3ef] ring-1 ring-[#a64f32]/20':'border-slate-200 bg-white hover:border-[#d4af9d] hover:bg-[#fffcfa]'}`}
      >
        <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${activeSection===setting.key?'bg-[#a64f32] text-white':'bg-[#f4e7df] text-[#a64f32]'}`}><i className={`fa-solid ${setting.icon}`}/></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900 sm:text-base">{setting.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{setting.description}</span></span>
        <i aria-hidden="true" className={`fa-solid fa-chevron-${activeSection===setting.key?'up':'down'} text-xs text-slate-400`}/>
      </button>)}
    </nav>
    {activeSection==='photo'&&<div id="account-panel-photo" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-slate-900">Profile picture</h3>
      <p className="mt-1 text-sm text-slate-500">Choose a PNG, JPEG, or WebP photo. It will be cropped to a square and resized for fast loading.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#26342d] text-xl font-bold text-white">
          {profile?.avatar?<img src={profile.avatar} alt="Current profile picture" className="h-full w-full object-cover"/>:initials(profile?.name||'PF')}
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-[#d4af9d] bg-[#fbf3ef] px-4 py-3 text-sm font-bold text-[#a64f32] hover:bg-[#f4e2d8]">
          {uploadingPhoto?'Updating…':'Upload photo'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploadingPhoto} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadPhoto(file);event.target.value='';}}/>
        </label>
        {profile?.avatar&&<button type="button" disabled={uploadingPhoto} onClick={()=>void removePhoto()} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Remove photo</button>}
      </div>
    </div>}
    {activeSection==='information'&&<form id="account-panel-information" onSubmit={e=>void save(e)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div><h3 className="text-lg font-bold text-slate-900">Profile information</h3><p className="text-sm text-slate-500">Changes to your profile do not change your assigned procurement permissions.</p></div>
      <label className="block"><span className={labelClass}>Full name</span><input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={inputClass}/></label>
      <label className="block"><span className={labelClass}>Username</span><input required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]{3,32}" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} className={inputClass}/><p className="mt-1 text-xs text-slate-500">3–32 letters, numbers, dots, hyphens or underscores. Historical usernames remain reserved.</p></label>
      <label className="block"><span className={labelClass}>About me</span><textarea rows={4} maxLength={500} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} className={inputClass} placeholder="A short introduction for colleagues…"/><p className="mt-1 text-right text-xs text-slate-500">{form.bio.length}/500</p></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#a64f32]" checked={form.discoverable} onChange={e=>setForm({...form,discoverable:e.target.checked})}/><span><strong className="block text-sm text-slate-800">Show my account in People Search</strong><span className="text-xs text-slate-500">You can hide your profile from new searches. Existing conversations remain accessible to participants.</span></span></label>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><strong>Requested position:</strong> {profile?.requestedPosition || 'Employee'}<p className="mt-1 text-xs text-slate-500">Only Admin can formally assign a Head or Officer position through Staff Assignments.</p></div>
      <button disabled={saving} type="submit" className="w-full rounded-xl bg-[#a64f32] px-5 py-3 font-bold text-white hover:bg-[#873e27] disabled:opacity-60 sm:w-auto">{saving?'Saving…':'Save profile'}</button>
    </form>}
    {activeSection==='email'&&<div id="account-panel-email" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-slate-900">Email verification</h3>
      <p className="mb-4 mt-1 text-sm text-slate-500">Confirm that you own your email address. Changing your email requires verification first.</p>
      <span className={`mb-5 inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${profile?.emailVerified?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800'}`}>{profile?.emailVerified?'Email verified':'Email unverified'}</span>
      {profile.emailDeliveryConfigured===false&&<div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong className="block">Verification email is not available yet</strong>
        <p className="mt-1 leading-6">An Admin must connect the ProcureFlow Gmail account to the Cloudflare Worker. Your email address has not been changed or marked verified.</p>
        {(user?.role==='Admin'||profile.role==='Admin')&&<p className="mt-2 text-xs leading-5">Configure the Gmail OAuth Worker secrets with the supplied setup script, then reload My Account.</p>}
      </div>}
      <form onSubmit={e=>void sendEmail(e)} className="space-y-3"><label className="block"><span className={labelClass}>Email address</span><input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className={inputClass}/></label>
        <button type="submit" disabled={sending||profile.emailDeliveryConfigured===false} className="w-full rounded-xl border border-[#d4af9d] bg-[#fbf3ef] px-4 py-3 text-sm font-bold text-[#a64f32] hover:bg-[#f4e2d8] disabled:opacity-50 sm:w-auto">{sending?'Sending…':'Send verification code'}</button>
      </form>
      <form onSubmit={e=>void verify(e)} className="mt-6 space-y-3 border-t border-slate-100 pt-5"><label className="block"><span className={labelClass}>Six-digit code</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className={inputClass} placeholder="000000"/></label>
        <button type="submit" disabled={verifying||profile.emailDeliveryConfigured===false} className="w-full rounded-xl bg-[#26342d] px-4 py-3 text-sm font-bold text-white hover:bg-[#1c2721] disabled:opacity-50 sm:w-auto">{verifying?'Verifying…':'Verify email'}</button></form>
      <p className="mt-4 text-xs leading-5 text-slate-500">Email codes are sent by the server, expire after 10 minutes, and require a configured email provider. Your account's current email remains unchanged until verification succeeds.</p>
    </div>}
    {activeSection==='password'&&<form id="account-panel-password" onSubmit={e=>void changePassword(e)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4"><h3 className="text-lg font-bold text-slate-900">Change password</h3><p className="mt-1 text-sm text-slate-500">Confirm your current password to secure your account. Other sessions will be signed out.</p></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block"><span className={labelClass}>Current password</span><input type="password" required autoComplete="current-password" value={passwords.current} onChange={e=>setPasswords(p=>({...p,current:e.target.value}))} className={inputClass}/></label>
        <label className="block"><span className={labelClass}>New password</span><input type="password" required minLength={10} maxLength={256} autoComplete="new-password" value={passwords.next} onChange={e=>setPasswords(p=>({...p,next:e.target.value}))} className={inputClass}/></label>
        <label className="block"><span className={labelClass}>Confirm new password</span><input type="password" required minLength={10} maxLength={256} autoComplete="new-password" value={passwords.confirm} onChange={e=>setPasswords(p=>({...p,confirm:e.target.value}))} className={inputClass}/></label>
      </div>
      <button type="submit" disabled={changingPassword} className="mt-5 rounded-xl bg-[#26342d] px-5 py-3 text-sm font-bold text-white hover:bg-[#1c2721] disabled:opacity-50">{changingPassword?'Updating password…':'Update password'}</button>
    </form>}
  </section>;
}
