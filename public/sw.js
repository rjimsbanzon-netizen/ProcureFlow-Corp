/* ProcureFlow public app-shell cache. NEVER cache authenticated APIs or documents. */
const STATIC='procureflow-public-v1';
const SHELL=['/','/index.html','/manifest.webmanifest','/pwa-192.png','/pwa-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(STATIC).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('procureflow-public-')&&k!==STATIC).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>{
   if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(STATIC).then(c=>c.put('/index.html',copy)));}
   return response;
  }).catch(async()=>await caches.match('/index.html')||Response.error()));return;
 }
 // Only cache public build output and installable-app assets, never API requests.
 if(!/^\/(assets\/[^?]+|pwa-(?:192|512)\.png|manifest\.webmanifest|procureflow-mark\.png|procureflow-favicon\.png)$/.test(url.pathname))return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
  if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(STATIC).then(c=>c.put(req,copy)));}
  return response;
 })));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=event.notification.data?.tab||'notifications';
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const current=clients.find(c=>new URL(c.url).origin===self.location.origin);
  if(current){await current.focus();current.postMessage({type:'PROCUREFLOW_OPEN_MODULE',tab:target});}
  else await self.clients.openWindow('/?from=notification');
 }));
});
// No push event is registered: device alerts are intentionally scoped to the running app.
