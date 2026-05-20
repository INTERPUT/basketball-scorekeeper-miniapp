"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudMatchService_1 = require("../../services/cloudMatchService");
const validation_1 = require("../../domain/validation");
Page({
    data: {
        roomCode: "",
        error: ""
    },
    onRoomCodeInput(event) {
        this.setData({
            roomCode: (0, validation_1.normalizeRoomCode)(String(event.detail.value)),
            error: ""
        });
    },
    async handleJoin() {
        try {
            await (0, cloudMatchService_1.joinRoom)(this.data.roomCode);
            wx.navigateTo({
                url: `/pages/match-info/index?roomCode=${this.data.roomCode}`
            });
        }
        catch (error) {
            this.setData({
                error: error instanceof Error ? error.message : "无法进入比赛。"
            });
        }
    },
    handleCreate() {
        wx.navigateTo({
            url: "/pages/create/index"
        });
    }
});
