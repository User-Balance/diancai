const {cloudEnv} = require('./config');
App({onLaunch() { if (cloudEnv && wx.cloud) wx.cloud.init({env:cloudEnv,traceUser:false}); }});
