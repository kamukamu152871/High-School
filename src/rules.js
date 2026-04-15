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
  if (personality === "てんさい") return 2;   // 何でも+2
  if (personality === "ふつう") return 1;     // 何でも+1

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

// 練習を全選手に適用（あなたの仕様：選んだ練習に対応する能力が+1〜+3、性格で追加）
export function applyTraining(state, trainingId) {
  const t = TRAININGS.find(x => x.id === trainingId);
  if (!t) return;

  for (const a of state.athletes) {
    const base = randInt(1, 3);
    const bonus = personalityBonus(a.personality, t.stat);
    a.abilities[t.stat] = clamp1to100(a.abilities[t.stat] + base + bonus);
    recalcOverall(a);
  }

  state.lastTraining = { id: t.id, name: t.name, stat: t.stat };
  state.trainingDoneThisWeek = true;
}

// --- 記録会（1500/3000/5000）用のルール ---

export const EVENTS_RECORD = ["1500", "3000", "5000"];

export function calcEventPower(athlete, event) {
  const ab = athlete.abilities;
  let v = 0;
  if (event === "1500") v = (ab.sprint + ab.speed * 3 + ab.stamina) / 5;
  if (event === "3000") v = (ab.sprint + ab.speed * 2 + ab.stamina * 2) / 5;
  if (event === "5000") v = (ab.speed * 2 + ab.stamina * 2 + ab.toughness) / 5;
  return v;
}

// 丸め＋乱数（仕様通り）
export function calcTimeSecondsFromPower(event, n) {
  // n は種目総合値（小数OK）
  if (event === "1500") {
    // 310 − 0.859(n−1) を小数第一位四捨五入、その後 ±5（整数）
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
  return 9999;
}

export function formatTime(sec) {
  // 例: 310.4 -> 5:10.4
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

// 30人ずつグループ
export function groupBySize(entries, size) {
  const shuffled = shuffle(entries);
  const groups = [];
  for (let i = 0; i < shuffled.length; i += size) {
    groups.push(shuffled.slice(i, i + size));
  }
  return groups;
}
