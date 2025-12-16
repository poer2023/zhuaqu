import postgres from "postgres"

// ==================== Postgres NOTIFY Channel ====================

const NOTIFY_CHANNEL = "zhaqu_step_notify"

// ==================== Types ====================

type StepNotification = {
    type: "step_queued" | "step_completed" | "job_created"
    stepId?: string
    jobId?: string
    stepType?: string
    timestamp: string
}

type NotifyListener = (payload: StepNotification) => void

// ==================== State ====================

let sql: ReturnType<typeof postgres> | null = null
let isListening = false
const listeners: NotifyListener[] = []

// ==================== Connection ====================

function getConnectionString(): string {
    return process.env.DATABASE_URL || ""
}

async function getConnection(): Promise<ReturnType<typeof postgres>> {
    if (!sql) {
        sql = postgres(getConnectionString(), {
            // LISTEN/NOTIFY 需要长连接
            max: 1,
            idle_timeout: 0,
            connect_timeout: 10,
        })
    }
    return sql
}

// ==================== NOTIFY (Publisher) ====================

/**
 * 发送通知给订阅者
 * 当有新 step 进入队列或完成时调用
 */
export async function notifyStepQueued(stepId: string, stepType: string, jobId: string): Promise<void> {
    try {
        const conn = await getConnection()
        const payload: StepNotification = {
            type: "step_queued",
            stepId,
            jobId,
            stepType,
            timestamp: new Date().toISOString(),
        }
        await conn`SELECT pg_notify(${NOTIFY_CHANNEL}, ${JSON.stringify(payload)})`
    } catch (e) {
        // 通知失败不应阻塞主流程
        console.error("[notify] failed to send step_queued notification:", e)
    }
}

export async function notifyStepCompleted(stepId: string, stepType: string, jobId: string): Promise<void> {
    try {
        const conn = await getConnection()
        const payload: StepNotification = {
            type: "step_completed",
            stepId,
            jobId,
            stepType,
            timestamp: new Date().toISOString(),
        }
        await conn`SELECT pg_notify(${NOTIFY_CHANNEL}, ${JSON.stringify(payload)})`
    } catch (e) {
        console.error("[notify] failed to send step_completed notification:", e)
    }
}

export async function notifyJobCreated(jobId: string): Promise<void> {
    try {
        const conn = await getConnection()
        const payload: StepNotification = {
            type: "job_created",
            jobId,
            timestamp: new Date().toISOString(),
        }
        await conn`SELECT pg_notify(${NOTIFY_CHANNEL}, ${JSON.stringify(payload)})`
    } catch (e) {
        console.error("[notify] failed to send job_created notification:", e)
    }
}

// ==================== LISTEN (Subscriber) ====================

/**
 * 注册通知监听器
 */
export function addListener(listener: NotifyListener): () => void {
    listeners.push(listener)
    return () => {
        const idx = listeners.indexOf(listener)
        if (idx !== -1) listeners.splice(idx, 1)
    }
}

/**
 * 启动 LISTEN 订阅
 * 用于 worker 进程在等待时减少轮询
 */
export async function startListening(): Promise<void> {
    if (isListening) return

    try {
        const conn = await getConnection()

        await conn.listen(NOTIFY_CHANNEL, (payload) => {
            try {
                const notification = JSON.parse(payload) as StepNotification
                for (const listener of listeners) {
                    try {
                        listener(notification)
                    } catch (e) {
                        console.error("[notify] listener error:", e)
                    }
                }
            } catch (e) {
                console.error("[notify] failed to parse notification:", e)
            }
        })

        isListening = true
        console.log(`[notify] listening on channel: ${NOTIFY_CHANNEL}`)
    } catch (e) {
        console.error("[notify] failed to start listening:", e)
    }
}

/**
 * 停止监听
 */
export async function stopListening(): Promise<void> {
    if (!isListening || !sql) return

    try {
        await sql.end()
        sql = null
        isListening = false
        console.log("[notify] stopped listening")
    } catch (e) {
        console.error("[notify] failed to stop listening:", e)
    }
}

// ==================== Helper: Wait for Notification ====================

/**
 * 等待通知或超时
 * 用于 worker 在无任务时挂起，收到通知立即唤醒
 */
export function waitForNotification(timeoutMs: number): Promise<StepNotification | null> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            removeListener()
            resolve(null)
        }, timeoutMs)

        const removeListener = addListener((notification) => {
            clearTimeout(timeout)
            removeListener()
            resolve(notification)
        })
    })
}
