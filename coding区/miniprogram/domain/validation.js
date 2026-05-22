"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOM_CODE_PATTERN = void 0;
exports.normalizeRoomCode = normalizeRoomCode;
exports.normalizePlayerNumber = normalizePlayerNumber;
exports.isValidRoomCode = isValidRoomCode;
exports.parseRosterText = parseRosterText;
exports.validateRoster = validateRoster;
exports.ROOM_CODE_PATTERN = /^\d{4}$/;
function normalizeRoomCode(value) {
    return value.replace(/\D/g, "").slice(0, 4);
}
function normalizePlayerNumber(value) {
    return value.replace(/\D/g, "").slice(0, 3);
}
function isValidRoomCode(value) {
    return exports.ROOM_CODE_PATTERN.test(value);
}
function parseRosterText(value) {
    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
        const parts = line.split(/\s+/);
        const [number, ...nameParts] = parts;
        return {
            number: number ?? "",
            name: nameParts.join(" ")
        };
    });
}
function validateRoster(players) {
    const errors = [];
    const seenNumbers = new Set();
    if (players.length === 0) {
        errors.push("至少需要录入 1 名球员。");
    }
    players.forEach((player, index) => {
        if (!player.number || !player.name) {
            errors.push(`第 ${index + 1} 名球员信息不完整，请补全号码和姓名。`);
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
