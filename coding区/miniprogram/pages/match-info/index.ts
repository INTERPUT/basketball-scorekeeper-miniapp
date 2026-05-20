import type { MatchSnapshot } from "../../domain/models";
import { watchRoomSnapshot } from "../../services/cloudMatchService";

Page({
  data: {
    snapshot: null as MatchSnapshot | null,
    error: ""
  },
  unsubscribe: undefined as undefined | (() => void),

  async onLoad(query: Record<string, string | undefined>) {
    try {
      this.unsubscribe = await watchRoomSnapshot(query.roomCode ?? "", (snapshot) => {
        this.setData({
          snapshot,
          error: ""
        });
      });
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : "无法加载比赛。"
      });
    }
  },

  onUnload() {
    this.unsubscribe?.();
  }
});
