# Temporal Code City: Visualizing Microservices Evolution Based on Git History with Procedural City Generation

## 👥 Penulis

- **Christopher Gijoh**
- **Evan Laluan**
- **Christian Oroh**

S1 Informatika, Universitas Pelita Harapan
Dirancang dan dikembangkan untuk proyek akhir mata kuliah *Grafika Komputer*.

## 📖 Deskripsi

**Temporal Code City** adalah alat visualisasi perangkat lunak yang menghadirkan *city metaphor* ke dalam aplikasi web 3D yang dinamis. Aplikasi ini memvisualisasikan evolusi struktur arsitektur skala besar, terutama *microservices* yang tersebar di banyak Git repository, dari waktu ke waktu.

Dalam representasi visual ini:

- **Buildings** merepresentasikan file individual.
- **Districts** merepresentasikan folder dan package.
- **Building Height** memvisualisasikan Lines of Code (LOC).
- **Colors** (Heatmap menggunakan colormap Magma) menunjukkan seberapa baru file terakhir diubah.
- **3D Curved Dependency Arcs** merepresentasikan keterkaitan kode dan dependency antar repository.

Memvisualisasikan puluhan ribu commit di browser biasanya menimbulkan bottleneck performa yang berat. **Temporal Code City** mengatasinya melalui implementasi WebGL yang optimal, khususnya **Instanced Rendering** dengan Three.js dan React, serta arsitektur data ingestion backend Node.js yang stabil dengan algoritma Treemap *Resquarify*. Hasilnya, aplikasi dapat tetap berjalan di atas 60 FPS tanpa patah-patah, bahkan ketika menampilkan lebih dari 10.000 file secara bersamaan di browser standar.

## 🛠️ Cara Kerja

Arsitektur sistem ini bekerja langsung dengan Git history dan analisis kode statis untuk memberi data ke visualizer berbasis React:

1. **Data Ingestion Node.js Parser (`scripts/git-parser.ts`)**: Git history dan dependency tree file diproses secara lokal di backend. Data ini dibaca otomatis dan disusun menjadi struktur JSON matriks yang terkompresi.
2. **Stable Treemap Hierarchy**: Menggunakan algoritma seperti `treemapResquarify` dari d3 agar posisi district dan file tetap stabil ketika ukuran atau nama file berubah, sehingga *mental map* developer tetap terjaga.
3. **Instanced Rendering Loop**: Daripada merender ribuan mesh geometri terpisah yang memicu overhead besar pada draw call, satu mesh dasar diduplikasi ke ribuan koordinat berbeda melalui WebGL `InstancedMesh` dan `Float32Array`, sehingga beban real-time berpindah dengan lancar ke GPU.
4. **Architectural Code Analysis**: Logika analitik menghitung metrik abstraksi di dalam visualizer untuk mengukur Code Health seperti **Modularity Index**, **Hub Detection** bottlenecks, **Coupling Radius**, **Abandoned Zones**, dan **Skyline Roughness**.

## 💻 Tech Stack

- Frontend: **React 19**, **Three.js**, **@react-three/fiber**, **@react-three/drei**, **Vite**
- Processing: **TypeScript**, **Node.js**, **d3-hierarchy**, **simple-git**

## 🚀 Cara Instalasi dan Menjalankan Project

### Prasyarat

- [Node.js](https://nodejs.org/en/) terpasang secara lokal (disarankan v18 atau lebih baru).

### 1. Install Dependencies

```bash
npm install
```

### 2. Parse Git History Project

Ekstrak Git history dan dependency dari repository yang ditargetkan. Git parser akan memproses project dan menghasilkan output untuk visualizer di `src/data/commits.json` dan `src/data/deps.json`.

Anda bisa memberikan absolute path dari repository yang ingin divisualisasikan melalui environment variable `REPO_PATHS` (dipisahkan koma untuk multi-repo):

```bash
REPO_PATHS=/path/to/my-first-repo,/path/to/my-second-repo npx tsx scripts/git-parser.ts
```

Jika tidak ada path yang diberikan, parser akan memakai direktori saat ini.

### 3. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:5173](http://localhost:5173) di browser Anda.

### 4. Build Project untuk Production

```bash
npm run build
```

Jika ingin melihat hasil build secara lokal, gunakan:

```bash
npm run preview
```

## 🎮 Cara Menggunakan Aplikasi

1. **Jelajahi 3D City**: Pan, rotate, dan zoom ke berbagai district dan module. Perhatikan garis dependency yang menghubungkan beberapa area arsitektur.
2. **Navigasi Timeline**: Gunakan controller "Timeline" untuk menelusuri evolusi commit software dari hari ke hari. Anda akan melihat bagaimana technical debt dan churn arsitektur terbentuk.
3. **Analytics Dashboard**: Buka panel Code Health untuk melihat metrik abstrak seperti Modularity Index dan Hub constraints secara real time guna menilai maintainability kode.
4. **Settings Panel**: Ubah toggle visual seperti filtering atau nonaktifkan curved dependency arcs untuk menyesuaikan intensitas rendering dan opsi tampilan.

## 📊 Hasil Benchmark

Kami mengevaluasi kecepatan parser dan beban rendering pada beberapa repository open-source besar dengan hingga 1.000+ commit. Secara umum, throughput parsing tetap tinggi dengan jejak memori yang stabil di kisaran 10-15 MB untuk transfer matriks rendering:

| Framework/System | Total Recorded Commits | Dependencies Handled | Time taken (ms) | Peak RAM usage (MB) |
| --- | --- | --- | --- | --- |
| **Express** | 2542 | 47 | ~2027.61 ms | ~12.12 MB |
| **Axios** | 1784 | 110 | ~4336.68 ms | ~14.54 MB |
| **Vue** | 1403 | 339 | ~5106.72 ms | ~11.89 MB |
| **Gin** | 1000 | 21 | ~1188.56 ms | ~10.21 MB |
| **Hugo** | 1017 | 573 | ~8025.52 ms | ~15.40 MB |
| **React** | 1000 | 1042 | ~35270.68 ms | ~10.48 MB |

Hasil di atas berasal dari environment lokal yang dicatat pada `tests/benchmark_results.json`. Rendering di dalam web visualizer tetap sangat cepat di atas 60 FPS dengan pemanfaatan paralelisme GPU, tanpa stuttering, bahkan pada repository React atau Hugo yang kompleks.
