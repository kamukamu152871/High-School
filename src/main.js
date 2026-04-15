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
        <button id="next">次の週へ</button>
        <button class="secondary" id="back">タイトルへ</button>
      </div>
    </div>
  `;

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

renderTitle();
