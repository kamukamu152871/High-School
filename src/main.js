import { createNewGameState, saveGame, loadGame, clearSave } from "./state.js";
import { TRAININGS, applyTraining } from "./rules.js";
import { runRecordMeet } from "./meet_record.js";
import { runSoutai } from "./meet_soutai.js";
import { runEkiden } from "./meet_ekiden.js";
import { ensureRivals, rivalsWeeklyTraining, rivalsYearUpdate } from "./rivals.js";

const app = document.querySelector("#app");

// --- スケジュール判定（「その週の練習後に大会」） ---
function getMeetOfWeek(state) {
  // 記録会：4月4週後、9月3週後、3月3週後
  if (state.month === 4 && state.week === 4) return { type: "record" };
  if (state.month === 9 && state.week === 3) return { type: "record" };
  if (state.month === 3 && state.week === 3) return { type: "record" };

  // 総体：5月1週後 地区、5月4週後 県、6月3週後 地域、7月4週後 全国
  if (state.month === 5 && state.week === 1) return { type: "soutai", stage: "district" };
  if (state.month === 5 && state.week === 4) return { type: "soutai", stage: "prefecture" };
  if (state.month === 6 && state.week === 3) return { type: "soutai", stage: "region" };
  if (state.month === 7 && state.week === 4) return { type: "soutai", stage: "national" };

  // 駅伝：10月2週後 地区、10月4週後 県、11月2週後 地域、12月3週後 全国
  if (state.month === 10 && state.week === 2) return { type: "ekiden", stage: "district" };
  if (state.month === 10 && state.week === 4) return { type: "ekiden", stage: "prefecture" };
  if (state.month === 11 && state.week === 2) return { type: "ekiden", stage: "region" };
  if (state.month === 12 && state.week === 3) return { type: "ekiden", stage: "national" };

  return null;
}

