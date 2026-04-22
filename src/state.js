import { FAMILY_NAMES, GIVEN_NAMES } from "./data/names.js";
import { clamp1to110, recalcOverall } from "./rules.js";

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

// 学年別（自校）初期能力分布：従来仕様を維持（のちに必要なら変更）
function sampleByRanges(ranges) {
  const r = Math.random() * 100;
  if (r < 45) return randInt(ranges[0][0], ranges[0][1]);
  if (r < 95) return randInt(ranges[1][0], ranges[1][1]);
  return randInt(ranges[2][0], ranges[2][1]);
}
function rangesByGrade(grade) {
  if (grade === 1) return [[1, 20], [21, 40], [41, 50]];
  if (grade === 2) return [[11, 30], [31, 50], [51, 60]];
  return [[21, 40], [41, 60], [61, 70]];
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

function createAthlete(grade, index) {
  const abilities = createAbilitiesByGrade(grade);
  const a = {
    id: `${grade}-${index}-${crypto.randomUUID?.() ?? Math.random()}`,
    grade,
    name: createRandomName(),
    personality: createPersonality(),
    abilities,
    overall: 0,
  };
  recalcOverall(a);
  return a;
}

function createInitialAthletes() {
  const athletes = [];
  for (let i = 0; i < 5; i++) athletes.push(createAthlete(1, i));
  for (let i = 0; i < 5; i++) athletes.push(createAthlete(2, i));
  for (let i = 0; i < 5; i++) athletes.push(createAthlete(3, i));
  return athletes;
}

function ensureScout(state) {
  state.scout ??= {
    pool: [],
    selected: [],
    max: 1,
    lastEkidenTier: "none",
  };
  state.scout.pool ??= [];
  state.scout.selected ??= [];
  state.scout.max ??= 1;
  state.scout.lastEkidenTier ??= "none";
}

function ensureRecords(state) {
  state.records ??= {
    events: { "800": [], "1500": [], "3000": [], "3000sc": [], "5000": [], "5000w": [] },
    ekidenLegs: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [] },
    ekidenTotal: [],
  };
  state.records.events ??= {};
  for (const ev of ["800", "1500", "3000", "3000sc", "5000", "5000w"]) state.records.events[ev] ??= [];
  state.records.ekidenLegs ??= {};
  for (const leg of ["1", "2", "3", "4", "5", "6", "7"]) state.records.ekidenLegs[leg] ??= [];
  state.records.ekidenTotal ??= [];
}

export function ensureAchievements(state) {
  // 既存の簡易実績に加え、今後「総体総合優勝」などを足す土台だけ用意
  const soutaiStages = ["district", "prefecture", "region", "national"];
  const events = ["800", "1500", "3000sc", "5000", "5000w"];
  const legs = ["1", "2", "3", "4", "5", "6", "7"];

  state.achievements ??= {};

  // 総体：種目別優勝
  state.achievements.soutaiWins ??= {};
  for (const st of soutaiStages) {
    state.achievements.soutaiWins[st] ??= {};
    for (const ev of events) state.achievements.soutaiWins[st][ev] ??= 0;
  }

  // 総体：総合優勝（今回あなたが追加要求しているが、集計自体は次の meet/main で入れる）
  state.achievements.soutaiOverallWins ??= {};
  for (const st of soutaiStages) state.achievements.soutaiOverallWins[st] ??= 0;

  // 駅伝：優勝
  state.achievements.ekidenWins ??= {};
  for (const st of soutaiStages) state.achievements.ekidenWins[st] ??= 0;

  // 駅伝：区間賞（大会別×区間別）
  state.achievements.ekidenLegAwards ??= {};
  for (const st of soutaiStages) {
    state.achievements.ekidenLegAwards[st] ??= {};
    for (const leg of legs) state.achievements.ekidenLegAwards[st][leg] ??= 0;
  }

  // 新人駅伝（カテゴリ別）
  state.achievements.newcomerEkidenWins ??= 0;
  state.achievements.newcomerEkidenLegAwards ??= {};
  for (const leg of legs) state.achievements.newcomerEkidenLegAwards[leg] ??= 0;
}

