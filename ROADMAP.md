# FAITH — to'liq yo'l xaritasi (ROADMAP)

> Holat: **2026-yil 17-noyabr**. Bu hujjat FAITH platformasi haqida hamma narsani bir joyga yig'adi:
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

Hammasi bitta monorepo'da, avtomatik testlar bilan. Oxirgi o'lchov: **API testlari 82/82**
(jumladan zaxira → yangi bazaga to'liq tiklash), **unit testlar 29/29**, lint va TypeScript
toza, `pnpm audit`: **ma'lum zaiflik yo'q**, 8 til bo'yicha 1516 ta tarjima kaliti.

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
- **Video darslar (yangi):** ijodkor har bir darsga MP4 yuklaydi; pullik o'quvchi uni
  himoyalangan pleyerda ko'radi (3.14-bo'lim).
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

### 3.12. Tezlik (yangi, 16-noyabr)
Muammo: sayt telefonda ham, kompyuterda ham 3–4 daqiqada ochilardi. Sabablari va yechimlar:

| Sabab | Yechim |
|---|---|
| Bepul Render serveri 15 daqiqa so'rov bo'lmasa uxlaydi; birinchi mehmon uyg'onishini kutadi | API o'zini har 10 daqiqada "ping" qiladi (`KEEP_AWAKE`), qo'shimcha ravishda GitHub Actions (`keep-warm.yml`) har 10 daqiqada API va bosh sahifani uyg'otadi. Bitta doimiy server bepul oylik 750 soatga sig'adi |
| Vercel funksiyalari AQShda (Vashington), API va baza Frankfurtda — har so'rov okeanni ikki marta kesib o'tardi | Vercel funksiyalari Frankfurtga ko'chirildi (`regions: ["fra1"]`) |
| Sahifa API javobini cheksiz kutardi; API uxlasa, butun sayt osilib qolardi | Ixtiyoriy bo'limlar 4 soniyada voz kechadi va ma'lumotsiz chiziladi; zarur sahifalar 25 soniyadan keyin "qayta urinish" tugmasini ko'rsatadi; valyuta aniqlash API'siz ham ishlaydi |
| Mahsulot rasmlari har safar API'dan o'tardi | Rasmlar Vercel chekkasida (CDN) bir kun saqlanadi |

Pullik Render tarifiga o'tilganda `KEEP_AWAKE=false` qilinadi.

### 3.13. To'lov usullari va kartalar (yangi)
- **To'lov belgilari:** Click, Payme, UZCARD, HUMO, Visa, Mastercard, UnionPay, Mir — footer'da,
  narxlar sahifasida, savatchada va billing sahifasida.
- **Jonli karta:** Pro xaridida karta orqa fonda turadi; raqam terilishi bilan karta turi va rangi
  o'zgaradi (8600 — UZCARD, 9860 — HUMO, 4 — Visa, 51–55/2221–2720 — Mastercard, 62 — UnionPay,
  2200–2204 — Mir). Raqam, muddat va ism kartada jonli ko'rinadi.
- **Karta faqat bog'lanadi, pul yechilmaydi.** Serverga faqat karta turi, oxirgi 4 raqam, amal
  muddati va ism boradi. To'liq raqam va CVV FAITH'ga hech qachon yetib bormaydi (PCI talabi).
- "Kartalarim": 5 tagacha karta, asosiy karta tanlash, olib tashlash.
- Pro: rol → muddat (oylik/yillik) → karta. Simulyatorda karta bog'langach Pro darhol yoqiladi.

### 3.14. Himoyalangan video darslar (yangi)
Brauzerda ekran yozib olishni **100% to'xtatib bo'lmaydi** — buni faqat apparat DRM (Widevine L1,
FairPlay) qila oladi, u 2-bosqichda. Hozir FAITH brauzer qila oladigan hamma narsani qiladi:
- Video faqat kirish huquqi bor, tizimga kirgan odamga, 4 MB bo'laklarda, keshlanmasdan beriladi;
  video manzilini nusxalab yangi oynada ochsa, rad etiladi.
- Ekranda tomoshabinning **emaili va ID'si** suzib yuradi va butun kadr bo'ylab xira yoziladi:
  yozib olingan video kimdan chiqqanini ko'rsatadi.
