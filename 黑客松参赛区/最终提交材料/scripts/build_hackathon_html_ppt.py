from __future__ import annotations

import html
import re
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
FINAL_DIR = ROOT / "黑客松参赛区" / "最终提交材料"
REQ_DIR = ROOT / "黑客松参赛区" / "修改要求及素材"
SKILL_DIR = ROOT / ".external" / "frontend-slides-editable"
REFERENCE_HTML = SKILL_DIR / "examples" / "editable-deck-reference.html"
ASSET_DIR = FINAL_DIR / "html-ppt-assets"
OUT_HTML = FINAL_DIR / "篮球技术台自动化_黑客松演示.html"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    names = ["msyhbd.ttc", "simhei.ttf"] if bold else ["msyh.ttc", "simhei.ttf"]
    for name in names + ["arial.ttf"]:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def resize_image(src: Path, dst: Path, max_width: int = 1600) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as img:
        img = img.convert("RGB")
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
        img.save(dst, quality=88, optimize=True)


def fit_image(img: Image.Image, box: tuple[int, int], bg: str = "#f6f1e8") -> Image.Image:
    img = img.convert("RGB")
    canvas = Image.new("RGB", box, bg)
    ratio = min(box[0] / img.width, box[1] / img.height)
    size = (int(img.width * ratio), int(img.height * ratio))
    resized = img.resize(size, Image.LANCZOS)
    canvas.paste(resized, ((box[0] - size[0]) // 2, (box[1] - size[1]) // 2))
    return canvas


def make_grassroots_sketch(dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    w, h = 1400, 850
    img = Image.new("RGB", (w, h), "#f5f0e6")
    draw = ImageDraw.Draw(img)
    title = font(62, True)
    label = font(38, True)
    body = font(30)
    small = font(24)
    ink = "#18222f"
    red = "#e15038"
    green = "#078f71"
    gray = "#b8aa96"

    draw.text((70, 55), "基层篮球赛常见技术台", font=title, fill=ink)
    draw.text((72, 135), "一块翻分牌 + 一张难读的记录表 + 一名临时技术员", font=body, fill="#6b6257")
    draw.rounded_rectangle((62, 220, 1338, 760), radius=36, outline="#d7c9b6", width=6)
    draw.line((700, 220, 700, 760), fill="#d7c9b6", width=5)
    draw.ellipse((590, 365, 810, 585), outline="#d7c9b6", width=5)

    draw.rounded_rectangle((120, 285, 500, 600), radius=18, fill="#1c2833", outline="#111", width=4)
    draw.text((155, 320), "白队", font=label, fill="#ffffff")
    draw.text((380, 320), "蓝队", font=label, fill="#ffffff", anchor="ra")
    draw.text((185, 420), "08", font=font(96, True), fill=red)
    draw.text((355, 420), "06", font=font(96, True), fill=red)
    draw.text((160, 555), "观众远处看不清 / 不知道犯规暂停", font=small, fill="#c9d2dc")

    draw.rounded_rectangle((865, 270, 1260, 625), radius=12, fill="#ffffff", outline=gray, width=4)
    draw.text((900, 305), "篮球技术统计表", font=label, fill=ink)
    for i in range(7):
        y = 370 + i * 32
        draw.line((900, y, 1220, y), fill="#bfc8d2", width=2)
    for x in [965, 1035, 1105, 1175]:
        draw.line((x, 360, x, 592), fill="#bfc8d2", width=2)
    draw.text((920, 650), "表格字段多，临时技术员容易漏记", font=body, fill="#6b6257")

    draw.ellipse((620, 360, 695, 435), fill="#2f4155")
    draw.rounded_rectangle((585, 435, 735, 625), radius=40, fill=green)
    draw.text((560, 670), "体育爱好者能看懂比赛，\n但不一定会填专业表。", font=body, fill=ink)
    img.save(dst, quality=92)


def make_workflow_board(dst: Path) -> None:
    screenshots = FINAL_DIR / "screenshots"
    items = [
        ("01_devtools_project_tree.png", "工程结构"),
        ("02_architecture_design.png", "架构设计"),
        ("03_create_add_player.png", "建赛与添加球员"),
        ("04_scoreboard_natural_language.png", "自然语言录入"),
        ("05_full_scenario_test_result.png", "完整场景测试"),
        ("06_pdf_report_player_stats.png", "中文 PDF 报告"),
    ]
    w, h = 1800, 1040
    img = Image.new("RGB", (w, h), "#101721")
    draw = ImageDraw.Draw(img)
    title_font = font(50, True)
    label_font = font(28, True)
    caption_font = font(22)
    draw.text((62, 46), "成果测试流程效果图", font=title_font, fill="#f6f7fb")
    draw.text((64, 112), "从工程、架构、建赛、录入、自动化测试到中文报告的完整闭环。", font=caption_font, fill="#b9c7d5")

    card_w, card_h = 520, 375
    positions = [(60, 180), (640, 180), (1220, 180), (60, 610), (640, 610), (1220, 610)]
    for idx, ((name, label), (x, y)) in enumerate(zip(items, positions), start=1):
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=22, fill="#f6f1e8", outline="#00b784", width=3)
        draw.text((x + 20, y + 18), f"{idx:02d}  {label}", font=label_font, fill="#102033")
        with Image.open(screenshots / name) as src:
            fitted = fit_image(src, (card_w - 44, card_h - 82), "#eef2f5")
        img.paste(fitted, (x + 22, y + 62))
    img.save(dst, quality=92)


def prepare_assets() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    resize_image(REQ_DIR / "篮球计分设备素材1.jpg", ASSET_DIR / "scoreboard-large.jpg")
    resize_image(REQ_DIR / "篮球计分设备素材2.jpg.jpg", ASSET_DIR / "scoreboard-compact.jpg")
    resize_image(REQ_DIR / "篮球计分设备素材3.jpg", ASSET_DIR / "scoreboard-facility.jpg")
    resize_image(REQ_DIR / "篮球协会数据统计表格.jpg", ASSET_DIR / "stats-sheet.jpg", max_width=1400)
    make_grassroots_sketch(ASSET_DIR / "grassroots-sketch.jpg")
    make_workflow_board(ASSET_DIR / "workflow-board.jpg")

    screenshots = FINAL_DIR / "screenshots"
    for item in [
        "01_devtools_project_tree.png",
        "02_architecture_design.png",
        "03_create_add_player.png",
        "04_scoreboard_natural_language.png",
        "05_full_scenario_test_result.png",
        "06_pdf_report_player_stats.png",
    ]:
        shutil.copy2(screenshots / item, ASSET_DIR / item)


def controls() -> str:
    return """
        <button type="button" class="slide-object-move" aria-label="Move">⠿</button>
        <button type="button" class="slide-object-delete" aria-label="Delete object">×</button>
        <button type="button" class="slide-object-resize" aria-label="Resize"></button>"""


def style_from(left: str, top: str, width: str, height: str | None = None) -> str:
    style = f"left:{left};top:{top};width:{width};"
    if height:
        style += f"height:{height};"
    return style


def text_object(oid: str, inner: str, left: str, top: str, width: str, height: str | None = None, cls: str = "") -> str:
    return f"""
      <div class="slide-object {cls}" data-slide-object data-oid="{oid}" data-object-type="text" style="{style_from(left, top, width, height)}">
{controls()}
        <div class="slide-object-text" contenteditable="false">{inner}</div>
      </div>"""


def image_object(
    oid: str,
    src: str,
    alt: str,
    left: str,
    top: str,
    width: str,
    height: str,
    cls: str = "shot-frame",
    fit: str = "contain",
) -> str:
    return f"""
      <div class="slide-object image-object" data-slide-object data-oid="{oid}" data-object-type="image" style="{style_from(left, top, width, height)}">
{controls()}
        <div class="slide-object-graphic {cls}">
          <img src="html-ppt-assets/{html.escape(src)}" alt="{html.escape(alt)}" style="object-fit:{fit};">
        </div>
      </div>"""


def graphic_object(oid: str, inner: str, left: str, top: str, width: str, height: str, cls: str = "data-card") -> str:
    return f"""
      <div class="slide-object {cls}" data-slide-object data-oid="{oid}" data-object-type="graphic" style="{style_from(left, top, width, height)}">
{controls()}
        <div class="slide-object-graphic">{inner}</div>
      </div>"""


def section(n: int, cls: str, title: str, objects: str) -> str:
    visible = " visible" if n == 0 else ""
    return f"""
<section class="slide deck-slide slide-{cls}{visible}" id="slide-{n}" data-title="{html.escape(title)}">
  <div class="court-grid" aria-hidden="true"></div>
  <div class="slide-index" aria-hidden="true">{n + 1:02d}</div>
  <div class="slide-edit-layer">
{objects}
  </div>
</section>"""


def build_slides() -> str:
    slides: list[str] = []
    slides.append(section(0, "cover", "篮球技术台自动化", "\n".join([
        text_object("s0-o0", '<p class="eyebrow">i坤队 / solo / hackathon</p><h1>篮球技术台自动化</h1><p class="lead">校园篮球赛的一人技术台：自然语言记录、实时提醒、观众看分、签字归档。</p>', "6%", "12%", "58%"),
        text_object("s0-o1", '<div class="score-led">08<span>:</span>06</div><p class="score-note">白队 8 : 6 蓝队 · 完整自然语言比赛测试通过</p>', "57%", "48%", "34%"),
        graphic_object("s0-o2", '<b>1人</b><span>完成计分 / 计时 / 提醒 / 归档</span>', "65%", "16%", "25%", "18%", "metric-card"),
        graphic_object("s0-o3", '<b>21/21</b><span>自动化测试通过</span>', "65%", "35%", "25%", "15%", "metric-card metric-card--dark"),
    ])))

    slides.append(section(1, "pain", "专业计分设施成本", "\n".join([
        text_object("s1-o0", '<p class="eyebrow">真实痛点 01</p><h2>专业计分设施贵且复杂</h2><p>大型屏幕、控制台和专业记录系统更适合正式赛事。校园篮球爱好者比赛往往无法长期复用这些设备。</p>', "6%", "12%", "40%"),
        image_object("s1-o1", "scoreboard-facility.jpg", "大型场馆计分系统", "50%", "12%", "42%", "60%", "photo-frame", "cover"),
        graphic_object("s1-o2", '<b>限制</b><span>设备、场馆、专人维护缺一不可</span>', "6%", "70%", "26%", "13%"),
        graphic_object("s1-o3", '<b>结果</b><span>基层比赛回到翻分牌和纸质表</span>', "35%", "70%", "26%", "13%"),
    ])))

    slides.append(section(2, "grassroots", "基层技术台痛点", "\n".join([
        text_object("s2-o0", '<p class="eyebrow">真实痛点 02</p><h2>翻分牌和记录表解决不了全部问题</h2><p>观众看分困难；临时技术员要同时处理得分、犯规、暂停、计时，纸质表字段多且容易漏记。</p>', "6%", "10%", "43%"),
        image_object("s2-o1", "grassroots-sketch.jpg", "基层篮球赛技术台示意图", "52%", "10%", "40%", "38%", "photo-frame", "contain"),
        image_object("s2-o2", "stats-sheet.jpg", "篮球统计表格", "52%", "53%", "40%", "35%", "paper-frame", "contain"),
        graphic_object("s2-o3", '<b>观众</b><span>远处看不清比分、犯规、暂停、节次</span>', "6%", "67%", "20%", "15%"),
        graphic_object("s2-o4", '<b>技术台</b><span>懂球不等于会填专业统计表</span>', "28%", "67%", "20%", "15%"),
    ])))

    slides.append(section(3, "positioning", "产品定位", "\n".join([
        text_object("s3-o0", '<p class="eyebrow">现有产品不足</p><h2>按钮式计分仍然要找按钮、切模块</h2><p>微信小程序契合基层篮球的便捷场景，但得分、犯规、暂停分开记录，临场操作依然有门槛。</p>', "6%", "11%", "48%"),
        graphic_object("s3-o1", '<b>得分按钮</b><span>先判断队伍、球员、分值</span>', "8%", "62%", "23%", "15%"),
        graphic_object("s3-o2", '<b>犯规按钮</b><span>再切到犯规模块</span>', "33%", "62%", "23%", "15%"),
        graphic_object("s3-o3", '<b>暂停 / 计时</b><span>提醒缺失时容易漏</span>', "58%", "62%", "23%", "15%"),
        graphic_object("s3-o4", '<div class="nl-card"><strong>自然语言</strong><em>白队 7 号两分命中</em><span>→ 待确认事件 → 比分 / 个人得分 / 事件流</span></div>', "57%", "18%", "34%", "34%", "nl-object"),
    ])))

    slides.append(section(4, "workflow", "成果测试流程", "\n".join([
        text_object("s4-o0", '<p class="eyebrow">完整成果截图</p><h2>完整测试流程闭环</h2>', "6%", "7%", "70%"),
        image_object("s4-o1", "workflow-board.jpg", "完整成果测试流程效果图", "6%", "27%", "88%", "62%", "workflow-frame", "contain"),
    ])))

    slides.append(section(5, "create", "建赛与球员", "\n".join([
        text_object("s5-o0", '<p class="eyebrow">流程 01</p><h2>建赛与添加球员</h2><p>球员名单不再要求复杂格式，点击添加后分别输入球衣号码和球员名称，降低临时技术员误填概率。</p>', "6%", "12%", "35%"),
        image_object("s5-o1", "03_create_add_player.png", "建赛页添加球员弹窗", "48%", "9%", "36%", "76%", "app-frame", "contain"),
        graphic_object("s5-o2", '<b>房间码</b><span>四位码让观众快速加入</span>', "6%", "63%", "18%", "13%"),
        graphic_object("s5-o3", '<b>名单</b><span>号码和姓名分开输入</span>', "26%", "63%", "18%", "13%"),
    ])))

    slides.append(section(6, "input", "自然语言录入", "\n".join([
        text_object("s6-o0", '<p class="eyebrow">流程 02</p><h2>自然语言录入<br>待确认入账</h2><p>技术员只要说清楚或输入场上事件，系统解析为待确认事件；确认后更新比分、犯规、暂停和提醒。</p>', "6%", "10%", "37%"),
        image_object("s6-o1", "04_scoreboard_natural_language.png", "自然语言录入技术台", "47%", "8%", "37%", "78%", "app-frame", "contain"),
        graphic_object("s6-o2", '<div class="pipeline"><b>白队 7 号两分命中</b><span>解析</span><b>确认事件</b><span>入账</span><b>比分 +2</b></div>', "6%", "63%", "36%", "18%", "pipeline-object"),
    ])))

    slides.append(section(7, "rules", "一人技术台", "\n".join([
        text_object("s7-o0", '<p class="eyebrow">核心价值</p><h2>三人技术台缩减到一人</h2><p>过去常见配置是两人计分互相校对，一人计时并翻总分。现在由事件流统一计算并提醒。</p>', "6%", "12%", "42%"),
        graphic_object("s7-o1", '<strong>传统</strong><span>计分员 A</span><span>计分员 B</span><span>计时 / 翻分</span>', "53%", "13%", "18%", "46%", "role-card"),
        text_object("s7-o2", '<div class="arrow-big">→</div>', "72%", "26%", "7%"),
        graphic_object("s7-o3", '<strong>现在</strong><span>一名技术员</span><span>自然语言记录</span><span>系统自动提醒</span>', "79%", "13%", "18%", "46%", "role-card role-card--green"),
        graphic_object("s7-o4", '<b>个人犯规</b><span>5 犯临界提醒</span>', "6%", "65%", "20%", "14%"),
        graphic_object("s7-o5", '<b>球队犯规</b><span>本节第 5 犯提醒</span>', "28%", "65%", "20%", "14%"),
        graphic_object("s7-o6", '<b>暂停 / 时间</b><span>额度与最后一分钟提示</span>', "50%", "65%", "26%", "14%"),
    ])))

    slides.append(section(8, "test", "完整测试结果", "\n".join([
        text_object("s8-o0", '<p class="eyebrow">测试与 Debug</p><h2>完整自然语言比赛已跑通</h2><p>自动化场景覆盖 4 节、19 条文本事件、得分、犯规、暂停、时间更正、比赛结束、观众页、签字、归档和 PDF 打开。</p>', "6%", "10%", "38%"),
        image_object("s8-o1", "05_full_scenario_test_result.png", "完整场景测试结果", "46%", "10%", "45%", "58%", "terminal-frame", "contain"),
        graphic_object("s8-o2", '<b>21/21</b><span>测试用例通过</span>', "47%", "72%", "13%", "13%", "metric-card"),
        graphic_object("s8-o3", '<b>8:6</b><span>最终比分</span>', "62%", "72%", "13%", "13%", "metric-card"),
        graphic_object("s8-o4", '<b>3</b><span>HTML / JSON / PDF</span>', "77%", "72%", "13%", "13%", "metric-card"),
    ])))

    slides.append(section(9, "report", "中文报告", "\n".join([
        text_object("s9-o0", '<p class="eyebrow">赛后情绪价值</p><h2>球队比分之外，留下球员个人得分</h2><p>中文 PDF 报告降低统计表阅读门槛，包含球队得分、逐节比分、球员个人得分和犯规，适合赛后分享和复盘。</p>', "6%", "10%", "36%"),
        image_object("s9-o1", "06_pdf_report_player_stats.png", "中文 PDF 报告包含个人得分", "47%", "7%", "43%", "80%", "pdf-frame", "contain"),
        graphic_object("s9-o2", '<b>球队得分</b><span>逐节 + 总分</span>', "6%", "66%", "18%", "13%"),
        graphic_object("s9-o3", '<b>个人得分</b><span>张三 / 赵六 / 李四 / 王五</span>', "26%", "66%", "18%", "13%"),
    ])))

    slides.append(section(10, "engineering", "工程可运行", "\n".join([
        text_object("s10-o0", '<p class="eyebrow">工程证据</p><h2>不是静态原型，是真实可运行小程序</h2><p>包含微信小程序工程、云函数、云数据库实时监听、自然语言解析、归档导出和持续测试。</p>', "6%", "8%", "42%"),
        image_object("s10-o1", "01_devtools_project_tree.png", "微信开发者工具工程结构", "50%", "8%", "20%", "43%", "shot-frame", "contain"),
        image_object("s10-o2", "02_architecture_design.png", "系统架构设计", "72%", "8%", "20%", "43%", "shot-frame", "contain"),
        graphic_object("s10-o3", '<b>GitHub</b><span>INTERPUT/basketball-scorekeeper-miniapp</span>', "6%", "63%", "31%", "13%"),
        graphic_object("s10-o4", '<b>已验证</b><span>build:miniprogram / typecheck / npm test</span>', "40%", "63%", "31%", "13%"),
        text_object("s10-o5", '<p class="closing-copy">后续扩展：篮板、助攻、抢断、赛事排名和长期数据档案。</p>', "6%", "81%", "64%"),
    ])))

    return "\n".join(slides)


CUSTOM_CSS = """

    /* === Basketball scorekeeper deck: Bold Signal inspired === */
    :root {
      --font-display: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif;
      --font-body: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif;
      --body-size: clamp(0.95rem, 1.18vw, 1.22rem);
      --deck-chrome-bg: rgba(11, 18, 27, 0.92);
      --deck-chrome-border: rgba(255, 255, 255, 0.18);
      --deck-chrome-text: #edf7ff;
      --deck-chrome-muted: #9fb2c7;
      --deck-chrome-accent: #00b784;
      --deck-chrome-shadow: 0 20px 50px rgba(0, 0, 0, 0.34);
      --deck-chrome-surface: rgba(18, 28, 40, 0.94);
      --bg-deep: #10151d;
      --bg-mid: #16202b;
      --ink: #f7fbff;
      --muted: #b7c7d7;
      --green: #00b784;
      --orange: #ff7a1a;
      --red: #ff473d;
      --paper: #f6f1e8;
    }

    html, body { background: var(--bg-deep); color: var(--ink); font-family: var(--font-body); }
    .slides-offset { background: var(--bg-deep); }
    .deck-slide {
      isolation: isolate;
      background:
        radial-gradient(circle at 78% 6%, rgba(0, 183, 132, 0.23), transparent 34%),
        linear-gradient(135deg, #0f141c 0%, #182332 62%, #10151d 100%);
      color: var(--ink);
    }
    .court-grid {
      position: absolute; inset: 0; opacity: 0.32; z-index: 0;
      background-image:
        linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
      background-size: clamp(44px, 5.2vw, 84px) clamp(44px, 5.2vw, 84px);
      pointer-events: none;
    }
    .slide-index {
      position: absolute; right: 5%; top: 5%; z-index: 1;
      font: 900 clamp(2.6rem, 6vw, 6.4rem) var(--font-display);
      color: rgba(255,255,255,.055);
    }
    .slide-edit-layer { position:absolute; inset:0; z-index:5; pointer-events:none; }
    .slide-object { pointer-events:auto; }
    .slide-object-text { width: 100%; box-sizing: border-box; overflow-wrap: break-word; color: var(--ink); }
    .slide-object-graphic { width: 100%; height: 100%; box-sizing: border-box; }
    .slide-object-graphic img {
      display:block; width:100%; height:100%; max-height:min(76vh, 820px);
      object-position:center; border:0; pointer-events:none;
    }

    h1, h2, h3, p { margin: 0; }
    h1 {
      font-size: clamp(3.5rem, 7.3vw, 7.2rem);
      line-height: 1.02; letter-spacing: 0; font-weight: 900;
      max-width: 10em;
    }
    h2 {
      font-size: clamp(2.25rem, 4.7vw, 4.9rem);
      line-height: 1.08; letter-spacing: 0; font-weight: 900;
      max-width: 12em;
    }
    p { font-size: clamp(1rem, 1.45vw, 1.42rem); line-height: 1.55; color: var(--muted); }
    .lead { margin-top: clamp(1rem, 2vh, 1.6rem); max-width: 24em; color:#dce7ef; }
    .eyebrow {
      color: var(--green); font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
      font-size: clamp(.78rem, 1.05vw, 1rem); margin-bottom: clamp(.55rem, 1.1vh, .9rem);
    }
    .score-led {
      font: 900 clamp(5rem, 10vw, 10rem) var(--font-display);
      color: var(--red); line-height: .86; text-shadow: 0 0 30px rgba(255,71,61,.26);
    }
    .score-led span { color: var(--paper); padding: 0 .08em; }
    .score-note { margin-top: clamp(.8rem, 1.4vh, 1rem); color:#d7e4f1; }
    .metric-card .slide-object-graphic,
    .data-card .slide-object-graphic {
      padding: clamp(1rem, 1.8vw, 1.55rem); border-radius: clamp(12px, 1.4vw, 20px);
      border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.07);
      display: flex; flex-direction: column; justify-content: center; gap: .45rem;
    }
    .metric-card .slide-object-graphic { border-left: 6px solid var(--green); }
    .metric-card--dark .slide-object-graphic { border-left-color: var(--orange); }
    .metric-card b, .data-card b {
      display:block; font: 900 clamp(1.45rem, 3vw, 3.2rem) var(--font-display); color: var(--orange);
    }
    .metric-card span, .data-card span { color:#dce8f2; font-size: clamp(.86rem, 1.15vw, 1.06rem); line-height:1.35; }
    .photo-frame, .paper-frame, .shot-frame, .app-frame, .terminal-frame, .pdf-frame, .workflow-frame {
      overflow:hidden; border-radius: clamp(14px, 1.3vw, 22px);
      border: 1px solid rgba(255,255,255,.18); background:#edf2f5;
      box-shadow: 0 28px 70px rgba(0,0,0,.36);
      padding: clamp(.35rem, .7vw, .7rem);
    }
    .photo-frame { background:#10151d; }
    .paper-frame { background:#f8f4eb; }
    .app-frame { background:#eef2f5; padding: clamp(.6rem, 1vw, 1rem); }
    .terminal-frame { background:#07101d; padding: clamp(.55rem, .8vw, .85rem); }
    .pdf-frame { background:#f7fafc; padding: clamp(.7rem, 1vw, 1rem); }
    .workflow-frame { background:#0e1621; padding: clamp(.4rem, .7vw, .7rem); }
    .nl-card {
      width:100%; height:100%; box-sizing:border-box; border-radius: clamp(16px,1.5vw,24px);
      background: var(--paper); color:#15202b; padding: clamp(1.2rem,2.2vw,2rem);
      display:grid; gap: clamp(.6rem,1vh,.95rem); align-content:center;
      box-shadow: 0 26px 60px rgba(0,0,0,.30);
    }
    .nl-card strong { color: var(--green); font-size: clamp(1.3rem,2.1vw,2.1rem); }
    .nl-card em { font-style: normal; font-weight: 900; font-size: clamp(1.15rem,1.8vw,1.7rem); }
    .nl-card span { color:#354252; font-size: clamp(.95rem,1.25vw,1.1rem); }
    .pipeline {
      width:100%; height:100%; display:grid; grid-template-columns: 1.2fr .5fr 1fr .5fr 1fr;
      align-items:center; gap:.65rem;
    }
    .pipeline b {
      background: var(--paper); color:#111923; border-radius: clamp(10px,1vw,16px);
      padding: clamp(.75rem,1.2vw,1.2rem); text-align:center; font-size: clamp(.95rem,1.2vw,1.15rem);
    }
    .pipeline span { color: var(--orange); font-weight: 900; text-align:center; }
    .role-card .slide-object-graphic {
      background: var(--paper); color:#111923; border-radius: clamp(16px,1.5vw,24px);
      padding: clamp(1rem,1.8vw,1.5rem); display:flex; flex-direction:column; gap:.75rem;
    }
    .role-card strong { font-size: clamp(1.6rem,2.9vw,3rem); }
    .role-card span {
      background:#172332; color:#f7fbff; border-radius: 10px;
      padding: clamp(.55rem,.9vw,.8rem); font-size: clamp(.86rem,1vw,1rem);
    }
    .role-card--green .slide-object-graphic { border: 4px solid var(--green); }
    .arrow-big { font: 900 clamp(4rem, 8vw, 8rem) var(--font-display); color: var(--orange); }
    .closing-copy { color:#e7f1f9; font-size: clamp(1.25rem,2vw,2rem); font-weight:800; }

    body.screenshot-mode .deck-left-hover-anchor,
    body.screenshot-mode .deck-add-element-menu,
    body.screenshot-mode .progress-bar,
    body.screenshot-mode .nav-dots,
    body.screenshot-mode .slide-sidebar,
    body.screenshot-mode .rte-toolbar { display:none !important; }
    body.screenshot-mode .slides-offset { padding-right:0 !important; scroll-snap-type:none !important; }

    @media (max-height: 700px) {
      h1 { font-size: clamp(3rem, 6.4vw, 6rem); }
      h2 { font-size: clamp(2rem, 4vw, 4.1rem); }
      p { font-size: clamp(.88rem, 1.2vw, 1.1rem); }
    }
    @media (max-height: 600px) {
      .slide-object-graphic img { max-height: min(70vh, 620px); }
    }
"""


def reference_parts() -> tuple[str, str]:
    ref = REFERENCE_HTML.read_text(encoding="utf-8")
    ref = ref.replace(
        '<html lang="en" data-deck-id="editable-deck-reference" data-mobile-adaptation="desktop-default">',
        '<html lang="zh-CN" data-deck-id="basketball-tech-table-editable-v2" data-mobile-adaptation="desktop-default">',
    )
    ref = re.sub(r"<title>.*?</title>", "<title>篮球技术台自动化 - 可编辑 HTML-PPT</title>", ref, count=1, flags=re.S)
    ref = ref.replace("</style>", CUSTOM_CSS + "\n  </style>", 1)
    ref = ref.replace(
        "  loadState();",
        "  const deckUrlParams = new URLSearchParams(location.search);\n"
        "  if (!deckUrlParams.has('fresh') && !deckUrlParams.has('shot')) loadState();",
        1,
    )
    ref = ref.replace(
        "  deck._updateChrome();\n})();",
        "  const deckShotParam = new URLSearchParams(location.search).get('shot');\n"
        "  if (deckShotParam) {\n"
        "    deck.refreshSlides();\n"
        "    const target = Math.max(0, Math.min(Number(deckShotParam) - 1, deck.slides.length - 1));\n"
        "    document.body.classList.add('screenshot-mode');\n"
        "    deck.slides.forEach((slide, index) => {\n"
        "      slide.style.display = index === target ? 'block' : 'none';\n"
        "      slide.classList.toggle('visible', index === target);\n"
        "    });\n"
        "    deck.current = target;\n"
        "    window.scrollTo(0, 0);\n"
        "  }\n"
        "  deck._updateChrome();\n})();",
        1,
    )
    marker = '<div class="slides-offset">'
    start = ref.index(marker)
    script_marker = "\n<script>"
    script_start = ref.index(script_marker, start)
    pre = ref[: start + len(marker)]
    post = ref[script_start:]
    return pre, post


def build_html() -> str:
    pre, post = reference_parts()
    return pre + "\n" + build_slides() + "\n</div>" + post


def main() -> None:
    if not REFERENCE_HTML.exists():
        raise FileNotFoundError(f"Missing frontend-slides-editable reference runtime: {REFERENCE_HTML}")
    prepare_assets()
    OUT_HTML.write_text(build_html(), encoding="utf-8")
    print(OUT_HTML)


if __name__ == "__main__":
    main()
