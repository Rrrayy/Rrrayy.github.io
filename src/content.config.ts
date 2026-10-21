import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const articles = defineCollection({
	loader: glob({
		pattern: "**/*.md",
		base: new URL("../blog/content", import.meta.url)
	})
});

export const collections = { articles };
