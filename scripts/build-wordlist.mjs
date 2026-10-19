// Builds src/data/wordlist4to9.txt, the local fallback words, out of a
// spell-check dictionary, a word frequency list and a profanity list. Only
// words that are spelled right, commonly known and fit for all ages are kept.
//
// Run with: node scripts/build-wordlist.mjs <scowl.txt> <en_50k.txt> <bad-words.txt>
//
// Download the inputs from
// - SCOWL size 50, US spelling, no variants (spell-check dictionary words):
//   http://app.aspell.net/create?max_size=50&spelling=US&max_variant=0&diacritic=strip&special=hacker&download=wordlist&encoding=utf-8&format=inline
// - FrequencyWords (OpenSubtitles 2018, most frequent first):
//   https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt
// - List of Dirty, Naughty, Obscene and Otherwise Bad Words:
//   https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en

import { readFileSync, writeFileSync } from "node:fs";

const MIN_LENGTH = 4;
const MAX_LENGTH = 9;
// Words past this frequency rank are mostly ones players won't know
const MAX_RANK = 30000;

// Words that pass the profanity list but don't belong in a family game,
// including slurs that are left out of it. Common endings are added below
const SENSITIVE = `
  abortion abortions abuse abused abuser abusers abusing abusive addict addicted
  addicts alcoholic anorexia anorexic arson arsonist arsonists assault assaulted
  bigot bigoted bigotry bigots bloodbath brothel cancer cancers carcass casualty
  cocaine corpse corpses crackhead dead death deaths decapitate disease
  drunk drunken drunks ejaculate fetish genocide gonorrhea
  gunshot heroin holocaust homicide hooker hookers incest infidel
  junkie kidnap kidnapped killed killer killers killing killings lynch lynching
  massacre masturbate meth molest molested molester morgue murder murdered
  murderer murderers murders nakedness narcotic narcotics nazi nazis nudity
  opium overdose pedophile perverse pervert perverts pimp pimps prostitute
  prostitutes racism racist racists rape raped rapes rapist rapists satanic
  semen seduce seduced sexual sexually sexy slaughter slave slavery slaves
  sodomy stripper strippers suicidal suicide suicides syphilis terror terrorism
  terrorist terrorists torture tortured tumor victim victims virgin virginity
  booze boozing breasts cleavage condom crap damn damned erection hell jihad
  lingerie naked orgies piss pissed pussies sperm stoned strangle
  chink cripple crippled dyke gook gypsy midget queer retard retarded
`.split(/\s+/).filter(Boolean);

// Roots that are offensive wherever they appear in a word
const OFFENSIVE_ROOTS = ["fuck", "shit", "cunt", "nigg", "fagg", "whore", "slut", "bitch", "porn"];

const [scowlPath, frequencyPath, badWordsPath] = process.argv.slice(2);
if (!scowlPath || !frequencyPath || !badWordsPath) {
  throw new Error("Pass the paths to the SCOWL list, the frequency list and the bad words list");
}

// SCOWL starts with a license header ending in a "---" line. Lowercase-only
// words leave out names, places and abbreviations
const dictionary = new Set(
  readFileSync(scowlPath, "utf8")
    .split("\n---\n")[1]
    .split("\n")
    .filter((w) => /^[a-z]+$/.test(w))
);

const rank = new Map();
readFileSync(frequencyPath, "utf8")
  .split("\n")
  .forEach((line, i) => {
    const word = line.split(" ")[0];
    if (word && !rank.has(word)) rank.set(word, i);
  });

const blocked = new Set();
const badWords = readFileSync(badWordsPath, "utf8").split("\n");
for (const line of [...badWords, ...SENSITIVE]) {
  const word = line.trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) continue;
  for (const ending of ["", "s", "es", "ed", "ing", "er", "ers"]) blocked.add(word + ending);
}

const words = [...dictionary]
  .filter((w) => w.length >= MIN_LENGTH && w.length <= MAX_LENGTH)
  .filter((w) => rank.has(w) && rank.get(w) < MAX_RANK)
  .filter((w) => !blocked.has(w) && !OFFENSIVE_ROOTS.some((root) => w.includes(root)))
  .sort();

writeFileSync(
  new URL(`../src/data/wordlist${MIN_LENGTH}to${MAX_LENGTH}.txt`, import.meta.url),
  `${words.join("\n")}\n`
);
console.log(`Wrote ${words.length} words`);
