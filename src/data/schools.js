// 学校データの編集点
// - 兵庫県：7地区（神戸/阪神/東播/西播/丹有/但馬/淡路）
// - 兵庫以外：全都道府県ぶんを明示的に記述
// - 各校は { name, level }（level: 1..4）
//
// このファイルを編集すれば、全高校の名前とレベルを変更できます。

export const HYOGO_DISTRICTS = [
  { key: "kobe", name: "神戸" },
  { key: "hanshin", name: "阪神" },
  { key: "toban", name: "東播" },
  { key: "seiban", name: "西播" },
  { key: "tanyu", name: "丹有" },
  { key: "tajima", name: "但馬" },
  { key: "awaji", name: "淡路" },
];

// 兵庫県：地区別の学校リスト（仮名＆仮レベル）
// ※ここを自由に編集してOK
export const HYOGO_SCHOOLS_BY_DISTRICT = {
  kobe: [
    { name: "須磨学園", level: 4 },
    { name: "神港学園", level: 3 },
    { name: "長田", level: 2 },
    { name: "神戸", level: 2},
    { name: "兵庫", level: 2 },
    { name: "夢野台高校", level: 1 },
 　 { name: "北須磨高校", level: 1 },
  　{ name: "御影高校", level: 1 },
  　{ name: "神戸商業高校", level: 2 },
 　 { name: "須磨東高校", level: 1 },
  　{ name: "神戸北高校", level: 1 },
  　{ name: "彩星工科高校", level: 1 },
  　{ name: "舞子高校", level: 1 },
  　{ name: "高塚高校", level: 1 },
  　{ name: "葺合高校", level: 1 },
 　 { name: "須磨翔風高校", level: 1 },
  　{ name: "須磨友が丘高校", level: 1 },
  　{ name: "滝川高校", level: 1 },
  　{ name: "六甲高校", level: 1 },
  　{ name: "神戸龍谷高校", level: 1 },

    
  ],
  hanshin: [
    { name: "報徳", level: 3 },
    { name: "市立西宮", level: 3 },
    { name: "県立伊丹", level: 2 },
    { name: "西宮東", level: 1 },
    { name: "宝塚", level: 1 },
    { name: "県立西宮", level: 1 },
    { name: "関学付属", level: 1 },
    { name: "県立尼崎", level: 1 },
    { name: "伊丹西", level: 1 },
    { name: "川西緑台", level: 1 },
    { name: "尼崎稲園", level: 1 },
    { name: "伊丹北", level: 1 },
    { name: "市立尼崎", level: 1 },
    { name: "宝塚北", level: 1 },
    { name: "西宮北苦楽園", level: 1 },
    { name: "雲雀丘", level: 1 },

  ],
  toban: [
    { name: "西脇工業", level: 4 },
    { name: "東播磨", level: 2 },
    { name: "小野", level: 2 },
    { name: "加古川東", level: 1 },
    { name: "明石北", level: 2 },
    { name: "明石清水", level: 2 },
    { name: "明石高専", level: 1 },
    { name: "高砂", level: 1 },
    { name: "明石", level: 1 },
    { name: "西脇", level: 1 },
    { name: "東播工業", level: 1 },
    { name: "明石城西", level: 1 },
    { name: "明石西", level: 2 },
    { name: "明石南", level: 1 },
  ],
  seiban: [
    { name: "姫路商業", level: 2 },
    { name: "龍野", level: 2 },
    { name: "姫路西", level: 2 },
    { name: "龍野北", level: 1 },
    { name: "姫路", level: 1 },
    { name: "姫路工業", level: 1 },
    { name: "飾磨工業", level: 1 },
    { name: "姫路東", level: 1 },
    { name: "播磨夢福", level: 1 },
    { name: "赤穂", level: 1 },
    { name: "姫路飾西", level: 1 },
    { name: "東洋大姫路", level: 1 },
  ],
  tanyu: [
    { name: "三田", level: 2 },
    { name: "北摂三田", level: 2 },
    { name: "三田祥雲館", level: 1 },
    { name: "柏原", level: 1 },
    { name: "有馬", level: 1 },
    { name: "篠山鳳鳴", level: 1 },
  ],
  tajima: [
    { name: "豊岡", level: 1 },
    { name: "近大豊岡", level: 1 },
    { name: "豊岡総合", level: 1 },
    { name: "八鹿", level: 1 },
  ],
  awaji: [
    { name: "洲本", level: 1 },
    { name: "淡路三原", level: 1 },
    { name: "洲本実業", level: 1 },
    { name: "津名", level: 1 },
  ],
};

