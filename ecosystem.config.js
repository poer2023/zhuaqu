// PM2 进程管理配置文件
// 使用方式: pm2 start ecosystem.config.js
// 查看状态: pm2 status
// 查看日志: pm2 logs
// 停止所有: pm2 stop all
// 重启所有: pm2 restart all

module.exports = {
    apps: [
        {
            name: 'zhaqu-web',
            script: 'npm',
            args: 'run dev',  // 开发模式，生产环境改为 'run start'
            cwd: '/Users/wanghao/Project/zhaqu',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            restart_delay: 3000,
            max_restarts: 10,
            env: {
                NODE_ENV: 'development',
                PORT: 3000,
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
        },
        {
            name: 'zhaqu-worker',
            script: 'npx',
            args: 'tsx scripts/worker.ts',
            cwd: '/Users/wanghao/Project/zhaqu',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            restart_delay: 3000,
            max_restarts: 10,
            env: {
                NODE_ENV: 'development',
                WORKER_ROLE: 'all',
            },
        },
        {
            name: 'zhaqu-watchdog',
            script: 'npx',
            args: 'tsx scripts/watchdog.ts',
            cwd: '/Users/wanghao/Project/zhaqu',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            restart_delay: 5000,
            max_restarts: 10,
            env: {
                NODE_ENV: 'development',
            },
        },
    ],
}
