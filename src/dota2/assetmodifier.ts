import { Dota2Item } from './items/item';

export type Dota2AssetModifierType = 'activity' | 'additional_wearable' | 'entity_model' | 'hero_model_change' | 'model' | 'model_skin' | 'particle' | 'particle_create' | 'persona' | 'pet' | 'portrait_background_model' | 'courier' | 'courier_flying' | 'entity_clientside_model' | 'arcana_level' | 'bodygroup_visibility';

export type Dota2AssetModifierJSON = {
	modifier?: string,
	type?: Dota2AssetModifierType,
	style?: string,
	asset?: string,
	level?: string,
	persona?: string,
	skin?: string,
	loadout_default_offset?: string,
	value?: string,
}

export class Dota2AssetModifier {
	#item: Dota2Item | null;
	#definition: Dota2AssetModifierJSON;

	constructor(item: Dota2Item | null, definition: Dota2AssetModifierJSON) {
		this.#item = item;
		this.#definition = definition;
	}

	get item() {
		return this.#item;
	}

	get type() {
		return this.#definition.type;
	}

	get asset() {
		return this.#definition.asset;
	}

	get modifier() {
		return this.#definition.modifier;
	}

	get persona() {
		return this.#definition.persona;
	}

	get skin() {
		return this.#definition.skin;
	}

	get style() {
		return this.#definition.style ?? 0;
	}

	get loadoutDefaultOffset() {
		return this.#definition.loadout_default_offset;
	}

	get level() {
		return this.#definition.level;
	}

	get value() {
		return this.#definition.value;
	}
}
