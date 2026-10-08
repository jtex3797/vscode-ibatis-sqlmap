// 예제 미리보기: samples/ 의 예제를 내장 XML 문법만으로, 그리고 이 확장을 주입해 칠한 결과를 나란히 보이는 HTML 1장 생성(README 전후 그림용)
// 사용: node tools/preview.js [--app <IDE resources/app>] [--out <html>]  (기본 tools/out/preview.html, 미추적)
// 색은 IDE 번들 테마(Dark Modern·Light Modern, include 사슬 병합)를 vscode-textmate 에 그대로 넣어 얻음
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const APP_CANDIDATES = [
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Antigravity IDE", "resources", "app"),
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "resources", "app"),
  "/Applications/Visual Studio Code.app/Contents/Resources/app",
  "/usr/share/code/resources/app",
];
const APP = opt("--app") || APP_CANDIDATES.find((p) => fs.existsSync(path.join(p, "node_modules", "vscode-textmate"))) || APP_CANDIDATES[0];
const OUT = path.resolve(opt("--out") || path.join(ROOT, "tools", "out", "preview.html"));

const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, "syntaxes", "sqlmap-sql.injection.json"), "utf8"));

// 탭 = samples/ 의 예제 파일. 왼쪽은 내장 XML 문법만, 오른쪽은 이 확장을 주입한 결과
const TABS = fs.readdirSync(path.join(ROOT, "samples")).filter((f) => f.endsWith(".xml")).sort().map((f) => ({
  id: f.replace(/\W/g, "_"), label: f,
  lines: fs.readFileSync(path.join(ROOT, "samples", f), "utf8").replace(/\r\n/g, "\n").trimEnd().split("\n"),
}));

