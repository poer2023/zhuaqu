// 简体中文翻译
const zh = {
    // 通用
    common: {
        save: "保存",
        cancel: "取消",
        delete: "删除",
        edit: "编辑",
        create: "创建",
        search: "搜索",
        filter: "筛选",
        loading: "加载中...",
        noData: "暂无数据",
        confirm: "确认",
        back: "返回",
        next: "下一步",
        previous: "上一步",
        submit: "提交",
        clear: "清空",
        close: "关闭",
        export: "导出",
        import: "导入",
        refresh: "刷新",
        viewAll: "查看全部",
    },

    // 导航
    nav: {
        content: "内容",
        publish: "发布",
        automation: "自动化",
        jobs: "任务",
        settings: "设置",
        // Legacy keys for compatibility
        overview: "概览",
        ingest: "入库",
        pools: "素材池",
        rewrite: "改写",
        sync: "同步",
        audit: "审计",
    },


    // 入库页
    ingest: {
        title: "快速入库",
        description: "批量导入内容 URL 到知识库",
        placeholder: "在此粘贴 X/Twitter URL，每行一个...\n\n• https://x.com/elonmusk/status/...\n• https://twitter.com/sama/status/...",
        options: "选项",
        hideOptions: "隐藏选项",
        startIngest: "开始入库",
        linksCount: "{count} 条链接",
        destination: "目标位置",
        selectWorkspace: "选择工作区",
        selectPool: "选择素材池",
        tags: "标签",
        threadMode: {
            title: "线程模式",
            single: "仅单条",
            thread: "完整线程",
        },
        mediaAssets: {
            title: "媒体资源",
            downloadVideo: "下载视频到本地",
        },
        result: {
            completed: "已完成",
            processing: "处理中...",
            partialFailed: "部分失败",
            queued: "排队中",
            succeeded: "成功",
            deduped: "去重",
            failed: "失败",
        },
    },

    // 素材池
    pools: {
        title: "素材池",
        addNew: "添加新内容",
        allPools: "所有素材池",
        filterPlaceholder: "筛选...",
        columns: {
            author: "作者",
            content: "内容",
            status: "状态",
            date: "日期",
        },
        status: {
            ready: "就绪",
            approved: "已通过",
            published: "已发布",
        },
        actions: {
            rewrite: "改写",
            tag: "打标签",
            delete: "删除",
        },
        selected: "{count} 条已选择",
        noItems: "暂无内容",
        importHint: "从入库页面导入内容",
    },

    // 改写页
    rewrite: {
        title: "改写工作室",
        newBatch: "新建批次",
        batches: "批次列表",
        noBatches: "暂无批次",
        selectBatchHint: "选择批次开始审阅",
        createFromPools: "或从素材池创建新批次",
        original: "原文",
        generated: "生成",
        actions: {
            reject: "拒绝",
            rework: "重做",
            approve: "通过",
            regen: "重新生成",
            generating: "生成中...",
        },
        status: {
            generated: "已生成",
            approved: "已通过",
            rejected: "已拒绝",
            rework: "需修改",
        },
    },

    // 发布页
    publish: {
        title: "发布中心",
        description: "管理发布队列和定时任务",
        pause: "暂停",
        resume: "恢复",
        post: "发布",
        upNext: "待发布",
        failed: "失败",
        history: "历史",
        noQueued: "暂无排队任务。通过审阅后的改写内容将添加到队列。",
        noPublished: "暂无已发布内容。",
        stats: {
            title: "统计",
            queueDepth: "队列深度",
            pending: "待处理",
            successRate: "成功率",
            queueActive: "队列运行中",
            queuePaused: "队列已暂停",
        },
        actions: {
            retry: "重试",
            cancel: "取消",
            view: "查看",
        },
    },

    // 审计页
    audit: {
        title: "系统审计",
        description: "追踪所有内容操作和系统事件",
        searchLogs: "搜索日志...",
        allActions: "所有操作",
        noLogs: "暂无审计日志",
        recordHint: "系统操作将被记录在此",
        actions: {
            ingestCreated: "入库创建",
            ingestCompleted: "入库完成",
            ingestFailed: "入库失败",
            rewriteCreated: "改写创建",
            rewriteGenerated: "改写生成",
            rewriteApproved: "改写通过",
            rewriteRejected: "改写拒绝",
            rewriteRework: "改写重做",
            publishQueued: "发布排队",
            publishSucceeded: "发布成功",
            publishFailed: "发布失败",
            itemMoved: "移动条目",
            itemDeleted: "删除条目",
            itemTagged: "打标签",
        },
    },

    // 设置页
    settings: {
        title: "设置",
        description: "管理工作区偏好和集成",
        tabs: {
            preferences: "偏好设置",
            general: "通用",
            poolsTags: "素材池与标签",
            system: "系统",
            integrations: "集成",
        },
        workspace: {
            title: "工作区",
            description: "配置主要工作区设置",
            name: "工作区名称",
            defaultPool: "默认素材池",
            defaultPoolHint: "新入库内容将默认添加到此素材池",
        },
        browser: {
            title: "浏览器发布",
            description: "使用浏览器会话直接发布到 X",
            connected: "已连接",
            notConnected: "未连接",
            loggedInAs: "已登录为 @{username}",
            openBrowser: "打开浏览器",
            reLogin: "重新登录",
            waiting: "等待中...",
            howItWorks: "工作原理",
            step1: '点击"打开浏览器"启动 Chromium',
            step2: "在浏览器窗口中登录 X 账号",
            step3: "登录会话将保存到本地供后续使用",
        },
        oauth: {
            title: "X API (OAuth)",
            description: "需要 API 凭证",
            comingSoon: "即将推出",
        },
        language: {
            title: "语言",
            description: "选择界面显示语言",
        },
    },

    // 时间相关
    time: {
        justNow: "刚刚",
        minutesAgo: "{count} 分钟前",
        hoursAgo: "{count} 小时前",
        daysAgo: "{count} 天前",
    },
}

export default zh
