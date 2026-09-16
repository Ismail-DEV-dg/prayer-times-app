// Full-surah reciter registry for the LISTEN mode ("Слушать").
//
// ONE SURAH = ONE CONTINUOUS AUDIO TRACK. The user picks a RECITER, never
// an API. Each entry carries:
//   - id        — stable id "mq:{slug}" (mp3quran) for storage
//   - name      — user-facing Russian display name
//   - nameEn    — English name (also searchable)
//   - aliases   — RU transliterations + EN spellings, so the same reciter
//                 is found regardless of the input language
//                 ("Мишари" / "Mishari" / "Mishary" / "Alafasy"…)
//   - server    — mp3quran.net moshaf server (PRIMARY, full-surah mp3s)
//   - qa        — quranicaudio.com relative path (VERIFIED full-surah
//                 FALLBACK for the same human), or null = PRIMARY only
//
// SOURCES (both verified with REAL HTTP checks, 2026-09-14):
//   PRIMARY  mp3quran.net — 60 famous reciters, each with a COMPLETE
//            114-surah moshaf; URL = {server}/NNN.mp3 (001..114),
//            audio/mpeg, HTTP Range 206 (seek works), no API key.
//            Every one of the 60 servers was probed on surahs
//            001/002/018/036/055/114 — 360/360 HTTP 200.
//   FALLBACK download.quranicaudio.com — same-human complete recitations
//            for 31 of the 60; URL = https://download.quranicaudio.com/
//            quran/{qaPath}NNN.mp3. Verified 001/002/018/036/055/114.
//            The other 29 reciters have NO honest full-surah fallback —
//            they are PRIMARY only (qa: null), and a load error is
//            surfaced honestly instead of playing a single ayah.
//
// The reading mode (useAyahAudio + everyayah + services/quranApi.js) is
// NOT touched by this registry. The old everyayah/alfurqan ayah-level
// registry (quranAudioRegistry.js) is no longer used by the Listen player
// because neither source provides full-surah tracks (probed 2026-09-14:
// everyayah.com 002.mp3 -> 404; alfurqan.online surah-level -> 404).
//
// The reciter list = 60 MOST FAMOUS reciters (product decision): every
// entry has ALL 114 surahs (surah_list cross-checked against the
// mp3quran API dump — 0 missing entries).