- Boshqa oyna yoki dasturga o'tilsa, tab yashirilsa yoki skrinshot tugmasi (PrintScreen,
  Win+Shift+S, Cmd+Shift+3/4/5) bosilsa — video to'xtaydi va qora ekran bilan yopiladi.
- Yuklab olish tugmasi, rasm-ichida-rasm, televizorga uzatish va o'ng tugma menyusi o'chirilgan.
- To'liq ekranda ham suv belgisi qoladi; video qayerda to'xtagan bo'lsa, o'sha joydan davom etadi.
- Begona yuklangan faylni darsga ulab bo'lmaydi (faqat ijodkorning o'z MP4 fayli).

### 3.15. Backend mustahkamligi (yangi, 17-noyabr)
Backend qayta tekshirildi; topilgan kamchiliklar va yechimlar:

| Kamchilik | Xavfi | Yechim |
|---|---|---|
| Yuklanayotgan fayl (100 MB gacha) butunlay server xotirasida turardi; serverda jami 512 MB | 3–4 ta katta yuklash serverni yiqitardi | Fayl avval vaqtinchalik faylga yoziladi va R2'ga oqim bilan uzatiladi; bir vaqtda 3 ta yuklash; chegaralar: rasm 10 MB, video 300 MB, boshqa fayl 100 MB; vaqtinchalik fayl har doim o'chiriladi |
| Eskirgan sessiya va havolalarni tozalash faqat alohida worker'da edi, jonli serverda (Render) umuman ishlamasdi | Baza (bepul 1 GB) cheksiz o'sardi | Tozalash API ichidagi worker'ga ulandi (har 6 soatda): eski sessiya/havolalar 7 kunda, yetkazilgan webhook va yozib olingan xatlar 30 kunda, hodisalar 1 yilda. Pul, buyurtma, to'lov va audit jurnaliga tegilmaydi |
| `nodemailer` va `multer` paketlarining zaif versiyalari (5 ta yuqori xavfli topilma) | Ma'lum hujumlar | `nodemailer` 10.3.1, `multer` 2.5.0; `pnpm audit` toza |
| Bazaga ulanish kutishi va so'rov vaqti cheksiz edi | Baza javob bermasa, butun API osilib qolardi | Ulanishni kutish 10 s, so'rov 60 s, havza 10 ta ulanish (`DATABASE_POOL_MAX`) |
| `?q=a&q=b` yoki noto'g'ri `status` kabi so'rovlar 500 xato berardi | Xato jurnali ifloslanadi, sahifa yiqiladi | Matnli parametrlar qisqartiriladi, noto'g'ri filtr — tushunarli 400 |
| Ochiq "click" hisoblagichlari va cheklovsiz yozish so'rovlari | Soxta kliklar, spam | Click: 30/daqiqa; boshqa barcha o'zgartiruvchi so'rovlar: IP bo'yicha 300/daqiqa (mobil operatorlarda ko'p odam bitta IP'da) |
| Google/Apple bilan kirishda tashqi so'rovlar cheksiz kutardi | Kirish sahifasi osilib qolardi | 10 soniyalik chegara |
| Kutilmagan xato butun serverni jimgina to'xtatishi mumkin edi | Sababsiz uzilishlar | Har bir xato jurnalga yoziladi; o'chishda fon taymerlari to'xtatiladi; oqim yarmida xato bo'lsa server qulamaydi |
| Email faqat bazaga yozilardi va sozlash noqulay edi | Parolni tiklash xati kelmaydi | Render'da `SMTP_URL` qo'yilsa xatlar haqiqatan yuboriladi va yangi akkauntlar emailini tasdiqlaydi (0-bosqich) |
| Bazaning zaxira nusxasi yo'q edi | Ma'lumot butunlay yo'qolishi mumkin | **API o'zi** har kecha butun bazaning shifrlangan nusxasini R2'ga yozadi (GitHub'ga bog'liq emas), 14 kun saqlaydi; Admin → Sozlamalar → Zaxira nusxalar: ro'yxat, "Hozir zaxira qilish", yuklab olish. Bo'sh bazaga tiklash skripti bor (`scripts/restore-backup.mjs`), sinovda 11 281 qator 3 soniyada aynan tiklandi. Qo'shimcha: GitHub `Database backup` workflow. Yo'riqnoma: `docs/BACKUP.md` |

