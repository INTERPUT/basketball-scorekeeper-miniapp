"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateMatchInput = validateCreateMatchInput;
exports.createMatchBundle = createMatchBundle;
exports.createSnapshot = createSnapshot;
const eventEngine_1 = require("./eventEngine");
const id_1 = require("./id");
const validation_1 = require("./validation");
function buildPlayers(teamId, players) {
    return players.map((player) => ({
        playerId: (0, id_1.createId)("player"),
        teamId,
        number: player.number,
        name: player.name,
        personalFouls: 0,
        points: 0
    }));
}
function buildTeam(input) {
    const teamId = (0, id_1.createId)("team");
    return {
        teamId,
        name: input.name.trim(),
        color: input.color.trim(),
        players: buildPlayers(teamId, input.players)
    };
}
function validateCreateMatchInput(input) {
    const errors = [];
    if (!(0, validation_1.isValidRoomCode)(input.roomCode)) {
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
        (0, validation_1.validateRoster)(team.players).forEach((error) => {
            errors.push(`${teamLabel}${error}`);
        });
    });
    return errors;
}
function createMatchBundle(input, now = new Date()) {
    const errors = validateCreateMatchInput(input);
    if (errors.length > 0) {
        throw new Error(errors.join(" "));
    }
    const createdAt = now.toISOString();
    const matchId = (0, id_1.createId)("match");
    const teams = [buildTeam(input.teams[0]), buildTeam(input.teams[1])];
    const match = {
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
    const room = {
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
function createSnapshot(match, room) {
    return (0, eventEngine_1.recomputeSnapshot)(match, room, []);
}