// 兵庫以外の都道府県リスト（北海道は別扱い）
export const PREFECTURES_EXCEPT_HYOGO_AND_HOKKAIDO = [
  "青森", "岩手", "宮城", "山形", "福島", "秋田",
  "山梨", "群馬", "栃木", "茨城",
  "千葉", "埼玉", "東京", "神奈川",
  "新潟", "長野", "富山", "石川", "福井",
  "愛知", "三重", "静岡", "岐阜",
  "大阪", "京都", "和歌山", "滋賀", "奈良",
  "鳥取", "島根", "岡山", "広島", "山口",
  "香川", "高知", "愛媛", "徳島",
  "福岡", "大分", "佐賀", "長崎",
  "熊本", "宮崎", "鹿児島", "沖縄",
];

// 都道府県ごとの学校
// - 北海道：10校
// - その他：5校
// ※名前もレベルも自由に編集してOK
export const PREFECTURE_SCHOOLS = {
  "北海道": [
    { name: "札幌山の手", level: 4 },
    { name: "東海大札幌", level: 3 },
    { name: "白樺学園", level: 3 },
    { name: "北海道栄", level: 3 },
    { name: "札幌日大", level: 2 },
    { name: "北見北斗", level: 1},
    { name: "滝川西", level: 1 },
    { name: "函館中部", level: 1 },
    { name: "北見柏陽", level: 1 },
    { name: "北広島", level: 1 },
  ],
  "青森": [
    { name: "青森山田", level: 4 },
    { name: "八戸学院光星", level: 3 },
    { name: "八戸西", level: 1 },
    { name: "三沢", level: 1 },
    { name: "弘前中央", level: 1 },
    { name: "弘前", level: 1 },
    
  ],
  "岩手": [
    { name: "一関学院", level: 3 },
    { name: "盛大付属", level: 3 },
    { name: "花巻東", level: 3 },
    { name: "盛岡第一", level: 1 },
    { name: "花巻北", level: 2 },
    { name: "大舟渡", level: 1 },
    
  ],
  "宮城": [
    { name: "東北", level: 3 },
    { name: "仙台育英", level: 4 },
    { name: "利府", level: 3 },
    { name: "聖和学園", level: 3 },
    { name: "仙台二", level: 2 },
    { name: "仙台大明成", level: 2 },
  ],
  "山形": [
    { name: "酒田南", level: 3 },
    { name: "山形中央", level: 3 },
    { name: "東海大山形", level: 3 },
    { name: "山形南", level: 1 },
    { name: "九里学園", level: 1 },
    { name: "米沢中央", level: 1 },
  ],
  "福島": [
    { name: "学法石川", level: 4 },
    { name: "田村", level: 3 },
    { name: "帝京安積", level: 3 },
    { name: "いわき集英", level: 3 },
    { name: "ザベリオ学園", level: 3 },
    { name: "日大東北", level: 2 },
  ],
  "秋田": [
    { name: "秋田工業", level: 3 },
    { name: "大曲工業", level: 2 },
    { name: "鹿角", level: 2 },
    { name: "秋田中央", level: 1 },
    { name: "秋田", level: 1 },
    { name: "金足農業", level: 1 },
  ],
  "山梨": [
    { name: "山梨学院", level: 3 },
    { name: "笛吹", level: 1 },
    { name: "東海大甲府", level: 1 },
    { name: "韮崎", level: 1 },
    { name: "甲府工業", level: 1 },
    { name: "富士学苑", level: 1 },
  ],
  "群馬": [
    { name: "農大二", level: 4 },
    { name: "前橋育英", level: 3 },
    { name: "樹徳", level: 3 },
    { name: "健大高崎", level: 3 },
    { name: "富岡", level: 3 },
    { name: "桐生工業", level: 2 },
  ],
  "栃木": [
    { name: "作新学院", level: 3 },
    { name: "佐野日大", level: 3 },
    { name: "那須柘陽", level: 3 },
    { name: "文星芸大付属", level: 3 },
    { name: "宇都宮", level: 1 },
    { name: "小山", level: 1 },
  ],
  "茨城": [
    { name: "東洋大牛久", level: 4 },
    { name: "水城", level: 4 },
    { name: "鹿島学園", level: 3 },
    { name: "水戸菱陵", level: 3 },
    { name: "土浦日大", level: 3 },
    { name: "日立一", level: 2 },
  ],
  "千葉": [
    { name: "市立船橋", level: 4 },
    { name: "八千代松陰", level: 4 },
    { name: "西武台千葉", level: 3 },
    { name: "専修大松戸", level: 3 },
    { name: "市立松戸", level: 3 },
    { name: "流経大柏", level: 3 },
  ],
  "埼玉": [
    { name: "埼玉栄", level: 3 },
    { name: "花咲徳栄", level: 3 },
    { name: "武蔵越生", level: 3 },
    { name: "春日部", level: 3 },
    { name: "東京農大三", level: 3 },
    { name: "浦和実業", level: 3 },
  ],
  "東京": [
    { name: "柘大一", level: 4 },
    { name: "駒大高", level: 3 },
    { name: "東京実業", level: 3 },
    { name: "国学院久我山", level: 3 },
    { name: "城西", level: 3 },
    { name: "東京", level: 3 },
  ],
  "神奈川": [
    { name: "東海大相模", level: 4 },
    { name: "川崎市立橘", level: 4 },
    { name: "相洋", level: 3 },
    { name: "光明相模原", level: 3 },
    { name: "法制二", level: 3 },
    { name: "湘南工大付属", level: 3 },
  ],
  "新潟": [
    { name: "中越", level: 3 },
    { name: "日本文理", level: 3 },
    { name: "開志国際", level: 3 },
    { name: "十日町", level: 3 },
    { name: "佐渡", level: 3 },
    { name: "帝京長岡", level: 3 },
  ],
  "長野": [
    { name: "佐久長聖", level: 4 },
    { name: "長野日大", level: 3 },
    { name: "上伊那農業", level: 3 },
    { name: "上田西", level: 1 },
    { name: "伊那北", level: 1 },
    { name: "中野立志舘", level: 1 },
  ],
  "富山": [
    { name: "高岡向陵", level: 3 },
    { name: "富山商行", level: 3 },
    { name: "富山中部", level: 1 },
    { name: "高岡商業", level: 1 },
    { name: "龍谷富山", level: 1 },
    { name: "魚津", level: 1 },
  ],
  "石川": [
    { name: "遊学館", level: 3 },
    { name: "金沢学大付属", level: 2 },
    { name: "星稜", level: 1 },
    { name: "石川高専", level: 1 },
    { name: "小松", level: 1 },
    { name: "金沢泉丘", level: 1 },
  ],
  "福井": [
    { name: "美方", level: 3 },
    { name: "敦賀気比", level: 3 },
    { name: "鯖江", level: 3 },
    { name: "羽水", level: 1 },
    { name: "武生", level: 1 },
    { name: "若狭", level: 1 },
  ],
  "愛知": [
    { name: "豊川", level: 4 },
    { name: "豊田大谷", level: 3 },
    { name: "愛知", level: 3 },
    { name: "名経大高蔵", level: 3 },
    { name: "中京大中京", level: 3 },
    { name: "豊橋南", level: 3},
  ],
  "三重": [
    { name: "稲生", level: 3 },
    { name: "伊賀白鷗", level: 3 },
    { name: "四日市工業", level: 3 },
    { name: "高田", level: 2 },
    { name: "海星", level: 1 },
    { name: "四日市", level: 1 },
  ],
  "静岡": [
    { name: "浜松日体", level: 3 },
    { name: "藤枝明誠", level: 3 },
    { name: "浜松工業", level: 3 },
    { name: "加藤学園", level: 3 },
    { name: "浜松開誠館", level: 3 },
    { name: "東海大静岡翔洋", level: 3 },
  ],
  "岐阜": [
    { name: "美濃加茂", level: 4 },
    { name: "中京", level: 3 },
    { name: "高山西", level: 3 },
    { name: "大垣日大", level: 3 },
    { name: "県岐阜商業", level: 3 },
    { name: "岐阜", level: 3 },
  ],
  "大阪": [
    { name: "興國", level: 4 },
    { name: "関大北陽", level: 3 },
    { name: "関大創価", level: 3 },
    { name: "清風", level: 3 },
    { name: "大阪", level: 3 },
    { name: "大阪学芸", level: 3 },
  ],
  "京都": [
    { name: "洛南", level: 4 },
    { name: "洛北", level: 3 },
    { name: "京都外大西", level: 3 },
    { name: "桂", level: 3 },
    { name: "京産大付属", level: 3 },
    { name: "乙訓", level: 3 },
  ],
  "和歌山": [
    { name: "和歌山北", level: 3 },
    { name: "智辯和歌山", level: 3 },
    { name: "田辺", level: 1 },
    { name: "高野山", level: 1 },
    { name: "近大和歌山", level: 1 },
    { name: "向陽", level: 1 },
  ],
  "滋賀": [
    { name: "滋賀学園", level: 3 },
    { name: "草津東", level: 3 },
    { name: "大津商業", level: 3 },
    { name: "比叡山", level: 3 },
    { name: "水口東", level: 2 },
    { name: "彦根翔西館", level: 1 },
  ],
  "奈良": [
    { name: "智辯カレッジ", level: 3 },
    { name: "奈良育英", level: 3 },
    { name: "奈良", level: 1 },
    { name: "添上", level: 1 },
    { name: "橿原", level: 1 },
    { name: "畝傍", level: 1 },
  ],
  "鳥取": [
    { name: "鳥取城北", level: 4 },
    { name: "米子松蔭", level: 3 },
    { name: "八頭", level: 2 },
    { name: "鳥取中央育英", level: 1 },
    { name: "鳥取東", level: 1 },
    { name: "境", level: 1 },
  ],
  "島根": [
    { name: "平田", level: 3 },
    { name: "浜田商業", level: 1 },
    { name: "開星", level: 1 },
    { name: "松江高専", level: 1 },
    { name: "出雲工業", level: 1 },
    { name: "大社", level: 1 },
  ],
  "岡山": [
    { name: "倉敷", level: 4 },
    { name: "玉野光南", level: 3 },
    { name: "岡山商大付属", level: 3 },
    { name: "倉敷南", level: 1 },
    { name: "玉島商業", level: 1 },
    { name: "就実", level: 1 },
  ],
  "広島": [
    { name: "世羅", level: 3 },
    { name: "西条農業", level: 3 },
    { name: "広島国際学院", level: 3 },
    { name: "沼田", level: 2 },
    { name: "千代田", level: 2 },
    { name: "舟入", level: 2 },
  ],
  "山口": [
    { name: "宇部鴻城", level: 3 },
    { name: "西京", level: 3 },
    { name: "高川学園", level: 3 },
    { name: "南陽工業", level: 2 },
    { name: "山口", level: 1 },
    { name: "萩", level: 1 },
  ],
  "香川": [
    { name: "四学香川西", level: 3 },
    { name: "高松工芸", level: 2 },
    { name: "英明", level: 2 },
    { name: "尽誠学園", level: 1 },
    { name: "小豆島中央", level: 1 },
    { name: "観音寺総合", level: 1 },
  ],
  "高知": [
    { name: "高知農業", level: 3 },
    { name: "高知工業", level: 3 },
    { name: "高知商業", level: 1 },
    { name: "高知港線", level: 1 },
    { name: "高知国際", level: 1 },
  ],
  "愛媛": [
    { name: "今治北", level: 3 },
    { name: "宇和", level: 3 },
    { name: "松山商業", level: 3 },
    { name: "新居浜東", level: 2 },
    { name: "八幡浜", level: 2 },
    { name: "新居浜西", level: 1 },
  ],
  "徳島": [
    { name: "つるぎ", level: 3 },
    { name: "徳島科学技術", level: 3 },
    { name: "鳴門", level: 2 },
    { name: "小松島西", level: 2 },
    { name: "富岡西", level: 1 },
    { name: "富岡東", level: 1 },
  ],
  "福岡": [
    { name: "福岡第一", level: 3 },
    { name: "飯塚", level: 3 },
    { name: "自由が丘", level: 3 },
    { name: "純真", level: 3 },
    { name: "希望ヶ丘", level: 3 },
    { name: "九州国際大付属", level: 3 },
  ],
  "大分": [
    { name: "大分東明", level: 3 },
    { name: "藤蔭高", level: 3 },
    { name: "鶴崎工業", level: 2 },
    { name: "杵築", level: 1 },
    { name: "大分舞鶴", level: 1 },
    { name: "臼杵", level: 1 },

  ],
  "佐賀": [
    { name: "鳥栖工業", level: 4 },
    { name: "白石", level: 3 },
    { name: "唐津工業", level: 2 },
    { name: "早稲田佐賀", level: 2 },
    { name: "唐津東", level: 1 },
    { name: "佐賀工業", level: 1 },
  ],
  "長崎": [
    { name: "鎮西学院", level: 3 },
    { name: "長崎日大", level: 3 },
    { name: "瓊浦", level: 3 },
    { name: "九州文化学園", level: 2 },
    { name: "創成館", level: 2 },
    { name: "五島", level: 2 },
  ],
  "熊本": [
    { name: "九州学院", level: 4 },
    { name: "熊本工業", level: 3 },
    { name: "千原台", level: 3 },
    { name: "慶誠", level: 3},
    { name: "開新", level: 3 },
    { name: "熊本国府", level: 2 },
  ],
  "宮崎": [
    { name: "小林", level: 4 },
    { name: "宮崎日大", level: 3 },
    { name: "都城工業", level: 1 },
    { name: "宮崎西", level: 1 },
    { name: "日章学園", level: 1 },
    { name: "宮崎工業", level: 1 },
  ],
  "鹿児島": [
    { name: "鹿児島城西", level: 3 },
    { name: "鹿児島実業", level: 3 },
    { name: "鹿児島工業", level: 3 },
    { name: "樟南", level: 3 },
    { name: "鳳凰", level: 3 },
    { name: "鹿児島", level: 3 },
  ],
  "沖縄": [
    { name: "北山", level: 3 },
    { name: "那覇西", level: 3 },
    { name: "エタジック", level: 2 },
    { name: "名護", level: 1},
    { name: "糸満", level: 1 },
    { name: "宮古", level: 1 },

  ],
};