### 3.16. Treyderlar va kurs egalari uchun (yangi, 23-noyabr)
VIP kanal va pullik darslarni Telegram'siz, FAITH ichida yuritish uchun:
- **Chek orqali to'g'ridan-to'g'ri to'lov.** Sotuvchi Do'kon sozlamalarida o'z kartasini yoki
  MChJ/YaTT hisob raqamini (STIR, bank, MFO) kiritadi. Xaridor pulni shu rekvizitlarga o'tkazadi,
  chek rasmini yoki PDF'ini yuboradi; sotuvchi Buyurtmalar sahifasida chekni ko'rib "Pul tushdi"
  deydi — kurs yoki VIP hamjamiyat **avtomatik** ochiladi, hech kimni qo'lda qo'shish shart emas.
  Rad etilsa sabab yoziladi va xaridor yangi chek yuboradi. To'lov tizimi bilan shartnoma kerak
  emas; pul FAITH orqali o'tmaydi. Bu sotuvlardan FAITH komissiyasi do'konning qarzi sifatida
  yoziladi (balans manfiy bo'ladi, to'lab bo'lmaydi); komissiya foizi admin sozlamasida.
- **Bitta hisob — bitta qurilma.** Yangi qurilmadan kirilsa, oldingisi darhol chiqib ketadi va
  sababini ko'radi; o'ynayotgan video 20 soniya ichida to'xtaydi. Xodimlar (admin va boshqalar)
  bundan ozod; admin `security.singleDevice` sozlamasi bilan o'chira oladi.
- **Skrinshotga ogohlantirish va vaqtincha blok.** Himoyalangan video ochiq turganda skrinshot
  tugmasi bosilsa — ogohlantirish (1/3, 2/3). Bir hafta ichida 3-marta — hisob 24 soatga bloklanadi
  va hamma qurilmada chiqib ketadi. Admin Foydalanuvchilar sahifasida blokni oldinroq olib tashlay oladi.
  Ijodkor o'z videosida ogohlantirish olmaydi.
- **Yuklab olish dasturlariga (IDM va h.k.) yopiq.** Video faqat brauzerning o'z pleyeriga beriladi
  (`Sec-Fetch-Dest: video`); havolani nusxalash, IDM yoki skript bilan so'rasa — rad etiladi.
- **Pullik yoki bepul?** Video yuklanganda tizim so'raydi: pullik (to'liq himoya, faqat xaridorlar)
  yoki bepul (hamma ko'radi, himoyasiz). Keyin ham bir tugma bilan almashtiriladi.
- **VIP hamjamiyat postlarida video.** Egasi va moderatorlar postga MP4 biriktiradi; uni faqat a'zolar,
  himoyalangan pleyerda ko'radi.

Halol chegaralar: brauzer ekran yozuvchisini (OBS, telefon kamerasi) **ko'ra olmaydi** — skrinshot
tugmasini ko'radi. Yozuvda qora ekran faqat **FAITH kompyuter ilovasida** (Windows ekrandan yozishni
taqiqlaydi) yoki DRM bilan bo'ladi. Jonli efir hali yo'q: unga oqim xizmati kerak (2-bosqich).

**DRM (VdoCipher, 23-noyabr).** Render'da `VDOCIPHER_API_SECRET` qo'yilsa, pullik dars va VIP post
videolari brauzerdan to'g'ridan-to'g'ri VdoCipher'ga yuklanadi (FAITH serveri va 300 MB chegarasi
orqali emas) va Widevine (Chrome, Edge, Firefox, Android) hamda FairPlay (Safari, iPhone) bilan
shifrlanadi. Kalit brauzerning himoyalangan modulida qoladi: DevTools, IDM yoki saqlangan trafikdan
ko'riladigan video chiqmaydi. Har ko'rish uchun FAITH 5 daqiqalik bir martalik OTP beradi (kirish
huquqi tekshiriladi), pleyer ustida tomoshabinning `@username`i suzadi (email uchinchi tomonga
berilmaydi). DRM videoda oddiy oqim umuman yo'q. Kalit bo'lmasa — hozirgi himoyalangan oqim ishlaydi.
Cheklovlar: kompyuterda Chrome'da (Widevine L3) ekran yozuvi qora bo'lishi kafolatlanmaydi; Safari,
iPhone va ko'p Android'larda (FairPlay/L1) qora chiqadi. FAITH kompyuter ilovasi oddiy Electron —
unda Widevine yo'q, DRM video ochilmaydi; buning uchun ilovani castlabs ECS Electron'ga o'tkazish
kerak. FairPlay uchun VdoCipher Apple sertifikatini o'zi boshqaradi. Narx: VdoCipher yillik paket
(~$149/yil dan), 30 kunlik bepul sinov bor.

