"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../../domain/validation");
const cloudMatchService_1 = require("../../services/cloudMatchService");
Page({
    data: {
        roomCode: "",
        periodLengthMinutes: "10",
        homeTeamName: "",
        homeTeamColor: "白色",
        homeRosterText: "",
        awayTeamName: "",
        awayTeamColor: "蓝色",
        awayRosterText: "",
        showAdvanced: false,
        competitionName: "",
        venue: "",
        referee: "",
        error: ""
    },
    onRoomCodeInput(event) {
        this.setData({
            roomCode: (0, validation_1.normalizeRoomCode)(String(event.detail.value)),
            error: ""
        });
    },
    onFieldInput(event) {
        const field = event.currentTarget.dataset.field;
        this.setData({
            [field]: String(event.detail.value),
            error: ""
        });
    },
    toggleAdvanced() {
        this.setData({
            showAdvanced: !this.data.showAdvanced
        });
    },
    async handleSubmit() {
        try {
            const input = {
                roomCode: this.data.roomCode,
                periodLengthMinutes: Number(this.data.periodLengthMinutes),
                operatorId: "local_operator",
                header: {
                    competitionName: this.data.competitionName.trim() || undefined,
                    venue: this.data.venue.trim() || undefined,
                    referee: this.data.referee.trim() || undefined
                },
                teams: [
                    {
                        name: this.data.homeTeamName,
                        color: this.data.homeTeamColor,
                        players: (0, validation_1.parseRosterText)(this.data.homeRosterText)
                    },
                    {
                        name: this.data.awayTeamName,
                        color: this.data.awayTeamColor,
                        players: (0, validation_1.parseRosterText)(this.data.awayRosterText)
                    }
                ]
            };
            const snapshot = await (0, cloudMatchService_1.createMatch)(input);
            wx.navigateTo({
                url: `/pages/scoreboard/index?roomCode=${snapshot.roomCode}`
            });
        }
        catch (error) {
            this.setData({
                error: error instanceof Error ? error.message : "创建比赛失败。"
            });
        }
    }
});
