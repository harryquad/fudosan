// 不動産のお金サイトのツール一覧と共通の計算（このサイト専用。ほかのサイトとは別管理）
const TOOLS = [
  { path: "/fudosan/", name: "相続税 計算", desc: "相続税がかかるか、いくらになるかを家族構成から計算", group: "相続" },
  { path: "/fudosan/souzokubun/", name: "法定相続分 計算", desc: "誰がどれだけ相続するか（配偶者・子・親・兄弟姉妹）", group: "相続" },
  { path: "/fudosan/shokibo/", name: "小規模宅地等の特例 計算", desc: "自宅・事業・貸付の土地の相続税評価がいくら下がるか", group: "相続" },
  { path: "/fudosan/zouyo/", name: "贈与税 計算（暦年・相続時精算課税）", desc: "生前贈与の税金と、2つの方法の比較", group: "相続" },
  { path: "/fudosan/touki/", name: "相続登記の費用・期限", desc: "登録免許税の計算と、義務化された相続登記の期限", group: "相続" },
  { path: "/fudosan/tetsuzuki/", name: "相続手続き やることリスト", desc: "亡くなった日から、期限つきの手続きを一覧に", group: "相続" },
  { path: "/fudosan/baikyaku/", name: "不動産売却 手取り計算", desc: "仲介手数料・税金・特例を引いて、手元にいくら残るか", group: "売る" },
  { path: "/fudosan/chukai/", name: "仲介手数料 計算", desc: "売買価格から仲介手数料の上限（800万円以下の特例も）", group: "売る" },
  { path: "/fudosan/urukasu/", name: "実家 売る・貸す・持ち続ける 比較", desc: "空き家になった家を、どうするといちばん手元に残るか", group: "売る" },
  { path: "/fudosan/shohiyo/", name: "購入時の諸費用 計算", desc: "登録免許税・不動産取得税・印紙税・仲介手数料など", group: "買う・持つ" },
  { path: "/fudosan/koteishisan/", name: "固定資産税・都市計画税 計算", desc: "住宅用地の特例や新築住宅の減額を反映", group: "買う・持つ" },
  { path: "/fudosan/inshi/", name: "印紙税 計算（不動産売買・工事請負・ローン契約）", desc: "契約書に貼る印紙の金額（軽減措置対応）", group: "買う・持つ" },
  { path: "/fudosan/rimawari/", name: "不動産投資 利回り・キャッシュフロー 計算", desc: "表面利回り・実質利回りと、ローン返済後に残るお金", group: "投資" },
];

const MAN = 10000;
const yen = n => Math.round(n).toLocaleString("ja-JP") + "円";
const man = n => (Math.round(n / 1000) / 10).toLocaleString("ja-JP") + "万円";
const num = id => Math.max(0, Number(document.getElementById(id).value) || 0);
const floor100 = n => Math.max(0, Math.floor(n / 100) * 100);
const floor1000 = n => Math.max(0, Math.floor(n / 1000) * 1000);

// 相続税の速算表 [上限, 税率, 控除額]
const SOZOKU = [[1e7, .10, 0], [3e7, .15, 5e5], [5e7, .20, 2e6], [1e8, .30, 7e6], [2e8, .40, 1.7e7], [3e8, .45, 2.7e7], [6e8, .50, 4.2e7], [Infinity, .55, 7.2e7]];
const sozokuTax = x => { if (x <= 0) return 0; const [, r, d] = SOZOKU.find(b => x <= b[0]); return x * r - d; };

// 法定相続人と法定相続分
// p = { spouse: bool, children, parents, siblings }（子がいれば親・兄弟姉妹は相続人にならない）
function heirs(p) {
  const list = [];
  if (p.children > 0) {
    if (p.spouse) list.push({ who: "配偶者", share: 1 / 2 });
    for (let i = 0; i < p.children; i++) list.push({ who: `子${p.children > 1 ? i + 1 : ""}`, share: (p.spouse ? 1 / 2 : 1) / p.children });
  } else if (p.parents > 0) {
    if (p.spouse) list.push({ who: "配偶者", share: 2 / 3 });
    for (let i = 0; i < p.parents; i++) list.push({ who: `親${p.parents > 1 ? i + 1 : ""}`, share: (p.spouse ? 1 / 3 : 1) / p.parents });
  } else if (p.siblings > 0) {
    if (p.spouse) list.push({ who: "配偶者", share: 3 / 4 });
    for (let i = 0; i < p.siblings; i++) list.push({ who: `兄弟姉妹${p.siblings > 1 ? i + 1 : ""}`, share: (p.spouse ? 1 / 4 : 1) / p.siblings, add20: true });
  } else if (p.spouse) list.push({ who: "配偶者", share: 1 });
  return list;
}
const frac = x => { for (let d = 1; d <= 24; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return d === 1 ? `${n}` : `${n}/${d}`; } return (x * 100).toFixed(1) + "%"; };

// 印紙税（不動産の譲渡に関する契約書）[上限, 本則, 軽減]（軽減は2027年3月31日までに作成された契約書）
const INSHI_BAIBAI = [[9999, 0, 0], [100000, 200, 200], [500000, 400, 200], [1000000, 1000, 500], [5000000, 2000, 1000], [10000000, 10000, 5000],
  [50000000, 20000, 10000], [100000000, 60000, 30000], [500000000, 100000, 60000], [1000000000, 200000, 160000], [5000000000, 400000, 320000], [Infinity, 600000, 480000]];
// 建設工事の請負に関する契約書
const INSHI_KOJI = [[9999, 0, 0], [1000000, 200, 200], [2000000, 400, 200], [3000000, 1000, 500], [5000000, 2000, 1000], [10000000, 10000, 5000],
  [50000000, 20000, 10000], [100000000, 60000, 30000], [500000000, 100000, 60000], [1000000000, 200000, 160000], [5000000000, 400000, 320000], [Infinity, 600000, 480000]];
// 金銭消費貸借契約書（住宅ローンなど。軽減措置なし）
const INSHI_LOAN = [[9999, 0], [100000, 200], [500000, 400], [1000000, 1000], [5000000, 2000], [10000000, 10000], [50000000, 20000],
  [100000000, 60000], [500000000, 100000], [1000000000, 200000], [5000000000, 400000], [Infinity, 600000]];
const inshi = (table, amount, reduced = true) => { const row = table.find(r => amount <= r[0]); return reduced && row.length > 2 ? row[2] : row[1]; };

// 仲介手数料の上限（税込）。lowPrice: 800万円以下の空き家等の特例（上限30万円＋税）を使うか
function chukai(price, lowPrice = false) {
  let fee = price <= 2000000 ? price * 0.05 : price <= 4000000 ? price * 0.04 + 20000 : price * 0.03 + 60000;
  if (lowPrice && price <= 8000000) fee = Math.max(fee, 300000);
  return Math.floor(fee * 1.1);
}

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("related");
  if (!el) return;
  const here = location.pathname.replace(/index\.html$/, "");
  const groups = [...new Set(TOOLS.map(t => t.group))];
  el.innerHTML = `<h2>ほかのツール</h2>` + groups.map(g => `<h3 style="font-size:.95rem;margin:12px 0 6px;color:var(--muted)">${g}</h3><ul class="tools">${TOOLS.filter(t => t.group === g && t.path !== here)
    .map(t => `<li><a href="${t.path}"><b>${t.name}</b><span>${t.desc}</span></a></li>`).join("")}</ul>`).join("");
});
