import { describe, expect, it } from "vitest";
import type { ConfirmedEvent, CreateMatchInput } from "../miniprogram/domain/models";
import { recomputeSnapshot } from "../miniprogram/domain/eventEngine";
import { createMatchBundle } from "../miniprogram/domain/matchFactory";

const input: CreateMatchInput = {
  roomCode: "1357",
  periodLengthMinutes: 10,
  operatorId: "operator_1",
  teams: [
    {
      name: "白队",
      color: "白色",
      players: [{ number: "7", name: "张三" }]
    },
    {
      name: "蓝队",
      color: "蓝色",
      players: [{ number: "12", name: "李四" }]
    }
  ]
};

function createContext() {
  return createMatchBundle(input, new Date("2026-05-18T00:00:00.000Z"));
}

describe("recomputeSnapshot", () => {
  it("replays scoring, fouls, alerts, and period scores from confirmed events", () => {
    const { match, room } = createContext();
    const homeTeam = match.teams[0];
    const awayTeam = match.teams[1];
    const homePlayer = homeTeam.players[0];
    const awayPlayer = awayTeam.players[0];
    const events: ConfirmedEvent[] = [
      {
        eventId: "e1",
        eventType: "clock_start",
        period: 1,
        gameClockSeconds: 600,
        createdAt: "2026-05-18T00:00:01.000Z"
      },
      {
        eventId: "e2",
        eventType: "score_two_point",
        period: 1,
        gameClockSeconds: 580,
        createdAt: "2026-05-18T00:00:02.000Z",
        teamId: homeTeam.teamId,
        playerId: homePlayer.playerId
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        eventId: `f${index + 1}`,
        eventType: "personal_foul" as const,
        period: 1,
        gameClockSeconds: 560 - index,
        createdAt: `2026-05-18T00:00:0${index + 3}.000Z`,
        teamId: awayTeam.teamId,
        playerId: awayPlayer.playerId
      })),
      {
        eventId: "e3",
        eventType: "clock_correct",
        period: 1,
        gameClockSeconds: 120,
        targetRemainingSeconds: 60,
        createdAt: "2026-05-18T00:00:10.000Z"
      }
    ];

    const snapshot = recomputeSnapshot(match, room, events);

    expect(snapshot.teams.map((team) => team.score)).toEqual([2, 0]);
    expect(snapshot.periodScores["1"]).toEqual([2, 0]);
    expect(snapshot.teams[1].currentPeriodFouls).toBe(5);
    expect(snapshot.alerts.map((alert) => alert.type)).toEqual([
      "player_foul_out_alert",
      "team_bonus_alert",
      "last_minute_alert"
    ]);
  });

  it("enforces timeout quota and clock state transitions", () => {
    const { match, room } = createContext();
    const homeTeam = match.teams[0];
    const events: ConfirmedEvent[] = [
      {
        eventId: "e1",
        eventType: "clock_start",
        period: 1,
        gameClockSeconds: 600,
        createdAt: "2026-05-18T00:00:01.000Z"
      },
      {
        eventId: "e2",
        eventType: "clock_pause",
        period: 1,
        gameClockSeconds: 590,
        createdAt: "2026-05-18T00:00:02.000Z"
      },
      {
        eventId: "e3",
        eventType: "team_timeout",
        period: 1,
        gameClockSeconds: 590,
        createdAt: "2026-05-18T00:00:03.000Z",
        teamId: homeTeam.teamId
      },
      {
        eventId: "e4",
        eventType: "team_timeout",
        period: 2,
        gameClockSeconds: 580,
        createdAt: "2026-05-18T00:00:04.000Z",
        teamId: homeTeam.teamId
      }
    ];

    const snapshot = recomputeSnapshot(match, room, events);
    expect(snapshot.clock.status).toBe("paused");
    expect(snapshot.teams[0].timeoutsRemaining).toBe(0);

    expect(() =>
      recomputeSnapshot(match, room, [
        ...events,
        {
          eventId: "e5",
          eventType: "team_timeout",
          period: 2,
          gameClockSeconds: 570,
          createdAt: "2026-05-18T00:00:05.000Z",
          teamId: homeTeam.teamId
        }
      ])
    ).toThrow("该阶段暂停额度已用完。");
  });

  it("can replay a deterministic multi-period match without AI", () => {
    const { match, room } = createContext();
    const homeTeam = match.teams[0];
    const awayTeam = match.teams[1];
    const events: ConfirmedEvent[] = [
      {
        eventId: "e1",
        eventType: "clock_start",
        period: 1,
        gameClockSeconds: 600,
        createdAt: "2026-05-18T00:00:01.000Z"
      },
      {
        eventId: "e2",
        eventType: "score_three_point",
        period: 1,
        gameClockSeconds: 580,
        createdAt: "2026-05-18T00:00:02.000Z",
        teamId: homeTeam.teamId,
        playerId: homeTeam.players[0].playerId
      },
      {
        eventId: "e3",
        eventType: "period_end",
        period: 1,
        gameClockSeconds: 0,
        createdAt: "2026-05-18T00:00:03.000Z"
      },
      {
        eventId: "e4",
        eventType: "clock_start",
        period: 2,
        gameClockSeconds: 600,
        createdAt: "2026-05-18T00:00:04.000Z"
      },
      {
        eventId: "e5",
        eventType: "free_throw_series_result",
        period: 2,
        gameClockSeconds: 540,
        createdAt: "2026-05-18T00:00:05.000Z",
        teamId: awayTeam.teamId,
        playerId: awayTeam.players[0].playerId,
        attempts: 2,
        made: 1
      },
      {
        eventId: "e6",
        eventType: "game_end",
        period: 2,
        gameClockSeconds: 0,
        createdAt: "2026-05-18T00:00:06.000Z"
      }
    ];

    const snapshot = recomputeSnapshot(match, room, events);

    expect(snapshot.status).toBe("finished");
    expect(snapshot.currentPeriod).toBe(2);
    expect(snapshot.teams.map((team) => team.score)).toEqual([3, 1]);
    expect(snapshot.periodScores).toEqual({
      "1": [3, 0],
      "2": [0, 1]
    });
  });
});
