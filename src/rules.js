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

export function personalityBonus(personality, stat) {
  if (personality === "てんさい") return 1;
  if (personality === "ふつう") return 0.5;

  const map = {
    "たんき": "sprint",
    "せっかち": "speed",
    "おおらか": "stamina",
    "がんこ": "toughness",
    "きよう": "technique",
  };
  return map[personality] === stat ? 1: 0;
}

export function clamp1to100(n) {
  return Math.max(1, Math.min(100, n));
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

// 練習適用：設備の基礎上昇 + 性格補正（別）
export function applyTraining(state, trainingId) {
  const t = TRAININGS.find(x => x.id === trainingId);
  if (!t) return;

  const level = state.facilities?.[trainingId] ?? 2;

  for (const a of state.athletes) {
    const base = baseGainFromFacilityLevel(level);
    const bonus = personalityBonus(a.personality, t.stat);

    a.abilities[t.stat] = clamp1to100(a.abilities[t.stat] + base + bonus);
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

export function calcTimeSecondsFromPower(event, nRaw) {
  const n = floorN(nRaw);

  if (event === "800") {
    let t = 150 - 0.424 * (n - 1);
    t = Math.round(t * 100) / 100;
    t += Math.round(randFloat(-1.5, 1.5) * 100) / 100;
    return t;
  }

  if (event === "1500") {
    let t = 310 - 0.859 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += randInt(-5, 5);
    return t;
  }

  if (event === "3000sc") {
    let t = 750 - 2.273 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += randInt(-5, 5);
    return t;
  }

  if (event === "3000") {
    let t = 690 - 2.020 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += randInt(-5, 5);
    return t;
  }

  if (event === "5000") {
    let t = 1110 - 2.929 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += randInt(-5, 5);
    return t;
  }

  if (event === "5000w") {
    let t = 2100 - 9.394 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += randInt(-5, 5);
    return t;
  }

  if (event === "8000") {
    let t = 1800 - 4.242 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += randInt(-5, 5);
    return t;
  }

  if (event === "10000") {
    let t = 2520 - 7.980 * (n - 1);
    t = Math.round(t * 10) / 10;
    t += randInt(-5, 5);
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