function isYearUpdateWeek(state) {
  // 3月4週後：引退/進級/新入生
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

function resetWeekFlags(state) {
  state.trainingDoneThisWeek = false;
  state.lastTraining = null;
}

function renderTitle() {
  const hasSave = !!loadGame();

  app.innerHTML = `
    <div class="card">
      <h2>タイトル</h2>
      <div class="row">
        <button id="new">ゲームスタート</button>
        <button id="cont" ${hasSave ? "" : "disabled"}>つづきから</button>
        <button class="secondary" id="reset" ${hasSave ? "" : "disabled"}>セーブ削除</button>
      </div>
      <p style="margin-top:12px;color:#555;">
        端末内（ブラウザ）に自動でセーブされます。
      </p>
    </div>
  `;

  document.querySelector("#new").onclick = () => {
    const state = createNewGameState();
    ensureRivals(state);
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#cont").onclick = () => {
    const state = loadGame();
    if (state) {
      ensureRivals(state);
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
    ? (meet.type === "record"
      ? "この週は【記録会】があります（練習後に実行）"
      : meet.type === "soutai"
        ? `この週は【総体】があります：${stageTitleSoutai(meet.stage)}（練習後に実行）`
        : `この週は【駅伝】があります：${stageTitleEkiden(meet.stage)}（練習後に実行）`)
    : "この週は大会なし";

  const yearText = isYearUpdateWeek(state)
    ? "この週の最後に【年度更新（引退/進級/新入生）】があります"
    : "";

  app.innerHTML = `
    <div class="card">
      <h2>ホーム</h2>
      <p>年：${state.year} / ${state.month}月 ${state.week}週</p>
      <p style="color:#555;">${meetText}</p>
      ${yearText ? `<p style="color:#b00;">${yearText}</p>` : ""}
      <p style="color:#555;">今週の練習：${state.lastTraining?.name ?? "未実施"}</p>

      <div class="row">
        <button id="training">練習</button>
        <button id="athletes">選手</button>
        <button id="next" ${state.trainingDoneThisWeek ? "" : "disabled"}>次の週へ</button>
        <button class="secondary" id="back">タイトルへ</button>
      </div>

      <p style="margin-top:10px;color:#777;">
        ※「次の週へ」は、今週の練習を選んだ後に押せます。
      </p>
    </div>
  `;

  document.querySelector("#training").onclick = () => renderTraining(state);
  document.querySelector("#athletes").onclick = () => renderAthletes(state);

  document.querySelector("#next").onclick = () => {
    ensureRivals(state);

    // 相手校は毎週裏で練習
    rivalsWeeklyTraining(state);

    const meet = getMeetOfWeek(state);

    if (meet?.type === "record") {
      const result = runRecordMeet(state);
      saveGame(state);
      renderRecordResult(state, result);
      return;
    }
    if (meet?.type === "soutai") {
      const result = runSoutai(state, meet.stage);
      saveGame(state);
      renderSoutaiResult(state, result);
      return;
    }
    if (meet?.type === "ekiden") {
      const result = runEkiden(state, meet.stage);
      saveGame(state);
      renderEkidenResult(state, result);
      return;
    }

    // 大会なし
    advanceWeek(state);

    // 年度更新（3月4週を終えた直後）
    if (isYearUpdateWeek({ ...state, week: 4 })) {
      // この分岐は不要に見えるので、下で確実に処理するため次ステップへ
    }

    resetWeekFlags(state);
    saveGame(state);

    // 週を進めた結果「いまが4/1」に戻ったとき（＝年度更新直後）を判定しやすくするため、
    // 年度更新は「3月4週の結果画面」で実行する方式にします（次の画面へ）
    renderHome(state);
  };

  document.querySelector("#back").onclick = () => renderTitle();
}

function renderTraining(state) {
  const buttons = TRAININGS.map(t => `<button data-id="${t.id}">${t.name}</button>`).join("");

  app.innerHTML = `
    <div class="card">
      <h2>練習</h2>
      <p style="color:#555;">どれか1つ選んでください（全選手に適用）</p>
      <div class="row">${buttons}</div>
      <div class="row" style="margin-top:12px;">
        <button class="secondary" id="home">戻る</button>
      </div>
    </div>
  `;

  app.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      applyTraining(state, id);
      saveGame(state);
      renderHome(state);
    };
  });

  document.querySelector("#home").onclick = () => renderHome(state);
}

