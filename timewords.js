/* timewords.js — время словами (DE / RU).
   Общий файл для index.html (часы) и voicegen.html (озвучка):
   фраза для mp3 и фраза на экране берутся из одного места.

   timeInWords(h24, m) → { de, ru }
   officialDe(h, m)    → «zweiundzwanzig Uhr dreiundzwanzig»
   voiceKey(h, m)      → «02-25» для ровных 5 минут, иначе null (имя mp3)
*/
// ─── ВРЕМЯ СЛОВАМИ (DE / RU) ──────────────────────────────────────────────
// Фразы для шагов 0..11 (каждые 5 минут)
var phrasesDe = [
    '',               // 0  — «X Uhr»
    'fünf nach',      // 5
    'zehn nach',      // 10
    'Viertel nach',   // 15
    'zwanzig nach',   // 20
    'fünf vor halb',  // 25  → следующий час
    'halb',           // 30  → следующий час
    'fünf nach halb', // 35  → следующий час
    'zwanzig vor',    // 40  → следующий час
    'Viertel vor',    // 45
    'zehn vor',       // 50
    'fünf vor',       // 55
];

var ONES_DE = ['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun',
               'zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
var TENS_DE = ['','','zwanzig','dreißig','vierzig','fünfzig'];

function numDe(n) {
    if (n < 20) return ONES_DE[n];
    var t = Math.floor(n / 10), o = n % 10;
    if (!o) return TENS_DE[t];
    return (o === 1 ? 'ein' : ONES_DE[o]) + 'und' + TENS_DE[t];
}

// Час по-немецки (0 → zwölf). Перед «Uhr» — «ein», а не «eins»
function hourDe(h12, beforeUhr) {
    if (h12 === 0) return 'zwölf';
    if (h12 === 1) return beforeUhr ? 'ein' : 'eins';
    return ONES_DE[h12];
}

// Официальное время: «zweiundzwanzig Uhr dreiundzwanzig»
function officialDe(h, m) {
    return (h === 1 ? 'ein' : numDe(h)) + ' Uhr' + (m ? ' ' + numDe(m) : '');
}

// Русский: «пять минут ПЕРВОГО» — порядковое, родительный, СЛЕДУЮЩИЙ час
var hoursRuGen = ['двенадцатого','первого','второго','третьего','четвёртого','пятого',
                  'шестого','седьмого','восьмого','девятого','десятого','одиннадцатого'];
// Именительный — для «ровно …» и «без пяти ДВА / без четверти ЧАС»
var hoursRuNom = ['двенадцать','час','два','три','четыре','пять',
                  'шесть','семь','восемь','девять','десять','одиннадцать'];

var phrasesRu = [
    '',
    'пять минут',
    'десять минут',
    'четверть',
    'двадцать минут',
    'двадцать пять минут',
    'половина',
    'тридцать пять минут',
    'без двадцати',
    'без четверти',
    'без десяти',
    'без пяти',
];

function hourFormRu(h12) {
    if (h12 === 1) return '';                 // «ровно час»
    if (h12 >= 2 && h12 <= 4) return 'часа';
    return 'часов';                           // 5–12
}

function capFirst(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

// Возвращает { de, ru } — разговорный вариант с округлением до 5 минут
function timeInWords(h24, m) {
    var step   = Math.round(m / 5);           // 0..12
    var approx = (m % 5 !== 0);
    var early  = approx && (step * 5 > m);    // округлили вверх → «gleich»
    var base   = h24 % 12;
    if (step === 12) { step = 0; base = (base + 1) % 12; }  // 58–59 → следующий час
    var next = (base + 1) % 12;

    var de, ru;
    if (step === 0) {
        de = approx ? hourDe(base, false) : hourDe(base, true) + ' Uhr';
        var hf = hourFormRu(base);
        ru = (approx ? '' : 'ровно ') + hoursRuNom[base] + (hf ? ' ' + hf : '');
    } else if (step <= 4) {                   // 5–20: nach + ТЕКУЩИЙ час
        de = phrasesDe[step] + ' ' + hourDe(base, false);
        ru = phrasesRu[step] + ' ' + hoursRuGen[next];
    } else if (step <= 7) {                   // 25–35: …halb + СЛЕДУЮЩИЙ час
        de = phrasesDe[step] + ' ' + hourDe(next, false);
        ru = phrasesRu[step] + ' ' + hoursRuGen[next];
    } else {                                  // 40–55: vor / без + СЛЕДУЮЩИЙ час
        de = phrasesDe[step] + ' ' + hourDe(next, false);
        ru = phrasesRu[step] + ' ' + hoursRuNom[next];
    }

    if (approx) {
        de = 'Es ist ' + (early ? 'gleich ' : 'kurz nach ') + de;
        ru = '≈ ' + ru;
    } else {
        de = 'Es ist ' + de;
        ru = capFirst(ru);
    }
    return { de: de, ru: ru };
}

// Имя файла озвучки: час по кругу 0–11 (0 = zwölf) и минуты кратные 5
function voiceKey(h24, m) {
    if (m % 5 !== 0) return null;
    return String(h24 % 12).padStart(2, '0') + '-' + String(m).padStart(2, '0');
}
