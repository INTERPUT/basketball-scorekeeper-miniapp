"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeSnapshot = recomputeSnapshot;
function createAlertId(type, eventId) {
    return `${type}_${eventId}`;
}
function getTimeoutBucket(period) {
    if (period <= 2) {
        return "first_half";
    }
    if (period <= 4) {
        return "second_half";
    }
    return `overtime_${period}`;
}
function getTimeoutLimit(period) {
    if (period <= 2) {
        return 2;
    }
    if (period <= 4) {
        return 3;
    }
    return 1;
}
function getScoreValue(event) {
    switch (event.eventType) {
        case "score_free_throw":
            return 1;
        case "score_two_point":
            return 2;
        case "score_three_point":
            return 3;
        case "free_throw_series_result":
            return event.made;
        default:
            return 0;
    }
}
function ensurePeriodScore(state, period) {
    const key = String(period);
    if (!state.periodScores[key]) {
        state.periodScores[key] = [0, 0];
    }
    return state.periodScores[key];
}
function getTeamIndex(match, teamId) {
    const index = match.teams.findIndex((team) => team.teamId === teamId);
    if (index === -1) {
        throw new Error("事件引用了不存在的球队。");
    }
    return index;
}
function assertPlayerExists(state, teamId, playerId) {
    if (!state.teams[teamId]?.players[playerId]) {
        throw new Error("事件引用了不存在的球员。");
    }
}
function ensureLastMinuteAlert(state, event, remainingSeconds) {
    if (remainingSeconds > 60) {
        return;
    }
    const alreadyTriggered = state.alerts.some((alert) => alert.type === "last_minute_alert" && alert.period === event.period);
    if (!alreadyTriggered) {
        state.alerts.push({
            alertId: createAlertId("last_minute_alert", event.eventId),
            type: "last_minute_alert",
            period: event.period,
            gameClockSeconds: remainingSeconds,
            relatedEventId: event.eventId
        });
    }
}
function createInitialState(match) {
    return {
        status: "draft",
        currentPeriod: 1,
        clock: {
            period: 1,
            status: "ready",
            remainingSeconds: match.rules.periodLengthMinutes * 60
        },
        periodScores: {
            "1": [0, 0]
        },
        teams: Object.fromEntries(match.teams.map((team) => [
            team.teamId,
            {
                score: 0,
                currentPeriodFouls: 0,
                timeoutsByBucket: {},
                players: Object.fromEntries(team.players.map((player) => [
                    player.playerId,
                    {
                        points: 0,
                        fouls: 0
                    }
                ]))
            }
        ])),
        alerts: []
    };
}
function assertClockActionAllowed(state, event) {
    switch (event.eventType) {
        case "clock_start":
            if (state.clock.status !== "ready" && state.clock.status !== "period_ended") {
                throw new Error("当前时钟状态不允许启动。");
            }
            return;
        case "clock_pause":
            if (state.clock.status !== "running") {
                throw new Error("当前时钟状态不允许暂停。");
            }
            return;
        case "clock_resume":
            if (state.clock.status !== "paused") {
                throw new Error("当前时钟状态不允许继续。");
            }
            return;
        case "clock_correct":
            if (state.clock.status !== "running" && state.clock.status !== "paused") {
                throw new Error("当前时钟状态不允许更正时间。");
            }
            return;
        case "period_end":
            if (state.clock.status !== "running" && state.clock.status !== "paused") {
                throw new Error("当前时钟状态不允许结束本节。");
            }
            return;
        default:
            return;
    }
}
function recomputeSnapshot(match, room, events) {
    const state = createInitialState(match);
    events.forEach((event) => {
        if (state.status === "finished" || state.status === "archived") {
            throw new Error("已结束比赛不能继续写入普通事件。");
        }
        switch (event.eventType) {
            case "score_free_throw":
            case "score_two_point":
            case "score_three_point":
            case "free_throw_series_result": {
                assertPlayerExists(state, event.teamId, event.playerId);
                const scoreValue = getScoreValue(event);
                const teamIndex = getTeamIndex(match, event.teamId);
                const periodScore = ensurePeriodScore(state, event.period);
                state.teams[event.teamId].score += scoreValue;
                state.teams[event.teamId].players[event.playerId].points += scoreValue;
                periodScore[teamIndex] += scoreValue;
                ensureLastMinuteAlert(state, event, event.gameClockSeconds);
                break;
            }
            case "personal_foul": {
                assertPlayerExists(state, event.teamId, event.playerId);
                const teamState = state.teams[event.teamId];
                const playerState = teamState.players[event.playerId];
                teamState.currentPeriodFouls += 1;
                playerState.fouls += 1;
                if (playerState.fouls === 5) {
                    state.alerts.push({
                        alertId: createAlertId("player_foul_out_alert", event.eventId),
                        type: "player_foul_out_alert",
                        period: event.period,
                        gameClockSeconds: event.gameClockSeconds,
                        teamId: event.teamId,
                        playerId: event.playerId,
                        relatedEventId: event.eventId
                    });
                }
                if (teamState.currentPeriodFouls >= 5) {
                    state.alerts.push({
                        alertId: createAlertId("team_bonus_alert", event.eventId),
                        type: "team_bonus_alert",
                        period: event.period,
                        gameClockSeconds: event.gameClockSeconds,
                        teamId: event.teamId,
                        relatedEventId: event.eventId
                    });
                }
                ensureLastMinuteAlert(state, event, event.gameClockSeconds);
                break;
            }
            case "team_timeout": {
                const teamState = state.teams[event.teamId];
                if (!teamState) {
                    throw new Error("事件引用了不存在的球队。");
                }
                const bucket = getTimeoutBucket(event.period);
                const currentUsage = teamState.timeoutsByBucket[bucket] ?? 0;
                const nextUsage = currentUsage + 1;
                if (nextUsage > getTimeoutLimit(event.period)) {
                    throw new Error("该阶段暂停额度已用完。");
                }
                teamState.timeoutsByBucket[bucket] = nextUsage;
                ensureLastMinuteAlert(state, event, event.gameClockSeconds);
                break;
            }
            case "clock_start": {
                assertClockActionAllowed(state, event);
                if (state.clock.status === "period_ended") {
                    state.status = "live";
                    state.currentPeriod = event.period;
                    state.clock = {
                        period: event.period,
                        status: "running",
                        remainingSeconds: match.rules.periodLengthMinutes * 60
                    };
                    Object.values(state.teams).forEach((team) => {
                        team.currentPeriodFouls = 0;
                    });
                    ensurePeriodScore(state, event.period);
                }
                else {
                    state.status = "live";
                    state.clock = {
                        period: event.period,
                        status: "running",
                        remainingSeconds: event.gameClockSeconds
                    };
                }
                ensureLastMinuteAlert(state, event, state.clock.remainingSeconds);
                break;
            }
            case "clock_pause": {
                assertClockActionAllowed(state, event);
                state.clock = {
                    period: event.period,
                    status: "paused",
                    remainingSeconds: event.gameClockSeconds
                };
                ensureLastMinuteAlert(state, event, state.clock.remainingSeconds);
                break;
            }
            case "clock_resume": {
                assertClockActionAllowed(state, event);
                state.clock = {
                    period: event.period,
                    status: "running",
                    remainingSeconds: event.gameClockSeconds
                };
                ensureLastMinuteAlert(state, event, state.clock.remainingSeconds);
                break;
            }
            case "clock_correct": {
                assertClockActionAllowed(state, event);
                state.clock = {
                    period: event.period,
                    status: state.clock.status,
                    remainingSeconds: event.targetRemainingSeconds
                };
                ensureLastMinuteAlert(state, event, state.clock.remainingSeconds);
                break;
            }
            case "period_end": {
                assertClockActionAllowed(state, event);
                state.status = "period_break";
                state.clock = {
                    period: event.period,
                    status: "period_ended",
                    remainingSeconds: 0
                };
                ensureLastMinuteAlert(state, event, state.clock.remainingSeconds);
                break;
            }
            case "game_end": {
                state.status = "finished";
                state.clock = {
                    period: event.period,
                    status: "period_ended",
                    remainingSeconds: 0
                };
                break;
            }
        }
    });
    return {
        matchId: match.matchId,
        roomCode: room.roomCode,
        status: state.status,
        currentPeriod: state.currentPeriod,
        clock: state.clock,
        teams: match.teams.map((team) => {
            const teamState = state.teams[team.teamId];
            const bucket = getTimeoutBucket(state.currentPeriod);
            const usedTimeouts = teamState.timeoutsByBucket[bucket] ?? 0;
            return {
                teamId: team.teamId,
                name: team.name,
                color: team.color,
                score: teamState.score,
                playerCount: team.players.length,
                currentPeriodFouls: teamState.currentPeriodFouls,
                timeoutsRemaining: getTimeoutLimit(state.currentPeriod) - usedTimeouts
            };
        }),
        periodScores: state.periodScores,
        alerts: state.alerts,
        recentEvents: events.slice(-10)
    };
}
