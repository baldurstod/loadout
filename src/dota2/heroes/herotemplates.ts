import { JSONObject } from 'harmony-types';
import { Dota2HeroTemplate } from './herotemplate';

export class Dota2HeroTemplates {
	static #templates = new Map<string, Dota2HeroTemplate>();
	static heroCount = 0;

	static addTemplate(templateJSON: JSONObject/*TODO: improve type*/): void {
		const template = new Dota2HeroTemplate(templateJSON)
		this.#templates.set(templateJSON.ID as string, template);

		if (template.isHero()) {
			++this.heroCount;
		}
	}

	static getTemplate(id: string): Dota2HeroTemplate | undefined {
		return this.#templates.get(id);
	}

	static getTemplates(): Map<string, Dota2HeroTemplate> {
		return this.#templates;
	}
}
