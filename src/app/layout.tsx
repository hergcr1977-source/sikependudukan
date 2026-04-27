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
                // Cek apakah sudah pernah cleanup SW (sekali saja per browser)
                if (sessionStorage.getItem('sw_cleaned')) return;

                if ('serviceWorker' in navigator) {
                  // Unregister semua SW lama
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(r) { r.unregister(); });
                  });
                }

                // Hapus semua cache
                if ('caches' in window) {
                  caches.keys().then(function(names) {
                    names.forEach(function(n) { caches.delete(n); });
                  });
                }

                // Tandai sudah dibersihkan (sekali per sesi browser)
                sessionStorage.setItem('sw_cleaned', '1');
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
