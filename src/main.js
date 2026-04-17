import {
  createNewGameState,
  saveGame,
  loadGame,
  clearSave,
  applyYearUpdateToState,
  createScoutFreshman,
} from "./state.js";

import { TRAININGS, applyTraining } from "./rules.js";
import { ensureRivals, rivalsWeeklyTraining, rivalsYearUpdate } from "./rivals.js";
import { renderPicker } from "./ui_pick.js";

import { runRecordMeet } from "./meet_record.js";
import { runSoutai } from "./meet_soutai.js";
import { runEkiden } from "./meet_ekiden.js";

const app = document.querySelector("#app");

// --- スケジュール（練習後に大会） ---
function getMeetOfWeek(state) {
  if (state.month === 4 && state.week === 4) return { type: "record" };
  if (state.month === 9 && state.week === 3) return { type: "record" };
  if (state.month === 3 && state.week === 3) return { type: "record" };

  if (state.month === 5 && state.week === 1) return { type: "soutai", stage: "district" };
  if (state.month === 5 && state.week === 4) return { type: "soutai", stage: "prefecture" };
  if (state.month === 6 && state.week === 3) return { type: "soutai", stage: "region" };
  if (state.month === 7 && state.week === 4) return { type: "soutai", stage: "national" };

  if (state.month === 10 && state.week === 2) return { type: "ekiden", stage: "district" };
  if (state.month === 10 && state.week === 4) return { type: "ekiden", stage: "prefecture" };
  if (state.month === 11 && state.week === 2) return { type: "ekiden", stage: "region" };
  if (state.month === 12 && state.week === 3) return { type: "ekiden", stage: "national" };

  return null;
}

function isYearUpdateWeek(state) {
  return state.month === 3 && state.week === 4;
}

function advanceWeek(state) {
  state.week += 1;
  if (state.week > 4) {
    state.week = 1;
    state.month += 1;
    if (state.month > 12) state.month = 1;
  }
}

// --- 旧：通過管理（駅伝条件チェックに使う） ---
function ensureQualify(state) {
  state.qualify ??= {
    soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
    ekiden: { prefecture: false, region: false, national: false },
  };

  if (state.qualify.soutai && ("prefecture" in state.qualify.soutai)) {
    state.qualify = {
      soutai: { prefecturePairs: [], regionPairs: [], nationalPairs: [] },
      ekiden: state.qualify.ekiden ?? { prefecture: false, region: false, national: false },
    };
  }
}

function ensureFacilities(state) {
  state.facilities ??= { nagashi: 1, tt: 1, jog: 1, interval: 1, circuit: 1 };
}

function ensureCarry(state) {
  state.carry ??= { soutai: { next: [] }, ekiden: { next: [] } };
  state.carry.soutai ??= { next: [] };
  state.carry.ekiden ??= { next: [] };
  state.carry.soutai.next ??= [];
  state.carry.ekiden.next ??= [];
}

