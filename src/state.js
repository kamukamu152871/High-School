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

function createAbilitiesByGrade(grade) {
  // 1年:10-40, 2年:45-55, 3年:55-75
  let min = 10, max = 40;
  if (grade === 2) { min = 45; max = 55; }
  if (grade === 3) { min = 55; max = 75; }

  return {
    sprint: randInt(min, max),
    speed: randInt(min, max),
    stamina: randInt(min, max),
    toughness: randInt(min, max),
    technique: randInt(min, max),
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
  // 各学年5人ずつ
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
  };
}

export function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
