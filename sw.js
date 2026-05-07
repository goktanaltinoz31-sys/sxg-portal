self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: "SXG Portal", body: "Neue Benachrichtigung", url: "/" }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "SXG Portal", {
      body: data.body || "Neue Benachrichtigung",
      icon: "/sxg-logo.png",
      badge: "/sxg-logo.png",
      data: { url: data.url || "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil(clients.openWindow(url))
})