export function createNewGameState() {
  const state = {
    year: 1,
    month: 4,
    week: 1,
    teamName: "自校",
    athletes: createInitialAthletes(),

    facilities: {
      nagashi: 1,
      tt: 1,
      jog: 1,
      interval: 1,
      circuit: 1,
    },

    lastTraining: null,
    lastMeetResult: null,

    // 旧UI互換（次の main 完全版で撤去予定）
    rivals: null,

    qualify: {
      soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
      ekiden: { prefecture: false, region: false, national: false },
    },

    carry: {
      soutai: { next: [] },
      ekiden: { next: [] },
    },

    scout: { pool: [], selected: [], max: 1, lastEkidenTier: "none" },

    records: {
      events: { "800": [], "1500": [], "3000": [], "3000sc": [], "5000": [], "5000w": [] },
      ekidenLegs: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [] },
      ekidenTotal: [],
    },

    achievements: {},

    // キャプテン（4月1週後に指名）
    captainId: null,

    // 新人駅伝（旧仕様の名残：次の完全実装で置換するが、互換で残す）
    newcomerEkiden: { eligibleSchools: [], top10: [], sourceWhen: null },

    // ★方針B（裏大会完全再現）のための世界状態
    // ここに「各大会の結果（通過者/通過校）」を蓄積していく
    world: {
      schools: null, // rivals.js が生成
      season: {
        // 直近の主要大会結果スナップショット（新人駅伝の出場条件などで使用）
        lastHyogoEkidenTop10: [],     // [{school, rank}]
        lastNationalEkidenTop10: [],  // [{school, rank}]
        lastHyogoSoutaiQualifiers: null,
        lastKinkiSoutaiQualifiers: null,
        lastNationalSoutaiQualifiers: null,
      },
      // 年ごとの大会ログを残したい場合はここに足す
      history: [],
    },
  };

  ensureScout(state);
  ensureRecords(state);
  ensureAchievements(state);
  return state;
}

export function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const state = JSON.parse(raw);

    state.facilities ??= { nagashi: 1, tt: 1, jog: 1, interval: 1, circuit: 1 };

    state.qualify ??= {
      soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
      ekiden: { prefecture: false, region: false, national: false },
    };

    state.carry ??= { soutai: { next: [] }, ekiden: { next: [] } };
    state.carry.soutai ??= { next: [] };
    state.carry.ekiden ??= { next: [] };
    state.carry.soutai.next ??= [];
    state.carry.ekiden.next ??= [];

    ensureScout(state);
    ensureRecords(state);
    ensureAchievements(state);

    state.captainId ??= null;

    state.newcomerEkiden ??= { eligibleSchools: [], top10: [], sourceWhen: null };
    state.newcomerEkiden.eligibleSchools ??= [];
    state.newcomerEkiden.top10 ??= [];
    state.newcomerEkiden.sourceWhen ??= null;

    state.world ??= { schools: null, season: {}, history: [] };
    state.world.season ??= {};
    state.world.season.lastHyogoEkidenTop10 ??= [];
    state.world.season.lastNationalEkidenTop10 ??= [];
    state.world.season.lastHyogoSoutaiQualifiers ??= null;
    state.world.season.lastKinkiSoutaiQualifiers ??= null;
    state.world.season.lastNationalSoutaiQualifiers ??= null;
    state.world.history ??= [];

    // 上限110へ整合（旧セーブ救済）
    if (Array.isArray(state.athletes)) {
      for (const a of state.athletes) {
        a.abilities ??= {};
        a.abilities.sprint = clamp1to110(a.abilities.sprint ?? 1);
        a.abilities.speed = clamp1to110(a.abilities.speed ?? 1);
        a.abilities.stamina = clamp1to110(a.abilities.stamina ?? 1);
        a.abilities.toughness = clamp1to110(a.abilities.toughness ?? 1);
        a.abilities.technique = clamp1to110(a.abilities.technique ?? 1);
        recalcOverall(a);
      }
    }

    return state;
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

// ★スカウト候補（1年生）を作る：能力が21〜60（現行仕様維持）
export function createScoutFreshman(index) {
  const r = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const abilities = {
    sprint: r(21, 60),
    speed: r(21, 60),
    stamina: r(21, 60),
    toughness: r(21, 60),
    technique: r(21, 60),
  };
  const a = {
    id: `scout-1-${index}-${crypto.randomUUID?.() ?? Math.random()}`,
    grade: 1,
    name: createRandomName(),
    personality: createPersonality(),
    abilities,
    overall: 0,
  };
  recalcOverall(a);
  return a;
}

export function applyYearUpdateToState(state) {
  ensureScout(state);
  ensureRecords(state);
  ensureAchievements(state);

  // 3年引退→進級
  const survivors = state.athletes.filter(a => a.grade !== 3);
  for (const a of survivors) a.grade += 1;

  // 新1年生5人：スカウト生を優先
  const freshmen = [];
  const selected = (state.scout.selected ?? []).slice(0, 5);
  for (const s of selected) {
    freshmen.push({ ...s, grade: 1 });
  }

  // 残り枠を従来分布で生成
  const rest = 5 - freshmen.length;
  for (let i = 0; i < rest; i++) freshmen.push(createAthlete(1, i));

  state.athletes = freshmen.concat(survivors);
  state.year += 1;

  // 使い終わったらスカウト情報をリセット
  state.scout.pool = [];
  state.scout.selected = [];
}
