# Panduan Deployment Production — KasirKita POS & Inventory

Dokumen ini berisi panduan teknis langkah-demi-langkah untuk melakukan deployment aplikasi **KasirKita POS & Inventory** ke server production (Cloud VPS seperti DigitalOcean, AWS, Google Cloud, atau server on-premise toko) dengan keamanan standar enterprise, HTTPS tersertifikasi, serta penjadwalan backup database otomatis.

---

## 1. Persiapan Sistem & Spesifikasi Hardware Minimum

### Spesifikasi Hardware (VPS / Dedicated Server)
- **CPU**: Minimal 2 vCore (Direkomendasikan 4 vCore untuk konkurensi kasir tinggi)
- **RAM**: Minimal 4 GB (Direkomendasikan 8 GB untuk build & cache PostgreSQL)
- **Storage**: Minimal 40 GB NVMe SSD (Penting untuk kecepatan query database & foto nota)
- **Sistem Operasi**: Ubuntu 22.04 LTS / Debian 12

### Kebutuhan Software di Server
Pastikan software berikut sudah terinstal di server:
```bash
sudo apt update && sudo apt install -y curl git ufw
# Install Docker & Docker Compose Plugin
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
```

---

## 2. Konfigurasi Keamanan Jaringan & Firewall (UFW)

Sebelum menjalankan aplikasi, tutup port yang tidak diperlukan dan hanya buka port HTTP/HTTPS serta SSH:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80/tcp       # HTTP (untuk redireksi ke HTTPS)
sudo ufw allow 443/tcp      # HTTPS
sudo ufw enable
```

> [!WARNING]
> **Jangan pernah membuka port 5432 (PostgreSQL) ke publik** di server production! Dalam konfigurasi `docker-compose.yml`, database berkomunikasi dengan backend secara eksklusif melalui jaringan internal Docker (`pos_network`).

---

## 3. Deployment Stack dengan Docker Compose

1. Clone repositori ke direktori opt:
```bash
sudo mkdir -p /opt/kasirkita
cd /opt/kasirkita
git clone https://github.com/username/kasirkita.git .
```

2. Buat dan salin konfigurasi `.env` dari `.env.example`:
```bash
cp .env.example .env
nano .env
```

3. **Ganti semua secret default** dengan string acak berentropi tinggi:
```bash
# Generate secret acak dengan openssl
openssl rand -hex 32
```
Isikan hasil generate ke dalam parameter `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, dan `SEED_OWNER_PASSWORD`. Jika Anda menggunakan fitur OCR Nota otomatis, masukkan `ANTHROPIC_API_KEY` Anda.

4. Jalankan kontainer dalam mode background (`detached`):
```bash
docker compose up -d --build
```

5. Verifikasi status kontainer dan migrasi database:
```bash
docker compose ps
docker compose logs -f backend
```
Pastikan log menunjukkan: `✅ Prisma migrations deployed successfully!` dan `🌱 Running database seeding...`.

---

## 4. Reverse Proxy & Terminasi HTTPS (Nginx dengan Let's Encrypt / Caddy)

Aplikasi Next.js berjalan di port internal `3000` dan Backend API di `4000`. Kita gunakan Nginx sebagai reverse proxy untuk melayani domain publik (`pos.tokoanda.com`) dengan SSL gratis dari Let's Encrypt.

### Opsi A: Nginx + Certbot (Standar Industri)

1. Install Nginx & Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

2. Buat file konfigurasi `/etc/nginx/sites-available/pos.tokoanda.com`:
```nginx
server {
    server_name pos.tokoanda.com;

    # Keamanan tambahan header
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Ukuran maksimal upload foto nota OCR (8MB)
    client_max_body_size 10M;

    # 1. Traffic API diarahkan ke backend Node.js (port 4000)
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 2. Traffic UI diarahkan ke frontend Next.js (port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Aktifkan konfigurasi dan dapatkan sertifikat SSL:
```bash
sudo ln -s /etc/nginx/sites-available/pos.tokoanda.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d pos.tokoanda.com
```

---

### Opsi B: Caddy Server (Sangat Mudah & Otomatis HTTPS)

Jika ingin konfigurasi ringkas tanpa certbot terpisah, gunakan **Caddy**:

Buat file `/etc/caddy/Caddyfile`:
```caddy
pos.tokoanda.com {
    request_body {
        max_size 10MB
    }

    handle /api/* {
        reverse_proxy 127.0.0.1:4000
    }

    handle /* {
        reverse_proxy 127.0.0.1:3000
    }
}
```
Reload Caddy (`sudo systemctl reload caddy`), dan Caddy akan otomatis menerbitkan sertifikat Let's Encrypt dalam hitungan detik.

---

## 5. Konfigurasi Backup Database & Disaster Recovery

Aplikasi dilengkapi dengan skrip backup internal (`src/jobs/backupDatabase.js`) yang berjalan via Cron (`0 2 * * *` - jam 2 pagi). Untuk perlindungan ganda (offsite disaster recovery), tambahkan cron job tingkat sistem operasi di host server:

1. Buat direktori backup di host dan script `/usr/local/bin/backup-pos.sh`:
```bash
sudo mkdir -p /var/backups/kasir
sudo nano /usr/local/bin/backup-pos.sh
```

Isi dengan:
```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/var/backups/kasir/pos_db_$TIMESTAMP.sql.gz"

# Dump database dari dalam kontainer Docker langsung
docker exec pos_postgres_db pg_dump -U pos_user -d pos_inventory | gzip > "$BACKUP_FILE"

# Hapus backup yang lebih tua dari 30 hari di host
find /var/backups/kasir -type f -name "*.sql.gz" -mtime +30 -delete

echo "Backup sukses: $BACKUP_FILE"
```

2. Beri hak eksekusi dan pasang di Crontab host:
```bash
sudo chmod +x /usr/local/bin/backup-pos.sh
sudo crontab -e
```
Tambahkan baris berikut (jalan tiap jam 3 pagi):
```cron
0 3 * * * /usr/local/bin/backup-pos.sh >> /var/log/pos_backup.log 2>&1
```

---

## 6. Monitoring & Troubleshooting

### Melihat Log Real-time
```bash
# Log seluruh stack
docker compose logs -f

# Log khusus error backend
docker compose logs backend | grep -i error
```

### Restart & Pembaruan Kode (Continuous Deployment)
Jika ada update fitur baru dari repositori Git:
```bash
git pull origin main
docker compose up -d --build
```
Perintah di atas akan membangun ulang image Next.js/Node.js secara zero-downtime dan menjalankan migrasi skema database baru secara otomatis melalui `docker-entrypoint.sh`.
