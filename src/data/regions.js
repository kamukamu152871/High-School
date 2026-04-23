// ブロック（地域総体／地域駅伝）定義
// ※方針B（裏大会完全再現）で、都道府県→ブロック所属を判定するために使用

export const BLOCKS = {
  tohoku: {
    key: "tohoku",
    name: "東北",
    prefectures: ["青森", "岩手", "宮城", "山形", "福島", "秋田"],
  },
  north_kanto: {
    key: "north_kanto",
    name: "北関東",
    prefectures: ["山梨", "群馬", "栃木", "茨城"],
  },
  south_kanto: {
    key: "south_kanto",
    name: "南関東",
    prefectures: ["千葉", "埼玉", "東京", "神奈川"],
  },
  hokushinetsu: {
    key: "hokushinetsu",
    name: "北信越",
    prefectures: ["新潟", "長野", "富山", "石川", "福井"],
  },
  tokai: {
    key: "tokai",
    name: "東海",
    prefectures: ["愛知", "三重", "静岡", "岐阜"],
  },
  kinki: {
    key: "kinki",
    name: "近畿",
    prefectures: ["兵庫", "大阪", "京都", "和歌山", "滋賀", "奈良"],
  },
  chugoku: {
    key: "chugoku",
    name: "中国",
    prefectures: ["鳥取", "島根", "岡山", "広島", "山口"],
  },
  shikoku: {
    key: "shikoku",
    name: "四国",
    prefectures: ["香川", "高知", "愛媛", "徳島"],
  },
  north_kyushu: {
    key: "north_kyushu",
    name: "北九州",
    prefectures: ["福岡", "大分", "佐賀", "長崎"],
  },
  south_kyushu: {
    key: "south_kyushu",
    name: "南九州",
    prefectures: ["熊本", "宮崎", "鹿児島", "沖縄"],
  },
};

// 北海道は「全国総体に北海道の県総体」扱いがあるので、ブロックには含めない前提
export const SPECIAL_PREFECTURES = {
  hokkaido: { key: "hokkaido", name: "北海道" },
};

// 都道府県名（日本語）→ブロックキー
export function blockKeyOfPrefecture(prefName) {
  if (!prefName) return null;
  if (prefName === "北海道") return null;

  for (const b of Object.values(BLOCKS)) {
    if (b.prefectures.includes(prefName)) return b.key;
  }
  return null;
}

// ブロックキー→表示名
export function blockName(blockKey) {
  if (!blockKey) return "";
  if (BLOCKS[blockKey]) return BLOCKS[blockKey].name;
  return String(blockKey);
}