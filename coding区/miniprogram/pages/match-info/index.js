"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudMatchService_1 = require("../../services/cloudMatchService");
Page({
    data: {
        snapshot: null,
        error: ""
    },
    unsubscribe: undefined,
    async onLoad(query) {
        try {
            this.unsubscribe = await (0, cloudMatchService_1.watchRoomSnapshot)(query.roomCode ?? "", (snapshot) => {
                this.setData({
                    snapshot,
                    error: ""
                });
            });
        }
        catch (error) {
            this.setData({
                error: error instanceof Error ? error.message : "无法加载比赛。"
            });
        }
    },
    onUnload() {
        this.unsubscribe?.();
    }
});
