"use strict";
App({
    onLaunch() {
        wx.cloud.init({
            env: "cloudbase-d0gqn3qol9fab297a",
            traceUser: true
        });
    },
    globalData: {
        appName: "篮球技术台自动化"
    }
});
