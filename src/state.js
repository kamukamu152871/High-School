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

// 1年生能力：
// 45% -> 1-20, 50% -> 21-40, 5% -> 41-50
function baseAbilityFreshman() {
  const r = Math.random() * 100;
  if (r < 45) return randInt(1, 20);
  if (r < 95) return randInt(21, 40);
  return randInt(41, 50);
}

function createAbilitiesByGrade(grade) {
  const add = grade === 1 ? 0 : grade === 2 ? 10 : 20;

  return {
    sprint: baseAbilityFreshman() + add,
    speed: baseAbilityFreshman() + add,
    stamina: baseAbilityFreshman() + add,
    toughness: baseAbilityFreshman() + add,
    technique: baseAbilityFreshman() + add,
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

    // 設備レベル（練習ごとに1-4）
    facilities: {
      nagashi: 2,
      tt: 2,
      jog: 2,
      interval: 2,
      circuit: 2,
    },

    lastTraining: null,
    lastMeetResult: null,

    rivals: null,
    qualify: {
      // 今後：厳密な通過（選手×種目）をここに入れる
      soutai: {
        prefecturePairs: [], // [{athleteId,event}]
        regionPairs: [],
        nationalPairs: [],
      },
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

    // 旧セーブ救済（施設）
    state.facilities ??= { nagashi: 2, tt: 2, jog: 2, interval: 2, circuit: 2 };

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
