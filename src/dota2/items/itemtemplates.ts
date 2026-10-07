import { JSONObject } from 'harmony-types';
import { Dota2ItemTemplate } from './itemtemplate';

export class Dota2ItemTemplates {
	static #templates = new Map<string, Dota2ItemTemplate>();
	static #templatesByName = new Map<string, string>();

	static addTemplate(templateJSON: JSONObject): void {
		this.#templates.set(String(templateJSON.id), new Dota2ItemTemplate(templateJSON));
		this.#templatesByName.set(templateJSON.name as string, String(templateJSON.id));
	}

	static getTemplate(id: string) {
		return this.#templates.get(id);
	}

	static getTemplateByName(name: string): string | undefined {
		return this.#templatesByName.get(name);
	}

	static getTemplates() {
		return this.#templates;
	}
}
