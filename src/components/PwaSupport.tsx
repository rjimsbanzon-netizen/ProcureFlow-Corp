import {useEffect,useState} from 'react';
import {DB} from '../store/state';
import {getNotifications,isNotificationRead} from '../features/notifications/notificationService';
import {subscribeCloudNotifications} from '../features/notifications/cloudNotificationSync';
import {canAccessTab} from '../domain/permissions';
import {navigateTo} from '../core/renderBridge';
import {showToast} from '../services/toast';

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
let pendingInstall:InstallEvent|null=null;
let swReady=false;
const seen=new Map<string,Set<string>>();
const alertKey=(userId:string)=>`procureflow_mobile_alerts_${userId}`;
const available=typeof window!=='undefined'&&'Notification' in window&&'serviceWorker' in navigator;

/** User-initiated desktop/mobile alerts while the app is open; not remote Web Push. */
export function PwaSupport(){
 const account=String(DB.currentUser?.id||'');
 const [installReady,setInstallReady]=useState(Boolean(pendingInstall));
 const [installed,setInstalled]=useState(window.matchMedia?.('(display-mode: standalone)').matches||false);
 const [enabled,setEnabled]=useState(localStorage.getItem(alertKey(account))==='yes');
 const [help,setHelp]=useState(false);
 useEffect(()=>{
  const ask=(e:Event)=>{e.preventDefault();pendingInstall=e as InstallEvent;setInstallReady(true)};
  const done=()=>{setInstalled(true);pendingInstall=null;setInstallReady(false)};
  window.addEventListener('beforeinstallprompt',ask);window.addEventListener('appinstalled',done);
  return()=>{window.removeEventListener('beforeinstallprompt',ask);window.removeEventListener('appinstalled',done)};
 },[]);
 useEffect(()=>{
  if(!available||swReady||!('serviceWorker' in navigator))return;
  swReady=true;
  navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(err=>{console.warn('PWA installation unavailable:',err);swReady=false});
 },[]);
 useEffect(()=>{
  const listener=(e:MessageEvent)=>{
   if(e.data?.type!=='PROCUREFLOW_OPEN_MODULE')return;
   const tab=String(e.data?.tab||'notifications');
   if(canAccessTab(tab))navigateTo(tab);
  };
  navigator.serviceWorker?.addEventListener('message',listener);
  return()=>navigator.serviceWorker?.removeEventListener('message',listener);
 },[]);
 useEffect(()=>{
  if(!account)return;
  let known=seen.get(account);
  if(!known){known=new Set(getNotifications().map(n=>n.id));seen.set(account,known);}
  const current=known;
  const changed=()=>{
   const notifications=getNotifications();
   for(const item of notifications){
    if(current.has(item.id))continue;
    current.add(item.id);
    if(!enabled||!available||Notification.permission!=='granted'||item.historical||isNotificationRead(item))continue;
    // Do not send historical record alerts on login; only newly detected items in the current session.
    void navigator.serviceWorker.ready.then(reg=>reg.showNotification(item.title,{
      body:item.description,icon:'/pwa-192.png',tag:item.id,data:{tab:item.targetTab},
    })).catch(()=>{});
   }
   if(current.size>1000)seen.set(account,new Set([...current].slice(-600)));
  };
  return subscribeCloudNotifications(changed);
 },[account,enabled]);
 const install=async()=>{
  if(!pendingInstall){setHelp(v=>!v);return;}
  const event=pendingInstall;pendingInstall=null;setInstallReady(false);
  await event.prompt();try{const result=await event.userChoice;if(result.outcome==='accepted')setInstalled(true)}catch{}
 };
 const toggle=async()=>{
  if(enabled){localStorage.removeItem(alertKey(account));setEnabled(false);showToast('Device alerts paused. Your in-app notifications remain available.','info');return;}
  if(!available){showToast('This browser does not support device notifications. Use the notification bell instead.','warning');return;}
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){showToast('Device notifications were not enabled in your browser settings.','warning');return;}
  // Baseline first, so enabling alerts does not notify about all old records.
  seen.set(account,new Set(getNotifications().map(x=>x.id)));
  localStorage.setItem(alertKey(account),'yes');setEnabled(true);
  showToast('Device alerts enabled while ProcureFlow is open.','success');
 };
 return <div className="relative flex gap-1 items-center"><button type="button" onClick={()=>void install()} title="Install ProcureFlow app" className="pf-install-button rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><i className="fa-solid fa-mobile-screen-button mr-1"/><span className="hidden lg:inline">{installed?'App':installReady?'Install':'How to install'}</span></button>
 <button type="button" onClick={()=>void toggle()} title="Device alerts while ProcureFlow is open" aria-label={enabled?'Turn off device alerts':'Turn on device alerts'} className={`pf-alert-button rounded-lg border px-2 py-2 text-xs font-semibold ${enabled?'bg-emerald-50 border-emerald-200 text-emerald-700':'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><i className={`fa-solid ${enabled?'fa-bell':'fa-bell-slash'}`}/></button>
 {help&&<div className="absolute top-11 right-0 z-50 w-64 rounded-xl bg-white shadow-2xl border p-4 text-sm text-slate-700"><strong>Install ProcureFlow</strong><p className="mt-2 text-xs">On iPhone: open Safari’s Share menu and choose <b>Add to Home Screen</b>. On other devices, use your browser’s Install app option if shown.</p><p className="mt-2 text-xs text-slate-500">Installation requires HTTPS and browser support. Alerts are delivered while the app is running.</p><button onClick={()=>setHelp(false)} className="mt-3 text-xs font-bold text-[#a64f32]">Close</button></div>}
 </div>;
}
