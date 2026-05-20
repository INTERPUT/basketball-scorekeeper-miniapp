"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMatch = createMatch;
exports.joinRoom = joinRoom;
exports.parseTextEvent = parseTextEvent;
exports.confirmDraftEvent = confirmDraftEvent;
exports.watchRoomSnapshot = watchRoomSnapshot;
const eventEngine_1 = require("../domain/eventEngine");
const matchFactory_1 = require("../domain/matchFactory");
const eventParser_1 = require("../domain/eventParser");
const id_1 = require("../domain/id");
const validation_1 = require("../domain/validation");
const localMatchRepository_1 = require("./localMatchRepository");
const snapshotBus_1 = require("./snapshotBus");
function createMatch(input) {
    const bundle = (0, matchFactory_1.createMatchBundle)(input);
    localMatchRepository_1.localMatchRepository.save(bundle.match, bundle.room, bundle.snapshot);
    return bundle.snapshot;
}
function joinRoom(roomCode) {
    if (!(0, validation_1.isValidRoomCode)(roomCode)) {
        throw new Error("房间码必须是 4 位数字。");
    }
    const room = localMatchRepository_1.localMatchRepository.findRoom(roomCode);
    if (!room || room.status !== "active") {
        throw new Error("房间不存在或已失效。");
    }
    const snapshot = localMatchRepository_1.localMatchRepository.findSnapshot(room.matchId);
    if (!snapshot) {
        throw new Error("比赛信息不存在。");
    }
    return snapshot;
}
function getMatchContext(roomCode) {
    const room = localMatchRepository_1.localMatchRepository.findRoom(roomCode);
    if (!room || room.status !== "active") {
        throw new Error("房间不存在或已失效。");
    }
    const match = localMatchRepository_1.localMatchRepository.findMatch(room.matchId);
    const snapshot = localMatchRepository_1.localMatchRepository.findSnapshot(room.matchId);
    if (!match || !snapshot) {
        throw new Error("比赛信息不存在。");
    }
    return { room, match, snapshot };
}
function parseTextEvent(roomCode, text) {
    const { match, snapshot } = getMatchContext(roomCode);
    return (0, eventParser_1.parseEventText)(match, snapshot, text);
}
function buildConfirmedEvent(draft) {
    const base = {
        eventId: (0, id_1.createId)("event"),
        eventType: draft.eventType,
        period: draft.period,
        gameClockSeconds: draft.gameClockSeconds,
        createdAt: new Date().toISOString()
    };
    switch (draft.eventType) {
        case "score_free_throw":
        case "score_two_point":
        case "score_three_point":
        case "personal_foul":
            if (!draft.teamId || !draft.playerId) {
                throw new Error("草稿事件缺少球队或球员。");
            }
            return {
                ...base,
                eventType: draft.eventType,
                teamId: draft.teamId,
                playerId: draft.playerId
            };
        case "free_throw_series_result":
            if (!draft.teamId || !draft.playerId || draft.attempts === undefined || draft.made === undefined) {
                throw new Error("罚球草稿缺少必要字段。");
            }
            return {
                ...base,
                eventType: draft.eventType,
                teamId: draft.teamId,
                playerId: draft.playerId,
                attempts: draft.attempts,
                made: draft.made
            };
        case "team_timeout":
            if (!draft.teamId) {
                throw new Error("暂停草稿缺少球队。");
            }
            return {
                ...base,
                eventType: draft.eventType,
                teamId: draft.teamId
            };
        case "clock_correct":
            if (draft.targetRemainingSeconds === undefined) {
                throw new Error("时间更正草稿缺少目标时间。");
            }
            return {
                ...base,
                eventType: draft.eventType,
                targetRemainingSeconds: draft.targetRemainingSeconds
            };
        case "clock_start":
        case "clock_pause":
        case "clock_resume":
        case "period_end":
        case "game_end":
            return {
                ...base,
                eventType: draft.eventType
            };
    }
}
function confirmDraftEvent(roomCode, draft) {
    const { room, match } = getMatchContext(roomCode);
    const events = [...localMatchRepository_1.localMatchRepository.findEvents(match.matchId), buildConfirmedEvent(draft)];
    const snapshot = (0, eventEngine_1.recomputeSnapshot)(match, room, events);
    localMatchRepository_1.localMatchRepository.saveEvents(match.matchId, events);
    localMatchRepository_1.localMatchRepository.saveSnapshot(snapshot);
    return snapshot;
}
function watchRoomSnapshot(roomCode, listener) {
    const { room, snapshot } = getMatchContext(roomCode);
    listener(snapshot);
    return snapshotBus_1.snapshotBus.subscribe(room.matchId, listener);
}
