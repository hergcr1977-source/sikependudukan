#!/bin/bash

# ============================================
# SETUP EVOLUTION API - SIKEPENDUDUKAN
# ============================================
# Pastikan:
# 1. Docker sudah terinstall
# 2. docker-compose sudah berjalan (docker-compose up -d)
# 3. Evolution API sudah aktif di http://localhost:8080
# ============================================

EVO_URL="http://localhost:8080"
EVO_KEY="${EVOLUTION_API_KEY:-evo_sikependudukan_secret_2026}"
INSTANCE="sikependudukan"
WEBHOOK_URL="https://sikependudukan.vercel.app/api/evolution/webhook"

echo "=========================================="
echo "  SETUP EVOLUTION API"
echo "=========================================="
echo ""
echo "API URL : $EVO_URL"
echo "Instance: $INSTANCE"
echo "Webhook : $WEBHOOK_URL"
echo ""

# 1. Cek apakah Evolution API sudah berjalan
echo "[1/4] Mengecek Evolution API..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$EVO_URL" 2>/dev/null)
if [ "$STATUS" != "000" ]; then
    echo "  ✓ Evolution API berjalan"
else
    echo "  ✗ Evolution API belum berjalan!"
    echo "  Jalankan terlebih dahulu: cd evolution-api && docker-compose up -d"
    exit 1
fi

# 2. Buat instance
echo ""
echo "[2/4] Membuat instance '$INSTANCE'..."
CREATE_RESULT=$(curl -s -X POST "$EVO_URL/instance/create" \
  -H "apikey: $EVO_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"instanceName\": \"$INSTANCE\",
    \"qrcode\": true,
    \"integration\": \"WHATSAPP-BAILEYS\"
  }")
echo "  $CREATE_RESULT"

# 3. Set webhook
echo ""
echo "[3/4] Mengatur webhook..."
WEBHOOK_RESULT=$(curl -s -X POST "$EVO_URL/webhook/set/$INSTANCE" \
  -H "apikey: $EVO_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"enabled\": true,
    \"url\": \"$WEBHOOK_URL\",
    \"webhookByEvents\": true,
    \"events\": [\"MESSAGES_UPSERT\", \"CONNECTION_UPDATE\"]
  }")
echo "  $WEBHOOK_RESULT"

# 4. Ambil QR Code
echo ""
echo "[4/4] Mengambil QR Code..."
echo "  Scan QR Code berikut dengan WhatsApp:"
echo "  (WhatsApp > Menu > Perangkat Tertaut > Tautkan Perangkat)"
echo ""
echo "=========================================="

# Fetch QR code - akan mengembalikan base64 QR
QR_RESULT=$(curl -s -X GET "$EVO_URL/instance/connect/$INSTANCE" \
  -H "apikey: $EVO_KEY")

echo "$QR_RESULT" | python3 -c "
import sys, json, base64
try:
    data = json.load(sys.stdin)
    if 'base64' in data:
        # Simpan QR sebagai gambar
        qr_b64 = data['base64']
        if ',' in qr_b64:
            qr_b64 = qr_b64.split(',')[1]
        with open('qrcode.png', 'wb') as f:
            f.write(base64.b64decode(qr_b64))
        print('QR Code tersimpan di: qrcode.png')
        print('Buka file tersebut untuk scan.')
    elif 'pairingCode' in data:
        print(f'Pairing Code: {data[\"pairingCode\"]}')
        print('Masukkan kode ini di WhatsApp > Menu > Tautkan Perangkat')
    elif 'error' in data:
        print(f'Error: {data[\"error\"]}')
    else:
        print(json.dumps(data, indent=2))
except:
    print('Tidak bisa parse response QR')
    print(sys.stdin.read() if hasattr(sys.stdin, 'read') else '')
" 2>/dev/null

echo "=========================================="
echo ""
echo "Setelah scan QR berhasil, coba kirim pesan:"
echo "  #HELP"
echo "di grup WhatsApp untuk testing."
echo ""
echo "Cek koneksi: curl $EVO_URL/instance/fetchInstances -H 'apikey: $EVO_KEY'"
