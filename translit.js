// A name typed in English letters ("Vijay") written in a card's script ("വിജയ്"), as on iOS (Translit.swift): the
// way people type names on WhatsApp, not ISO 15919. The rules are data, translit.json (content/src/translit.json,
// whose "_format" note is the rule book this follows): greedy longest match left to right, consonants joined by the
// virama, a vowel after a consonant as its sign. A suggestion only: the field stays editable.

// Whether the text still has English letters to write.
export const hasLatin = text => /[A-Za-z]/.test(text || '');
// The script's first letter ("അ"), the button's label.
export const scriptLetter = (rules, L) => rules?.scripts?.[L]?.vowels?.a || 'अ';

// Each run of English letters written in the script; everything else passes through.
export function translit(rules, text, L) {
  const s = rules?.scripts?.[L];
  return s ? text.replace(/[A-Za-z]+/g, w => word(w, s)) : text;
}

function word(typed, s) {
  // Title case is ignored, an all-capitals word read as lower case; capitals inside a word mark retroflex letters.
  const w = typed === typed.toUpperCase() ? typed.toLowerCase() : typed[0].toLowerCase() + typed.slice(1);
  if (s.words?.[w.toLowerCase()]) return s.words[w.toLowerCase()];
  const syl = s.syllables || {}, has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const longest = Math.max(...[syl, s.consonants, s.vowels].flatMap(o => Object.keys(o).map(k => k.length)));
  const toks = [];
  for (let i = 0; i < w.length;) {
    let hit = null;
    for (let n = Math.min(longest, w.length - i); n > 0 && !hit; n--) {
      const piece = w.slice(i, i + n);
      for (const k of piece === piece.toLowerCase() ? [piece] : [piece, piece.toLowerCase()]) {
        const kind = has(syl, k) ? 'syl' : has(s.consonants, k) ? 'con' : has(s.vowels, k) ? 'vow' : null;
        if (kind) { hit = [kind, k, n]; break; }
      }
    }
    if (hit) { toks.push([hit[0], hit[1]]); i += hit[2]; } else toks.push(['raw', w[i++]]);
  }
  let out = '';
  for (let k = 0; k < toks.length; k++) {
    const [kind, key] = toks[k];
    if (kind === 'con') {
      const letter = (k === 0 && s.initial?.[key]) || (k > 0 && toks[k - 1][0] === 'con' && s.subjoined?.[key]) || s.consonants[key];
      const next = toks[k + 1];
      if (next?.[0] === 'vow') {
        out += letter + (next[1] === 'a' && k + 2 === toks.length ? s.endA ?? '' : s.signs[next[1]] ?? ''); k++;
      } else if (next?.[0] === 'con' && next[1] === 'y' && k + 2 === toks.length && has(s.signs, 'y')) {
        // Parvathy: a final y after a consonant is a vowel.
        out += letter + s.signs.y; k++;
      } else if (next) out += next[0] === 'con' || next[0] === 'syl' ? s.medial?.[key] ?? letter + s.virama : letter + s.virama;
      else out += s.final?.[key] ?? letter + (s.finalA ?? '');
    } else if (kind === 'vow') out += s.vowels[key];
    else if (kind === 'syl') out += syl[key];
    else out += key;
  }
  return out;
}
