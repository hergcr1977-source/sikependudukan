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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (!('serviceWorker' in navigator)) return;

                // Tangkap pesan dari SW untuk reload
                navigator.serviceWorker.addEventListener('message', function(event) {
                  if (event.data && event.data.type === 'SW_UPDATED') {
                    window.location.reload();
                  }
                });

                // Register/update SW baru (browser selalu fetch sw.js dari network)
                navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                  .then(function(reg) {
                    // Jika ada SW baru yang menunggu, pakai skipWaiting
                    if (reg.waiting) {
                      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                    // Listen untuk update
                    reg.addEventListener('updatefound', function() {
                      var newWorker = reg.installing;
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          // SW baru terinstall, tapi SW lama masih aktif
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
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
