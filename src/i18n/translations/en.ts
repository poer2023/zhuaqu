// English translations
const en = {
    // Common
    common: {
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        create: "Create",
        search: "Search",
        filter: "Filter",
        loading: "Loading...",
        noData: "No data",
        confirm: "Confirm",
        back: "Back",
        next: "Next",
        previous: "Previous",
        submit: "Submit",
        clear: "Clear",
        close: "Close",
        export: "Export",
        import: "Import",
        refresh: "Refresh",
        viewAll: "View All",
    },

    // Navigation
    nav: {
        content: "Content",
        publish: "Publish",
        automation: "Automation",
        jobs: "Jobs",
        settings: "Settings",
        // Legacy keys for compatibility
        overview: "Overview",
        ingest: "Ingest",
        pools: "Pools",
        rewrite: "Rewrite",
        sync: "Sync",
        audit: "Audit",
    },


    // Ingest page
    ingest: {
        title: "Quick Ingest",
        description: "Batch import content URLs to your knowledge base",
        placeholder: "Paste X/Twitter URLs here, one per line...\n\n• https://x.com/elonmusk/status/...\n• https://twitter.com/sama/status/...",
        options: "Options",
        hideOptions: "Hide Options",
        startIngest: "Start Ingest",
        linksCount: "{count} links",
        destination: "Destination",
        selectWorkspace: "Select Workspace",
        selectPool: "Select Pool",
        tags: "Tags",
        threadMode: {
            title: "Thread Mode",
            single: "Single Only",
            thread: "Full Thread",
        },
        mediaAssets: {
            title: "Media Assets",
            downloadVideo: "Download video locally",
        },
        result: {
            completed: "Completed",
            processing: "Processing...",
            partialFailed: "Partial Failed",
            queued: "Queued",
            succeeded: "Succeeded",
            deduped: "Deduped",
            failed: "Failed",
        },
    },

    // Pools
    pools: {
        title: "Content Pools",
        addNew: "Add New",
        allPools: "All Pools",
        filterPlaceholder: "Filter...",
        columns: {
            author: "Author",
            content: "Content",
            status: "Status",
            date: "Date",
        },
        status: {
            ready: "Ready",
            approved: "Approved",
            published: "Published",
        },
        actions: {
            rewrite: "Rewrite",
            tag: "Tag",
            delete: "Delete",
        },
        selected: "{count} selected",
        noItems: "No content yet",
        importHint: "Import content from the Ingest page",
    },

    // Rewrite page
    rewrite: {
        title: "Rewrite Studio",
        newBatch: "New Batch",
        batches: "Batches",
        noBatches: "No batches yet",
        selectBatchHint: "Select a batch to start reviewing",
        createFromPools: "Or create a new batch from the Pools page",
        original: "Original",
        generated: "Generated",
        actions: {
            reject: "Reject",
            rework: "Rework",
            approve: "Approve",
            regen: "Regen",
            generating: "Generating...",
        },
        status: {
            generated: "Generated",
            approved: "Approved",
            rejected: "Rejected",
            rework: "Rework",
        },
    },

    // Publish page
    publish: {
        title: "Publish Center",
        description: "Manage your publication queue and schedule",
        pause: "Pause",
        resume: "Resume",
        post: "Post",
        upNext: "Up Next",
        failed: "Failed",
        history: "History",
        noQueued: "No queued jobs. Approve rewrites to add to queue.",
        noPublished: "No published content yet.",
        stats: {
            title: "Stats",
            queueDepth: "Queue Depth",
            pending: "Pending",
            successRate: "Success Rate",
            queueActive: "Queue Active",
            queuePaused: "Queue Paused",
        },
        actions: {
            retry: "Retry",
            cancel: "Cancel",
            view: "View",
        },
    },

    // Audit page
    audit: {
        title: "System Audit",
        description: "Track all content operations and system events",
        searchLogs: "Search logs...",
        allActions: "All Actions",
        noLogs: "No audit logs found",
        recordHint: "Actions will be recorded as you use the system",
        actions: {
            ingestCreated: "Ingest Created",
            ingestCompleted: "Ingest Completed",
            ingestFailed: "Ingest Failed",
            rewriteCreated: "Rewrite Created",
            rewriteGenerated: "Rewrite Generated",
            rewriteApproved: "Rewrite Approved",
            rewriteRejected: "Rewrite Rejected",
            rewriteRework: "Rewrite Rework",
            publishQueued: "Publish Queued",
            publishSucceeded: "Publish Success",
            publishFailed: "Publish Failed",
            itemMoved: "Item Moved",
            itemDeleted: "Item Deleted",
            itemTagged: "Tagged",
        },
    },

    // Settings page
    settings: {
        title: "Settings",
        description: "Manage workspace preferences and integrations",
        tabs: {
            preferences: "Preferences",
            general: "General",
            poolsTags: "Pools & Tags",
            system: "System",
            integrations: "Integrations",
        },
        workspace: {
            title: "Workspace",
            description: "Configure your primary workspace settings",
            name: "Workspace Name",
            defaultPool: "Default Pool",
            defaultPoolHint: "New ingests will default to this pool",
        },
        browser: {
            title: "Browser Publishing",
            description: "Use your browser session to publish directly to X",
            connected: "Connected",
            notConnected: "Not connected",
            loggedInAs: "Logged in as @{username}",
            openBrowser: "Open Browser",
            reLogin: "Re-login",
            waiting: "Waiting...",
            howItWorks: "How it works",
            step1: "Click \"Open Browser\" to launch Chromium",
            step2: "Log in to your X account in the browser window",
            step3: "Your session is saved locally for future use",
        },
        oauth: {
            title: "X API (OAuth)",
            description: "Requires API credentials",
            comingSoon: "Coming Soon",
        },
        language: {
            title: "Language",
            description: "Select interface display language",
        },
    },

    // Time related
    time: {
        justNow: "Just now",
        minutesAgo: "{count} min ago",
        hoursAgo: "{count} hr ago",
        daysAgo: "{count} days ago",
    },
}

export default en
