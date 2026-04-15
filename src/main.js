import { createNewGameState, saveGame, loadGame, clearSave } from "./state.js";

const app = document.querySelector("#app");

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
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#cont").onclick = () => {
    const state = loadGame();
    if (state) renderHome(state);
  };

  document.querySelector("#reset").onclick = () => {
    clearSave();
    renderTitle();
  };
}

function renderHome(state) {
  app.innerHTML = `
    <div class="card">
      <h2>ホーム</h2>
      <p>年：${state.year} / ${state.month}月 ${state.week}週</p>
      <div class="row">
        <button id="athletes">選手</button>
        <button id="next">次の週へ</button>
        <button class="secondary" id="back">タイトルへ</button>
      </div>
    </div>
  `;

  document.querySelector("#athletes").onclick = () => renderAthletes(state);

  document.querySelector("#next").onclick = () => {
    state.week += 1;
    if (state.week > 4) {
      state.week = 1;
      state.month += 1;
      if (state.month > 12) state.month = 1;
    }
    saveGame(state);
    renderHome(state);
  };

  document.querySelector("#back").onclick = () => renderTitle();
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
      <p style="color:#555;margin-top:8px;">
        ※スマホでは表が横スクロールになります。
      </p>
    </div>
  `;

  document.querySelector("#home").onclick = () => renderHome(state);
}

renderTitle();
