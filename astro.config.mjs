import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://rrrayy.github.io",
	output: "static",
	build: {
		format: "directory"
	},
	markdown: {
		shikiConfig: {
			theme: "github-light",
			langs: ["bash", "c", "cpp", "json", "python", "sql", "text", "typescript", "yaml"]
		}
	}
});
