import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Sistem Data Kependudukan RT.001 RW.002",
  description: "Sistem Data Kependudukan RT.001 RW.002 Sukamaju Cibungbulang Bogor",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sikependudukan",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (!('serviceWorker' in navigator)) return;

                // Unregister semua service worker lama dulu
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var i = 0; i < registrations.length; i++) {
                    registrations[i].unregister();
                  }
                });

                // Register SW baru dengan cache-busting version
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js?v=3', {
                    scope: '/'
                  }).then(function(reg) {
                    // Force update jika ada versi baru
                    reg.update();
                    reg.addEventListener('updatefound', function() {
                      var newWorker = reg.installing;
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'activated') {
                          // SW baru aktif, bisa reload kalau perlu
                          console.log('Service Worker v3 activated');
                        }
                      });
                    });
                  });
                });
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
