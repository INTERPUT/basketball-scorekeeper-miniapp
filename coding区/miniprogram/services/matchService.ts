import type { ConfirmedEvent, CreateMatchInput, DraftEvent, MatchSnapshot, ParseEventResult } from "../domain/models";
import { recomputeSnapshot } from "../domain/eventEngine";
import { createMatchBundle } from "../domain/matchFactory";
import { parseEventText } from "../domain/eventParser";
import { createId } from "../domain/id";
import { isValidRoomCode } from "../domain/validation";
import { localMatchRepository } from "./localMatchRepository";
import { snapshotBus } from "./snapshotBus";

export function createMatch(input: CreateMatchInput): MatchSnapshot {
  const bundle = createMatchBundle(input);
  localMatchRepository.save(bundle.match, bundle.room, bundle.snapshot);
  return bundle.snapshot;
}

export function joinRoom(roomCode: string): MatchSnapshot {
  if (!isValidRoomCode(roomCode)) {
    throw new Error("房间码必须是 4 位数字。");
  }

  const room = localMatchRepository.findRoom(roomCode);
  if (!room || room.status !== "active") {
    throw new Error("房间不存在或已失效。");
  }

  const snapshot = localMatchRepository.findSnapshot(room.matchId);
  if (!snapshot) {
    throw new Error("比赛信息不存在。");
  }

  return snapshot;
}

function getMatchContext(roomCode: string) {
  const room = localMatchRepository.findRoom(roomCode);
  if (!room || room.status !== "active") {
    throw new Error("房间不存在或已失效。");
  }

  const match = localMatchRepository.findMatch(room.matchId);
  const snapshot = localMatchRepository.findSnapshot(room.matchId);

  if (!match || !snapshot) {
    throw new Error("比赛信息不存在。");
  }

  return { room, match, snapshot };
}

export function parseTextEvent(roomCode: string, text: string): ParseEventResult {
  const { match, snapshot } = getMatchContext(roomCode);
  return parseEventText(match, snapshot, text);
}

function buildConfirmedEvent(draft: DraftEvent): ConfirmedEvent {
  const base = {
    eventId: createId("event"),
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

export function confirmDraftEvent(roomCode: string, draft: DraftEvent): MatchSnapshot {
  const { room, match } = getMatchContext(roomCode);
  const events = [...localMatchRepository.findEvents(match.matchId), buildConfirmedEvent(draft)];
  const snapshot = recomputeSnapshot(match, room, events);

  localMatchRepository.saveEvents(match.matchId, events);
  localMatchRepository.saveSnapshot(snapshot);

  return snapshot;
}

export function watchRoomSnapshot(roomCode: string, listener: (snapshot: MatchSnapshot) => void): () => void {
  const { room, snapshot } = getMatchContext(roomCode);
  listener(snapshot);

  return snapshotBus.subscribe(room.matchId, listener);
}
