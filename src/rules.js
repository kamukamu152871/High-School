// 乱数ユーティリティ
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

// 性格ボーナス（練習で上がった能力に追加で加算）
export function personalityBonus(personality, stat) {
  if (personality === "てんさい") return 2; // 何でも+2
  if (personality === "ふつう") return 1;   // 何でも+1

  const map = {
    "たんき": "sprint",
    "せっかち": "speed",
    "おおらか": "stamina",
    "がんこ": "toughness",
    "きよう": "technique",
  };
  return map[personality] === stat ? 2 : 0;
}

export function clamp1to100(n) {
  return Math.max(1, Math.min(100, n));
}

export function recalcOverall(a) {
  const ab = a.abilities;
  a.overall = Math.round((ab.sprint + ab.speed + ab.stamina + ab.toughness + ab.technique) / 5);
}

// 練習を全選手に適用
export function applyTraining(state, trainingId) {
  const t = TRAININGS.find(x => x.id === trainingId);
  if (!t) return;

  for (const a of state.athletes) {
    const base = randInt(1, 2);
    const bonus = personalityBonus(a.personality, t.stat);
    a.abilities[t.stat] = clamp1to100(a.abilities[t.stat] + base + bonus);
    recalcOverall(a);
  }

  state.lastTraining = { id: t.id, name: t.name, stat: t.stat };
  state.trainingDoneThisWeek = true;
}

// --- 種目ルール ---

export const EVENTS_RECORD = ["1500", "3000", "5000"];
export const EVENTS_MEET = ["800", "1500", "3000sc", "5000", "5000w"];
export const EVENTS_EKIDEN = ["10000", "3000", "8000", "5000"];

export function calcEventPower(athlete, event) {
  const ab = athlete.abilities;
  let v = 0;

  // 記録会
  if (event === "1500") v = (ab.sprint + ab.speed * 3 + ab.stamina) / 5;
  if (event === "3000") v = (ab.sprint + ab.speed * 2 + ab.stamina * 2) / 5;
  if (event === "5000") v = (ab.speed * 2 + ab.stamina * 2 + ab.toughness) / 5;

  // 総体
  if (event === "800") v = (ab.sprint * 3 + ab.toughness * 2) / 5;
  if (event === "3000sc") v = (ab.speed + ab.stamina + ab.technique * 3) / 5;
  if (event === "5000w") v = (ab.toughness * 2 + ab.technique * 3) / 5;

  // 駅伝
  if (event === "8000") v = (ab.stamina * 3 + ab.toughness * 2) / 5;
  if (event === "10000") v = (ab.stamina * 2 + ab.toughness * 3) / 5;

  return v;
}

export function calcTimeSecondsFromPower(event, n) {
  // 記録会
  if (event === "1500") {
    let t = 310 - 0.859 * (n - 1);
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

  // 総体
  if (event === "800") {
    let t = 150 - 0.424 * (n - 1);
    t = Math.round(t * 100) / 100; // 小数2位まで
    t += Math.round(randFloat(-1.5, 1.5) * 100) / 100;
    return t;
  }
  if (event === "3000sc") {
    let t = 750 - 2.273 * (n - 1);
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

  // 駅伝
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
