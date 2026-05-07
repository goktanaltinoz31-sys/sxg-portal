const CACHE_NAME="sxg-portal-v7";
const ASSETS=["/","/index.html","/manifest.json"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(fetch(event.request).then(res=>{
    const copy=res.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    return res;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match("/index.html"))));
});
self.addEventListener("push",event=>{
  let data={};try{data=event.data?event.data.json():{}}catch(e){}
  event.waitUntil(self.registration.showNotification(data.title||"SXG Portal",{body:data.body||"Neue Benachrichtigung",icon:"/sxg-logo.png",badge:"/sxg-logo.png",data:{url:data.url||"/"}}))
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url||"/"))
});
