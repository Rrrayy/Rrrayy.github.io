export const profile = {
	name: "Rray",
	university: "南京邮电大学 · 计算机科学与技术",
	positioning: "C++ 系统工程与 LLM Agent 应用实践。",
	email: "3111937934@qq.com",
	github: "https://github.com/Rrrayy",
	csdn: "https://blog.csdn.net/rr666888?type=blog"
};

export const capabilities = [
	{
		name: "C++ 与系统",
		items: ["C++17", "STL", "RAII", "内存管理", "Linux", "Unix", "系统调用"]
	},
	{
		name: "网络与并发",
		items: ["Socket", "TCP/IP", "HTTP", "DNS", "epoll", "多线程", "原子操作", "线程池"]
	},
	{
		name: "分布式基础设施",
		items: ["RPC", "Protobuf", "muduo", "ZooKeeper", "一致性哈希", "Redis", "MySQL"]
	},
	{
		name: "AI 后端与 Agent",
		items: ["Python", "asyncio", "FastAPI", "httpx", "pytest", "OpenAI API", "Tool Calling", "RAG", "MCP"]
	},
	{
		name: "工程工具",
		items: ["CMake", "Make", "GDB", "Git", "Docker", "VS Code", "Claude Code", "Codex"]
	}
];

export const learningFocus = ["Linux 内核", "Agent Runtime"];

export const jobDesk = {
	name: "Job Desk",
	category: "本地求职工作台",
	description: "把投递当作流程管理：跟进看板、今日待办、沉默提醒、截止倒计时与面经复盘。单文件运行，不需要账号，数据保存在本机浏览器。",
	technologies: ["HTML", "CSS", "JavaScript", "浏览器本地存储"],
	repository: "https://github.com/Rrrayy/job-desk",
	release: "https://github.com/Rrrayy/job-desk/releases/latest",
	releaseVersion: "v0.7.3"
};

export const evidenceOps = {
	name: "EvidenceOps",
	status: "开发中",
	category: "本机软件故障诊断",
	description: "用 Agent 受限查询日志、指标、配置和排障资料，把运行观测与诊断建议关联成可回查的证据链。",
	capabilities: [
		"Agent Loop 与白名单工具运行时",
		"诊断事件、证据报告与历史回放",
		"20 案例离线评测与检索对照",
		"C++20 日志解析器与 Python Adapter"
	],
	technologies: ["Python", "FastAPI", "Next.js", "React", "C++20", "SQLite", "PostgreSQL"],
	publicRepository: false
};

export const rpcProject = {
	name: "RPC Framework",
	category: "C++ · 分布式通信",
	description: "从远程调用链路拆解协议、网络、服务发现与连接复用，保留可运行实现和压测边界。",
	technologies: ["C++", "Protobuf", "muduo", "ZooKeeper", "TCP"],
	repository: "https://github.com/Rrrayy/RPC"
};

export const updateLog = {
	date: "2026-10-21",
	title: "个人网站重构",
	description: "采用 Astro 与 TypeScript 重建内容站，按最新仓库状态整理 Job Desk、EvidenceOps 和 RPC。"
};
