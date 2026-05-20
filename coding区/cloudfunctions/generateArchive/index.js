const cloud = require("wx-server-sdk");
const PDFDocument = require("pdfkit");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const REQUIRED_SIGNATURE_ROLES = ["home_captain", "away_captain"];
const REQUIRED_COLLECTIONS = ["signatures", "archives", "exportFiles"];

async function ensureCollections() {
  await Promise.all(
    REQUIRED_COLLECTIONS.map((collectionName) =>
      db.createCollection(collectionName).catch((error) => {
        const message = error && error.message ? error.message.toLowerCase() : "";
        if (message.includes("exist")) {
          return;
        }
        throw error;
      })
    )
  );
}

function assertOperator(match) {
  const openid = cloud.getWXContext().OPENID;
  if (openid && match.operatorId && openid !== match.operatorId) {
    throw new Error("只有创建比赛的技术员可以生成归档。");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function eventLabel(event) {
  const labels = {
    score_free_throw: "罚球命中",
    free_throw_series_result: "罚球组",
    score_two_point: "两分命中",
    score_three_point: "三分命中",
    personal_foul: "个人犯规",
    team_timeout: "球队暂停",
    clock_start: "计时开始",
    clock_pause: "计时暂停",
    clock_resume: "计时继续",
    clock_correct: "时间更正",
    period_end: "本节结束",
    game_end: "比赛结束"
  };
  return labels[event.eventType] || event.eventType;
}

function stripDocumentId(document) {
  if (!document || typeof document !== "object") {
    return document;
  }
  const { _id, ...rest } = document;
  return rest;
}

function buildPlayerTotals(match, events) {
  const totals = {};
  match.teams.forEach((team) => {
    totals[team.teamId] = {};
    team.players.forEach((player) => {
      totals[team.teamId][player.playerId] = {
        number: player.number,
        name: player.name,
        points: 0,
        fouls: 0
      };
    });
  });

  events.forEach((event) => {
    if (!event.teamId || !event.playerId || !totals[event.teamId] || !totals[event.teamId][event.playerId]) {
      return;
    }

    const player = totals[event.teamId][event.playerId];
    if (event.eventType === "score_free_throw") {
      player.points += 1;
    }
    if (event.eventType === "score_two_point") {
      player.points += 2;
    }
    if (event.eventType === "score_three_point") {
      player.points += 3;
    }
    if (event.eventType === "free_throw_series_result") {
      player.points += event.made || 0;
    }
    if (event.eventType === "personal_foul") {
      player.fouls += 1;
    }
  });

  return totals;
}

function buildPeriodScoreCells(snapshot) {
  const periods = Object.keys(snapshot.periodScores).sort((a, b) => Number(a) - Number(b));
  const header = periods.map((period) => `<th>第 ${escapeHtml(period)} 节</th>`).join("");
  const home = periods.map((period) => `<td>${snapshot.periodScores[period][0]}</td>`).join("");
  const away = periods.map((period) => `<td>${snapshot.periodScores[period][1]}</td>`).join("");
  return { header, home, away };
}

function buildRosterRows(team, totals) {
  return team.players
    .map((player) => {
      const total = totals[team.teamId][player.playerId];
      return `<tr><td>${escapeHtml(player.number)}</td><td>${escapeHtml(player.name)}</td><td>${total.points}</td><td>${total.fouls}</td></tr>`;
    })
    .join("");
}

async function imageDataUrl(fileID) {
  const result = await cloud.downloadFile({ fileID });
  return `data:image/png;base64,${result.fileContent.toString("base64")}`;
}

async function imageBuffer(fileID) {
  const result = await cloud.downloadFile({ fileID });
  return result.fileContent;
}

async function buildScoreSheetHtml({ match, snapshot, events, signatures, archiveId, version, createdAt }) {
  const totals = buildPlayerTotals(match, events);
  const periodScores = buildPeriodScoreCells(snapshot);
  const signatureByRole = Object.fromEntries(signatures.map((signature) => [signature.role, signature]));
  const [homeSignatureUrl, awaySignatureUrl] = await Promise.all([
    imageDataUrl(signatureByRole.home_captain.fileID),
    imageDataUrl(signatureByRole.away_captain.fileID)
  ]);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>篮球正式计分表 ${escapeHtml(archiveId)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 24px; color: #111827; }
    h1 { text-align: center; font-size: 24px; margin: 0 0 16px; }
    .meta, table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #111827; padding: 7px 8px; font-size: 13px; text-align: center; }
    th { background: #f3f4f6; }
    .score { font-size: 28px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .signature { height: 92px; object-fit: contain; max-width: 100%; }
    .muted { color: #6b7280; font-size: 12px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>篮球正式计分表</h1>
  <table class="meta">
    <tr><th>归档编号</th><td>${escapeHtml(archiveId)}</td><th>版本</th><td>v${version}</td></tr>
    <tr><th>比赛名称</th><td>${escapeHtml(match.header && match.header.competitionName)}</td><th>场地</th><td>${escapeHtml(match.header && match.header.venue)}</td></tr>
    <tr><th>裁判</th><td>${escapeHtml(match.header && match.header.referee)}</td><th>生成时间</th><td>${escapeHtml(createdAt)}</td></tr>
  </table>

  <table>
    <tr><th>队伍</th><th>颜色</th><th>总分</th><th>状态</th></tr>
    <tr><td>${escapeHtml(snapshot.teams[0].name)}</td><td>${escapeHtml(snapshot.teams[0].color)}</td><td class="score">${snapshot.teams[0].score}</td><td>${escapeHtml(snapshot.status)}</td></tr>
    <tr><td>${escapeHtml(snapshot.teams[1].name)}</td><td>${escapeHtml(snapshot.teams[1].color)}</td><td class="score">${snapshot.teams[1].score}</td><td>${escapeHtml(snapshot.status)}</td></tr>
  </table>

  <table>
    <tr><th>队伍</th>${periodScores.header}<th>总分</th></tr>
    <tr><td>${escapeHtml(snapshot.teams[0].name)}</td>${periodScores.home}<td>${snapshot.teams[0].score}</td></tr>
    <tr><td>${escapeHtml(snapshot.teams[1].name)}</td>${periodScores.away}<td>${snapshot.teams[1].score}</td></tr>
  </table>

  <div class="grid">
    <section>
      <h2>${escapeHtml(match.teams[0].name)} 球员</h2>
      <table><tr><th>号码</th><th>姓名</th><th>得分</th><th>犯规</th></tr>${buildRosterRows(match.teams[0], totals)}</table>
    </section>
    <section>
      <h2>${escapeHtml(match.teams[1].name)} 球员</h2>
      <table><tr><th>号码</th><th>姓名</th><th>得分</th><th>犯规</th></tr>${buildRosterRows(match.teams[1], totals)}</table>
    </section>
  </div>

  <h2>逐条记录</h2>
  <table>
    <tr><th>节次</th><th>时间</th><th>事件</th><th>记录时间</th></tr>
    ${events
      .map(
        (event) =>
          `<tr><td>${event.period}</td><td>${formatClock(event.gameClockSeconds)}</td><td>${escapeHtml(eventLabel(event))}</td><td>${escapeHtml(event.createdAt)}</td></tr>`
      )
      .join("")}
  </table>

  <h2>双方队长签字</h2>
  <table>
    <tr><th>${escapeHtml(match.teams[0].name)} 队长</th><th>${escapeHtml(match.teams[1].name)} 队长</th></tr>
    <tr><td><img class="signature" src="${homeSignatureUrl}" /></td><td><img class="signature" src="${awaySignatureUrl}" /></td></tr>
    <tr><td class="muted">${escapeHtml(signatureByRole.home_captain.signedAt)}</td><td class="muted">${escapeHtml(signatureByRole.away_captain.signedAt)}</td></tr>
  </table>
</body>
</html>`;
}

async function buildPdfReport({ snapshot, events, signatures, archiveId, version, createdAt }) {
  const signatureByRole = Object.fromEntries(signatures.map((signature) => [signature.role, signature]));
  const [homeSignatureBuffer, awaySignatureBuffer] = await Promise.all([
    imageBuffer(signatureByRole.home_captain.fileID),
    imageBuffer(signatureByRole.away_captain.fileID)
  ]);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: 48 });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Basketball Match Archive Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Archive: ${archiveId}`);
    doc.text(`Version: v${version}`);
    doc.text(`Generated At: ${createdAt}`);
    doc.text(`Match ID: ${snapshot.matchId}`);
    doc.text(`Status: ${snapshot.status}`);
    doc.moveDown();
    doc.fontSize(14).text("Final Score");
    doc.fontSize(12).text(`Team 1: ${snapshot.teams[0].score}`);
    doc.text(`Team 2: ${snapshot.teams[1].score}`);
    doc.text(`Events: ${events.length}`);
    doc.moveDown();
    doc.fontSize(14).text("Captain Signatures");
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Home Captain: ${signatureByRole.home_captain.signedAt}`);
    doc.image(homeSignatureBuffer, { fit: [220, 90] });
    doc.moveDown();
    doc.text(`Away Captain: ${signatureByRole.away_captain.signedAt}`);
    doc.image(awaySignatureBuffer, { fit: [220, 90] });

    doc.end();
  });
}

async function resolveRoom(event) {
  if (event.roomCode) {
    return db.collection("rooms").doc(event.roomCode).get().then((result) => result.data);
  }

  if (event.matchId) {
    const rooms = await db.collection("rooms").where({ matchId: event.matchId }).limit(1).get();
    return rooms.data[0];
  }

  throw new Error("缺少比赛或房间参数。");
}

async function uploadBufferFile(cloudPath, fileContent) {
  const result = await cloud.uploadFile({
    cloudPath,
    fileContent
  });
  return result.fileID;
}

async function uploadTextFile(cloudPath, text) {
  return uploadBufferFile(cloudPath, Buffer.from(text, "utf8"));
}

async function attachTempFileURLs(files) {
  const result = await cloud.getTempFileURL({
    fileList: files.map((file) => file.fileID)
  });
  const urlsByFileID = Object.fromEntries(
    result.fileList.map((file) => [file.fileID, file.tempFileURL])
  );

  return files.map((file) => ({
    ...file,
    tempFileURL: urlsByFileID[file.fileID] || ""
  }));
}

exports.main = async (event) => {
  await ensureCollections();

  const room = await resolveRoom(event);
  if (!room) {
    throw new Error("房间不存在。");
  }

  const [match, snapshot, eventsResult, signaturesResult, archivesResult] = await Promise.all([
    db.collection("matches").doc(room.matchId).get().then((result) => result.data),
    db.collection("snapshots").doc(room.matchId).get().then((result) => result.data),
    db.collection("events").where({ matchId: room.matchId }).orderBy("createdAt", "asc").limit(1000).get(),
    db.collection("signatures").where({ matchId: room.matchId }).get(),
    db.collection("archives").where({ matchId: room.matchId }).get()
  ]);

  if (!match || !snapshot) {
    throw new Error("比赛数据不完整。");
  }
  if (snapshot.status !== "finished" && snapshot.status !== "archived") {
    throw new Error("比赛结束后才能生成归档。");
  }
  assertOperator(match);

  const signatures = signaturesResult.data.map(stripDocumentId);
  const missingRoles = REQUIRED_SIGNATURE_ROLES.filter(
    (role) => !signatures.some((signature) => signature.role === role)
  );
  if (missingRoles.length) {
    throw new Error("双方队长签字完成前不能生成最终留档。");
  }

  const events = eventsResult.data.map((item) => item.event);
  const version = Math.max(0, ...archivesResult.data.map((archive) => archive.version || 0)) + 1;
  const archiveId = `${room.matchId}_v${version}`;
  const createdAt = new Date().toISOString();
  const archivePath = `archives/${room.matchId}/v${version}`;
  const archivedSnapshot = {
    ...stripDocumentId(snapshot),
    status: "archived"
  };
  const archiveData = {
    archiveId,
    matchId: room.matchId,
    roomCode: room.roomCode,
    version,
    createdAt,
    match: {
      ...match,
      status: "archived"
    },
    snapshot: archivedSnapshot,
    events,
    signatures
  };

  const html = await buildScoreSheetHtml({
    match,
    snapshot: archivedSnapshot,
    events,
    signatures,
    archiveId,
    version,
    createdAt
  });
  const pdf = await buildPdfReport({
    snapshot: archivedSnapshot,
    events,
    signatures,
    archiveId,
    version,
    createdAt
  });

  const [htmlFileID, jsonFileID, pdfFileID] = await Promise.all([
    uploadTextFile(`${archivePath}/score-sheet.html`, html),
    uploadTextFile(`${archivePath}/archive.json`, JSON.stringify(archiveData, null, 2)),
    uploadBufferFile(`${archivePath}/report.pdf`, pdf)
  ]);

  const files = [
    {
      exportFileId: `${archiveId}_score_sheet_html`,
      matchId: room.matchId,
      archiveId,
      type: "score_sheet_html",
      fileID: htmlFileID,
      createdAt
    },
    {
      exportFileId: `${archiveId}_archive_json`,
      matchId: room.matchId,
      archiveId,
      type: "archive_json",
      fileID: jsonFileID,
      createdAt
    },
    {
      exportFileId: `${archiveId}_pdf_report`,
      matchId: room.matchId,
      archiveId,
      type: "pdf_report",
      fileID: pdfFileID,
      createdAt
    }
  ];
  const archive = {
    archiveId,
    matchId: room.matchId,
    version,
    status: "generated",
    createdAt,
    signatures,
    files
  };

  await Promise.all([
    db.collection("archives").doc(archiveId).set({ data: archive }),
    ...files.map((file) => db.collection("exportFiles").doc(file.exportFileId).set({ data: file })),
    db.collection("snapshots").doc(room.matchId).set({ data: archivedSnapshot }),
    db.collection("matches").doc(room.matchId).update({
      data: {
        status: "archived",
        archiveVersion: version,
        archivedAt: createdAt
      }
    }),
    db.collection("rooms").doc(room.roomCode).update({
      data: {
        status: "closed",
        expiresAt: createdAt
      }
    })
  ]);

  return {
    archive: {
      ...archive,
      files: await attachTempFileURLs(files)
    }
  };
};
