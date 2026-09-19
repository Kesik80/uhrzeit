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

// Немецкая фраза без «Es ist»: один и тот же текст в часах и в именах файлов озвучки
function deCore(base, step, approx) {
    var next = (base + 1) % 12;
    if (step === 0) return approx ? hourDe(base, false) : hourDe(base, true) + ' Uhr';
    if (step <= 4)  return phrasesDe[step] + ' ' + hourDe(base, false);   // 5–20: nach + текущий час
    return phrasesDe[step] + ' ' + hourDe(next, false);                    // 25–55: следующий час
}

// Возвращает { de, ru } — разговорный вариант с округлением до 5 минут
function timeInWords(h24, m) {
    var step   = Math.round(m / 5);           // 0..12
    var approx = (m % 5 !== 0);
    var early  = approx && (step * 5 > m);    // округлили вверх → «gleich»
    var base   = h24 % 12;
    if (step === 12) { step = 0; base = (base + 1) % 12; }  // 58–59 → следующий час
    var next = (base + 1) % 12;

    var de = deCore(base, step, approx), ru;
    if (step === 0) {
        var hf = hourFormRu(base);
        ru = (approx ? '' : 'ровно ') + hoursRuNom[base] + (hf ? ' ' + hf : '');
    } else if (step <= 7) {                   // 5–35: nach / halb
        ru = phrasesRu[step] + ' ' + hoursRuGen[next];
    } else {                                  // 40–55: без …
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

// ─── ИМЕНА ФАЙЛОВ ОЗВУЧКИ ────────────────────────────────────────────────────
// Наборы в папке голоса (voice/de/<голос>/):
//   ЧЧ-ММ.mp3    разговорная фраза, ровные 5 минут   «Es ist fünf nach zehn»
//   g-ЧЧ-ММ.mp3  то же с «Es ist gleich …»           неровные минуты, округление вверх
//   k-ЧЧ-ММ.mp3  то же с «Es ist kurz nach …»        неровные минуты, округление вниз
//   o-ЧЧ-ММ.mp3  offiziell целиком                   «dreizehn Uhr zwölf» (24 × 60)
// Склейку из кусков («dreizehn Uhr» + «zwölf») пробовали — интонация рвалась,
// поэтому offiziell пишется целой фразой.
function pad2t(n) { return String(n).padStart(2, '0'); }

// Ровные 5 минут: ключ файла для часа 0–11 и минуты, кратной 5
function voiceKey(h24, m) {
    if (m % 5 !== 0) return null;
    return pad2t(h24 % 12) + '-' + pad2t(m);
}

// Ключ разговорной фразы для ЛЮБОЙ минуты (с префиксом g- / k-, если минута неровная)
function phraseKey(h24, m) {
    var step = Math.round(m / 5);
    var approx = (m % 5 !== 0);
    var early = approx && (step * 5 > m);
    var base = h24 % 12;
    if (step === 12) { step = 0; base = (base + 1) % 12; }
    var key = pad2t(base) + '-' + pad2t(step * 5);
    return approx ? (early ? 'g-' : 'k-') + key : key;
}

// Offiziell: один файл на каждую минуту суток
function officialKey(h, m) {
    return 'o-' + pad2t(h) + '-' + pad2t(m);
}

// Текст, который нужно озвучить для этого файла
function textForKey(key) {
    var mm = /^([gk])-(\d{2})-(\d{2})$/.exec(key);
    if (mm) {
        return 'Es ist ' + (mm[1] === 'g' ? 'gleich ' : 'kurz nach ') + deCore(+mm[2], +mm[3] / 5, true);
    }
    mm = /^o-(\d{2})-(\d{2})$/.exec(key);
    if (mm) return officialDe(+mm[1], +mm[2]);
    mm = /^(\d{2})-(\d{2})$/.exec(key);
    if (mm) return timeInWords(+mm[1], +mm[2]).de;
    return '';
}
