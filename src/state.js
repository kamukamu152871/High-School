import { FAMILY_NAMES, GIVEN_NAMES } from "./data/names.js";

const SAVE_KEY = "hsr_save_v1";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function createRandomName() {
  return `${choice(FAMILY_NAMES)} ${choice(GIVEN_NAMES)}`;
}

// 性格：てんさい以外6つは各16%、てんさい4%
function createPersonality() {
  const r = Math.random() * 100;
  if (r < 16) return "たんき";
  if (r < 32) return "せっかち";
  if (r < 48) return "おおらか";
  if (r < 64) return "がんこ";
  if (r < 80) return "きよう";
  if (r < 96) return "ふつう";
  return "てんさい";
}

// 学年別：45% / 50% / 5% の分布
function sampleByRanges(ranges) {
  const r = Math.random() * 100;
  if (r < 45) return randInt(ranges[0][0], ranges[0][1]);
  if (r < 95) return randInt(ranges[1][0], ranges[1][1]);
  return randInt(ranges[2][0], ranges[2][1]);
}

function rangesByGrade(grade) {
  // A案
  if (grade === 1) return [[1, 20], [21, 40], [41, 50]];
  if (grade === 2) return [[11, 30], [31, 50], [51, 60]];
  return [[21, 40], [41, 60], [61, 70]]; // grade 3
}

function createAbilitiesByGrade(grade) {
  const ranges = rangesByGrade(grade);
  return {
    sprint: sampleByRanges(ranges),
    speed: sampleByRanges(ranges),
    stamina: sampleByRanges(ranges),
    toughness: sampleByRanges(ranges),
    technique: sampleByRanges(ranges),
  };
}

function overall(abilities) {
  const avg =
    (abilities.sprint +
      abilities.speed +
      abilities.stamina +
      abilities.toughness +
      abilities.technique) / 5;
  return Math.round(avg);
}

function createAthlete(grade, index) {
  const abilities = createAbilitiesByGrade(grade);
  return {
    id: `${grade}-${index}-${crypto.randomUUID?.() ?? Math.random()}`,
    grade,
    name: createRandomName(),
    personality: createPersonality(),
    abilities,
    overall: overall(abilities),
  };
}

function createInitialAthletes() {
  const athletes = [];
  for (let i = 0; i < 5; i++) athletes.push(createAthlete(1, i));
  for (let i = 0; i < 5; i++) athletes.push(createAthlete(2, i));
  for (let i = 0; i < 5; i++) athletes.push(createAthlete(3, i));
  return athletes;
}

export function createNewGameState() {
  return {
    year: 1,
    month: 4,
    week: 1,
    teamName: "自校",
    athletes: createInitialAthletes(),

    // プレイヤー校：最初は全部Lv1
    facilities: {
      nagashi: 1,
      tt: 1,
      jog: 1,
      interval: 1,
      circuit: 1,
    },

    lastTraining: null,
    lastMeetResult: null,

    rivals: null,
    qualify: {
      soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
      ekiden: { prefecture: false, region: false, national: false },
    },
  };
}

export function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const state = JSON.parse(raw);

    // 旧セーブ救済（設備）
    state.facilities ??= { nagashi: 1, tt: 1, jog: 1, interval: 1, circuit: 1 };

    // 旧セーブ救済（通過管理）
    state.qualify ??= {
      soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
      ekiden: { prefecture: false, region: false, national: false },
    };

    return state;
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
// --- 追加export：年度更新を main.js から呼べるようにする ---
export function createAthletePublic(grade, index) {
  // 既存のcreateAthleteと同じ実装（内部関数があるのでそのまま呼べないため再定義）
  const abilities = (function createAbilitiesByGradePublic(grade) {
    const ranges = (function rangesByGradePublic(grade) {
      if (grade === 1) return [[1, 20], [21, 40], [41, 50]];
      if (grade === 2) return [[11, 30], [31, 50], [51, 60]];
      return [[21, 40], [41, 60], [61, 70]];
    })(grade);

    const sampleByRangesPublic = (ranges) => {
      const r = Math.random() * 100;
      const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      if (r < 45) return randInt(ranges[0][0], ranges[0][1]);
      if (r < 95) return randInt(ranges[1][0], ranges[1][1]);
      return randInt(ranges[2][0], ranges[2][1]);
    };

    return {
      sprint: sampleByRangesPublic(ranges),
      speed: sampleByRangesPublic(ranges),
      stamina: sampleByRangesPublic(ranges),
      toughness: sampleByRangesPublic(ranges),
      technique: sampleByRangesPublic(ranges),
    };
  })(grade);

  // 名前・性格は既存分布と一致
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const choice = (arr) => arr[randInt(0, arr.length - 1)];
  const name = `${choice(FAMILY_NAMES)} ${choice(GIVEN_NAMES)}`;

  const personality = (() => {
    const r = Math.random() * 100;
    if (r < 16) return "たんき";
    if (r < 32) return "せっかち";
    if (r < 48) return "おおらか";
    if (r < 64) return "がんこ";
    if (r < 80) return "きよう";
    if (r < 96) return "ふつう";
    return "てんさい";
  })();

  const overall = Math.round(
    (abilities.sprint + abilities.speed + abilities.stamina + abilities.toughness + abilities.technique) / 5
  );

  return {
    id: `${grade}-${index}-${crypto.randomUUID?.() ?? Math.random()}`,
    grade,
    name,
    personality,
    abilities,
    overall,
  };
}

export function applyYearUpdateToState(state) {
  // 3年引退→進級→新1年生5人（state.jsの分布で生成）
  const survivors = state.athletes.filter(a => a.grade !== 3);
  for (const a of survivors) a.grade += 1;

  const freshmen = [];
  for (let i = 0; i < 5; i++) freshmen.push(createAthletePublic(1, i));

  state.athletes = freshmen.concat(survivors);
  state.year += 1;
}
