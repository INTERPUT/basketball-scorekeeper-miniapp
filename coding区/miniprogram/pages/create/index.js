"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../../domain/validation");
const cloudMatchService_1 = require("../../services/cloudMatchService");
function getRosterKey(team) {
    return team === "home" ? "homePlayers" : "awayPlayers";
}
function getTeamLabel(team) {
    return team === "home" ? "主队" : "客队";
}
Page({
    data: {
        roomCode: "",
        periodLengthMinutes: "10",
        homeTeamName: "",
        homeTeamColor: "白色",
        homePlayers: [],
        awayTeamName: "",
        awayTeamColor: "蓝色",
        awayPlayers: [],
        playerModalVisible: false,
        playerModalTeam: "home",
        playerModalTeamLabel: "主队",
        playerNumber: "",
        playerName: "",
        playerModalError: "",
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
    openPlayerModal(event) {
        const team = event.currentTarget.dataset.team === "away" ? "away" : "home";
        this.setData({
            playerModalVisible: true,
            playerModalTeam: team,
            playerModalTeamLabel: getTeamLabel(team),
            playerNumber: "",
            playerName: "",
            playerModalError: "",
            error: ""
        });
    },
    closePlayerModal() {
        this.setData({
            playerModalVisible: false,
            playerNumber: "",
            playerName: "",
            playerModalError: ""
        });
    },
    onPlayerNumberInput(event) {
        this.setData({
            playerNumber: (0, validation_1.normalizePlayerNumber)(String(event.detail.value)),
            playerModalError: ""
        });
    },
    onPlayerNameInput(event) {
        this.setData({
            playerName: String(event.detail.value),
            playerModalError: ""
        });
    },
    confirmPlayerModal() {
        const team = this.data.playerModalTeam;
        const rosterKey = getRosterKey(team);
        const players = this.data[rosterKey];
        const number = (0, validation_1.normalizePlayerNumber)(this.data.playerNumber);
        const name = this.data.playerName.trim();
        if (!number) {
            this.setData({ playerModalError: "请输入球衣号码。" });
            return;
        }
        if (!name) {
            this.setData({ playerModalError: "请输入球员名称。" });
            return;
        }
        if (players.some((player) => player.number === number)) {
            this.setData({
                playerModalError: `${getTeamLabel(team)}已有 ${number} 号球员。`
            });
            return;
        }
        this.setData({
            [rosterKey]: [...players, { number, name }],
            playerModalVisible: false,
            playerNumber: "",
            playerName: "",
            playerModalError: "",
            error: ""
        });
    },
    removePlayer(event) {
        const team = event.currentTarget.dataset.team === "away" ? "away" : "home";
        const rosterKey = getRosterKey(team);
        const index = Number(event.currentTarget.dataset.index);
        const players = [...this.data[rosterKey]];
        if (!Number.isInteger(index) || index < 0 || index >= players.length) {
            return;
        }
        players.splice(index, 1);
        this.setData({
            [rosterKey]: players,
            error: ""
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
                        players: this.data.homePlayers
                    },
                    {
                        name: this.data.awayTeamName,
                        color: this.data.awayTeamColor,
                        players: this.data.awayPlayers
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