function renderAthletes(state) {
  const rows = (state.athletes ?? []).map(a => `
    <tr>
      <td>${a.grade}</td>
      <td>${a.name}</td>
      <td>${a.personality}</td>
      <td>${a.abilities.sprint}</td>
      <td>${a.abilities.speed}</td>
      <td>${a.abilities.stamina}</td>
      <td>${a.abilities.toughness}</td>
      <td>${a.abilities.technique}</td>
      <td>${a.overall}</td>
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

// --- 結果画面（記録会/総体/駅伝） ---
function renderRecordResult(state, result) {
  const sections = ["1500", "3000", "5000"].map(ev => {
    const rows = result.playerOnly[ev].map(r => `
      <tr>
        <td>${r.overallRank}</td>
        <td>${r.athlete.name}</td>
        <td>${r.timeText}</td>
        <td>${r.groupIndex}</td>
        <td>${r.rankInGroup}</td>
      </tr>
    `).join("");

    return `
      <h3 style="margin-top:14px;">${ev}m（自校）</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:520px;">
          <thead>
            <tr><th>全体順位</th><th>選手</th><th>タイム</th><th>組</th><th>組順位</th></tr>
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
        <button id="nextWeek">次の週へ進む</button>
        <button class="secondary" id="home">ホームへ</button>
      </div>
    </div>
  `;

  document.querySelector("#nextWeek").onclick = () => goNextWeekFromResult(state);
  document.querySelector("#home").onclick = () => renderHome(state);
}

function renderSoutaiResult(state, result) {
  const evOrder = ["800", "1500", "3000sc", "5000", "5000w"];
  const sections = evOrder.map(ev => {
    const er = result.events[ev];
    let list = er.type === "withFinal" ? er.final : er.overall;
    const top = list.slice(0, 10).map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${x.school}</td>
        <td>${x.isPlayer ? "自校" : ""}</td>
        <td>${x.athlete.name}</td>
        <td>${x.timeText}</td>
      </tr>
    `).join("");

    return `
      <h3 style="margin-top:14px;">${eventLabel(ev)}</h3>
      <div style="overflow:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:560px;">
          <thead>
            <tr><th>順位</th><th>学校</th><th></th><th>選手</th><th>タイム</th></tr>
          </thead>
          <tbody>${top}</tbody>
        </table>
      </div>
      <p style="color:#777;margin:6px 0 0 0;">※上位10人のみ表示</p>
    `;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      <p style="color:#777;">※勝ち上がり判定は簡略版</p>
      ${sections}
      <div class="row" style="margin-top:14px;">
        <button id="nextWeek">次の週へ進む</button>
        <button class="secondary" id="home">ホームへ</button>
      </div>
    </div>
  `;

  document.querySelector("#nextWeek").onclick = () => goNextWeekFromResult(state);
  document.querySelector("#home").onclick = () => renderHome(state);
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

  app.innerHTML = `
    <div class="card">
      <h2>${result.title} 結果</h2>
      <p style="color:#555;">${result.when}</p>
      <p style="color:#555;">自校順位：${result.myRank}位 / 通過：${result.cleared ? "YES" : "NO"}（5位以内）</p>

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

      <div class="row" style="margin-top:14px;">
        <button id="nextWeek">次の週へ進む</button>
        <button class="secondary" id="home">ホームへ</button>
      </div>
    </div>
  `;

  document.querySelector("#nextWeek").onclick = () => goNextWeekFromResult(state);
  document.querySelector("#home").onclick = () => renderHome(state);
}

// 結果画面から週進行（年度更新もここで実行）
function goNextWeekFromResult(state) {
  // いまが3月4週だった場合、年度更新してから次週（4月1週）へ
  if (isYearUpdateWeek(state)) {
    runYearUpdate(state);
  }

  advanceWeek(state);
  resetWeekFlags(state);
  saveGame(state);
  renderHome(state);
}

function runYearUpdate(state) {
  // 3年生引退→進級→新入生5人
  const survivors = state.athletes.filter(a => a.grade !== 3);
  for (const a of survivors) a.grade += 1; // 1->2, 2->3

  // 新入生5人（state.js の createNewGameState と同等の生成が理想だが、簡略でここで生成）
  // 既存の state.js の createAthlete を使っていないので、最低限の形で追加する（大枠優先）
  const family = ["佐藤","鈴木","高橋","田中","伊藤","渡辺","山本","中村","小林","加藤"];
  const given = ["翔太","蓮","大翔","悠真","陽斗","蒼","大和","悠人","颯太","結翔"];
  function randName() { return `${family[Math.floor(Math.random()*family.length)]} ${given[Math.floor(Math.random()*given.length)]}`; }
  function personality() {
    const r = Math.random() * 100;
    if (r < 16) return "たんき";
    if (r < 32) return "せっかち";
    if (r < 48) return "おおらか";
    if (r < 64) return "がんこ";
    if (r < 80) return "きよう";
    if (r < 96) return "ふつう";
    return "てんさい";
  }
  function abil() {
    const min = 10, max = 40;
    return {
      sprint: randInt(min, max),
      speed: randInt(min, max),
      stamina: randInt(min, max),
      toughness: randInt(min, max),
      technique: randInt(min, max),
    };
  }
  function overall(ab) {
    return Math.round((ab.sprint + ab.speed + ab.stamina + ab.toughness + ab.technique) / 5);
  }

  const freshmen = [];
  for (let i = 0; i < 5; i++) {
    const ab = abil();
    freshmen.push({
      id: `1-${i}-${Math.random()}`,
      grade: 1,
      name: randName(),
      personality: personality(),
      abilities: ab,
      overall: overall(ab),
    });
  }

  state.athletes = freshmen.concat(survivors);
  state.year += 1;

  // 相手校も年度更新（簡略）
  rivalsYearUpdate(state);
}

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
