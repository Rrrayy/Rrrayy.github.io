import articleData from "../data/articles.json";

export type Article = {
	title: string;
	date: string;
	category: string;
	tags: string[];
	csdn_url: string;
	slug: string;
	word_count: number;
	reading_time: number;
	summary: string;
	prerequisite: string;
	source_path: string;
};

export const articles = articleData as Article[];

export const sortedArticles = [...articles].sort((left, right) => {
	return new Date(right.date.replace(" ", "T")).getTime() - new Date(left.date.replace(" ", "T")).getTime();
});

export function categorySlug(category: string) {
	const slugs: Record<string, string> = {
		"AI 后端": "ai-backend",
		"C++ 新特性": "cpp-features",
		"分布式系统": "distributed-systems",
		"并发编程": "concurrency",
		"文件系统": "file-systems",
		"IO 模型": "io-models",
		"内存管理": "memory-management",
		"操作系统": "operating-systems",
		"编译器工具链": "compiler-toolchain"
	};

	return slugs[category] ?? encodeURIComponent(category);
}

export function tagSlug(tag: string) {
	const slugs: Record<string, string> = {
		"C++": "cpp",
		"C++11": "cpp11",
		"IO 模型": "io-models"
	};

	return slugs[tag] ?? tag.toLowerCase();
}

export function articleSourceId(sourcePath: string) {
	return sourcePath
		.replaceAll("\\", "/")
		.replace(/^.*?blog\/content\//i, "")
		.replace(/\.md$/i, "")
		.normalize("NFC")
		.toLocaleLowerCase("zh-CN");
}

export function articleDate(date: string) {
	return date.slice(0, 10).replaceAll("-", ".");
}

export function readTimeLabel(minutes: number) {
	return `${minutes} 分钟`;
}
