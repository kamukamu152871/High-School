// ルール集約
// - 能力上限 110
// - 性格補正（得意 +0.25 / 苦手 -0.25 / ふつう 0 / てんさい 常に +0.25）
// - キャプテン指名（3年生から）による練習上昇ボーナス +0.25
// - キャプテンが ふつう / てんさい のとき：大会の「秒乱数」を自校だけ -5..0（短距離系 -2..0）に変更
//
// 注意：大会の乱数は calcTimeSecondsFromPower 内で付与されるため、
//       state._raceRandomMode を参照して乱数レンジを切り替える。

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}
export function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const TRAININGS = [
  { id: "nagashi", name: "流し", stat: "sprint" },
  { id: "tt", name: "TT", stat: "speed" },
  { id: "jog", name: "ジョグ", stat: "stamina" },
  { id: "interval", name: "インターバル", stat: "toughness" },
  { id: "circuit", name: "サーキット", stat: "technique" },
];

// --- 性格補正（練習上昇に足す）---
export function personalityBonus(personality, stat) {
  // ふつう：補正なし
  if (personality === "ふつう") return 0;

  // てんさい：常に +0.25
  if (personality === "てんさい") return 0.25;

  // その他：得意 +0.25 / 苦手 -0.25
  // （ユーザー指定の苦手能力）
  const map = {
    "たん���": { preferred: "sprint", weak: "toughness" },   // 苦手=タフネス
    "せっかち": { preferred: "speed", weak: "stamina" },    // 苦手=スタミナ
    "おおらか": { preferred: "stamina", weak: "sprint" },   // 苦手=スプリント
    "がんこ": { preferred: "toughness", weak: "technique" }, // 苦手=テクニック
    "きよう": { preferred: "technique", weak: "speed" },     // 苦手=スピード
  };

  const m = map[personality];
  if (!m) return 0;
  if (m.preferred === stat) return 0.25;
  if (m.weak === stat) return -0.25;
  return 0;
}

export function clamp1to110(n) {
  return Math.max(1, Math.min(110, n));
}

export function recalcOverall(a) {
  const ab = a.abilities;
  a.overall = Math.round((ab.sprint + ab.speed + ab.stamina + ab.toughness + ab.technique) / 5);
}

// 練習設備レベル -> 基礎上昇量
// Lv1: 0.5 or 1 (random)
// Lv2: 1 fixed
// Lv3: 1 or 1.5 (random)
// Lv4: 1.5 fixed
export function baseGainFromFacilityLevel(level) {
  if (level === 1) return Math.random() < 0.5 ? 0.5 : 1.0;
  if (level === 2) return 1.0;
  if (level === 3) return Math.random() < 0.5 ? 1.0 : 1.5;
  if (level === 4) return 1.5;
  return 1.0;
}

// ---- キャプテン関連 ----
export function getCaptain(state) {
  const id = state?.captainId ?? null;
  if (!id) return null;
  return (state.athletes ?? []).find(a => a.id === id) ?? null;
}

// 練習時のキャプテン補正（「上昇した能力に +0.25」）
export function captainTrainingBonus(state, athlete, stat) {
  const cap = getCaptain(state);
  if (!cap) return 0;

  const p = cap.personality;
  const m = Number(state?.month);

  // たんき：6,7,8月の練習でチーム全員 +0.25
  if (p === "たんき") return ([6, 7, 8].includes(m)) ? 0.25 : 0;

  // がんこ：12,1,2月の練習でチーム全員 +0.25
  if (p === "がんこ") return ([12, 1, 2].includes(m)) ? 0.25 : 0;

  // せっかち：練習時、3年生全員 +0.25
  if (p === "せっかち") return athlete.grade === 3 ? 0.25 : 0;

  // おおらか：練習時、2年生全員 +0.25
  if (p === "おおらか") return athlete.grade === 2 ? 0.25 : 0;

  // きよう：練習時、1年生全員 +0.25
  if (p === "きよう") return athlete.grade === 1 ? 0.25 : 0;

  // ふつう / てんさい：練習上昇には影響なし（大会乱数側）
  return 0;
}

// 練習適用：設備の基礎上昇 + 性格補正 + キャプテン補正
export function applyTraining(state, trainingId) {
  const t = TRAININGS.find(x => x.id === trainingId);
  if (!t) return;

  const level = state.facilities?.[trainingId] ?? 2;

  for (const a of state.athletes) {
    const base = baseGainFromFacilityLevel(level);
    const pBonus = personalityBonus(a.personality, t.stat);
    const cBonus = captainTrainingBonus(state, a, t.stat);

    a.abilities[t.stat] = clamp1to110(a.abilities[t.stat] + base + pBonus + cBonus);
    recalcOverall(a);
  }

  state.lastTraining = { id: t.id, name: t.name, stat: t.stat, facilityLevel: level };
}