function ensureScout(state) {
  state.scout ??= { pool: [], selected: [], max: 1, lastEkidenTier: "none" };
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

// 速いほど良い（timeSecが小さいほど上）
// 同一選手は1ランキング内で重複禁止：良い記録なら置換、悪いなら無視
function upsertTop10NoDupByAthlete(list, entry, keyTime = "timeSec") {
  const arr = (list ?? []).slice();

  const idx = arr.findIndex(x => x.athleteId === entry.athleteId);
  if (idx >= 0) {
    if (entry[keyTime] < arr[idx][keyTime]) arr[idx] = entry;
  } else {
    arr.push(entry);
  }

  arr.sort((a, b) => a[keyTime] - b[keyTime]);
  return arr.slice(0, 10);
}

function pushTop10(list, entry, keyTime) {
  const arr = (list ?? []).slice();
  arr.push(entry);
  arr.sort((a, b) => a[keyTime] - b[keyTime]);
  return arr.slice(0, 10);
}

function updateRecordsFromSoutai(state, result) {
  ensureRecords(state);

  for (const [ev, er] of Object.entries(result.events ?? {})) {
    if (!state.records.events[ev]) continue;

    const ranked = er.type === "withFinal" ? (er.final ?? []) : (er.overall ?? []);
    for (const x of ranked) {
      if (!x.isPlayer) continue;

      const entry = {
        athleteId: x.athlete?.id ?? `${x.athlete?.name ?? "unknown"}`,
        athleteName: x.athlete?.name ?? "",
        grade: x.athlete?.grade ?? null,        // ★当時学年
        schoolYear: state.year ?? null,         // ★何年目
        timeSec: x.timeSec,
        timeText: x.timeText,
        when: result.when,
      };

      state.records.events[ev] = upsertTop10NoDupByAthlete(state.records.events[ev], entry, "timeSec");
    }
  }
}

function updateRecordsFromRecordMeet(state, result) {
  ensureRecords(state);

  for (const ev of ["1500", "3000", "5000"]) {
    if (!state.records.events[ev]) continue;
    for (const x of (result.events?.[ev] ?? [])) {
      if (!x.isPlayer) continue;
      const entry = {
        athleteId: x.athlete?.id ?? `${x.athlete?.name ?? "unknown"}`,
        athleteName: x.athlete?.name ?? "",
        grade: x.athlete?.grade ?? null,        // ★当時学年
        schoolYear: state.year ?? null,         // ★何年目
        timeSec: x.timeSec,
        timeText: x.timeText,
        when: result.when,
      };
      state.records.events[ev] = upsertTop10NoDupByAthlete(state.records.events[ev], entry, "timeSec");
    }
  }
}

function updateRecordsFromEkiden(state, result) {
  ensureRecords(state);

  const my = (result.ranking ?? []).find(x => x.isPlayer);
  if (!my) return;

  state.records.ekidenTotal = pushTop10(
    state.records.ekidenTotal,
    {
      totalSec: my.totalSec,
      totalText: my.totalText,
      schoolYear: state.year ?? null,          // ★何年目
      when: result.when
    },
    "totalSec"
  );

  for (const leg of (my.legs ?? [])) {
    const key = String(leg.leg);
    const entry = {
      athleteId: leg.athleteId ?? leg.athleteName,
      athleteName: leg.athleteName,
      grade: leg.grade ?? null,                // ★当時学年（無い場合null）
      schoolYear: state.year ?? null,          // ★何年目
      timeSec: leg.timeSec,
      timeText: leg.timeText,
      when: result.when,
      event: leg.event,
    };
    state.records.ekidenLegs[key] = upsertTop10NoDupByAthlete(state.records.ekidenLegs[key], entry, "timeSec");
  }
}

// ---- carry を次大会の rivals に混ぜ込む ----
function buildSoutaiRivalsWithCarry(state, stageKey) {
  ensureRivals(state);
  ensureCarry(state);

  const base = (state.rivals?.[stageKey] ?? []).slice();
  const carry = (state.carry.soutai.next ?? []).filter(x => x.toStage === stageKey);
  if (carry.length === 0) return base;

  const baseNames = new Set(base.map(s => s.name));
  const myName = state.teamName;

  const bySchool = new Map();
  for (const c of carry) {
    const schoolName = c.schoolName ?? "不明校";
    if (schoolName === myName) continue;

    if (!bySchool.has(schoolName)) bySchool.set(schoolName, []);
    bySchool.get(schoolName).push(c.athlete);
  }

  for (const [schoolName, athletes] of bySchool.entries()) {
    if (baseNames.has(schoolName)) {
      const s = base.find(x => x.name === schoolName);
      if (s) s.athletes = (s.athletes ?? []).concat(athletes);
    } else {
      base.push({
        name: schoolName,
        facilityLevel: 1,
        groupKey: "carry",
        athletes,
      });
      baseNames.add(schoolName);
    }
  }

  return base;
}

function buildEkidenRivalsWithCarry(state, stageKey) {
  ensureRivals(state);
  ensureCarry(state);

  const base = (state.rivals?.[stageKey] ?? []).slice();
  const carryTeams = (state.carry.ekiden.next ?? [])
    .filter(x => x.toStage === stageKey)
    .map(x => x.team)
    .filter(Boolean)
    .filter(t => t.name !== state.teamName);

  if (carryTeams.length === 0) return base;

  const baseNames = new Set(base.map(s => s.name));
  const add = carryTeams.filter(t => !baseNames.has(t.name));
  return base.concat(add);
}

function buildPlayerFixedSoutaiPicksFromCarry(state, stageKey) {
  ensureCarry(state);
  const src = (state.carry.soutai.next ?? [])
    .filter(x => x.toStage === stageKey && x.isPlayer);
  return src.map(x => ({ athlete: x.athlete, event: x.event }));
}

function canEnterEkiden(state, stageKey) {
  ensureQualify(state);
  if (stageKey === "district") return true;
  if (stageKey === "prefecture") return !!state.qualify.ekiden.prefecture;
  if (stageKey === "region") return !!state.qualify.ekiden.region;
  if (stageKey === "national") return !!state.qualify.ekiden.national;
  return false;
}

function renderEkidenNotQualified(state, stageKey) {
  app.innerHTML = `
    <div class="card">
      <h2>${stageTitleEkiden(stageKey)}</h2>
      <p style="color:#b00;">出場条件を満たしていないため出場できません（前大会で5位以内が必要）。</p>
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderSoutaiNoEntries(state, stageKey) {
  app.innerHTML = `
    <div class="card">
      <h2>${stageTitleSoutai(stageKey)}</h2>
      <p style="color:#b00;">出場できる種目がありません（前大会の通過枠がありません）。</p>
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function computeScoutMaxByEkiden(state) {
  ensureScout(state);
  const tier = state.scout.lastEkidenTier ?? "none";
  if (tier === "national_win") return 5;
  if (tier === "national") return 4;
  if (tier === "region") return 3;
  if (tier === "prefecture") return 2;
  return 1;
}

// --- 記録表示画面 ---
function renderRecords(state) {
  ensureRecords(state);

  const fmtMeta = (r) => {
    const g = (r.grade == null) ? "?" : `${r.grade}年`;
    const y = (r.schoolYear == null) ? "?" : `${r.schoolYear}年目`;
    const w = r.when ?? "";
    return `${g} / ${y} ${w}`.trim();
  };

  const evOrder = [
    { key: "800", label: "800m" },
    { key: "1500", label: "1500m" },
    { key: "3000", label: "3000m" },
    { key: "3000sc", label: "3000mSC" },
    { key: "5000", label: "5000m" },
    { key: "5000w", label: "5000mW" },
  ];

  const eventBlocks = evOrder.map(ev => {
    const list = state.records.events[ev.key] ?? [];
    const rows = list.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.athleteName}</td>
        <td>${r.timeText}</td>
        <td style="color:#777;">${fmtMeta(r)}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="color:#777;">記録なし</td></tr>`;

    return `
      <h3 style="margin-top:14px;">${ev.label} 歴代トップ10（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>順位</th><th>選手</th><th>タイム</th><th>日時</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const legBlocks = [1,2,3,4,5,6,7].map(leg => {
    const list = state.records.ekidenLegs[String(leg)] ?? [];
    const rows = list.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.athleteName}</td>
        <td>${r.timeText}</td>
        <td style="color:#777;">${fmtMeta(r)}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="color:#777;">記録なし</td></tr>`;

    return `
      <h3 style="margin-top:14px;">駅伝 ${leg}区 歴代トップ10（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>順位</th><th>選手</th><th>タイム</th><th>日時</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const totalRows = (state.records.ekidenTotal ?? []).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.totalText}</td>
      <td style="color:#777;">${(r.schoolYear == null ? "?" : `${r.schoolYear}年目`)} ${r.when ?? ""}</td>
    </tr>
  `).join("") || `<tr><td colspan="3" style="color:#777;">記録なし</td></tr>`;

  app.innerHTML = `
    <div class="card">
      <h2>自チーム 歴代記録</h2>

      ${eventBlocks}

      <h2 style="margin-top:18px;">駅伝記録</h2>
      ${legBlocks}

      <h3 style="margin-top:14px;">駅伝 総合タイム 歴代トップ10（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:420px;">
          <thead>
            <tr><th>順位</th><th>総合タイム</th><th>日時</th></tr>
          </thead>
          <tbody>${totalRows}</tbody>
        </table>
      </div>

      <div class="row" style="margin-top:14px;">
        <button class="secondary" id="back">戻る</button>
      </div>
    </div>
  `;

  document.querySelector("#back").onclick = () => renderHome(state);
}

// --- 3月4週：設備を1つ選んでLv+1 → スカウト → 年度更新 → 次週へ ---
function renderFacilityUpgradeChoice(state) {
  ensureFacilities(state);
  ensureScout(state);

  const items = [
    { key: "nagashi", label: "流し" },
    { key: "tt", label: "TT" },
    { key: "jog", label: "ジョグ" },
    { key: "interval", label: "インターバル" },
    { key: "circuit", label: "サーキット" },
  ];

  const rows = items.map(x => `
    <div style="border:1px solid #eee; border-radius:10px; padding:10px; margin-top:10px;">
      <div style="font-weight:800;">${x.label}（現在 Lv ${state.facilities[x.key]}）</div>
      <button data-up="${x.key}" style="margin-top:8px;">この設備をLv+1</button>
    </div>
  `).join("");

  app.innerHTML = `
    <div class="card">
      <h2>年度更新前：設備強化</h2>
      <p style="color:#555;">3月4週目は、設備を1つだけ強化できます（Lv+1）。</p>
      ${rows}
      <p style="color:#b00; margin-top:10px;">※このあと新入生スカウト→年度更新（引退/進級/新入生）→次週へ進みます。</p>
    </div>
  `;

  app.querySelectorAll("button[data-up]").forEach(b => {
    b.onclick = () => {
      const key = b.getAttribute("data-up");
      state.facilities[key] = Math.min(4, (state.facilities[key] ?? 1) + 1);
      saveGame(state);
      renderScout(state);
    };
  });
}

function renderScout(state) {
  ensureScout(state);

  state.scout.max = computeScoutMaxByEkiden(state);

  if (!state.scout.pool || state.scout.pool.length !== 10) {
    state.scout.pool = Array.from({ length: 10 }, (_, i) => createScoutFreshman(i));
    state.scout.selected = [];
  }

  const max = state.scout.max;

  const rows = state.scout.pool.map((a, idx) => {
    const ab = a.abilities;
    return `
      <div style="border-top:1px solid #eee; padding:10px 0;">
        <label style="display:flex; gap:10px; align-items:flex-start;">
          <input type="checkbox" data-scout="1" data-idx="${idx}" style="margin-top:5px;" />
          <div style="flex:1;">
            <div style="font-weight:800;">${a.name}（性格：${a.personality}）</div>
            <div style="color:#555; margin-top:4px;">
              SPRINT ${ab.sprint} / SPEED ${ab.speed} / STAMINA ${ab.stamina} / TOUGHNESS ${ab.toughness} / TECHNIQUE ${ab.technique}
            </div>
            <div style="color:#777; margin-top:2px;">総合 ${a.overall}</div>
          </div>
        </label>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>新入生スカウト</h2>
      <p style="color:#555;">
        候補10人から <b>${max}人まで</b> 選べます（能力は21〜60の範囲）。
      </p>

      <div style="max-height:55vh; overflow:auto;">
        ${rows}
      </div>

      <div class="row" style="margin-top:12px;">
        <button id="ok">決定</button>
      </div>

      <p id="count" style="margin-top:10px; color:#555;"></p>
      <p style="color:#b00; margin-top:6px;">※決定すると年度更新が行われ、次の週へ進みます。</p>
    </div>
  `;

  const updateCount = () => {
    const selectedIdx = Array.from(app.querySelectorAll("input[data-scout]"))
      .filter(x => x.checked)
      .map(x => Number(x.getAttribute("data-idx")));

    const over = selectedIdx.length > max;
    document.querySelector("#count").textContent =
      `選択数：${selectedIdx.length}/${max}` + (over ? "（選びすぎ）" : "");
    document.querySelector("#count").style.color = over ? "#b00" : "#555";
  };

  app.querySelectorAll("input[data-scout]").forEach(cb => {
    cb.onchange = () => updateCount();
  });
  updateCount();

  document.querySelector("#ok").onclick = () => {
    const selectedIdx = Array.from(app.querySelectorAll("input[data-scout]"))
      .filter(x => x.checked)
      .map(x => Number(x.getAttribute("data-idx")));

    if (selectedIdx.length > max) return;

    state.scout.selected = selectedIdx.map(i => state.scout.pool[i]);
    saveGame(state);

    runYearUpdate(state);
    advanceWeek(state);
    state.lastTraining = null;
    saveGame(state);
    renderHome(state);
  };
}

function goNextWeek(state) {
  if (isYearUpdateWeek(state)) {
    renderFacilityUpgradeChoice(state);
    return;
  }

  advanceWeek(state);
  state.lastTraining = null;
  saveGame(state);
  renderHome(state);
}

// --- 画面 ---
function renderTitle() {
  const hasSave = !!loadGame();

  app.innerHTML = `
    <div class="card">
      <h2>タイトル</h2>

      <label style="display:block; margin-top:10px;">
        学校名：
        <input id="teamNameInput" type="text" value="自校" style="width:100%; padding:10px; margin-top:6px;" />
      </label>

      <div class="row" style="margin-top:12px;">
        <button id="new">ゲームスタート</button>
        <button id="cont" ${hasSave ? "" : "disabled"}>つづきから</button>
        <button class="secondary" id="reset" ${hasSave ? "" : "disabled"}>セーブ削除</button>
      </div>

      <p style="margin-top:12px;color:#555;">端末内（ブラウザ）に自動でセーブされます。</p>
     
    </div>
  `;

  document.querySelector("#new").onclick = () => {
    const state = createNewGameState();

    const name = (document.querySelector("#teamNameInput")?.value ?? "").trim();
    state.teamName = name || "自校";

    ensureRivals(state);
    ensureQualify(state);
    ensureFacilities(state);
    ensureCarry(state);
    ensureScout(state);
    ensureRecords(state);
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#cont").onclick = () => {
    const state = loadGame();
    if (state) {
      ensureRivals(state);
      ensureQualify(state);
      ensureFacilities(state);
      ensureCarry(state);
      ensureScout(state);
      ensureRecords(state);
      saveGame(state);
      renderHome(state);
    }
  };

  document.querySelector("#reset").onclick = () => {
    clearSave();
    renderTitle();
  };
}

function renderHome(state) {
  const meet = getMeetOfWeek(state);

  const meetText = meet
    ? meet.type === "record"
      ? "この週は【記録会】（練習後に出場選出→実行）"
      : meet.type === "soutai"
        ? `この週は【${stageTitleSoutai(meet.stage)}】（練習後に出場選出→実行）`
        : `この週は【${stageTitleEkiden(meet.stage)}】（練習後に出場選出→実行）`
    : "この週は大会なし";

  const yearText = isYearUpdateWeek(state)
    ? "この週の最後に【年度更新（設備強化→スカウト→引退/進級/新入生）】があります"
    : "";

  const trainingButtons = TRAININGS.map(t => `<button data-tr="${t.id}">${t.name}</button>`).join("");

  app.innerHTML = `
    <div class="card">
      <h2>ホーム</h2>
      <p>学校：${state.teamName}</p>
      <p>年：${state.year} / ${state.month}月 ${state.week}週</p>
      <p style="color:#555;">${meetText}</p>
      ${yearText ? `<p style="color:#b00;">${yearText}</p>` : ""}
      <p style="color:#555;">今週の練習：${state.lastTraining?.name ?? "未実施"}</p>

      <h3 style="margin-top:14px;">練習（タップで実行→大会があれば選出→実行）</h3>
      <div class="row">${trainingButtons}</div>

      <div class="row" style="margin-top:12px;">
        <button id="athletes">選手</button>
        <button id="facilities">設備</button>
        <button id="records">記録</button>
        <button id="rename">学校名変更</button>
        <button id="help">ヘルプ</button>
        <button class="secondary" id="back">タイトルへ</button>
      </div>
    </div>
  `;

  document.querySelector("#athletes").onclick = () => renderAthletes(state);
  document.querySelector("#facilities").onclick = () => renderFacilities(state);
  document.querySelector("#records").onclick = () => renderRecords(state);
  document.querySelector("#rename").onclick = () => renderRenameTeam(state);
  document.querySelector("#help").onclick = () => renderHelp(state);
  document.querySelector("#back").onclick = () => renderTitle();

  app.querySelectorAll("button[data-tr]").forEach(b => {
    b.onclick = async () => {
      const id = b.getAttribute("data-tr");

      ensureRivals(state);
      ensureQualify(state);
      ensureFacilities(state);
      ensureCarry(state);
      ensureScout(state);
      ensureRecords(state);

      rivalsWeeklyTraining(state);
      applyTraining(state, id);

      const meet = getMeetOfWeek(state);
      saveGame(state);

      if (!meet) {
        goNextWeek(state);
        return;
      }

      if (meet.type === "record") {
        renderPicker(app, "record", state, {
          onCancel: () => renderHome(state),
          onConfirm: (picks) => {
            const result = runRecordMeet(state, picks);
            updateRecordsFromRecordMeet(state, result);
            saveGame(state);
            renderRecordResult(state, result);
          }
        });
        return;
      }

      if (meet.type === "soutai") {
        const original = state.rivals?.[meet.stage];
        state.rivals[meet.stage] = buildSoutaiRivalsWithCarry(state, meet.stage);

        const readOnly = meet.stage !== "district";
        const fixedPicks = readOnly ? buildPlayerFixedSoutaiPicksFromCarry(state, meet.stage) : null;

        if (readOnly && (!fixedPicks || fixedPicks.length === 0)) {
          state.rivals[meet.stage] = original;
          renderSoutaiNoEntries(state, meet.stage);
          return;
        }

        renderPicker(app, "soutai", state, {
          allowedEvents: null,
          allowedPairs: null,
          readOnly,
          fixedPicks,
          onCancel: () => {
            state.rivals[meet.stage] = original;
            renderHome(state);
          },
          onConfirm: (picks) => {
            const submit = readOnly ? (fixedPicks ?? []) : picks;
            const result = runSoutai(state, meet.stage, submit, null);

            state.carry.soutai.next = result.carryCandidates ?? [];

            // ★歴代保存（5種目）
            updateRecordsFromSoutai(state, result);

            state.rivals[meet.stage] = original;

            saveGame(state);
            renderSoutaiResult(state, result);
          }
        });
        return;
      }

      if (meet.type === "ekiden") {
        if (!canEnterEkiden(state, meet.stage)) {
          renderEkidenNotQualified(state, meet.stage);
          return;
        }

        const original = state.rivals?.[meet.stage];
        state.rivals[meet.stage] = buildEkidenRivalsWithCarry(state, meet.stage);

        renderPicker(app, "ekiden", state, {
          onCancel: () => {
            state.rivals[meet.stage] = original;
            renderHome(state);
          },
          onConfirm: (picks) => {
            const result = runEkiden(state, meet.stage, picks);

            ensureQualify(state);
            if (meet.stage === "district") state.qualify.ekiden.prefecture = !!result.cleared;
            if (meet.stage === "prefecture") state.qualify.ekiden.region = !!result.cleared;
            if (meet.stage === "region") state.qualify.ekiden.national = !!result.cleared;

            ensureScout(state);
            if (meet.stage === "prefecture") state.scout.lastEkidenTier = "prefecture";
            if (meet.stage === "region") state.scout.lastEkidenTier = "region";
            if (meet.stage === "national") {
              state.scout.lastEkidenTier = (result.myRank === 1) ? "national_win" : "national";
            }

            state.carry.ekiden.next = result.top5Teams ?? [];

            // ★歴代保存（区間＋総合）
            updateRecordsFromEkiden(state, result);

            state.rivals[meet.stage] = original;

            saveGame(state);
            renderEkidenResult(state, result);
          }
        });
        return;
      }
    };
  });
}

function renderRenameTeam(state) {
  app.innerHTML = `
    <div class="card">
      <h2>学校名変更</h2>
      <p style="color:#555;">現在：${state.teamName}</p>

      <label style="display:block; margin-top:12px;">
        新しい学校名：
        <input id="newTeamName" type="text" value="${state.teamName}" style="width:100%; padding:10px; margin-top:6px;" />
      </label>

      <div class="row" style="margin-top:12px;">
        <button id="ok">保存</button>
        <button class="secondary" id="cancel">戻る</button>
      </div>
    </div>
  `;

  document.querySelector("#ok").onclick = () => {
    const v = (document.querySelector("#newTeamName")?.value ?? "").trim();
    state.teamName = v || "自校";
    saveGame(state);
    renderHome(state);
  };
  document.querySelector("#cancel").onclick = () => renderHome(state);
}

/**
 * ヘルプはあとで書き換えるとのことなので仮実装です。
 * あなたの任意の内容に差し替えてOK。
 */
function renderHelp(state) {
  app.innerHTML = `
    <div class="card">
      <h2>ヘルプ</h2>

      <h3 style="margin-top:12px;">基本の流れ</h3>
      <ul>
        <li>ホームで練習を選ぶ → 週が進みます。</li>
        <li>大会がある週は、練習後に出場確認/選出して大会を実行します。</li>
        <li>結果を見たら「OK（次の週へ）」で進みます。</li>
        <li>年度末（3月4週）には、設備強化・スカウト・年度更新があります。</li>
      </ul>

      <h3 style="margin-top:12px;">能力の種類</h3>
      <ul>
        <li><b>SPRINT</b>：瞬発力</li>
        <li><b>SPEED</b>：スピード</li>
        <li><b>STAMINA</b>：スタミナ</li>
        <li><b>TOUGHNESS</b>：タフネス</li>
        <li><b>TECHNIQUE</b>：テクニック</li>
      </ul>

      <h3 style="margin-top:12px;">練習と伸びる能力</h3>
      <ul>
        <li>流し：主に <b>SPRINT</b> が伸びやすい練習です。</li>
        <li>TT：主に <b>SPEED</b> が伸びやすい練習です。</li>
        <li>ジョグ：主に <b>STAMINA</b> が伸びやすい練習です。</li>
        <li>インターバル：主に <b>TOUGHNESS</b> が伸びやすい練習です。</li>
        <li>サーキット：主に <b>TECHNIQUE</b> が伸びやすい練習です。</li>
      </ul>

      <h3 style="margin-top:12px;">性格補正（練習の伸び方）</h3>
      <ul>
        <li>選手の性格によって、特定の練習で能力が伸びやすくなります。</li>
        <li>短気：<b>SPRINT</b> 系が伸びやすい傾向があります。</li>
        <li>せっかち：<b>SPEED</b> 系が伸びやすい傾向があります。</li>
        <li>おおらか：<b>STAMINA</b> 系が伸びやすい傾向があります。</li>
        <li>がんこ：<b>TOUGHNESS</b> 系が伸びやすい傾向があります。</li>
        <li>きよう：<b>TECHNIQUE</b> 系が伸びやすい傾向があります。</li>
        <li>ふつう：全体的に安定して伸びやすい傾向があります。</li>
        <li>てんさい：多方面で伸びやすく、化ける可能性があります。</li>
      </ul>

      <h3 style="margin-top:12px;">総体：種目ごとの重要能力（目安）</h3>
      <ul>
        <li>800m：主に <b>SPRINT</b> と <b>TOUGHNESS</b> が重要になりやすいです。</li>
        <li>1500m：主に <b>SPRINT</b> と <b>SPEED</b>、さらに <b>STAMINA</b> も影響します。</li>
        <li>3000mSC：主に <b>SPEED</b>・<b>STAMINA</b> に加えて、<b>TECHNIQUE</b> の影響が出やすいです。</li>
        <li>5000m：主に <b>SPEED</b> と <b>STAMINA</b>、さらに <b>TOUGHNESS</b> も効きやすいです。</li>
        <li>5000mW：主に <b>TOUGHNESS</b> と <b>TECHNIQUE</b> が重要になりやすいです。</li>
      </ul>

      <h3 style="margin-top:12px;">駅伝：区間ごとの重要能力（目安）</h3>
      <ul>
        <li>1区 10000m：主に <b>STAMINA</b> と <b>TOUGHNESS</b> が重要になりやすいです。</li>
        <li>2区 3000m：主に <b>SPRINT</b>・<b>SPEED</b> と <b>STAMINA</b> のバランスが効きやすいです。</li>
        <li>3区 8000m：主に <b>STAMINA</b> と <b>TOUGHNESS</b> が重要になりやすいです。</li>
        <li>4区 8000m：主に <b>STAMINA</b> と <b>TOUGHNESS</b> が重要になりやすいです。</li>
        <li>5区 3000m：主に <b>SPRINT</b>・<b>SPEED</b> と <b>STAMINA</b> のバランスが効きやすいです。</li>
        <li>6区 5000m：主に <b>SPEED</b> と <b>STAMINA</b> に加えて、<b>TOUGHNESS</b> も影響します。</li>
        <li>7区 5000m：主に <b>SPEED</b> と <b>STAMINA</b> に加えて、<b>TOUGHNESS</b> も影響します。</li>
      </ul>

      <h3 style="margin-top:12px;">大会の出場条件</h3>
      <ul>
        <li>駅伝は、地区以外（県/地域/全国）では「前大会で5位以内」の条件を満たさないと出場できません。</li>
        <li>総体は大会週に出場選出（県以降は確認のみ）を行い、そのまま実行できます。</li>
      </ul>

      <h3 style="margin-top:12px;">駅伝結果の見方（順位推移）</h3>
      <ul>
        <li>駅伝の結果画面では、各区ごとに「区間順位」と「その時点の累積順位（順位推移）」を確認できます。</li>
        <li>累積順位は、各区終了時点での合計タイム順です。</li>
      </ul>

      <h3 style="margin-top:12px;">年度末（3月4週）の処理</h3>
      <ul>
        <li>3月4週目の最後に、次の順で処理が行われます。</li>
        <li>① 設備強化：設備を1つ選んでレベルを1上げます。</li>
        <li>② 新入生スカウト：候補10人から最大n人選びます（nはその年の駅伝成績で決まります）。</li>
        <li>③ 年度更新：3年生引退→進級→新1年生が加入します（新入生5人の枠はスカウト生が優先されます）。</li>
      </ul>

      <h3 style="margin-top:12px;">スカウト人数（駅伝成績による）</h3>
      <ul>
        <li>全国駅伝 優勝：5人</li>
        <li>全国駅伝 出場：4人</li>
        <li>地域駅伝 出場：3人</li>
        <li>県駅伝 出場：2人</li>
        <li>それ以外：1人</li>
      </ul>

   

      <div class="row" style="margin-top:14px;">
        <button class="secondary" id="back">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#back").onclick = () => renderHome(state);
}

function renderFacilities(state) {
  ensureFacilities(state);
  const f = state.facilities;

  app.innerHTML = `
    <div class="card">
      <h2>練習設備レベル</h2>
      <table style="width:100%; border-collapse:collapse;">
        <tbody>
          <tr><td>流し</td><td>Lv ${f.nagashi}</td></tr>
          <tr><td>TT</td><td>Lv ${f.tt}</td></tr>
          <tr><td>ジョグ</td><td>Lv ${f.jog}</td></tr>
          <tr><td>インターバル</td><td>Lv ${f.interval}</td></tr>
          <tr><td>サーキット</td><td>Lv ${f.circuit}</td></tr>
        </tbody>
      </table>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#home").onclick = () => renderHome(state);
}

function renderAthletes(state) {
  const f = (n) => Math.floor(n);

  const rows = (state.athletes ?? []).map(a => `
    <tr>
      <td>${a.grade}</td>
      <td>${a.name}</td>
      <td>${a.personality}</td>
      <td>${f(a.abilities.sprint)}</td>
      <td>${f(a.abilities.speed)}</td>
      <td>${f(a.abilities.stamina)}</td>
      <td>${f(a.abilities.toughness)}</td>
      <td>${f(a.abilities.technique)}</td>
      <td>${f(a.overall)}</td>
    </tr>
  `).join("");

  app.innerHTML = `
    <div class="card">
      <h2>選手</h2>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:700px;">
          <thead>
            <tr>
              <th>学年</th><th>名前</th><th>性格</th>
              <th>SP</th><th>SPD</th><th>STA</th><th>TUF</th><th>TEC</th>
              <th>総合</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;
  document.querySelector("#home").onclick = () => renderHome(state);
}

// --- 結果画面 ---
function renderRecordResult(state, result) {
  const sections = ["1500", "3000", "5000"].map(ev => {
    const rows = result.playerOnly[ev].map(r => `
      <tr>
        <td>${r.overallRank}</td>
        <td>${r.athlete.name}</td>
        <td>${r.timeText}</td>
      </tr>
    `).join("");

    return `
      <h3 style="margin-top:14px;">${ev}m（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:420px;">
          <thead>
            <tr><th>全体順位</th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderSoutaiResult(state, result) {
  saveGame(state);

  const evOrder = ["800", "1500", "3000sc", "5000", "5000w"];
  const sections = evOrder.map(ev => {
    const er = result.events[ev];
    if (!er) return "";

    const list = er.type === "withFinal" ? er.final : er.overall;

    const top = list.slice(0, 10).map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${x.school}</td>
        <td>${x.isPlayer ? "自校" : ""}</td>
        <td>${x.athlete.name}</td>
        <td>${x.timeText}</td>
      </tr>
    `).join("");

    let playerRows = [];

    if (er.type === "withFinal") {
      const heats = er.heats ?? [];
      const allHeatResults = heats.flatMap(h =>
        (h.results ?? []).map((x, i) => ({
          ...x,
          heat: h.heat,
          rankInHeat: i + 1,
        }))
      );
      const athleteKey = (x, fallback) => x.athlete?.id ?? x.athlete?.name ?? fallback;
      const prelimRankMap = new Map(
        allHeatResults
          .slice()
          .sort((a, b) => a.timeSec - b.timeSec)
          .map((x, i) => [athleteKey(x, `heat-${x.heat}-rank-${x.rankInHeat}`), i + 1])
      );

      playerRows = allHeatResults
        .filter(x => x.isPlayer)
        .map(x => {
          const key = athleteKey(x, `heat-${x.heat}-rank-${x.rankInHeat}`);
          const finalRank = (er.final ?? []).findIndex(f =>
            (athleteKey(f, "") === key) || (f.athlete === x.athlete)
          );
          const isFinalist = finalRank >= 0;
          const shown = isFinalist ? er.final[finalRank] : x;
          return {
            athleteName: x.athlete?.name ?? "",
            overallRank: isFinalist ? (finalRank + 1) : (prelimRankMap.get(key) ?? "-"),
            timeText: shown.timeText,
            remark: isFinalist ? `決勝${finalRank + 1}位` : `予選${x.heat}組${x.rankInHeat}着`,
          };
        })
        .sort((a, b) => {
          const ra = typeof a.overallRank === "number" ? a.overallRank : 9999;
          const rb = typeof b.overallRank === "number" ? b.overallRank : 9999;
          return ra - rb;
        });
    } else {
      playerRows = (er.overall ?? [])
        .map((x, i) => ({ ...x, overallRank: i + 1 }))
        .filter(x => x.isPlayer)
        .map(x => ({
          athleteName: x.athlete?.name ?? "",
          overallRank: x.overallRank,
          timeText: x.timeText,
          remark: "-",
        }));
    }

    const playerTableRows = playerRows.map(r => `
      <tr>
        <td>${r.overallRank}</td>
        <td>${r.athleteName}</td>
        <td>${r.timeText}</td>
        <td>${r.remark}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" style="color:#777;">該当なし</td></tr>`;

    return `
      <h3 style="margin-top:14px;">${eventLabel(ev)}</h3>
      <h4 style="margin:10px 0 6px 0;">全体（上位10）</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:560px;">
          <thead>
            <tr><th>順位</th><th>学校</th><th></th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${top}</tbody>
        </table>
      </div>
      <h4 style="margin:10px 0 6px 0;">自校選手</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:560px;">
          <thead>
            <tr><th>総合順位</th><th>選手</th><th>タイム</th><th>備考</th></tr>
          </thead>
          <tbody>${playerTableRows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

function renderEkidenResult(state, result) {
  const top10 = result.ranking.slice(0, 10).map(x => `
    <tr>
      <td>${x.rank}</td>
      <td>${x.school}</td>
      <td>${x.isPlayer ? "自校" : ""}</td>
      <td>${x.totalText}</td>
    </tr>
  `).join("");

  const my = result.ranking.find(x => x.isPlayer);
  const legs = (my?.legs ?? []).map(l => `
    <tr>
      <td>${l.leg}</td>
      <td>${l.event}m</td>
      <td>${l.athleteName}</td>
      <td>${l.timeText}</td>
    </tr>
  `).join("");

  const q = `自校順位：${result.myRank}位 / 通過：${result.cleared ? "YES" : "NO"}（5位以内）`;

  const splitBlocks = (result.splits ?? []).map(sp => {
    const rows = (sp.rows ?? []).map(r => `
      <tr>
        <td>${r.cumRank}</td>
        <td>${r.school}</td>
        <td>${r.isPlayer ? "自校" : ""}</td>
        <td>${r.legRank}</td>
        <td>${r.legTimeText}</td>
        <td>${r.cumText}</td>
      </tr>
    `).join("");

    return `
      <h4 style="margin:10px 0 6px 0;">${sp.leg}区（${sp.event}m）時点</h4>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr>
              <th>累積順位</th><th>学校</th><th></th><th>区間順位</th><th>区間タイム</th><th>累積タイム</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      <p style="color:#555;">${q}</p>

      <h3 style="margin-top:14px;">総合順位（上位10）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>順位</th><th>学校</th><th></th><th>総合タイム</th></tr>
          </thead>
          <tbody>${top10}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">自校区間タイム</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>区</th><th>距離</th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${legs}</tbody>
        </table>
      </div>

      <h3 style="margin-top:14px;">各区の順位推移（全校）</h3>
      ${splitBlocks}

      <div class="row" style="margin-top:14px;">
        <button id="ok">OK（次の週へ）</button>
      </div>
    </div>
  `;
  document.querySelector("#ok").onclick = () => goNextWeek(state);
}

// --- 年度更新 ---
function runYearUpdate(state) {
  applyYearUpdateToState(state);
  rivalsYearUpdate(state);

  ensureCarry(state);
  state.carry.soutai.next = [];
  state.carry.ekiden.next = [];

  ensureFacilities(state);

  ensureQualify(state);
  state.qualify.ekiden = { prefecture: false, region: false, national: false };

  ensureScout(state);
  state.scout.lastEkidenTier = "none";
}

// --- ラベル ---
function stageTitleSoutai(key) {
  if (key === "district") return "地区総体";
  if (key === "prefecture") return "県総体";
  if (key === "region") return "地域総体";
  if (key === "national") return "全国総体";
  return "総体";
}
function stageTitleEkiden(key) {
  if (key === "district") return "地区駅伝";
  if (key === "prefecture") return "県駅伝";
  if (key === "region") return "地域駅伝";
  if (key === "national") return "全国駅伝";
  return "駅伝";
}
function eventLabel(ev) {
  if (ev === "800") return "800m";
  if (ev === "1500") return "1500m";
  if (ev === "3000sc") return "3000mSC";
  if (ev === "5000") return "5000m";
  if (ev === "5000w") return "5000mW";
  return ev;
}

renderTitle();
