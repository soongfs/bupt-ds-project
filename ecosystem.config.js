// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'travel-mate',        // 在 pm2 中的应用名称
      script: './app.js',         // 启动命令：node app.js
      instances: 1,               // 实例数：1 个实例。如果需要多实例可改为 'max'
      exec_mode: 'fork',          // 启动模式：fork（单进程）。若想开集群可改为 'cluster'
      autorestart: true,          // 程序崩溃后自动重启
      watch: false,               // 是否监听文件改动自动重启。开发时可设 true，生产时设 false
      max_memory_restart: '500M', // 内存占用超过 500M 自动重启
      env: {
        NODE_ENV: 'development',
        PORT: 3000                // 运行时环境变量 PORT=3000（你的 app.js 应该读取 process.env.PORT）
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};