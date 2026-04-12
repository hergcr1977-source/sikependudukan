---
Task ID: 1
Agent: Super Z (Main)
Task: Tambah tab Kas RT ke aplikasi Sikependudukan

Work Log:
- Added KasRT model to prisma/schema.prisma (id, tanggal, jenis, jumlah, keterangan, timestamps)
- Created /api/kas-rt/route.ts (GET with filters for bulan/tahun/jenis, POST for new entries)
- Created /api/kas-rt/[id]/route.ts (PUT for update, DELETE for removal)
- Created TabKasRT.tsx component with full features:
  - Summary cards (Total Pemasukan, Total Pengeluaran, Saldo)
  - Filter by bulan/tahun
  - Sort toggle (terbaru/terlama)
  - Desktop + Mobile responsive table
  - Form dialog with jenis toggle (Pemasukan/Pengeluaran)
  - Edit & Delete functionality
  - Export CSV with totals
  - Auto-refresh via sikependudukan-data-changed events
- Updated setup-db/route.ts to auto-create KasRT table
- Updated page.tsx: added Wallet icon, TabKasRT import, 7-column grid, new tab trigger + content
- Committed and pushed to GitHub (Vercel auto-deploy)

Stage Summary:
- Tab Kas RT sudah terintegrasi sepenuhnya
- Fitur tidak mengganggu fitur yang sudah ada (hanya menambahkan tab baru)
- Semua file baru bersifat standalone dan mudah dihapus jika tidak sesuai
- Deploy ke Vercel via GitHub auto-deploy
