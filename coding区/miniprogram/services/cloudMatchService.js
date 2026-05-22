"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCloudError = normalizeCloudError;
exports.createMatch = createMatch;
exports.joinRoom = joinRoom;
exports.parseTextEvent = parseTextEvent;
exports.confirmDraftEvent = confirmDraftEvent;
exports.watchRoomSnapshot = watchRoomSnapshot;
exports.transcribeAudio = transcribeAudio;
exports.saveSignature = saveSignature;
exports.generateArchive = generateArchive;
exports.getArchiveStatus = getArchiveStatus;
const validation_1 = require("../domain/validation");
function getDatabase() {
    return wx.cloud.database();
}
function isCloudSystemErrorMessage(message) {
    return /document\.get:fail|cannot find document|access permission|errCode|cloudbase|database/i.test(message);
}
function normalizeCloudError(error, fallback) {
    if (!(error instanceof Error)) {
        return new Error(fallback);
    }
    if (!error.message || isCloudSystemErrorMessage(error.message)) {
        return new Error(fallback);
    }
    return error;
}
async function callFunction(name, data) {
    const response = await wx.cloud.callFunction({
        name,
        data
    });
    return response.result;
}
async function findRoom(roomCode) {
    if (!(0, validation_1.isValidRoomCode)(roomCode)) {
        throw new Error("房间码必须是 4 位数字。");
    }
    try {
        const result = await getDatabase().collection("rooms").doc(roomCode).get();
        const room = result.data;
        if (!room || room.status !== "active") {
            throw new Error("未找到比赛房间。");
        }
        return room;
    }
    catch (error) {
        throw normalizeCloudError(error, "未找到比赛房间。");
    }
}
async function createMatch(input) {
    const result = await callFunction("createMatch", { input });
    return result.snapshot;
}
async function joinRoom(roomCode) {
    const room = await findRoom(roomCode);
    try {
        const result = await getDatabase().collection("snapshots").doc(room.matchId).get();
        return result.data;
    }
    catch (error) {
        throw normalizeCloudError(error, "未找到比赛信息。");
    }
}
async function parseTextEvent(roomCode, text) {
    return callFunction("parseEvent", {
        roomCode,
        text
    });
}
async function confirmDraftEvent(roomCode, draft) {
    const result = await callFunction("confirmEvent", {
        roomCode,
        draft
    });
    return result.snapshot;
}
async function watchRoomSnapshot(roomCode, listener) {
    const room = await findRoom(roomCode);
    const database = getDatabase();
    const initialSnapshot = await database.collection("snapshots").doc(room.matchId).get();
    if (initialSnapshot.data) {
        listener(initialSnapshot.data);
    }
    const watcher = database
        .collection("snapshots")
        .doc(room.matchId)
        .watch({
        onChange(snapshot) {
            const doc = snapshot.docs[0];
            if (doc) {
                listener(doc);
            }
        },
        onError(error) {
            console.error("snapshot watch failed", error);
        }
    });
    return () => {
        watcher.close();
    };
}
async function transcribeAudio(tempFilePath) {
    const cloudPath = `voice/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`;
    const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
    });
    const result = await callFunction("transcribeAudio", {
        fileID: uploadResult.fileID,
        audioFormat: "wav",
        sampleRate: 16000,
        channel: 1,
        bits: 16
    });
    return result.text;
}
async function saveSignature(matchId, role, tempFilePath) {
    const cloudPath = `signatures/${matchId}/${role}-${Date.now()}.png`;
    const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
    });
    const result = await callFunction("saveSignature", {
        matchId,
        role,
        fileID: uploadResult.fileID
    });
    return result.signature;
}
async function generateArchive(matchId) {
    const result = await callFunction("generateArchive", {
        matchId
    });
    return result.archive;
}
async function getArchiveStatus(matchId) {
    return callFunction("getArchiveStatus", {
        matchId
    });
}