---

## 4. Nima haqiqiy, nima hali simulyatsiya

Bu bo'lim muhim: platforma **hali haqiqiy pul qabul qilmaydi**.

| Qism | Holat | Izoh |
|---|---|---|
| To'lovlar | **Simulyator** | "SIMULYATSIYA: haqiqiy pul harakatlanmaydi" deb ochiq yozilgan. Payme, Click, Stripe adapterlari bor, lekin ulanmagan |
| Chek orqali to'lov | **Haqiqiy** | Pul xaridordan to'g'ridan-to'g'ri sotuvchining kartasi yoki MChJ/YaTT hisobiga o'tadi; sotuvchi chekni tasdiqlaydi. FAITH pulni ushlamaydi |
| Sotuvchilarga pul o'tkazish | **Simulyatsiya** | So'rov va tasdiqlash oqimi bor, real o'tkazma yo'q |
| Email | **Tayyor, kalit kutadi** | Render'da `SMTP_URL` qo'yilmaguncha xatlar faqat bazaga yoziladi |
| Zaxira nusxa (backup) | **Ishlaydi** | API har kecha o'zi oladi (R2, 14 kun). Kalit — Render'dagi `APP_ENCRYPTION_KEY`: uni parol menejeringizda saqlang |
| Fayllar | **Doimiy (Cloudflare R2)** | 2026-yil 13-noyabrdan `faith-files` papkasida saqlanadi |
| Google kirish | **Haqiqiy** | Jonli ishlaydi |
| Apple kirish | O'chiq | Apple Developer a'zoligi kerak |
| Valyuta kurslari | **Haqiqiy** | Markaziy bank, cbu.uz |
| AI | Demo | Anthropic kaliti qo'yilsa haqiqiy bo'ladi |
| Bog'langan kartalar | **Faqat saqlanadi** | Karta turi va oxirgi 4 raqam saqlanadi; hech narsa yechilmaydi. Haqiqiy bog'lash (token) Payme/Click bilan 1-bosqichda |
| Video himoyasi | **Brauzer darajasida** | Suv belgisi, pauza, bo'lakli oqim, bitta qurilma, skrinshotga ogohlantirish va blok, IDM'ga yopiq. Yozuvda qora ekran: kompyuter ilovasida bor; brauzerda — DRM bilan, 2-bosqich |
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
2. Oylik yoki yillik muddatni tanlaydi, keyin kartani bog'laydi (jonli karta, 3.13-bo'lim) yoki
   saqlangan kartasini tanlaydi. Simulyatorda kartadan pul yechilmaydi.
3. Tanlangan rol darhol ochiladi.
4. Galochka **24 soatda avtomatik** tasdiqlanadi yoki admin uni darhol tasdiqlaydi/rad etadi.
5. Pro tugasa, galochka olib tashlanadi; qayta faollashsa, qaytadi.

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
| Ma'lumotlar bazasi | PostgreSQL (109 ta model), Prisma 7 |
| Fon ishlari | Worker: hodisalar navbati, webhook'lar, obunalar muddati, galochkalar, valyuta kurslari, eski yozuvlarni tozalash |
| Paketlar | `config`, `money`, `database`, `validators`, `automation`, `design-tokens`, `sdk` |
| Testlar | Vitest (unit, API integratsiya), Playwright (brauzer), i18n tekshiruvi |
| Infratuzilma | Docker, GitHub Actions CI, Render Blueprint, Vercel |

