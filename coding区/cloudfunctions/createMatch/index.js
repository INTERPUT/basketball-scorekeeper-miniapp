const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const REQUIRED_COLLECTIONS = ["matches", "rooms", "snapshots", "events", "signatures", "archives", "exportFiles"];

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function validateRoster(players) {
  const errors = [];
  const seenNumbers = new Set();

  if (!players.length) {
    errors.push("至少需要录入 1 名球员。");
  }

  players.forEach((player, index) => {
    if (!player.number || !player.name) {
      errors.push(`第 ${index + 1} 行球员信息不完整，请按“号码 姓名”录入。`);
      return;
    }

    if (seenNumbers.has(player.number)) {
      errors.push(`号码 ${player.number} 重复。`);
      return;
    }

    seenNumbers.add(player.number);
  });

  return errors;
}

function validateInput(input) {
  const errors = [];
  if (!/^\d{4}$/.test(input.roomCode)) {
    errors.push("房间码必须是 4 位数字。");
  }
  if (!Number.isInteger(input.periodLengthMinutes) || input.periodLengthMinutes <= 0) {
    errors.push("单节时长必须是正整数。");
  }

  input.teams.forEach((team, index) => {
    const label = index === 0 ? "主队" : "客队";
    if (!team.name.trim()) {
      errors.push(`${label}名称不能为空。`);
    }
    if (!team.color.trim()) {
      errors.push(`${label}球衣颜色不能为空。`);
    }
    validateRoster(team.players).forEach((error) => errors.push(`${label}${error}`));
  });

  return errors;
}

function buildPlayers(teamId, players) {
  return players.map((player) => ({
    playerId: createId("player"),
    teamId,
    number: player.number,
    name: player.name,
    personalFouls: 0,
    points: 0
  }));
}

function buildTeam(team) {
  const teamId = createId("team");
  return {
    teamId,
    name: team.name.trim(),
    color: team.color.trim(),
    players: buildPlayers(teamId, team.players)
  };
}

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

exports.main = async (event) => {
  const input = event.input;
  const errors = validateInput(input);
  if (errors.length) {
    throw new Error(errors.join(" "));
  }

  await ensureCollections();

  const existingRoom = await db.collection("rooms").doc(input.roomCode).get().catch(() => null);
  if (existingRoom && existingRoom.data && existingRoom.data.status === "active") {
    throw new Error("该房间码已被占用。");
  }

  const now = new Date().toISOString();
  const matchId = createId("match");
  const teams = [buildTeam(input.teams[0]), buildTeam(input.teams[1])];
  const operatorId = cloud.getWXContext().OPENID;
  const match = {
    matchId,
    status: "draft",
    currentPeriod: 1,
    operatorId,
    createdAt: now,
    header: input.header || {},
    rules: {
      periodLengthMinutes: input.periodLengthMinutes
    },
    teams,
    clock: {
      period: 1,
      status: "ready",
      remainingSeconds: input.periodLengthMinutes * 60
    }
  };
  const room = {
    roomCode: input.roomCode,
    matchId,
    status: "active",
    createdAt: now
  };
  const snapshot = {
    matchId,
    roomCode: input.roomCode,
    status: "draft",
    currentPeriod: 1,
    clock: match.clock,
    teams: teams.map((team) => ({
      teamId: team.teamId,
      name: team.name,
      color: team.color,
      score: 0,
      playerCount: team.players.length,
      currentPeriodFouls: 0,
      timeoutsRemaining: 2
    })),
    periodScores: {
      "1": [0, 0]
    },
    alerts: [],
    recentEvents: []
  };

  await Promise.all([
    db.collection("matches").doc(matchId).set({ data: match }),
    db.collection("rooms").doc(input.roomCode).set({ data: room }),
    db.collection("snapshots").doc(matchId).set({ data: snapshot })
  ]);

  return {
    snapshot
  };
};