function loadTheme(file) {
  const dir = path.join(APP, "extensions", "theme-defaults", "themes");
  const chain = [];
  for (let f = file; f; ) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    chain.unshift(t);
    f = t.include ? path.basename(t.include) : null;
  }
  const colors = Object.assign({}, ...chain.map((t) => t.colors || {}));
  const tokenColors = [].concat(...chain.map((t) => t.tokenColors || []));
  return {
    bg: colors["editor.background"], fg: colors["editor.foreground"],
    raw: { name: file, settings: [{ settings: { foreground: colors["editor.foreground"], background: colors["editor.background"] } }, ...tokenColors] },
  };
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  const rel = (...p) => path.join(APP, "node_modules", ...p);
  const tm = require(rel("vscode-textmate", "release", "main.js"));
  const on = require(rel("vscode-oniguruma", "release", "main.js"));
  const b = fs.readFileSync(rel("vscode-oniguruma", "release", "onig.wasm"));
  await on.loadWASM(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const onigLib = Promise.resolve({ createOnigScanner: (p) => new on.OnigScanner(p), createOnigString: (s) => new on.OnigString(s) });
  const xmlPj = path.join(APP, "extensions", "xml", "package.json");
  const xmlG = JSON.parse(fs.readFileSync(xmlPj, "utf8")).contributes.grammars.find((g) => g.scopeName === "text.xml");
  const xmlRaw = fs.readFileSync(path.join(APP, "extensions", "xml", xmlG.path), "utf8");

  const themes = { dark: loadTheme("dark_modern.json"), light: loadTheme("light_modern.json") };

  // 문법 하나 × 테마 하나로 줄마다 [글자, 색, 글꼴] 목록
  async function paint(grammarJson, lines, theme) { // grammarJson 이 null 이면 주입 없음
    const reg = new tm.Registry({
      onigLib,
      loadGrammar: async (scope) => (scope === "text.xml" ? JSON.parse(xmlRaw) : grammarJson && scope === grammarJson.scopeName ? JSON.parse(JSON.stringify(grammarJson)) : null),
      getInjections: (scope) => (grammarJson && scope === "text.xml" ? [grammarJson.scopeName] : []),
    });
    reg.setTheme(theme.raw);
    const cmap = reg.getColorMap();
    const g = await reg.loadGrammar("text.xml");
    let st = tm.INITIAL;
    return lines.map((ln) => {
      const r = g.tokenizeLine2(ln, st); st = r.ruleStack;
      const out = [];
      for (let i = 0; i < r.tokens.length; i += 2) {
        const s = r.tokens[i], e = i + 2 < r.tokens.length ? r.tokens[i + 2] : ln.length, m = r.tokens[i + 1];
        out.push([ln.slice(s, e), cmap[(m & 16744448) >>> 15], (m & 30720) >>> 11]);
      }
      return out;
    });
  }

  const html = (rows, other) => rows.map((toks, i) => {
    const changed = other && JSON.stringify(toks.map((t) => [t[1], t[2]]).filter((_, k) => /\S/.test(toks[k][0]))) !== JSON.stringify(other[i].map((t) => [t[1], t[2]]).filter((_, k) => /\S/.test(other[i][k][0])));
    const body = toks.map(([t, c, f]) => "<span style=\"color:" + c + (f & 1 ? ";font-style:italic" : "") + (f & 2 ? ";font-weight:bold" : "") + "\">" + esc(t.replace(/\t/g, "    ")) + "</span>").join("");
    return "<div class=\"ln" + (changed ? " ch" : "") + "\"><i>" + (i + 1) + "</i>" + (body || " ") + "</div>";
  }).join("");

  const panes = {};
  for (const mode of ["dark", "light"]) {
    for (const tab of TABS) {
      const before = await paint(null, tab.lines, themes[mode]);
      const after = await paint(BASE, tab.lines, themes[mode]);
      panes[mode + tab.id] = { before: html(before, null), after: html(after, before), changed: after.filter((r, i) => JSON.stringify(r) !== JSON.stringify(before[i])).length };
    }
  }

  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>sqlMap SQL 미리보기</title>
<style>
:root{--bgD:${themes.dark.bg};--fgD:${themes.dark.fg};--bgL:${themes.light.bg};--fgL:${themes.light.fg}}
body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#111;color:#ddd}
body.light{background:#eee;color:#222}
header{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 16px;position:sticky;top:0;background:inherit;border-bottom:1px solid #8884}
button{font:inherit;padding:4px 10px;border-radius:6px;border:1px solid #8886;background:transparent;color:inherit;cursor:pointer}
button.on{background:#0078d4;color:#fff;border-color:#0078d4}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px 24px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
.pane h3{margin:4px 0;font-size:13px;font-weight:600}
pre{margin:0;padding:8px 0;border-radius:6px;overflow-x:auto;font:13px/1.45 Consolas,"Cascadia Mono",monospace}
.dark pre{background:var(--bgD);color:var(--fgD)} .light pre{background:var(--bgL);color:var(--fgL)}
.ln{white-space:pre;padding:0 10px 0 0;border-left:3px solid transparent}
.ln.ch{border-left-color:#f0a020}
.ln i{display:inline-block;width:3em;text-align:right;margin-right:10px;color:#888;font-style:normal;user-select:none}
.sp{flex:1}
.pane{min-width:0}
.shot header,.shot small{display:none} .shot .grid{padding-top:12px} .shot .ln.ch{border-left-color:transparent}
</style></head><body class="dark"><header>
${TABS.map((t, i) => `<button data-tab="${t.id}"${i ? "" : " class=\"on\""}>${t.label}</button>`).join("")}
<span class="sp"></span><button id="mode">Light</button></header>
<div class="grid"><div class="pane"><h3>Without the extension (built-in XML grammar)</h3><pre id="before"></pre></div><div class="pane"><h3>With the extension <small id="cnt"></small></h3><pre id="after"></pre></div></div>
<script>
// #shot: README 그림용(상단 버튼·변경 표시 숨김). #shot-light 는 밝은 테마, =17-48 처럼 줄 범위를 주면 그 줄만
const P=${JSON.stringify(panes)};const SHOT=/^#shot(-light)?(?:=(\\d+)-(\\d+))?$/.exec(location.hash);
let tab="${TABS[0].id}",mode=SHOT&&SHOT[1]?"light":"dark";
function show(){const p=P[mode+tab];document.getElementById("before").innerHTML=p.before;document.getElementById("after").innerHTML=p.after;
if(SHOT&&SHOT[2])document.querySelectorAll("pre").forEach(pre=>[...pre.children].forEach((d,i)=>{if(i+1<+SHOT[2]||i+1>+SHOT[3])d.style.display="none"}));
document.getElementById("cnt").textContent="("+p.changed+" lines changed, marked orange)";
document.body.className=mode+(SHOT?" shot":"");document.getElementById("mode").textContent=mode==="dark"?"Light":"Dark";
document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab));}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;show();});
document.getElementById("mode").onclick=()=>{mode=mode==="dark"?"light":"dark";show();};
show();
</script></body></html>`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, page);
  console.log("생성: " + OUT);
  for (const t of TABS) console.log("  " + t.label + ": 바뀐 줄 " + panes["dark" + t.id].changed + " / " + t.lines.length);
}

main().catch((e) => { console.error(e); process.exit(2); });
