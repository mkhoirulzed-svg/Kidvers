# KidVerse Demo

Contoh game edukasi HTML5 yang dapat langsung dimainkan dan di-deploy ke GitHub Pages.

## Isi demo

- Dunia 2D top-down yang digambar langsung dengan Canvas.
- Karakter dapat bergerak menggunakan keyboard atau tombol layar.
- Sekolah berisi kuis matematika.
- Taman Bintang terkunci sampai anak menjawab 3 soal dengan benar.
- Mini-game Tangkap Bintang.
- Sistem koin, XP, dan level.
- Progres tersimpan di browser menggunakan `localStorage`.
- PWA: dapat dipasang ke layar utama setelah di-host menggunakan HTTPS.
- Tidak memakai library atau aset pihak ketiga.

## Cara mencoba di komputer

Game memakai Service Worker, jadi paling aman dijalankan melalui server lokal.

### Menggunakan VS Code

1. Buka folder ini di VS Code.
2. Pasang ekstensi **Live Server**.
3. Klik kanan `index.html`.
4. Pilih **Open with Live Server**.

### Menggunakan Python

```bash
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Deploy ke GitHub Pages

1. Buat repository baru, misalnya `kidverse-demo`.
2. Unggah **seluruh isi folder ini** ke root repository.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`.
6. Tekan **Save**.
7. Setelah proses selesai, GitHub memberi alamat seperti:
   `https://username.github.io/kidverse-demo/`

Semua path dibuat relatif sehingga aman dipasang pada subfolder GitHub Pages.

## Kontrol

- Keyboard: `WASD` atau tombol panah.
- Interaksi: `E` atau `Enter`.
- Mobile: gunakan tombol arah dan tombol `A` di layar.

## Struktur

```text
kidverse-demo/
├── index.html
├── manifest.webmanifest
├── sw.js
├── README.md
├── css/
│   └── style.css
├── js/
│   └── game.js
└── assets/
    └── icons/
        ├── icon-192.png
        └── icon-512.png
```

## Catatan pengembangan

Demo ini sengaja dibuat tanpa Phaser agar mudah dipahami dan dapat berjalan tanpa dependensi. Untuk versi yang lebih besar, dunia, NPC, soal, item, dan mini-game dapat dipisahkan menjadi modul serta data JSON.