Hujjatlar: `docs/` papkasida — ARCHITECTURE, DATABASE, API, AUTHORIZATION, PAYMENTS, REWARDS,
DESIGN_SYSTEM, THREE_JS, TESTING, DEPLOYMENT, SECURITY, **BACKUP** (zaxira va tiklash).

---

## 8. Jonli muhit (production)

| Qism | Qayerda | Holat |
|---|---|---|
| Sayt | Vercel — `https://faith-platform-green.vercel.app`, funksiyalar Frankfurtda (`fra1`) | Ishlaydi. GitHub'ga ulangan: har push'da o'zi yangilanadi |
| API | Render (Frankfurt, bepul) — `faith-api-mpch.onrender.com` | Ishlaydi. GitHub'ga push qilinganda avtomatik yangilanadi |
| Baza | Render bepul Postgres | **Taxminan 2026-yil 9-dekabrda muddati tugaydi** |
| Fayllar | Cloudflare R2 — `faith-files` (yopiq papka, 10 GB bepul) | Ishlaydi |
| Kod | GitHub — `faithydev/FAITH` (ochiq repo) | — |

Bepul Render serveri 15 daqiqa ishlatilmasa uxlaydi. 16-noyabrdan u uxlamaydi: API o'zini har
10 daqiqada uyg'otadi, GitHub Actions'dagi `Keep warm` ham shuni qiladi (3.12-bo'lim).

---

## 9. Xavflar va zudlik bilan hal qilinadiganlar

| # | Xavf | Ta'siri | Yechim | Muddat |
|---|---|---|---|---|
| 1 | **Baza muddati tugaydi** (~9-dekabr) | Barcha ma'lumot yo'qoladi | Har kecha zaxira olinyapti. Endi: Neon'da (doimiy bepul) yoki pullik Render'da yangi baza → "Hozir zaxira qilish" → tiklash → `DATABASE_URL`ni almashtirish (`docs/BACKUP.md`) | **9-dekabrdan oldin** |
| 2 | ~~Yuklangan fayllar qayta deploy'da o'chadi~~ | — | **Hal qilindi:** Cloudflare R2 ulandi (13-noyabr) | ✓ |
| 3 | Email yuborilmaydi | Parolni tiklash, tasdiqlash xatlari bormaydi | Kod tayyor: Resend (bepul 3000 xat/oy) akkaunti → Render'da `SMTP_URL` va `EMAIL_FROM`, eski `EMAIL_DRIVER=dev`ni o'chirish | 0-bosqich |
| 4 | Neon paroli chatda ochiq qolgan | Bazaga ruxsatsiz kirish xavfi | Neon'da `neondb_owner` parolini almashtirish | Darhol |
| 5 | ~~Sayt qo'lda deploy qilinadi~~ | — | **Hal qilindi:** Vercel GitHub'ga ulangan | ✓ |
| 6 | Namuna akkauntlar va ma'lumotlar jonli saytda | Haqiqiy foydalanuvchilarni chalg'itadi | Admin → Users → "Boshqa akkauntlarni olib tashlash" | Siz xohlagan payt |
| 7 | To'lovlar simulyator | Daromad yo'q | 1-bosqich | 1-bosqich |
| 8 | Huquqiy hujjatlar tekshirilmagan | Huquqiy xavf | Yurist bilan ishlash | Haqiqiy pul qabul qilishdan oldin |
| 9 | Monitoring yo'q | Nosozlikni kech bilish | Zaxira hal qilindi (API'ning o'zi). Qoldi: Sentry, uptime monitor (masalan UptimeRobot), oylik tiklash mashqi | 0-bosqich |
| 15 | **GitHub hisobi to'lov muammosi tufayli bloklangan** ("account is locked due to a billing issue") | CI testlari, `Keep warm` va GitHub zaxirasi umuman ishlamaydi (8-noyabrdan beri) | GitHub → Settings → Billing and plans: to'lov usuli yoki to'lanmagan hisobni to'g'rilash (faqat siz) | **Darhol** |
| 10 | ~~Sayt 3–4 daqiqada ochiladi~~ | — | **Hal qilindi:** uyg'oq server, Frankfurtdagi funksiyalar, kutish chegaralari (3.12) | ✓ |
| 11 | Ekran yozib olishni brauzer to'liq to'xtata olmaydi | Pullik kurs videosi tarqalishi mumkin | Hozir: suv belgisi + pauza. Keyin: DRM (Widevine/FairPlay) video hamkori bilan | 2-bosqich |
| 12 | Video Render orqali o'tadi (bepul tarifda oyiga 100 GB trafik; yuklash endi xotiraga tushmaydi, 300 MB gacha) | Ko'p o'quvchida trafik tugaydi | Videoni to'g'ridan-to'g'ri R2'ga yuklash va video hamkori (HLS + CDN) | 2-bosqich |
| 13 | API'ga Vercel'ni chetlab, to'g'ridan-to'g'ri `onrender.com` orqali murojaat qilinsa, IP manzilni soxtalashtirib IP bo'yicha cheklovlarni chetlab o'tish mumkin | Ko'p akkauntga parol terish urinishlari (har akkaunt 8 xatodan keyin 15 daqiqa bloklanadi) | API oldiga Cloudflare qo'yish yoki faqat Vercel'dan kelgan so'rovlarni maxfiy sarlavha bilan qabul qilish | 4-bosqich |
| 14 | Render bepul serverida 1 nusxa; cheklovlar xotirada | Server qayta ishga tushsa hisoblagichlar nolga tushadi | Pullik tarif + Redis (`REDIS_URL` allaqachon qo'llab-quvvatlanadi) | Foydalanuvchilar ko'paygach |

---

## 10. Whop bilan solishtirish

| Imkoniyat | Whop | FAITH bugun | Reja |
|---|---|---|---|
| Raqamli mahsulot sotish | ✓ | ✓ | — |
| Kurslar | ✓ | ✓ (bo'lim, dars, progress, **video darslar**) | Test, sertifikat, drip — 2-bosqich |
| **Video himoyasi (suv belgisi, pauza, yuklab olishsiz)** | qisman | ✓ | DRM — 2-bosqich |
| **Jonli karta (UZCARD/HUMO/Visa... raqamdan aniqlanadi)** | — | ✓ | Payme/Click token — 1-bosqich |
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
| **O'zbekiston to'lovlari (Payme, Click, Uzum)** | — | Adapter tayyor, belgilar saytda | 1-bosqich |
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
- [x] Fayllar uchun doimiy saqlash: Cloudflare R2 (`faith-files`).
- [~] Haqiqiy email yuborish: kod tayyor (17-noyabr). **Sizdan:** Resend akkaunti → Render'da
      `SMTP_URL` (`smtps://resend:API_KALIT@smtp.resend.com:465`), `EMAIL_FROM`; eski
      `EMAIL_DRIVER=dev`ni o'chirish. Keyin xat shablonlarini 8 tilda tekshirish.
- [x] Vercel'ni GitHub'ga ulash: har push'da avtomatik deploy.
- [ ] GitHub'da CI majburiy tekshiruvlar bilan.
- [x] Kunlik shifrlangan zaxira R2'ga — API'ning o'zi oladi, admin panelda ko'rinadi (17-noyabr).
      **Sizdan:** Render'dagi `APP_ENCRYPTION_KEY`ni parol menejeringizga nusxalash.
- [ ] GitHub hisobidagi to'lov blokini olib tashlash (CI, `Keep warm`, ikkinchi zaxira ishlashi uchun).
- [ ] Oylik tiklash mashqi (Neon branch'ga tiklab ko'rish).
- [ ] Monitoring (Sentry) va uptime ogohlantirish (UptimeRobot, bepul).
- [x] Backend mustahkamlash: yuklash xotirasi, tozalash ishi, zaif paketlar, baza ulanish
      chegaralari, so'rov cheklovlari, tashqi so'rov timeout'lari (17-noyabr, 3.15-bo'lim).
- [ ] Namuna akkauntlarni olib tashlash (Admin → Users).
- [x] Render "uyquga ketmaslik" yechimi: API o'zini uyg'otadi + GitHub `Keep warm` (16-noyabr).
- [x] Vercel funksiyalarini API yoniga (Frankfurt) ko'chirish; sahifalar uxlagan API'ni kutmaydi.
- [ ] Haqiqiy foydalanuvchilar ko'paygach Render'ni pullik tarifga o'tkazish (`KEEP_AWAKE=false`).

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
- [ ] **Kartani haqiqiy bog'lash:** Payme (`cards.create` → SMS kod → token) va Click kartani
      tokenlash. Karta raqami to'g'ridan-to'g'ri hamkorga boradi, FAITH faqat tokenni saqlaydi
      (shifrlangan). Hozirgi "Kartalarim" shu tokenni oladi.
- [ ] Saqlangan karta tokenidan Pro'ni har oy avtomatik uzaytirish; yechilmasa 3 kunlik imkon
      va xabarnoma.
- [ ] Bir bosishda xarid (one-click): saqlangan karta bilan kurs va mahsulot sotib olish.
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
3. [~] **Kurslarni chuqurlashtirish.** Bajarildi: video darslar, himoyalangan pleyer (suv
       belgisi, pauza, bo'lakli oqim, joydan davom etish). Qoldi:
       - [ ] **DRM** (Widevine L1 / FairPlay / PlayReady) video hamkori orqali (masalan VdoCipher,
             Bunny Stream yoki PallyCon): ko'p qurilmalarda ekran yozuvida video qora chiqadi.
       - [ ] HLS transkodlash (360p–1080p, internetga qarab sifat), CDN orqali tarqatish.
       - [ ] Katta fayllarni (100 MB+) to'g'ridan-to'g'ri R2'ga yuklash.
       - [ ] Bir akkaunt — bir vaqtda bitta qurilmada tomosha (akkauntni ulashishga qarshi).
       - [ ] Server tomonida videoga "kuydirilgan" shaxsiy suv belgisi (forensic watermark).
       - [ ] Testlar, uy vazifalari, sertifikatlar, drip, kurs reytingi.
4. [ ] **Bepul sinov muddati va kutish ro'yxati.**
5. [ ] **Upsell va order bump** — to'lov sahifasida qo'shimcha taklif.
6. [ ] **Bo'lib to'lash** (3, 6, 12 oy) — hamkor qo'llasa.
7. [ ] **Band qilish** — 1:1 maslahat, konsultatsiya, tadbirlar, taqvim integratsiyasi.
8. [ ] **Real vaqtli hamjamiyat chati.**
9. [ ] **Frilans escrow** — pul bosqich tasdiqlanguncha platformada ushlab turiladi
       (1-bosqichdagi hamkor va yurist bilan).

**Whop'dan oson va kuchliroq bo'lish uchun qo'shimcha g'oyalar (tartib bo'yicha):**
1. [ ] **AI kurs quruvchi** — ijodkor mavzuni yozadi, AI bo'lim/dars rejasi, tavsif va narx
       taklifini tayyorlaydi; ijodkor tasdiqlaydi.
2. [ ] **5 daqiqada do'kon** — bitta sahifali "sehrgar": nom → mahsulot → narx → to'lov havolasi.
3. [ ] **Telegram Mini App** — xaridor Telegram ichidan sotib oladi va darsni ko'radi.
4. [ ] **Mahalliy to'lovlarda bir bosishda xarid** (saqlangan UZCARD/HUMO bilan).
5. [ ] **Avtomatik sertifikat** — kurs tugaganda QR kodli, tekshirsa bo'ladigan sertifikat.
6. [ ] **Sotuvchi uchun "sotuv voronkasi"** — sahifa → upsell → obuna, bitta oynada tahlil bilan.
7. [ ] **O'zbek va rus tilida AI yordamchi** — o'quvchining dars bo'yicha savoliga javob beradi.

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
| Video hamkori va DRM (VdoCipher, Bunny Stream, PallyCon — oylik to'lov) | Yozuvda qora ekran, HLS | Ochiq |
| Render pullik tarifi (~$7/oy) | Uyg'otishsiz doimiy tezlik, ko'proq xotira | Ochiq |
| Email provayderi (Resend tavsiya: bepul 3000 xat/oy) | Parolni tiklash, email tasdiqlash | Ochiq |
| Yangi baza: Neon (bepul) yoki Render pullik Postgres (~$7/oy) | 9-dekabrdan keyin ma'lumot saqlanishi | **Shoshilinch** |

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
