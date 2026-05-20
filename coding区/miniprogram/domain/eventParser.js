"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEventText = parseEventText;
const id_1 = require("./id");
const INCOMPLETE_MESSAGE = "缺少球队 / 球员 / 事件，请重新给出完整技术记录。";
const UNSUPPORTED_MESSAGE = "首版暂不记录该类扩展技术统计。";
function normalizeText(text) {
    return text.replace(/\s+/g, "").trim();
}
function findTeam(match, text) {
    return match.teams.find((team) => text.includes(team.name));
}
function findPlayerByNumber(team, text) {
    const match = text.match(/(\d+)号/);
    if (!match) {
        return undefined;
    }
    return team.players.find((player) => player.number === match[1]);
}
function createDraft(snapshot, sourceText, input) {
    return {
        draftEventId: (0, id_1.createId)("draft"),
        period: snapshot.currentPeriod,
        gameClockSeconds: snapshot.clock.remainingSeconds,
        sourceText,
        ...input
    };
}
function parseClockText(snapshot, rawText, compactText) {
    if (compactText === "开始计时") {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "clock_start",
                dataEffect: "开始比赛计时"
            })
        };
    }
    if (compactText === "暂停计时") {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "clock_pause",
                dataEffect: "暂停比赛计时"
            })
        };
    }
    if (compactText === "继续计时") {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "clock_resume",
                dataEffect: "恢复比赛计时"
            })
        };
    }
    if (compactText === "结束本节比赛") {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "period_end",
                dataEffect: "结束当前节次"
            })
        };
    }
    if (compactText === "比赛结束") {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "game_end",
                dataEffect: "结束整场比赛"
            })
        };
    }
    const clockCorrectionMatch = compactText.match(/^把时间改成(\d{1,2}):(\d{2})$/);
    if (clockCorrectionMatch) {
        const minutes = Number(clockCorrectionMatch[1]);
        const seconds = Number(clockCorrectionMatch[2]);
        if (seconds >= 60) {
            return {
                ok: false,
                reason: "时间格式不正确。"
            };
        }
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "clock_correct",
                targetRemainingSeconds: minutes * 60 + seconds,
                dataEffect: `将比赛时间更正为 ${clockCorrectionMatch[1].padStart(2, "0")}:${clockCorrectionMatch[2]}`
            })
        };
    }
    return undefined;
}
function parseEventText(match, snapshot, rawText) {
    const compactText = normalizeText(rawText);
    if (!compactText) {
        return {
            ok: false,
            reason: INCOMPLETE_MESSAGE
        };
    }
    if (/(篮板|助攻|抢断|盖帽|失误)/.test(compactText)) {
        return {
            ok: false,
            reason: UNSUPPORTED_MESSAGE
        };
    }
    const clockResult = parseClockText(snapshot, rawText, compactText);
    if (clockResult) {
        return clockResult;
    }
    const team = findTeam(match, compactText);
    if (!team) {
        return {
            ok: false,
            reason: INCOMPLETE_MESSAGE
        };
    }
    if (/(暂停|叫暂停)$/.test(compactText)) {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "team_timeout",
                teamId: team.teamId,
                dataEffect: `${team.name} 使用 1 次暂停`
            })
        };
    }
    const player = findPlayerByNumber(team, compactText);
    if (!player) {
        return {
            ok: false,
            reason: compactText.includes("号") ? "未找到该球员。" : INCOMPLETE_MESSAGE
        };
    }
    const freeThrowSeriesMatch = compactText.match(/(\d+)罚(?:中(\d+)|(\d+)中)$/);
    if (freeThrowSeriesMatch) {
        const attempts = Number(freeThrowSeriesMatch[1]);
        const made = Number(freeThrowSeriesMatch[2] ?? freeThrowSeriesMatch[3]);
        if (made > attempts) {
            return {
                ok: false,
                reason: "罚球命中次数不能超过罚球次数。"
            };
        }
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "free_throw_series_result",
                teamId: team.teamId,
                playerId: player.playerId,
                attempts,
                made,
                dataEffect: `${team.name} ${player.number} 号罚球 ${attempts} 次，命中 ${made} 次`
            })
        };
    }
    if (/(罚球命中|罚进一个)$/.test(compactText)) {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "score_free_throw",
                teamId: team.teamId,
                playerId: player.playerId,
                dataEffect: `${team.name} +1，${player.number} 号 +1`
            })
        };
    }
    if (/(两分命中|进了个两分|两分)$/.test(compactText)) {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "score_two_point",
                teamId: team.teamId,
                playerId: player.playerId,
                dataEffect: `${team.name} +2，${player.number} 号 +2`
            })
        };
    }
    if (/(三分命中|投进三分)$/.test(compactText)) {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "score_three_point",
                teamId: team.teamId,
                playerId: player.playerId,
                dataEffect: `${team.name} +3，${player.number} 号 +3`
            })
        };
    }
    if (/(犯规一次|个人犯规|犯规)$/.test(compactText)) {
        return {
            ok: true,
            draft: createDraft(snapshot, rawText, {
                eventType: "personal_foul",
                teamId: team.teamId,
                playerId: player.playerId,
                dataEffect: `${team.name} ${player.number} 号个人犯规 +1`
            })
        };
    }
    return {
        ok: false,
        reason: INCOMPLETE_MESSAGE
    };
}