// --- 種目 ---
export const EVENTS_RECORD = ["1500", "3000", "5000"];
export const EVENTS_MEET = ["800", "1500", "3000sc", "5000", "5000w"];
export const EVENTS_EKIDEN = ["10000", "3000", "8000", "5000"];

export function calcEventPower(athlete, event) {
  const ab = athlete.abilities;
  let v = 0;

  if (event === "1500") v = (ab.sprint + ab.speed * 3 + ab.stamina) / 5;
  if (event === "3000") v = (ab.sprint + ab.speed * 2 + ab.stamina * 2) / 5;
  if (event === "5000") v = (ab.speed * 2 + ab.stamina * 2 + ab.toughness) / 5;

  if (event === "800") v = (ab.sprint * 3 + ab.toughness * 2) / 5;
  if (event === "3000sc") v = (ab.speed + ab.stamina + ab.technique * 3) / 5;
  if (event === "5000w") v = (ab.toughness * 2 + ab.technique * 3) / 5;

  if (event === "8000") v = (ab.stamina * 3 + ab.toughness * 2) / 5;
  if (event === "10000") v = (ab.stamina * 2 + ab.toughness * 3) / 5;

  return v;
}

// ★重要：0.5が入った場合は切り捨て → n を floor して使う
function floorN(n) {
  return Math.floor(n);
}

// ---- 大会乱数（キャプテンふつう/てんさい） ----
// state._raceRandomMode は main が「大会を回す直前だけ」セットして、終わったら消す想定。
// - "normal": 通常（既存の ±5 / ±2 相当）
// - "captain_normal": ふつうキャプテン（自校のみ -5..0 / -2..0）
// - "captain_genius": てんさいキャプテン（駅伝だけ自校 -5..0 / -2..0）
export function withRaceRandomMode(state, mode, fn) {
  const prev = state._raceRandomMode ?? null;
  state._raceRandomMode = mode;
  try {
    return fn();
  } finally {
    if (prev == null) delete state._raceRandomMode;
    else state._raceRandomMode = prev;
  }
}

// 種目ごとの「秒乱数レンジ」を返す（整数秒）
function raceRandomSecondsRange(state, event) {
  const mode = state?._raceRandomMode ?? "normal";

  // 「一部種目は±2」とあるので、ここでは 800 を短距離扱いで ±2 にする
  const isShort = (event === "800");

  if (mode === "captain_normal" || mode === "captain_genius") {
    // 自校のみの適用は main 側で「自校を計算するタイミングでだけ mode を入れる」ことで担保する
    return isShort ? { min: -2, max: 0 } : { min: -5, max: 0 };
  }

  // 通常
  return isShort ? { min: -2, max: 2 } : { min: -5, max: 5 };
}

export function calcTimeSecondsFromPower(event, nRaw, stateForRandom = null) {
  const n = floorN(nRaw);

  // 乱数（800は元々小数で揺らしていたが、仕様に合わせ「秒乱数」を統一で扱う）
  // ※既存の見た目を大きく崩さないため、800だけは従来の小数揺れも残しつつ、秒乱数も足す。
  const rr = raceRandomSecondsRange(stateForRandom, event);
  const secRand = randInt(rr.min, rr.max);

  if (event === "800") {
    let t = 150 - 0.424 * (n - 1);
    t = Math.round(t * 100) / 100;
    // 従来：±1.5秒相当の小数揺れ
    t += Math.round(randFloat(-1.5, 1.5) * 100) / 100;
    // 追加：仕様の±2秒 or -2..0
    t += secRand;
    return t;
  }

  if (event === "1500") {
    let t = 310 - 0.859 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += secRand;
    return t;
  }

  if (event === "3000sc") {
    let t = 750 - 2.273 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += secRand;
    return t;
  }

  if (event === "3000") {
    let t = 690 - 2.020 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += secRand;
    return t;
  }

  if (event === "5000") {
    let t = 1110 - 2.929 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += secRand;
    return t;
  }

  if (event === "5000w") {
    let t = 2100 - 9.394 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += secRand;
    return t;
  }

  if (event === "8000") {
    let t = 1800 - 4.242 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += secRand;
    return t;
  }

  if (event === "10000") {
    let t = 2520 - 7.980 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += secRand;
    return t;
  }

  return 9999;
}

export function formatTime(sec, digits = 1) {
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(digits);
  const pad = digits === 0 ? 2 : (digits + 3);
  const s2 = s.padStart(pad, "0");
  return `${m}:${s2}`;
}

export function groupBySize(entries, size) {
  const shuffled = shuffle(entries);
  const groups = [];
  for (let i = 0; i < shuffled.length; i += size) groups.push(shuffled.slice(i, i + size));
  return groups;
}
