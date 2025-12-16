import "dotenv/config"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg")

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error("DATABASE_URL is required")
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🌱 开始初始化数据库...')

    // 创建默认工作区
    const workspace = await prisma.workspace.upsert({
        where: { id: 'default-workspace' },
        update: {},
        create: {
            id: 'default-workspace',
            name: '默认工作区',
            description: '系统默认工作区，用于管理 X 内容',
            settings: {
                defaultThreadMode: 'current',
                defaultMediaMode: 'link',
                requirePublishConfirm: true,
                includeSourceLink: false,
            },
        },
    })

    console.log(`✅ 创建工作区: ${workspace.name}`)

    // 创建默认素材池
    const pools = await Promise.all([
        prisma.pool.upsert({
            where: { id: 'pool-general' },
            update: {},
            create: {
                id: 'pool-general',
                workspaceId: workspace.id,
                name: '通用素材',
                description: '未分类的素材收集',
            },
        }),
        prisma.pool.upsert({
            where: { id: 'pool-ideas' },
            update: {},
            create: {
                id: 'pool-ideas',
                workspaceId: workspace.id,
                name: '灵感收集',
                description: '值得深入思考的观点和灵感',
            },
        }),
        prisma.pool.upsert({
            where: { id: 'pool-cases' },
            update: {},
            create: {
                id: 'pool-cases',
                workspaceId: workspace.id,
                name: '案例库',
                description: '行业案例和最佳实践',
            },
        }),
    ])

    console.log(`✅ 创建素材池: ${pools.map((p: { name: string }) => p.name).join(', ')}`)

    // 更新工作区默认素材池
    await prisma.workspace.update({
        where: { id: workspace.id },
        data: { defaultPoolId: pools[0].id },
    })

    // 创建默认标签
    const tags = await Promise.all([
        prisma.tag.upsert({
            where: { workspaceId_name: { workspaceId: workspace.id, name: '重要' } },
            update: {},
            create: {
                workspaceId: workspace.id,
                name: '重要',
                color: '#ef4444',
            },
        }),
        prisma.tag.upsert({
            where: { workspaceId_name: { workspaceId: workspace.id, name: '待深入' } },
            update: {},
            create: {
                workspaceId: workspace.id,
                name: '待深入',
                color: '#f59e0b',
            },
        }),
        prisma.tag.upsert({
            where: { workspaceId_name: { workspaceId: workspace.id, name: '灵感' } },
            update: {},
            create: {
                workspaceId: workspace.id,
                name: '灵感',
                color: '#10b981',
            },
        }),
        prisma.tag.upsert({
            where: { workspaceId_name: { workspaceId: workspace.id, name: '案例' } },
            update: {},
            create: {
                workspaceId: workspace.id,
                name: '案例',
                color: '#3b82f6',
            },
        }),
    ])

    console.log(`✅ 创建标签: ${tags.map((t: { name: string }) => t.name).join(', ')}`)

    // 创建默认改写预设
    const presets = await Promise.all([
        prisma.rewritePreset.upsert({
            where: { id: 'preset-professional' },
            update: {},
            create: {
                id: 'preset-professional',
                workspaceId: workspace.id,
                name: '专业深度分析',
                description: '适合行业洞察和深度思考的内容',
                targetPersona: '行业专家',
                audienceTone: '专业但易懂',
                stance: 'neutral',
                outputFormat: 'single',
                includeHook: true,
                includeConclusion: true,
                includeCTA: false,
                requireFactCheck: true,
                includeSource: false,
                language: 'zh',
                isDefault: true,
            },
        }),
        prisma.rewritePreset.upsert({
            where: { id: 'preset-casual' },
            update: {},
            create: {
                id: 'preset-casual',
                workspaceId: workspace.id,
                name: '轻松科普风格',
                description: '适合日常分享和科普类内容',
                targetPersona: '内容创作者',
                audienceTone: '轻松友好',
                stance: 'agree',
                outputFormat: 'single',
                includeHook: true,
                includeConclusion: false,
                includeCTA: true,
                requireFactCheck: false,
                includeSource: false,
                language: 'zh',
                isDefault: false,
            },
        }),
        prisma.rewritePreset.upsert({
            where: { id: 'preset-concise' },
            update: {},
            create: {
                id: 'preset-concise',
                workspaceId: workspace.id,
                name: '简洁观点输出',
                description: '直击要点的简短观点',
                targetPersona: '意见领袖',
                audienceTone: '犀利简洁',
                stance: 'supplement',
                outputFormat: 'single',
                includeHook: false,
                includeConclusion: true,
                includeCTA: false,
                requireFactCheck: false,
                includeSource: false,
                language: 'zh',
                isDefault: false,
            },
        }),
    ])

    console.log(`✅ 创建改写预设: ${presets.map((p: { name: string }) => p.name).join(', ')}`)

    // 创建一些示例内容（用于演示）
    const sampleItems = await Promise.all([
        prisma.contentItem.upsert({
            where: { workspaceId_sourceId: { workspaceId: workspace.id, sourceId: 'sample-1' } },
            update: {},
            create: {
                workspaceId: workspace.id,
                poolId: pools[0].id,
                sourceId: 'sample-1',
                sourceUrl: 'https://x.com/elonmusk/status/sample1',
                authorHandle: 'elonmusk',
                authorName: 'Elon Musk',
                textOriginal: 'Exciting developments in AI! The future is closer than we think. We are seeing unprecedented progress in language models and their applications across industries.',
                lang: 'en',
                rawJson: { type: 'sample', createdAt: new Date().toISOString() },
                media: [],
                captureStatus: 'READY',
                rewriteStatus: 'NONE',
                publishStatus: 'NOT_PUBLISHED',
            },
        }),
        prisma.contentItem.upsert({
            where: { workspaceId_sourceId: { workspaceId: workspace.id, sourceId: 'sample-2' } },
            update: {},
            create: {
                workspaceId: workspace.id,
                poolId: pools[1].id,
                sourceId: 'sample-2',
                sourceUrl: 'https://x.com/sama/status/sample2',
                authorHandle: 'sama',
                authorName: 'Sam Altman',
                textOriginal: 'The most important skill is learning how to learn. In a world of constant change, adaptability is everything. Focus on principles, not tactics.',
                lang: 'en',
                rawJson: { type: 'sample', createdAt: new Date().toISOString() },
                media: [],
                captureStatus: 'READY',
                rewriteStatus: 'NONE',
                publishStatus: 'NOT_PUBLISHED',
            },
        }),
        prisma.contentItem.upsert({
            where: { workspaceId_sourceId: { workspaceId: workspace.id, sourceId: 'sample-3' } },
            update: {},
            create: {
                workspaceId: workspace.id,
                poolId: pools[2].id,
                sourceId: 'sample-3',
                sourceUrl: 'https://x.com/naval/status/sample3',
                authorHandle: 'naval',
                authorName: 'Naval',
                textOriginal: 'The best startup ideas come from personal experience. Solve your own problems first, then scale the solution to help others facing similar challenges.',
                lang: 'en',
                rawJson: { type: 'sample', createdAt: new Date().toISOString() },
                media: [],
                captureStatus: 'READY',
                rewriteStatus: 'NONE',
                publishStatus: 'NOT_PUBLISHED',
            },
        }),
    ])

    console.log(`✅ 创建示例内容: ${sampleItems.length} 条`)

    // 为示例内容添加标签
    await prisma.contentItemTag.createMany({
        data: [
            { contentItemId: sampleItems[0].id, tagId: tags[0].id },
            { contentItemId: sampleItems[0].id, tagId: tags[2].id },
            { contentItemId: sampleItems[1].id, tagId: tags[1].id },
            { contentItemId: sampleItems[2].id, tagId: tags[3].id },
        ],
        skipDuplicates: true,
    })

    console.log('✅ 添加标签关联')

    console.log('\n🎉 数据库初始化完成！')
    console.log(`
📊 初始化统计:
   - 工作区: 1
   - 素材池: ${pools.length}
   - 标签: ${tags.length}
   - 改写预设: ${presets.length}
   - 示例内容: ${sampleItems.length}
  `)
}

main()
    .catch((e) => {
        console.error('❌ 初始化失败:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