// ---- 参照しやすい形に整形するユーティリティ ----

// 兵庫：地区キー→学校配列
export function hyogoSchoolsByDistrictKey(key) {
  return HYOGO_SCHOOLS_BY_DISTRICT[key] ?? [];
}

// 兵庫：全学校（地区ラベル付き）
export function allHyogoSchools() {
  const out = [];
  for (const d of HYOGO_DISTRICTS) {
    for (const s of (HYOGO_SCHOOLS_BY_DISTRICT[d.key] ?? [])) {
      out.push({ ...s, prefecture: "兵庫", districtKey: d.key, districtName: d.name });
    }
  }
  return out;
}

// 県：学校配列
export function schoolsOfPrefecture(prefName) {
  return (PREFECTURE_SCHOOLS[prefName] ?? []).map(s => ({ ...s, prefecture: prefName }));
}

// 全国：全学校（兵庫含む）
export function allSchoolsJapan() {
  const out = [];
  out.push(...allHyogoSchools());
  out.push(...schoolsOfPrefecture("北海道"));
  for (const pref of PREFECTURES_EXCEPT_HYOGO_AND_HOKKAIDO) out.push(...schoolsOfPrefecture(pref));
  return out;
<<<<<<< HEAD
}
=======
}
>>>>>>> aaa7795231caf1858ae34576ba7228ae7a907856
