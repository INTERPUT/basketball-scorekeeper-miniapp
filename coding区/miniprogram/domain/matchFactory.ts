import type { CreateMatchInput, Match, MatchSnapshot, Player, Room, Team } from "./models";
import { recomputeSnapshot } from "./eventEngine";
import { createId } from "./id";
import { isValidRoomCode, validateRoster } from "./validation";

function buildPlayers(teamId: string, players: Array<Pick<Player, "number" | "name">>): Player[] {
  return players.map((player) => ({
    playerId: createId("player"),
    teamId,
    number: player.number,
    name: player.name,
    personalFouls: 0,
    points: 0
  }));
}

function buildTeam(input: CreateMatchInput["teams"][number]): Team {
  const teamId = createId("team");
  return {
    teamId,
    name: input.name.trim(),
    color: input.color.trim(),
    players: buildPlayers(teamId, input.players)
  };
}

export function validateCreateMatchInput(input: CreateMatchInput): string[] {
  const errors: string[] = [];

  if (!isValidRoomCode(input.roomCode)) {
    errors.push("房间码必须是 4 位数字。");
  }

  if (!Number.isInteger(input.periodLengthMinutes) || input.periodLengthMinutes <= 0) {
    errors.push("单节时长必须是正整数。");
  }

  input.teams.forEach((team, index) => {
    const teamLabel = index === 0 ? "主队" : "客队";

    if (!team.name.trim()) {
      errors.push(`${teamLabel}名称不能为空。`);
    }

    if (!team.color.trim()) {
      errors.push(`${teamLabel}球衣颜色不能为空。`);
    }

    validateRoster(team.players).forEach((error) => {
      errors.push(`${teamLabel}${error}`);
    });
  });

  return errors;
}

export function createMatchBundle(input: CreateMatchInput, now = new Date()): {
  match: Match;
  room: Room;
  snapshot: MatchSnapshot;
} {
  const errors = validateCreateMatchInput(input);

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  const createdAt = now.toISOString();
  const matchId = createId("match");
  const teams = [buildTeam(input.teams[0]), buildTeam(input.teams[1])] as [Team, Team];
  const match: Match = {
    matchId,
    status: "draft",
    currentPeriod: 1,
    operatorId: input.operatorId,
    createdAt,
    header: input.header ?? {},
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
  const room: Room = {
    roomCode: input.roomCode,
    matchId,
    status: "active",
    createdAt
  };

  return {
    match,
    room,
    snapshot: createSnapshot(match, room)
  };
}

export function createSnapshot(match: Match, room: Room): MatchSnapshot {
  return recomputeSnapshot(match, room, []);
}
