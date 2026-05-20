const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const VALID_ROLES = new Set(["home_captain", "away_captain"]);
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
    throw new Error("只有创建比赛的技术员可以提交签字。");
  }
}

exports.main = async (event) => {
  const { matchId, role, fileID } = event;
  if (!matchId || !VALID_ROLES.has(role)) {
    throw new Error("签字参数不完整。");
  }
  if (!fileID) {
    throw new Error("缺少签名图片。");
  }

  await ensureCollections();

  const [match, snapshot] = await Promise.all([
    db.collection("matches").doc(matchId).get().then((result) => result.data),
    db.collection("snapshots").doc(matchId).get().then((result) => result.data)
  ]);

  if (!match) {
    throw new Error("比赛不存在。");
  }
  if (!snapshot || (snapshot.status !== "finished" && snapshot.status !== "archived")) {
    throw new Error("比赛结束后才能签字。");
  }
  assertOperator(match);

  const now = new Date().toISOString();
  const signature = {
    signatureId: `${matchId}_${role}`,
    matchId,
    role,
    fileID,
    signedAt: now
  };

  await db.collection("signatures").doc(signature.signatureId).set({
    data: signature
  });

  return {
    signature
  };
};
