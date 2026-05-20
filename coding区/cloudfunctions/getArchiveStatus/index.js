const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function assertOperator(match) {
  const openid = cloud.getWXContext().OPENID;
  if (openid && match.operatorId && openid !== match.operatorId) {
    throw new Error("只有创建比赛的技术员可以查看赛后归档。");
  }
}

function stripDocumentId(document) {
  if (!document || typeof document !== "object") {
    return document;
  }
  const { _id, ...rest } = document;
  return rest;
}

async function attachTempFileURLs(archive) {
  if (!archive || !Array.isArray(archive.files) || archive.files.length === 0) {
    return archive;
  }

  const result = await cloud.getTempFileURL({
    fileList: archive.files.map((file) => file.fileID)
  });
  const urlsByFileID = Object.fromEntries(
    result.fileList.map((file) => [file.fileID, file.tempFileURL])
  );

  return {
    ...archive,
    files: archive.files.map((file) => ({
      ...file,
      tempFileURL: urlsByFileID[file.fileID] || ""
    }))
  };
}

exports.main = async (event) => {
  const { matchId } = event;
  if (!matchId) {
    throw new Error("缺少比赛编号。");
  }

  const match = await db.collection("matches").doc(matchId).get().then((result) => result.data);
  if (!match) {
    throw new Error("比赛不存在。");
  }
  assertOperator(match);

  const [signaturesResult, archivesResult] = await Promise.all([
    db.collection("signatures").where({ matchId }).get(),
    db.collection("archives").where({ matchId }).orderBy("version", "desc").limit(1).get()
  ]);

  const signatures = signaturesResult.data.map(stripDocumentId);
  const archive = archivesResult.data[0] ? await attachTempFileURLs(stripDocumentId(archivesResult.data[0])) : null;

  return {
    signatures,
    archive
  };
};
