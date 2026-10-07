import { JSONObject } from 'harmony-types';

export class Dota2ItemTemplate {
	#definition;

	constructor(definition: JSONObject) {
		this.#definition = definition;
	}

	get name() {
		return (this.#definition.name as string) ?? '';
	}

	get imageInventory() {
		return this.#definition.imageInventory;
	}

	get slot(): string {
		return (this.#definition.slot as string)?.toLowerCase();
	}

	get id(): string {
		return String(this.#definition.id);
	}

	getModelName(styleId: number, model: number = 0): string {
		const style = (this.#definition.styles as JSONObject)?.[styleId] as JSONObject;
		if (model == 0) {
			return (style?.model_player as string | undefined) ?? (this.#definition.modelPlayer as string | undefined) ?? '';
		} else {
			return (style?.['model_player' + model] as string | undefined) ?? (style?.model_player as string | undefined) ?? (this.#definition['modelPlayer' + model] as string | undefined) ?? (this.#definition.modelPlayer as string | undefined) ?? '';
		}
	}

	get repository() {
		return this.#definition.repository;
	}

	get isBaseItem() {
		return this.#definition.baseItem == 1;
	}

	get bundle() {
		return this.#definition.bundle;
	}

	get assetModifiers() {
		return this.#definition.assetmodifiers;
	}

	get rarity() {
		return this.#definition.rarity;
	}

	get skin() {
		return this.#definition.skin;
	}

	getSkin(styleId: number): number {
		const style = (this.#definition.styles as JSONObject)?.[styleId] as JSONObject;
		return (style?.skin as number | undefined) ?? (this.#definition.skin as number | undefined) ?? 0;

	}

	hasStyles() {
		return Object.keys(this.#definition.styles ?? {}).length > 1;
	}

	getStyle(styleId: number) {
		return (this.#definition.styles as JSONObject)?.[styleId] as JSONObject;
	}

	getStyles() {
		const ret = new Map<string, JSONObject>();
		const styles = this.#definition.styles as JSONObject;
		if (styles) {
			for (const styleId in styles) {
				ret.set(styleId, styles[styleId] as JSONObject);
			}
		}
		return ret;
	}
}
