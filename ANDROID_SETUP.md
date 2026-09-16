# Android client

Folder `android-app/` adalah project Android native Kotlin + Jetpack Compose.

Buka folder `android-app/` langsung dari Android Studio, lalu pilih **Sync Project with
Gradle Files**. Project memakai:

- **Package:** `id.absensiplus.app`
- **Minimum SDK:** 26
- **Compile/target SDK:** 35
- **JVM target:** 17 untuk Java dan Kotlin
- **Android Gradle Plugin:** 8.13.2 dan Gradle 9.3.0, kompatibel dengan JDK
  Android Studio terbaru
- **Kotlin:** 2.1.21, untuk menghindari internal compiler error pada Kotlin 2.0.21
- **Ktor:** 3.1.3 (versi ini menghindari error D8 `use streaming syntax` pada
  perangkat dengan `minSdk` di bawah 30)

Tambahkan dependency Supabase Kotlin pada `app/build.gradle.kts`:

```kotlin
implementation("io.github.jan-tennert.supabase:postgrest-kt:3.2.0")
implementation("io.github.jan-tennert.supabase:auth-kt:3.2.0")
implementation("io.github.jan-tennert.supabase:realtime-kt:3.2.0")
implementation("io.ktor:ktor-client-android:3.2.3")
```

Salin `local.properties.example` menjadi `local.properties`, lalu isi URL dan anon key.
Nilai tersebut dibaca ke `BuildConfig`; jangan masukkan
service-role key ke APK. Layar awal masih berupa skeleton; koneksi Auth, absensi,
pengajuan, dan Realtime akan dihubungkan ke migration Supabase berikutnya.
