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
                if ('serviceWorker' in navigator) {
                  // 1. Hapus semua SW yang terdaftar (termasuk sw.js lama)
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(r) { r.unregister(); });
                  });

                  // 2. Hapus semua cache
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      names.forEach(function(n) { caches.delete(n); });
                    });
                  }

                  // 3. Register kill-sw.js (file BARU, bukan sw.js yang di-cache SW lama)
                  // File ini akan: skipWaiting → hapus semua cache → unregister semua SW
                  navigator.serviceWorker.register('/kill-sw.js', { scope: '/' })
                    .then(function(reg) {
                      // Force activate segera tanpa menunggu tab ditutup
                      if (reg.active) {
                        reg.active.postMessage({ type: 'SKIP_WAITING' });
                      }
                    })
                    .catch(function(err) {
                      console.log('SW kill registered or error:', err);
                    });
                }

                // 4. Setelah 3 detik, force reload untuk memastikan halaman segar dari server
                setTimeout(function() {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(regs) {
                      if (regs.length === 0) {
                        // Sudah tidak ada SW, reload untuk ambil halaman dari server
                        window.location.reload();
                      }
                    });
                  }
                }, 3000);
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