// --- search normalization ----------------------------------------------
// lowercase, trim, collapse spaces, strip Latin diacritics (NFD then
// remove combining marks). Cyrillic passes through unchanged.
export function normalizeSearchText(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// --- registry data (verified 2026-09-14, see header) ---------------------
const RECITERS_DATA = [
  { id: "mq:afasy", name: "Мишари Рашид аль-Афаси", nameEn: "Mishary Al-Afasy", aliases: ["мишари", "мишари рашид аль-афаси", "мишари аль-афаси", "мишари аль афаси", "аль-афаси", "афаси", "афасы", "рашид", "mishari", "mishary", "mishary rashid", "alafasy", "afasy", "afasi", "al afasy", "al-afasy"], server: "https://server8.mp3quran.net/afs/", qa: "mishaari_raashid_al_3afaasee/" },
  { id: "mq:husary", name: "Махмуд Халиль аль-Хусари", nameEn: "Mahmoud Al-Husary", aliases: ["махмуд", "махмуд халиль", "халиль", "хусари", "хусайри", "аль-хусари", "mahmoud", "mahmood", "khalil", "khaleel", "husary", "husari", "husaari", "husaree", "al-husary", "al husary"], server: "https://server13.mp3quran.net/husr/", qa: "mahmood_khaleel_al-husaree/" },
  { id: "mq:minshawi", name: "Мухаммад Сиддик аль-Миншави", nameEn: "Muhammad Al-Minshawi", aliases: ["миншави", "миншауи", "сиддик", "мухаммад сиддик", "аль-миншави", "мухаммед", "minshawi", "minshawy", "minshaawee", "minshaawi", "siddiq", "siddeeq", "muhammad siddiq"], server: "https://server10.mp3quran.net/minsh/", qa: "muhammad_siddeeq_al-minshaawee/" },
  { id: "mq:abdulbasit", name: "Абдул Басит Абдуссамад", nameEn: "Abdulbasit Abdulsamad", aliases: ["абдул басит", "абдуль басит", "абдулбасит", "басит", "басет", "абдуссамад", "абд ас-самад", "abdul basit", "abdulbasit", "abdul-basit", "abdul baset", "abdulsamad"], server: "https://server7.mp3quran.net/basit/", qa: "abdul_basit_murattal/" },
  { id: "mq:ghamdi", name: "Саад аль-Гамди", nameEn: "Saad Al-Ghamdi", aliases: ["саад", "гамди", "гамиди", "саад аль-гамди", "аль-гамди", "saad", "ghamdi", "ghaamidi", "al-ghamdi", "al ghamdi"], server: "https://server7.mp3quran.net/s_gmd/", qa: "sa3d_al-ghaamidi/complete/" },
  { id: "mq:sudais", name: "Абдуррахман ас-Судайс", nameEn: "Abdurrahman As-Sudais", aliases: ["судайс", "ас-судайс", "абдуррахман судайс", "абдурахман", "абдуррахман", "судейс", "sudais", "sudays", "as-sudais", "abdulrahman", "abdurrahman", "abdurrahmaan"], server: "https://server11.mp3quran.net/sds/", qa: "abdurrahmaan_as-sudays/" },
  { id: "mq:shuraim", name: "Сауд аш-Шурайм", nameEn: "Saud Ash-Shuraim", aliases: ["шурейм", "шурайм", "шураим", "сауд", "аш-шурейм", "shuraim", "shuraym", "saood", "saoud", "saud", "ash-shuraim", "ash-shuraym"], server: "https://server7.mp3quran.net/shur/", qa: "sa3ood_al-shuraym/" },
  { id: "mq:yasserdosari", name: "Ясир ад-Дусри", nameEn: "Yasser Ad-Dosari", aliases: ["ясир", "яссер", "дусри", "дуссари", "ад-дусри", "ясир ад-дусри", "аль-досари", "yasser", "yaser", "yassir", "dosari", "dussari", "dussary", "ad-dussary", "ad-dosari", "al-dosari"], server: "https://server11.mp3quran.net/yasser/", qa: "yasser_ad-dussary/" },
  { id: "mq:shatri", name: "Абу Бакр аш-Шатри", nameEn: "Abu Bakr Ash-Shatri", aliases: ["шатри", "аш-шатри", "абу бакр", "абубакр", "шаатри", "shatri", "shaatree", "ash-shatri", "ash-shaatree", "abu bakr", "abubakr", "shaatri"], server: "https://server11.mp3quran.net/shatri/", qa: "abu_bakr_ash-shaatree/" },
  { id: "mq:hanirifai", name: "Хани ар-Рифаи", nameEn: "Hani Ar-Rifai", aliases: ["хани", "рифаи", "ар-рифаи", "рифай", "hani", "rifai", "arrifai", "ar-rifai", "rifay", "hanirifai"], server: "https://server8.mp3quran.net/hani/", qa: null },
  { id: "mq:maher", name: "Махер аль-Муайкли", nameEn: "Maher Al-Muaiqly", aliases: ["махер", "муайкли", "муаикли", "аль-муайкли", "махер аль-муайкли", "maher", "muaiqly", "almuaiqly", "al-muaiqly", "al muaiqly", "mu3aiqly"], server: "https://server12.mp3quran.net/maher/", qa: "maher_256/" },
  { id: "mq:ajmi", name: "Ахмад аль-Аджами", nameEn: "Ahmad Al-Ajmi", aliases: ["аджами", "аль-аджами", "ахмад аль-аджами", "аль-аджми", "ajmi", "ajmy", "ajamy", "al-ajmi", "al ajmi", "al-ajamy", "ahmad al-ajmi"], server: "https://server10.mp3quran.net/ajm/", qa: "ahmed_ibn_3ali_al-3ajamy/" },
  { id: "mq:matroud", name: "Абдулла аль-Матруд", nameEn: "Abdullah Al-Matroud", aliases: ["матруд", "аль-матруд", "абдулла матруд", "матроуд", "matroud", "matrood", "matrud", "abdullah matroud", "al-matroud"], server: "https://server8.mp3quran.net/mtrod/", qa: "abdullah_matroud/" },
  { id: "mq:budair", name: "Салах аль-Будайр", nameEn: "Salah Al-Budair", aliases: ["будайр", "аль-будайр", "будер", "будайри", "салах", "budair", "budayr", "al-budair", "salah budair"], server: "https://server6.mp3quran.net/s_bud/", qa: "salahbudair/" },
  { id: "mq:juhany", name: "Абдулла аль-Джухани", nameEn: "Abdullah Al-Juhany", aliases: ["джухани", "аль-джухани", "джухайни", "juhany", "juhani", "juhaynee", "juhayni", "al-juhany", "al-johany", "johany"], server: "https://server13.mp3quran.net/jhn/", qa: "abdullaah_3awwaad_al-juhaynee/" },
  { id: "mq:qatami", name: "Насер аль-Катами", nameEn: "Nasser Al-Qatami", aliases: ["катами", "насер", "нассер", "насер аль-катами", "qatami", "qataami", "katami", "nasser", "naser", "nasir", "al-qatami"], server: "https://server6.mp3quran.net/qtm/", qa: "nasser_bin_ali_alqatami/" },
  { id: "mq:abbad", name: "Фарес Аббад", nameEn: "Fares Abbad", aliases: ["аббад", "фарес", "фарис", "фарис аббад", "abbad", "abbaad", "fares", "faaris", "fares abbad"], server: "https://server8.mp3quran.net/frs_a/", qa: "fares/" },
  { id: "mq:hudhaify", name: "Али аль-Хузайфи", nameEn: "Ali Al-Hudhaify", aliases: ["хузайфи", "худайфи", "хадифи", "hudhaify", "huthaify", "huthayfi", "hudaify", "al-hudhaify", "ali hudhaify"], server: "https://server9.mp3quran.net/hthfi/", qa: "huthayfi/" },
  { id: "mq:alijaber", name: "Али Джабер", nameEn: "Ali Jaber", aliases: ["джабер", "али джабер", "джабир", "али джабир", "jaber", "jabir", "ali jaber", "ali jabir", "ali al-jaber"], server: "https://server11.mp3quran.net/a_jbr/", qa: "ali_jaber/" },
  { id: "mq:bukhatir", name: "Салах Бухатир", nameEn: "Salah Bukhatir", aliases: ["бухатир", "бухайтер", "салах бухатир", "бу хатир", "bukhatir", "bukhaatir", "salah bukhatir", "bu khatir"], server: "https://server8.mp3quran.net/bu_khtr/", qa: "salaah_bukhaatir/" },
  { id: "mq:sahlyassin", name: "Сахль Ясин", nameEn: "Sahl Yassin", aliases: ["сахль", "ясин", "сахл", "сахль ясин", "sahl", "yassin", "yaseen", "yasen", "yaaseen", "sahl yassin", "sahl yaseen"], server: "https://server6.mp3quran.net/shl/", qa: "sahl_yaaseen/" },
  { id: "mq:tablawi", name: "Мухаммад ат-Таблави", nameEn: "Muhammad At-Tablawi", aliases: ["таблави", "ат-таблави", "аль-таблави", "таблауи", "tablawi", "tablaway", "tablawy", "at-tablawi", "al-tablawi", "mohammad tablawi"], server: "https://server12.mp3quran.net/tblawi/", qa: "mohammad_altablawi/" },
  { id: "mq:ayyub", name: "Мухаммад Аюб", nameEn: "Muhammad Ayyub", aliases: ["аюб", "айюб", "мухаммад аюб", "ayyub", "ayyoub", "ayoub", "ayub", "ayyuub", "muhammad ayyub"], server: "https://server8.mp3quran.net/ayyub/", qa: null },
  { id: "mq:jibreel", name: "Мухаммад Джибриль", nameEn: "Muhammad Jibreel", aliases: ["джибриль", "джибрил", "мухаммад джибриль", "jibreel", "jibril", "jibreen", "jibriil", "muhammad jibreel"], server: "https://server8.mp3quran.net/jbrl/", qa: "muhammad_jibreel/complete/" },
  { id: "mq:mustafaismail", name: "Мустафа Исмаил", nameEn: "Mustafa Ismail", aliases: ["мустафа", "исмаил", "мустафа исмаил", "mustafa", "ismail", "ismael", "mustafa ismail"], server: "https://server8.mp3quran.net/mustafa/", qa: null },
  { id: "mq:albanna", name: "Махмуд аль-Банна", nameEn: "Mahmoud Al-Banna", aliases: ["банна", "аль-банна", "махмуд аль-банна", "banna", "al-banna", "mahmoud al-banna", "mahmood al-banna"], server: "https://server8.mp3quran.net/bna/", qa: null },
  { id: "mq:qasim", name: "Абдулмухсин аль-Касим", nameEn: "Abdulmohsen Al-Qasim", aliases: ["касим", "абдулмухсин", "аль-касим", "qasim", "qasem", "kasim", "abdulmuhsin", "abdul muhsin", "abdulmohsen", "al-qasim", "abdulmuhsin al-qasim"], server: "https://server8.mp3quran.net/qasm/", qa: "abdul_muhsin_alqasim/" },
  { id: "mq:kalbany", name: "Адель аль-Калбани", nameEn: "Adel Al-Kalbany", aliases: ["калбани", "кальбани", "адель", "аль-калбани", "kalbany", "kalbani", "khalbany", "khalbani", "adel", "adil", "al-kalbany"], server: "https://server8.mp3quran.net/a_klb/", qa: null },
  { id: "mq:jalil", name: "Халид аль-Джалиль", nameEn: "Khalid Al-Jalil", aliases: ["джалиль", "аль-джалиль", "халид аль-джалиль", "халид", "джаллиль", "jalil", "jaleel", "jileel", "al-jalil", "khalid al-jalil", "khalid"], server: "https://server10.mp3quran.net/jleel/", qa: null },
  { id: "mq:lohaidan", name: "Мухаммад аль-Лухайдан", nameEn: "Muhammad Al-Lohaidan", aliases: ["лухайдан", "лухидан", "лохайдан", "аль-лухайдан", "lohaidan", "luhaidan", "luhaydan", "lahidan", "al-luhaidan", "muhammad al-luhaidan", "мухаммад аль-лухайдан"], server: "https://server8.mp3quran.net/lhdan/", qa: null },
  { id: "mq:khayyat", name: "Абдулла Хайят", nameEn: "Abdullah Khayyat", aliases: ["хайят", "хаят", "абдулла хайят", "khayyat", "khaiyaat", "khaiyat", "hayat", "abdullah khayyat", "abdullah al-khayyat"], server: "https://server12.mp3quran.net/kyat/", qa: null },
  { id: "mq:basfar", name: "Абдулла Басфар", nameEn: "Abdullah Basfar", aliases: ["басфар", "абдулла басфар", "basfar", "abdullah basfar", "abdullaah basfar"], server: "https://server6.mp3quran.net/bsfr/", qa: "abdullaah_basfar/" },
  { id: "mq:soufi", name: "Абдуррашид Суфи", nameEn: "Abdulrashid Soufi", aliases: ["суфи", "абдуррашид", "соуфи", "абдулрашид суфи", "soufi", "sufi", "soofi", "abdulrashid", "abdurrashid", "abdurrasheed"], server: "https://server16.mp3quran.net/soufi/Rewayat-Hafs-A-n-Assem/", qa: "abdurrashid_sufi_soosi_rec/" },
  { id: "mq:alzain", name: "Аз-Зейн Мухаммад Ахмад", nameEn: "Az-Zain Muhammad Ahmad", aliases: ["аз-зейн", "зейн", "аз-заин", "аль-заин", "аль-зейн", "alzain", "az-zain", "az zain", "azain", "az-zayn"], server: "https://server9.mp3quran.net/alzain/", qa: null },
  { id: "mq:alaqmi", name: "Акрам аль-Алякми", nameEn: "Akram Al-Alaqmi", aliases: ["алякми", "акрам", "акрам аль-алякми", "аляками", "alaqmi", "al-alaqmi", "akram", "akram al-alaqmi"], server: "https://server9.mp3quran.net/akrm/", qa: "akram_al_alaqmi/" },
  { id: "mq:sultany", name: "Мифтах ас-Султани", nameEn: "Muftah As-Saltany", aliases: ["султани", "мифтах", "ас-султани", "мифтах ас-султани", "sultany", "saltany", "sultani", "muftah", "as-sultany", "muftah al-saltany"], server: "https://server14.mp3quran.net/muftah_sultany/Rewayat-Hafs-A-n-Assem/", qa: null },
  { id: "mq:salamah", name: "Ясир Саляма", nameEn: "Yasser Salamah", aliases: ["саляма", "салама", "ясир саляма", "ясир салама", "salamah", "salama", "yasser salamah", "yaser salamah", "yassir salama"], server: "https://server12.mp3quran.net/salamah/Rewayat-Hafs-A-n-Assem/", qa: null },
  { id: "mq:asimluhaidan", name: "Асим аль-Лухайдан", nameEn: "Asim Al-Luhaidan", aliases: ["асим", "асим аль-лухайдан", "лухайдан асим", "asim", "asem", "asim luhaidan", "asim al-luhaidan", "асим аль лухайдан"], server: "https://server7.mp3quran.net/asim/Rewayat-Hafs-A-n-Assem/", qa: null },
  { id: "mq:ibrahimdosari", name: "Ибрагим ад-Дусари", nameEn: "Ibrahim Ad-Dosari", aliases: ["ибрагим ад-дусари", "ибрагим дусри", "ибрахим дусари", "ибрахим ад-дусари", "ibrahim", "ibrahim dosari", "ibrahim ad-dosari", "ibrahim al-dosari"], server: "https://server10.mp3quran.net/ibrahim_dosri/Rewayat-Hafs-A-n-Assem/", qa: null },
  { id: "mq:tunaiji", name: "Халифа ат-Тунайджи", nameEn: "Khalifa At-Tunaiji", aliases: ["тунайджи", "ат-тунайджи", "халифа", "халифа тунайджи", "тунайжи", "tunaiji", "tunaigy", "khalifa", "khalifa al-tunaiji", "altunaiji"], server: "https://server12.mp3quran.net/tnjy/", qa: null },
  { id: "mq:zaki", name: "Заки Дагестани", nameEn: "Zaki Daghestani", aliases: ["заки", "дагестани", "дагестанский", "заки дагестани", "zaki", "daghistani", "daghestani"], server: "https://server9.mp3quran.net/zaki/", qa: null },
  { id: "mq:raadkurdi", name: "Раад аль-Курди", nameEn: "Raad Al-Kurdi", aliases: ["раад", "курди", "раад аль-курди", "курдский", "раад курди", "raad", "kurdi", "kurdy", "kurdish", "raad kurdi", "raad al-kurdi", "курд"], server: "https://server6.mp3quran.net/kurdi/", qa: "raad_mohammad_al_kurdi/mp3/" },
  { id: "mq:balilah", name: "Бандер Балиля", nameEn: "Bandar Balilah", aliases: ["балиля", "бандер", "бандер балиля", "бандэр", "balilah", "baleelah", "balila", "bandar", "bander", "bandar balilah"], server: "https://server6.mp3quran.net/balilah/", qa: null },
  { id: "mq:muhasny", name: "Мухаммад аль-Мухасни", nameEn: "Muhammad Al-Muhasny", aliases: ["мухасни", "мухаммад аль-мухасни", "muhasny", "muhassani", "muhasni", "al-muhasny"], server: "https://server11.mp3quran.net/mhsny/", qa: null },
  { id: "mq:azizahmad", name: "Абдульазиз аль-Ахмад", nameEn: "Abdulaziz Al-Ahmad", aliases: ["азиз", "ахмад", "абдульазиз аль-ахмад", "аль-ахмад", "азиз ахмад", "aziz", "aziz ahmad", "abdulaziz", "abdul-aziz", "abdulaziz al-ahmad", "al-ahmad", "ahmad"], server: "https://server11.mp3quran.net/a_ahmed/", qa: null },
  { id: "mq:akdar", name: "Ибрагим аль-Ахдар", nameEn: "Ibrahim Al-Akdar", aliases: ["ахдар", "акдар", "акдар ибрагим", "ибрагим аль-ахдар", "аль-ахдар", "ахтар", "akdar", "akhdar", "ibrahim al-akhdar", "ibrahim al-akdar", "аль-ахтар"], server: "https://server6.mp3quran.net/akdr/", qa: "ibrahim_al_akhdar/" },
  { id: "mq:abusneina", name: "Мухаммад Абу Снайна (Калюн)", nameEn: "Muhammad Abu Sneina", aliases: ["снайна", "абу снайна", "снейна", "абу снейна", "sneina", "sneineh", "sneena", "abu sneina", "abu sneineh", "калюн", "калoн"], server: "https://server16.mp3quran.net/sneineh/Rewayat-Qalon-A-n-Nafi/", qa: null },
  { id: "mq:abdulhakam", name: "Махмуд Абдульхакам", nameEn: "Mahmoud Abdulhakam", aliases: ["хакам", "абдульхакам", "абдулхакам", "махмуд абдульхакам", "хаким", "hakam", "abdulhakam", "abdul-hakam", "abdul hakam", "mahmoud abdulhakam", "abd al-hakam"], server: "https://server16.mp3quran.net/m_abdelhakam/Rewayat-Hafs-A-n-Assem/", qa: null },
  { id: "mq:saber", name: "Сабер Абдульхакам", nameEn: "Saber Abdulhakam", aliases: ["сабер", "сабир", "абдульхакам сабер", "сабир абдульхакам", "saber", "sabir", "sabber", "сабир"], server: "https://server12.mp3quran.net/hkm/", qa: null },
  { id: "mq:kafi", name: "Халид Абдулькафи", nameEn: "Khalid Abdul-Kafi", aliases: ["кафи", "абдулькафи", "халид кафи", "халид абдулькафи", "kafi", "kaafi", "abdulkafi", "abdul kafi", "khalid kafi", "khalid abdulkafi"], server: "https://server11.mp3quran.net/kafi/", qa: null },
  { id: "mq:yahyahawwa", name: "Яхья Хавва", nameEn: "Yahya Hawwa", aliases: ["яхья", "хавва", "яхья хавва", "яхия хава", "yahya", "yahya hawwa", "yahya hawa", "hawwa", "хава"], server: "https://server12.mp3quran.net/yahya/", qa: null },
  { id: "mq:sayegh", name: "Тауфик ас-Сайегх", nameEn: "Tawfeeq As-Sayegh", aliases: ["сайегх", "ас-сайегх", "тауфик", "тауфик ас-сайегх", "sayegh", "sayeg", "as-sayegh", "taufiq", "tawfeeq", "tawfeeq as-sayegh"], server: "https://server6.mp3quran.net/twfeeq/", qa: null },
  { id: "mq:hajjaj", name: "Али Хаджадж ас-Сувайси", nameEn: "Ali Hajjaj As-Suwaysi", aliases: ["хаджадж", "хажаж", "хаджадж ас-сувайси", "суэси", "суайси", "hajjaj", "hajaj", "souasi", "suwaysi", "суваиси"], server: "https://server9.mp3quran.net/hajjaj/", qa: "ali_hajjaj_alsouasi/" },
  { id: "mq:jazairi", name: "Ясин аль-Джазаири (Варш)", nameEn: "Yassin Al-Jazairi", aliases: ["джазаири", "джазаири", "ясин джазаири", "аль-джазаири", "варш", "jazairi", "jazaeri", "al-jazairi", "yassin", "yassin al-jazairi", "warsh"], server: "https://server11.mp3quran.net/qari/", qa: null },
  { id: "mq:qahtani", name: "Халид аль-Кахтани", nameEn: "Khalid Al-Qahtani", aliases: ["кахтани", "халид аль-кахтани", "qahtani", "qahtaanee", "al-qahtani", "khalid al-qahtani", "al-qahtanee"], server: "https://server10.mp3quran.net/qht/", qa: "khaalid_al-qahtaanee/" },
  { id: "mq:abdulkareem", name: "Мухаммад Абдулькарим", nameEn: "Muhammad Abdul-Kareem", aliases: ["абдулкарим", "абдулькарим", "мухаммад абдулкарим", "abdulkareem", "abdulkarim", "abdul-kareem", "abdul karim", "muhammad abdulkareem"], server: "https://server12.mp3quran.net/m_krm/", qa: "muhammad_abdulkareem/" },
  { id: "mq:albadr", name: "Абдуррахман аль-Бадр", nameEn: "Abdulrahman Al-Badr", aliases: ["аль-бадр", "бадр", "абдуррахман аль-бадр", "абдурахман аль-бадр", "badr", "al-badr", "albadr", "abdulrahman", "abdurrahman"], server: "https://server16.mp3quran.net/A-AlBadr/Rewayat-Hafs-A-n-Assem/", qa: null },
  { id: "mq:obaikan", name: "Абдулмухсин аль-Убайкан", nameEn: "Abdulmohsen Al-Obaikan", aliases: ["убайкан", "обаикан", "абдулмухсин аль-убайкан", "обайкен", "obaikan", "ubaykan", "ubaykaan", "al-obaikan", "abdulmohsen", "abdulmohsin", "аль-убайкан"], server: "https://server12.mp3quran.net/obk/", qa: null },
  { id: "mq:qazabri", name: "Омар аль-Казабри (Варш)", nameEn: "Omar Al-Qazabri", aliases: ["казабри", "казбри", "омар казабри", "qazabri", "omar", "omar al-qazabri"], server: "https://server9.mp3quran.net/omar_warsh/", qa: null },
  { id: "mq:salimi", name: "Мансур ас-Салими", nameEn: "Mansour As-Salimi", aliases: ["салими", "ас-салими", "мансур ас-салими", "мансур", "salimi", "salemi", "mansour", "mansur", "mansour al-salimi", "mansor alsalemi"], server: "https://server14.mp3quran.net/mansor/", qa: null },
];

// Flat registry (display order = data order, famous first).
export const LISTEN_RECITERS = RECITERS_DATA.map((r) => ({
  id: r.id,
  name: r.name,
  nameEn: r.nameEn,
  aliases: r.aliases,
  _server: r.server,
  _qa: r.qa,
}));

export const DEFAULT_LISTEN_RECITER = "mq:afasy";

export function getListenReciter(id) {
  return LISTEN_RECITERS.find((r) => r.id === id) || null;
}

// --- URL builders --------------------------------------------------------
// Surah number -> zero-padded "001".."114" file name.
function padSurah(surahNumber) {
  const s = Number(surahNumber);
  if (!Number.isInteger(s) || s < 1 || s > 114) return null;
  return String(s).padStart(3, "0");
}

// PRIMARY full-surah URL (mp3quran): {server}/NNN.mp3.
export function getSurahAudioUrl(reciterId, surahNumber) {
  const reciter = getListenReciter(reciterId);
  const n = padSurah(surahNumber);
  if (!reciter || !n) return null;
  return `${reciter._server}${n}.mp3`;
}

// OPTIONAL same-human full-surah FALLBACK (quranicaudio), used ONLY when
// the PRIMARY URL fails — exactly one attempt. null = PRIMARY only.
export function getSurahAudioFallbackUrl(reciterId, surahNumber) {
  const reciter = getListenReciter(reciterId);
  const n = padSurah(surahNumber);
  if (!reciter || !reciter._qa || !n) return null;
  return `https://download.quranicaudio.com/quran/${reciter._qa}${n}.mp3`;
}

// --- search ---------------------------------------------------------------
// Matches the display name, English name and all aliases, with a
// normalized input (RU + EN spellings find the same reciter).
export function searchListenReciters(query) {
  const q = normalizeSearchText(query);
  if (!q) return LISTEN_RECITERS;
  return LISTEN_RECITERS.filter((r) => {
    const haystack = [r.name, r.nameEn, ...r.aliases].map(normalizeSearchText);
    return haystack.some((h) => h.includes(q));
  });
}
