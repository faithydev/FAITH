# FAITH — to'liq yo'l xaritasi (ROADMAP)

> Holat: **2026-yil 13-noyabr**. Bu hujjat FAITH platformasi haqida hamma narsani bir joyga yig'adi:
> nima uchun bor, bugun nima qurilgan va jonli ishlayapti, nima hali simulyatsiya, qanday xavflar
> bor, va platforma qaysi tartibda, qaysi bosqichlar orqali o'sishi kerak.
>
> Sanalar va'da emas, tartib. Har bir bosqichning **"tayyor" mezoni** bor: mezon bajarilmaguncha
> bosqich tugagan hisoblanmaydi.

---

## Mundarija

1. [Vizyon](#1-vizyon)
2. [FAITH kim uchun](#2-faith-kim-uchun)
3. [Bugungi holat: nima qurilgan](#3-bugungi-holat-nima-qurilgan)
4. [Nima haqiqiy, nima hali simulyatsiya](#4-nima-haqiqiy-nima-hali-simulyatsiya)
5. [Pul, valyuta va komissiya modeli](#5-pul-valyuta-va-komissiya-modeli)
6. [Tariflar, rollar va FAITH Verified galochkalari](#6-tariflar-rollar-va-faith-verified-galochkalari)
7. [Texnik arxitektura](#7-texnik-arxitektura)
8. [Jonli muhit (production)](#8-jonli-muhit-production)
9. [Xavflar va zudlik bilan hal qilinadiganlar](#9-xavflar-va-zudlik-bilan-hal-qilinadiganlar)
10. [Whop bilan solishtirish](#10-whop-bilan-solishtirish)
11. [Bosqichlar](#11-bosqichlar)
12. [Siz qabul qilishingiz kerak bo'lgan biznes qarorlar](#12-siz-qabul-qilishingiz-kerak-bolgan-biznes-qarorlar)
13. [O'lchovlar (KPI)](#13-olchovlar-kpi)
14. [Ish tartibi: kim nima qiladi](#14-ish-tartibi-kim-nima-qiladi)
15. [Ilova: sahifalar va modullar ro'yxati](#15-ilova-sahifalar-va-modullar-royxati)

---

## 1. Vizyon

**FAITH — kurslar, xizmatlar va jiddiy raqamli mahsulotlar sotiladigan, Osiyo uchun qurilgan
ijodkorlar va bizneslar platformasi.**

- **Asosiy yo'nalish:** kurslar va xizmatlar (ta'lim, maslahat, frilans, agentlik ishlari).
  Mahsulotlar ham sotiladi, lekin faqat **jiddiy** mahsulotlar: dasturiy ta'minot, shablonlar,
  litsenziyalar, professional resurslar. Arzon, sifatsiz yoki "tez pul" mahsulotlari uchun joy yo'q.
- **Bozor:** markaz — O'zbekiston, maqsad — butun Osiyo (Markaziy, G'arbiy, Janubiy, Sharqiy
  Osiyo), shuningdek Yevropa va boshqa mamlakatlardan keladigan xaridorlar.
- **Pul:** asosiy valyutalar — **so'm (UZS)** va **AQSh dollari (USD)**. Har bir xaridor narxlarni
  o'z mamlakati valyutasida ko'radi.
- **Raqobat:** Whop.com bilan bir xil turdagi xizmat, lekin undan kuchliroq: mahalliy to'lovlar,
  mahalliy til va valyuta, "FAITH Verified" ishonch belgisi, kurs va xizmatlarga chuqur e'tibor,
  ish va kontent-mukofot bozorlari bitta akkauntda.

**Bir jumlada:** *Bitta identifikator — cheksiz imkoniyatlar.* Bir akkaunt bilan odam xaridor,
sotuvchi, ijodkor, frilanser, ish izlovchi, brend yoki dasturchi bo'la oladi.

---

## 2. FAITH kim uchun

| Kim | Nima qiladi | Asosiy sahifalar |
|---|---|---|
| **Xaridor / mijoz** | Kurs, xizmat va mahsulot topadi, sotib oladi, kutubxonasida saqlaydi | `/courses`, `/services`, `/marketplace`, `/app/library` |
| **Sotuvchi** | Do'kon ochadi, mahsulot va tariflar qo'yadi, buyurtma va daromadni kuzatadi | `/app/seller/*` |
| **Ijodkor (creator)** | Kurs yaratadi, hamjamiyat yuritadi, brend kampaniyalarida qatnashib mukofot oladi | `/app/creator/*` |
| **Frilanser** | Xizmat paketlarini sotadi, loyihalarni bosqichma-bosqich bajaradi | `/app/freelance/*` |
| **Ish izlovchi** | Vakansiyalarga ariza beradi, portfolio yuritadi | `/app/work/*` |
| **Brend / biznes** | Kontent-mukofot kampaniyalari, xodim yollash, ijodkorlar bilan ishlash | `/app/brand/*` |
| **Dasturchi** | FAITH ilovalar do'koni uchun ilova yaratadi, API va webhook'lardan foydalanadi | `/app/developer/*` |
| **Platforma egalari (Founder, admin)** | Moderatsiya, moliya, foydalanuvchilar, galochkalar, eksport | `/admin/*` |

---

## 3. Bugungi holat: nima qurilgan

Hammasi bitta monorepo'da, avtomatik testlar bilan. Oxirgi o'lchov: **API testlari 73/73**,
**unit testlar 25/25**, lint va TypeScript toza, 8 til bo'yicha 1455 ta tarjima kaliti.

### 3.1. Akkaunt va kirish
- Email va parol bilan ro'yxatdan o'tish, email tasdiqlash, parolni tiklash.
- **Google orqali kirish — jonli ishlaydi.**
- Apple orqali kirish — kod tayyor; Apple Developer a'zoligi ($99/yil) va 4 ta kalit kerak.
- Ikki bosqichli autentifikatsiya (TOTP), zaxira kodlar, faol seanslarni boshqarish.
- Akkauntni o'chirish (shaxsiy ma'lumotlar o'chadi, moliyaviy yozuvlar ismsiz qoladi).
- 8 til: o'zbek (asosiy), rus, ingliz, turk, qozoq, arab (o'ngdan chapga), xitoy, ispan.

### 3.2. Savdo (marketplace)
- Do'konlar: **logo va banner**, tavsif, chegirma kodlari, litsenziya shablonlari.
- Mahsulotlar: tariflar (variantlar), versiyalar, fayllar, **rasm galereyasi va previewlar**,
  muqova tanlash, moderatsiya.
- Savatcha, checkout, buyurtmalar, qaytarishlar (qisman ham), raqamli kutubxona,
  himoyalangan yuklab olish havolalari.
- Sharhlar, istaklar ro'yxati, hamkorlar (revenue share), affiliate havolalari.
- **To'lov havolalari** (`/buy/kod`): bitta tarifni darhol sotib olishga ochadigan havola,
  tashriflar sanaladi, o'chirib qo'yish mumkin.
- **Reyting** (`/leaderboard`): do'konlar to'langan buyurtmalar soni bo'yicha (hafta, 30 kun,
  barcha vaqt).
- Homiylik reklamalari — doim "Reklama" deb belgilanadi va tabiiy tartibni o'zgartirmaydi.

### 3.3. Kurslar va hamjamiyatlar
- Kurslar: bo'limlar, darslar, yozilish, dars bo'yicha progress.
- Hamjamiyatlar: kanallar, postlar, izohlar; Pro tarifga bog'liq yopiq hamjamiyatlar.

### 3.4. Xizmatlar va frilans
- Xizmat e'lonlari va paketlar, loyihalar, **bosqichli (milestone) to'lovlar**, nizolar.

### 3.5. Ish bozori
- Vakansiyalar (moderatsiyadan o'tadi), arizalar, saqlangan vakansiyalar, nomzod profili, portfolio.

### 3.6. Kontent-mukofotlar (content rewards)
- Brend kampaniyalari: byudjet, qoidalar (masalan 1000 ko'rish uchun X), talablar, muddatlar.
- Ijodkor arizalari va topshiriqlari, metrikalar, mukofot hisoblash, tekshiruv, shikoyat (appeal),
  firibgarlik signallari.

### 3.7. Dasturchilar ekotizimi
- Ilovalar do'koni: ilova, versiyalar, ko'rib chiqish, o'rnatish, sharhlar.
- API kalitlari (scope'lar bilan), imzolangan webhook'lar, TypeScript SDK.
- **Hech qanday tashqi kod FAITH serverida ishga tushirilmaydi.**

### 3.8. Avtomatlashtirish va AI
- Hodisalar navbati (outbox): har bir muhim harakat xabarnoma, avtomatlashtirish va
  webhook'larni ishga tushiradi.
- Foydalanuvchi avtomatlashtirish qoidalari.
- AI yordamchi (Anthropic Claude) — kalit qo'yilmaguncha "DEMO" deb belgilangan javob beradi;
  muhim harakatlar faqat aniq tasdiq bilan bajariladi.

### 3.9. Platforma boshqaruvi (admin)
- Foydalanuvchilar, rollar, to'xtatish, moderatsiya (mahsulot, kampaniya, vakansiya, ilova,
  reklama, kontent), moliya (tranzaksiyalar, solishtirish, to'lovlar, qaytarishlar),
  qo'llab-quvvatlash, sozlamalar, feature flag'lar, A/B tajribalar, audit jurnali.
- **Platforma egalariga real vaqtli xabarnomalar:** yangi ro'yxatdan o'tish (qaysi usulda),
  to'langan va qaytarilgan buyurtmalar, yangi Pro obunachilar, yangi mahsulotlar, ish arizalari,
  ilova o'rnatilishi.
- **Excel (CSV) eksport:** foydalanuvchilar, barcha faoliyat, buyurtmalar. Har bir yuklab olish
  audit jurnaliga yoziladi.
- **Boshqa akkauntlarni olib tashlash** (faqat Founder): oldindan ko'rish va `REMOVE` deb
  tasdiqlash bilan.
- Valyuta kurslarini qo'lda yangilash.

### 3.10. Valyuta (yangi)
- O'zbekiston Markaziy bankining rasmiy kurslari, har 6 soatda avtomatik yangilanadi.
- 58 ta valyuta; xaridor o'z valyutasini tanlaydi yoki u mamlakati bo'yicha avtomatik aniqlanadi.
- Narx yonida "≈ 630 000 so'm" kabi qator, to'lov sahifasida "to'lov qaysi valyutada olinadi"
  degan ochiq ogohlantirish.

### 3.11. Dizayn
- Sof qora va neon yashil; shisha (glass) panellar; kursor tomon yorug'lik oqadigan tugmalar;
  sahifalar orasida yorug' chaqnashsiz o'tishlar.
- Three.js: bosh sahifa tarmog'i, ekotizim bo'limida aylanuvchi zarrachali shakllar, kirish
  sahifasida to'lqinlar. WebGL bo'lmasa yoki harakat kamaytirilgan bo'lsa, statik variantlar.
- Rasmiy FAITH logotipi va 8 ta FAITH Verified galochkasi siz bergan rasmlardan olingan.

---

## 4. Nima haqiqiy, nima hali simulyatsiya

Bu bo'lim muhim: platforma **hali haqiqiy pul qabul qilmaydi**.

| Qism | Holat | Izoh |
|---|---|---|
| To'lovlar | **Simulyator** | "SIMULYATSIYA: haqiqiy pul harakatlanmaydi" deb ochiq yozilgan. Payme, Click, Stripe adapterlari bor, lekin ulanmagan |
| Sotuvchilarga pul o'tkazish | **Simulyatsiya** | So'rov va tasdiqlash oqimi bor, real o'tkazma yo'q |
| Email | **Yuborilmaydi** | Jonli demo'da xatlar faqat bazaga yoziladi |
| Fayllar | **Vaqtinchalik disk** | Render bepul serverida yuklangan rasm va fayllar qayta deploy'da o'chadi (9-bo'limga qarang) |
| Google kirish | **Haqiqiy** | Jonli ishlaydi |
| Apple kirish | O'chiq | Apple Developer a'zoligi kerak |
| Valyuta kurslari | **Haqiqiy** | Markaziy bank, cbu.uz |
| AI | Demo | Anthropic kaliti qo'yilsa haqiqiy bo'ladi |
| Huquqiy hujjatlar | **Tekshirilmagan** | Shartlar va maxfiylik siyosati yuristdan o'tmagan; platforma huquqiy talablarga mos deb da'vo qilinmaydi |

---

## 5. Pul, valyuta va komissiya modeli

### 5.1. Asosiy qoidalar
- Barcha summalar **butun sonlarda, eng kichik birlikda** (tiyin, sent) saqlanadi. Hisob-kitobda
  kasr son (float) yo'q.
- **Ikki tomonlama buxgalteriya jurnali (ledger):** har bir pul harakati debet va kredit sifatida
  yoziladi, yozuvlarni o'zgartirish yoki o'chirish **ma'lumotlar bazasi darajasida taqiqlangan**.
- Har bir to'lov **idempotent**: ikki marta bosish ikki buyurtma yaratmaydi.

### 5.2. Valyutalar
- **Narx belgilash, to'lov olish va hisob-kitob — faqat UZS yoki USD.** Sotuvchi do'kon ochganda
  shulardan birini tanlaydi.
- **Ko'rsatish valyutasi — 58 tadan istalgani:** Markaziy Osiyo (KZT, KGS, TJS, TMT, AFN),
  G'arbiy Osiyo va Kavkaz (TRY, AZN, GEL, AMD, AED, SAR, QAR, KWD, BHD, OMR, JOD, ILS, IQD),
  Janubiy Osiyo (INR, PKR, BDT), Sharqiy va Janubi-Sharqiy Osiyo (CNY, JPY, KRW, HKD, SGD, MYR,
  THB, VND, IDR, PHP, MNT, KHR, LAK, MMK, BND), Yevropa (EUR, GBP, CHF, PLN, CZK, SEK, NOK, DKK,
  HUF, RON, UAH, RUB, BYN, MDL, RSD, ISK), boshqa (CAD, AUD, NZD).
- Ko'rsatish valyutasi tartibi: qurilmada tanlangani → akkauntda saqlangani → mamlakat (IP
  bo'yicha) → til.
- Kurs topilmasa, taxminiy summa **ko'rsatilmaydi** (taxmin qilinmaydi).
- Kurs manbai bir kun ishlamay qolsa, oxirgi saqlangan kurslar qoladi.

### 5.3. Keyingi qadam: mahalliy valyutada haqiqiy to'lov
Hozir chet ellik xaridor narxni o'z valyutasida **ko'radi**, lekin to'lov UZS yoki USD'da olinadi
(kartasi bank kursi bilan konvertatsiya qiladi). Haqiqiy mahalliy to'lov uchun har bir mamlakatda
to'lov hamkori kerak (11-bo'lim, 3-bosqich).

### 5.4. Komissiyalar
- **Marketplace komissiyasi: 3,5%** (350 bps). Sozlamalarda o'zgaradi, lekin o'zboshimchalik bilan
  o'zgartirilmaydi. Qaytarishda komissiya proporsional qaytariladi.
- **Ilovalar do'koni komissiyasi: hali belgilanmagan** — bu sizning qaroringiz (12-bo'lim).
- To'lov tizimi xarajatlari va soliqlar komissiyadan alohida.

---

## 6. Tariflar, rollar va FAITH Verified galochkalari

### 6.1. Tariflar
| | Free | Pro |
|---|---|---|
| Narx | 0 | **$11,99 / oy** (yillik narx hali belgilanmagan) |
| Ko'rish va xarid qilish | ✓ | ✓ |
| Sotish, kurs yaratish, xizmat, ish e'lonlari, kampaniyalar, ilovalar | — | ✓ |
| Kengaytirilgan tahlil, avtomatlashtirish, premium vitrina, AI biznes vositalari | — | ✓ |
| FAITH Verified galochkasi | — | ✓ (24 soat ichida) |

Free foydalanuvchi boshqa bo'limni ochsa, "Pro imkoniyati" oynasi chiqadi. Rollar o'chmaydi,
Pro yoqilganda darhol ochiladi.

### 6.2. Pro xaridi va galochka
1. Xaridor 7 ta roldan **aynan bittasini** tanlaydi: Xaridor/Mijoz, Ish izlovchi, Frilanser,
   Sotuvchi, Ijodkor, Brend, Dasturchi. Tanlamasa, to'lov tugmasi yonmaydi.
2. To'lovdan keyin tanlangan rol darhol ochiladi.
3. Galochka **24 soatda avtomatik** tasdiqlanadi yoki admin uni darhol tasdiqlaydi/rad etadi.
4. Pro tugasa, galochka olib tashlanadi; qayta faollashsa, qaytadi.

### 6.3. Founder
- Oltin **Founder** galochkasi va bosh admin huquqi.
- Faqat Google yoki Apple bilan **tasdiqlangan** email orqali beriladi (`FOUNDER_EMAILS`), shuning
  uchun birov sizning emailingizni yozib ro'yxatdan o'tsa ham Founder bo'lolmaydi.

### 6.4. Xavfsizlik qoidalari
- Jonli saytda README'da paroli yozilgan namuna akkauntlarda admin huquqi yo'q.
- Ommaviy demo'da emailni tasdiqlab bo'lmagani uchun, Google bilan kirgan haqiqiy egasi kelganda
  begona o'rnatgan parol bekor qilinadi.

---

## 7. Texnik arxitektura

| Qism | Texnologiya |
|---|---|
| Monorepo | pnpm workspace'lar |
| Sayt (web) | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, next-intl, Three.js |
| API | NestJS 11, REST `/v1`, OpenAPI hujjati `/docs` |
| Ma'lumotlar bazasi | PostgreSQL (108 ta model), Prisma 7 |
| Fon ishlari | Worker: hodisalar navbati, webhook'lar, obunalar muddati, galochkalar, valyuta kurslari |
| Paketlar | `config`, `money`, `database`, `validators`, `automation`, `design-tokens`, `sdk` |
| Testlar | Vitest (unit, API integratsiya), Playwright (brauzer), i18n tekshiruvi |
| Infratuzilma | Docker, GitHub Actions CI, Render Blueprint, Vercel |

Hujjatlar: `docs/` papkasida — ARCHITECTURE, DATABASE, API, AUTHORIZATION, PAYMENTS, REWARDS,
DESIGN_SYSTEM, THREE_JS, TESTING, DEPLOYMENT, SECURITY.

---

## 8. Jonli muhit (production)

| Qism | Qayerda | Holat |
|---|---|---|
| Sayt | Vercel — `https://faith-platform-green.vercel.app` | Ishlaydi. Hozircha GitHub'ga ulanmagan, qo'lda deploy qilinadi |
| API | Render (Frankfurt, bepul) — `faith-api-mpch.onrender.com` | Ishlaydi. GitHub'ga push qilinganda avtomatik yangilanadi |
| Baza | Render bepul Postgres | **Taxminan 2026-yil 9-dekabrda muddati tugaydi** |
| Kod | GitHub — `faithydev/FAITH` (ochiq repo) | — |

Bepul Render serveri 15 daqiqa ishlatilmasa uxlaydi; birinchi so'rov ~50 soniya oladi.

---

## 9. Xavflar va zudlik bilan hal qilinadiganlar

| # | Xavf | Ta'siri | Yechim | Muddat |
|---|---|---|---|---|
| 1 | **Baza muddati tugaydi** (~9-dekabr) | Barcha ma'lumot yo'qoladi | Neon'ga (doimiy bepul) yoki pullik Render'ga o'tish | **9-dekabrdan oldin** |
| 2 | **Yuklangan fayllar qayta deploy'da o'chadi** | Logo, banner, mahsulot rasmlari va fayllari yo'qoladi | S3-mos saqlash: Cloudflare R2 (10 GB bepul) yoki AWS S3; `STORAGE_DRIVER=s3` | **Haqiqiy foydalanuvchilar fayl yuklashidan oldin** |
| 3 | Email yuborilmaydi | Parolni tiklash, tasdiqlash xatlari bormaydi | Resend, Postmark yoki SMTP; `EMAIL_DRIVER=smtp` | 0-bosqich |
| 4 | Neon paroli chatda ochiq qolgan | Bazaga ruxsatsiz kirish xavfi | Neon'da `neondb_owner` parolini almashtirish | Darhol |
| 5 | Sayt qo'lda deploy qilinadi | Yangilanishlar kechikadi | Vercel'ni GitHub'ga ulash | 0-bosqich |
| 6 | Namuna akkauntlar va ma'lumotlar jonli saytda | Haqiqiy foydalanuvchilarni chalg'itadi | Admin → Users → "Boshqa akkauntlarni olib tashlash" | Siz xohlagan payt |
| 7 | To'lovlar simulyator | Daromad yo'q | 1-bosqich | 1-bosqich |
| 8 | Huquqiy hujjatlar tekshirilmagan | Huquqiy xavf | Yurist bilan ishlash | Haqiqiy pul qabul qilishdan oldin |
| 9 | Monitoring va zaxira nusxa yo'q | Nosozlikni kech bilish, ma'lumot yo'qotish | Sentry, uptime monitor, kunlik backup va tiklash mashqi | 0-bosqich |

---

## 10. Whop bilan solishtirish

| Imkoniyat | Whop | FAITH bugun | Reja |
|---|---|---|---|
| Raqamli mahsulot sotish | ✓ | ✓ | — |
| Kurslar | ✓ | ✓ (bo'lim, dars, progress) | Video hosting, test, sertifikat, drip — 2-bosqich |
| Hamjamiyat / chat | ✓ | ✓ (kanal, post, izoh) | Real vaqtli chat — 2-bosqich |
| Sotuvchining oylik obunalari (a'zolik) | ✓ asosiy model | Qisman (MEMBERSHIP mahsulot turi bor) | **To'liq takroriy to'lov — 2-bosqich, 1-o'rin** |
| Telegram / Discord orqali kirish | ✓ | — | Telegram avtomatik kirish va chiqarish — 2-bosqich |
| To'lov havolalari | ✓ | ✓ | — |
| Affiliate dasturi | ✓ | ✓ | — |
| Kontent-mukofotlar | ✓ | ✓ (firibgarlikka qarshi tekshiruv bilan) | — |
| Reyting (leaderboard) | ✓ | ✓ | — |
| Bepul sinov, kutish ro'yxati | ✓ | — | 2-bosqich |
| Upsell / order bump | ✓ | — | 2-bosqich |
| Bo'lib to'lash | qisman | — | 2-bosqich |
| Ilovalar do'koni va API | ✓ | ✓ | — |
| **O'zbekiston to'lovlari (Payme, Click, Uzum)** | — | Adapter tayyor | 1-bosqich |
| **Mahalliy valyutada narx (58 ta)** | qisman | ✓ | Mahalliy to'lov — 3-bosqich |
| **8 til, arab tili RTL** | asosan ingliz | ✓ | Qo'shimcha Osiyo tillari — 3-bosqich |
| **Ish bozori (vakansiya, ariza)** | — | ✓ | — |
| **Frilans: bosqichli to'lov va nizolar** | — | ✓ | Escrow — 1-bosqichdan keyin |
| **FAITH Verified galochkasi (rol bo'yicha)** | — | ✓ | KYC bilan kuchaytirish — 4-bosqich |
| **Platforma egasiga real vaqt xabar va Excel** | qisman | ✓ | — |
| **Muhim AI harakatlari faqat tasdiq bilan** | — | ✓ | — |

---

## 11. Bosqichlar

### 0-bosqich — Barqarorlik (eng zarur, 1–2 hafta)
Maqsad: jonli sayt hech narsani yo'qotmasin va o'zini o'zi kuzatsin.

- [ ] Bazani Neon'ga ko'chirish (9-dekabrdan oldin) va Neon parolini almashtirish.
- [ ] Fayllar uchun doimiy saqlash: Cloudflare R2 yoki S3 (`STORAGE_DRIVER=s3`).
- [ ] Haqiqiy email yuborish (Resend yoki SMTP), xat shablonlarini 8 tilda tekshirish.
- [ ] Vercel'ni GitHub'ga ulash: har push'da avtomatik deploy, PR uchun preview.
- [ ] GitHub'da CI majburiy tekshiruvlar bilan.
- [ ] Monitoring (Sentry), uptime ogohlantirish, kunlik backup va tiklash mashqi.
- [ ] Namuna akkauntlarni olib tashlash (Admin → Users).
- [ ] Render'ni bepul tarifdan chiqarish yoki "uyquga ketmaslik" yechimi (haqiqiy foydalanuvchilar
      kelganda).

**Tayyor mezoni:** server qayta ishga tushganda hech qanday fayl yoki yozuv yo'qolmaydi; parolni
tiklash xati haqiqatan keladi; nosozlik haqida 5 daqiqada xabar keladi; backup'dan tiklash bir
marta sinab ko'rilgan.

### 1-bosqich — Haqiqiy pul (O'zbekiston)
Maqsad: birinchi haqiqiy so'm va dollar platformaga tushadi va sotuvchiga o'tadi.

- [ ] Yuridik shaxs va bank hisobi; litsenziyalangan to'lov hamkorlari bilan shartnoma
      (Payme, Click, Uzum Bank — qaysi biri, sizning qaroringiz).
- [ ] Har bir hamkor uchun adapterni haqiqiy test muhitida tekshirish (imzolar, webhook'lar,
      qaytarish).
- [ ] Xalqaro karta to'lovlari uchun hamkor (Visa/Mastercard, USD).
- [ ] Hamkor hisobotlari bilan kunlik solishtirish (reconciliation).
- [ ] Sotuvchilarga pul o'tkazish hamkor API'si orqali; minimal summa va jadval.
- [ ] Chek va hisob-faktura (fiskal talablar bo'yicha yurist bilan).
- [ ] Ommaviy oferta, foydalanish shartlari, maxfiylik siyosati, qaytarish siyosati — yurist
      tekshiruvidan keyin o'zbek va rus tillarida.
- [ ] Soliq masalalari bo'yicha mutaxassis maslahati.

**Tayyor mezoni:** haqiqiy karta bilan to'langan buyurtma jurnalda to'g'ri aks etadi, sotuvchi
pulini oladi, qaytarish ishlaydi, kunlik solishtirish farqsiz.

### 2-bosqich — Whop'dan ustun: kurslar va xizmatlar
Maqsad: kurs va xizmat sotuvchisi uchun eng yaxshi joy bo'lish.

Tartib bo'yicha:
1. [ ] **Sotuvchining oylik/yillik obunalari** — kurs, hamjamiyat yoki xizmat uchun takroriy
       to'lov, avtomatik uzaytirish, bekor qilish, kirishni avtomatik ochish/yopish.
2. [ ] **Telegram integratsiyasi** — to'lagan odam yopiq kanal/guruhga qo'shiladi, obuna tugasa
       chiqariladi (Telegram bot tokeni kerak).
3. [ ] **Kurslarni chuqurlashtirish** — video hosting va himoyalangan pleyer, testlar, uy
       vazifalari, sertifikatlar, darslarni bosqichma-bosqich ochish (drip), kurs reytingi.
4. [ ] **Bepul sinov muddati va kutish ro'yxati.**
5. [ ] **Upsell va order bump** — to'lov sahifasida qo'shimcha taklif.
6. [ ] **Bo'lib to'lash** (3, 6, 12 oy) — hamkor qo'llasa.
7. [ ] **Band qilish** — 1:1 maslahat, konsultatsiya, tadbirlar, taqvim integratsiyasi.
8. [ ] **Real vaqtli hamjamiyat chati.**
9. [ ] **Frilans escrow** — pul bosqich tasdiqlanguncha platformada ushlab turiladi
       (1-bosqichdagi hamkor va yurist bilan).

**Tayyor mezoni:** ijodkor kursini oylik obuna sifatida sotadi, xaridor to'laydi va Telegram
kanaliga avtomatik qo'shiladi, keyingi oy avtomatik yechiladi, bekor qilsa kanaldan chiqariladi.

### 3-bosqich — Osiyo bo'ylab kengayish
Maqsad: qo'shni va keyingi bozorlarda xaridor o'z usulida, o'z pulida to'laydi.

- [ ] Qozog'iston (Kaspi), Qirg'iziston, Tojikiston, Turkiya, BAA, Indoneziya va boshqalar uchun
      mahalliy to'lov hamkorlari — mamlakat tartibida, talabga qarab.
- [ ] Mahalliy valyutada **haqiqiy** to'lov olish (hozir faqat ko'rsatiladi).
- [ ] Mamlakat bo'yicha narx (sotuvchi xohlasa, har bir mamlakatga alohida narx).
- [ ] QQS/soliq qoidalari har bir mamlakat uchun.
- [ ] Qo'shimcha tillar: hindi, indonez, koreys, yapon, fors, urdu, tojik — talabga qarab.
- [ ] 8 ta mavjud lug'atni ona tili sohiblari tekshiruvi.
- [ ] Mintaqaviy qo'llab-quvvatlash va vaqt zonalari.

**Tayyor mezoni:** Qozog'istondagi xaridor tengeda o'z mahalliy usuli bilan to'laydi va
sotuvchi so'm yoki dollarda oladi.

### 4-bosqich — Ishonch va sifat ("jiddiy mahsulotlar")
Maqsad: FAITH'dagi har bir mahsulot va sotuvchiga ishonish mumkin bo'lsin.

- [ ] Sotuvchi KYC (shaxs yoki kompaniyani tasdiqlash) — FAITH Verified galochkasini
      kuchaytiradi.
- [ ] Mahsulot sifat standartlari va chop etishdan oldingi tekshiruv mezonlari.
- [ ] Shikoyat va nizolarni hal qilish jarayoni, muddatlari.
- [ ] Firibgarlikka qarshi qoidalar (to'lov, kontent-mukofot, sharhlar).
- [ ] Kurslar va xizmatlar uchun qaytarish kafolati siyosati.

**Tayyor mezoni:** galochkali sotuvchi shaxsi tasdiqlangan; har bir yangi mahsulot standart
bo'yicha tekshiriladi; shikoyatga belgilangan muddatda javob beriladi.

### 5-bosqich — O'sish
- [ ] SEO: kurs va xizmat sahifalari uchun tuzilgan ma'lumotlar, sayt xaritasi, tezlik
      (Lighthouse byudjetlari).
- [ ] Mobil ilova: avval PWA, keyin iOS va Android.
- [ ] Tavsiyalar va qidiruvni yaxshilash.
- [ ] Ijodkor va sotuvchilar uchun tahlil va AI vositalari (haqiqiy AI kaliti bilan).
- [ ] Referal dasturi (foydalanuvchi foydalanuvchini olib keladi).
- [ ] Email va push xabarnomalar, marketing kampaniyalari.

### 6-bosqich — Ekotizim
- [ ] Ilovalar do'koni komissiyasini belgilash (12-bo'lim) va dasturchilarga to'lov.
- [ ] Ommaviy API hujjati, SDK'larni npm'ga chiqarish, dasturchilar uchun sandbox.
- [ ] Ijtimoiy tarmoqlardan metrikalarni rasmiy ulanish orqali olish (qo'lda kiritish o'rniga).
- [ ] Jismoniy mahsulotlar (`marketplace.physicalProducts` flag'i ortida) — agar biznes xohlasa.
- [ ] Jonli efir va video transkodlash (`creator.liveStreaming` flag'i ortida).

---

## 12. Siz qabul qilishingiz kerak bo'lgan biznes qarorlar

| Qaror | Nima uchun kerak | Holat |
|---|---|---|
| Qaysi to'lov hamkorlari (Payme, Click, Uzum, xalqaro) | 1-bosqich shunga bog'liq | Ochiq |
| Yuridik shaxs, bank, soliq rejimi | Haqiqiy pul qabul qilish uchun | Ochiq |
| Ilovalar do'koni komissiyasi | Dasturchilarga to'lov | **Belgilanmagan** (kod sizni kutadi) |
| Pro yillik narxi | Yillik tugma chiqishi uchun | Belgilanmagan |
| Sotuvchiga pul o'tkazish jadvali va minimal summa | 1-bosqich | Ochiq |
| Qaytarish siyosati (kurs, xizmat, mahsulot) | Ishonch va huquqiy talab | Ochiq |
| Mahsulot sifat standartlari ("jiddiy" nima) | 4-bosqich | Ochiq |
| Birinchi kengayadigan Osiyo mamlakatlari | 3-bosqich tartibi | Ochiq |
| Apple Developer a'zoligi ($99/yil) | Apple orqali kirish | Ochiq |

---

## 13. O'lchovlar (KPI)

| Yo'nalish | O'lchov |
|---|---|
| O'sish | Haftalik yangi ro'yxatdan o'tishlar, faol foydalanuvchilar (haftalik/oylik) |
| Daromad | Umumiy savdo hajmi (GMV), platforma daromadi (komissiya + Pro), Pro obunachilar soni |
| Sotuvchilar | Faol sotuvchilar, birinchi sotuvgacha vaqt, sotuvchi boshiga o'rtacha daromad |
| Kurslar | Yozilishlar, kursni tugatish ulushi, takroriy xarid |
| Xizmatlar | Yopilgan loyihalar, nizolar ulushi |
| Ishonch | Qaytarish ulushi, shikoyatlar, firibgarlik signallari |
| Texnik | Ishlash vaqti (uptime), sahifa tezligi, xatolar soni |

Hammasini Admin → Excel eksport va admin bosh sahifasidagi grafiklar orqali kuzatish mumkin.

---

## 14. Ish tartibi: kim nima qiladi

**Siz (Founder):**
- 12-bo'limdagi qarorlar.
- Hamkorlar bilan shartnomalar, yurist, bank.
- Tashqi xizmatlarda akkaunt ochish va maxfiy kalitlarni Render'ga kiritish (Google, Apple,
  Telegram bot, to'lov hamkorlari, R2/S3, email).
- Akkauntlarni olib tashlash kabi qaytarilmas harakatlarni tasdiqlash.

**Ishlab chiqish (Claude Code bilan):**
- Kod, testlar, tarjimalar, hujjatlar.
- GitHub'ga push (API avtomatik yangilanadi), Vercel'ga deploy.
- Jonli saytni tekshirish.

**Har bir yangi imkoniyat uchun qoida:**
1. Testlar yoziladi va o'tadi.
2. 8 tilga tarjima qilinadi.
3. Lokal saytda ko'rib tekshiriladi.
4. Jonli saytga chiqariladi va u yerda ham tekshiriladi.
5. Simulyatsiya yoki tugallanmagan narsa haqiqiy deb ko'rsatilmaydi.

---

## 15. Ilova: sahifalar va modullar ro'yxati

**Ommaviy sahifalar:** bosh sahifa, kurslar, xizmatlar, marketplace, mahsulot, do'kon, to'lov
havolasi, reyting, vakansiyalar, kontent-mukofotlar, ijodkorlar, hamjamiyatlar, ilovalar,
dasturchilar, narxlar, explore, savatcha, haqida, yordam, shartlar, maxfiylik.

**Kirish:** login, ro'yxatdan o'tish, parolni tiklash, email tasdiqlash, onboarding.

**Shaxsiy kabinet (`/app`):** bosh sahifa, buyurtmalar, kutubxona, istaklar, xabarlar,
bildirishnomalar, avtomatlashtirish, AI, tarif va to'lovlar, sozlamalar; sotuvchi (do'kon,
mahsulotlar, buyurtmalar, mijozlar, tahlil, daromad, o'sish); ijodkor (kampaniyalar, topshiriqlar,
kontent, kurslar, hamjamiyat, daromad); frilans (xizmatlar, loyihalar); ish (arizalar, portfolio);
brend (kampaniyalar, ijodkorlar, byudjet, tahlil, yollash); dasturchi (ilovalar, kalitlar,
webhook'lar, tahlil).

**Admin (`/admin`):** bosh sahifa, foydalanuvchilar (galochkalar, eksport, akkauntlarni olib
tashlash), marketplace, kontent-mukofotlar, ilovalar, moderatsiya, moliya, qo'llab-quvvatlash,
sozlamalar, tajribalar (lab), audit.

**API modullari:** auth, identity, commerce, payments, billing, finance (ledger, payouts, kurslar),
rewards, work, creator, developer, messaging, automation, ai, platform, admin.

**Raqamlarda:** 108 ta ma'lumotlar modeli, 239 ta API marshruti, 100 dan ortiq sahifa, 8 til,
58 ta ko'rsatish valyutasi.
