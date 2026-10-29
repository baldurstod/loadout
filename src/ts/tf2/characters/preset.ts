import { vec3 } from 'gl-matrix';
import { JSONArray, JSONObject } from 'harmony-types';
import { Tf2EffectType } from '../effects/effecttemplate';
import { KillstreakColor } from '../paints/killstreaks';

export class Tf2PresetItem {
	id = '';
	paint?: number;
	warpaintId?: number;
	warpaintWear?: number;
	warpaintSeed?: bigint;
	isTournamentMedal = false;
	isWorkshop = false;
	weaponEffect?: number;
	sheen?: number;
	showFestivizer = false;
	killCount?: number;

	fromJSON(json: JSONObject): boolean {
		if (json.id !== undefined) {
			this.id = json.id as string;
		}
		if (json.paint !== undefined) {
			this.paint = json.paint as number;
		}
		if (json.warpaint_id !== undefined) {
			this.warpaintId = json.warpaint_id as number;
		}
		if (json.warpaint_wear !== undefined) {
			this.warpaintWear = json.warpaint_wear as number;
		}
		if (json.warpaint_seed !== undefined) {
			this.warpaintSeed = BigInt(json.warpaint_seed as string);
		}
		// For legacy presets
		if (json.paintkit_id !== undefined) {
			this.warpaintId = json.paintkit_id as number;
		}
		if (json.paintkit_wear !== undefined) {
			this.warpaintWear = json.paintkit_wear as number;
		}
		if (json.paintkit_seed !== undefined) {
			this.warpaintSeed = BigInt(json.paintkit_seed as string);
		}
		if (json.weapon_effect !== undefined) {
			this.weaponEffect = json.weapon_effect as number;
		}
		if (json.sheen !== undefined) {
			this.sheen = json.sheen as number;
		}
		if (json.kill_count !== undefined) {
			this.killCount = json.kill_count as number;
		}
		this.showFestivizer = (json.show_festivizer as boolean) ?? false;
		this.isTournamentMedal = json.is_tournament_medal as boolean ?? false;
		this.isWorkshop = json.is_workshop as boolean ?? false;
		return true;
	}

	toJSON(): JSONObject/*TODO: improve type*/ {
		const j: JSONObject = {};

		j.id = this.id;
		if (this.paint !== undefined) {
			j.paint = this.paint;
		}
		if (this.warpaintId !== undefined) {
			j.warpaint_id = this.warpaintId;
		}
		if (this.warpaintWear !== undefined) {
			j.warpaint_wear = this.warpaintWear;
		}
		if (this.warpaintSeed !== undefined) {
			j.warpaint_seed = String(this.warpaintSeed);
		}
		if (this.weaponEffect !== undefined) {
			j.weapon_effect = this.weaponEffect;
		}
		if (this.sheen !== undefined) {
			j.sheen = this.sheen;
		}
		if (this.showFestivizer !== false) {
			j.show_festivizer = this.showFestivizer;
		}
		j.kill_count = this.killCount || undefined;
		if (this.isTournamentMedal != false) {
			j.is_tournament_medal = this.isTournamentMedal;
		}
		if (this.isWorkshop != false) {
			j.is_workshop = this.isWorkshop;
		}

		return j;
	}
}

export enum Tf2PresetEffectType {
	Unusual = "unusual",
	Taunt = "taunt",
	Killstreak = "killstreak",
	Weapon = "weapon",
	Other = "other",
}

const VEC3_ZERO = vec3.create();

export class Tf2PresetEffect {
	id = 0;
	type: Tf2PresetEffectType = Tf2PresetEffectType.Unusual;
	attachment? = '';
	offset = vec3.create();
	color?: KillstreakColor;

	setType(type: Tf2EffectType): void {
		switch (type) {
			case Tf2EffectType.Cosmetic:
				this.type = Tf2PresetEffectType.Unusual;
				break;
			case Tf2EffectType.Killstreak:
				this.type = Tf2PresetEffectType.Killstreak;
				break;
			case Tf2EffectType.Taunt:
				this.type = Tf2PresetEffectType.Taunt;
				break;
			case Tf2EffectType.Weapon:
				this.type = Tf2PresetEffectType.Weapon;
				break;
			case Tf2EffectType.Other:
				this.type = Tf2PresetEffectType.Other;
				break;
		}
	}

	getType(): Tf2EffectType {
		switch (this.type) {
			case Tf2PresetEffectType.Unusual:
				return Tf2EffectType.Cosmetic;
			case Tf2PresetEffectType.Killstreak:
				return Tf2EffectType.Killstreak;
			case Tf2PresetEffectType.Taunt:
				return Tf2EffectType.Taunt;
			case Tf2PresetEffectType.Weapon:
				return Tf2EffectType.Weapon;
			case Tf2PresetEffectType.Other:
				return Tf2EffectType.Other;
		}
	}

	fromJSON(json: JSONObject): boolean {
		if (json.id !== undefined) {
			this.id = json.id as number;
		}
		if (json.attachment !== undefined) {
			this.attachment = json.attachment as string;
		}
		if (json.type !== undefined) {
			this.type = json.type as Tf2PresetEffectType;
		}
		if (json.offset !== undefined) {
			vec3.copy(this.offset, json.offset as any);
		}
		if (json.color !== undefined) {
			this.color = json.color as any;
		}
		return true;
	}

	toJSON(): JSONObject {
		const j: { id: number, type: string, attachment?: string, offset?: [number, number, number], color?: number } = {
			id: this.id,
			type: this.type,
		}

		if (this.attachment) {
			j.attachment = this.attachment;
		}
		if (!vec3.exactEquals(this.offset, VEC3_ZERO)) {
			j.offset = this.offset as [number, number, number];
		}
		j.color = this.color;

		return j;
	}
}

export class Tf2Preset {
	character = '';
	name = '';
	items = new Set<Tf2PresetItem>();
	effects = new Set<Tf2PresetEffect>();
	decapitationLevel = 0;

	constructor(name?: string) {
		if (name !== undefined) {
			this.name = name;
		}
	}

	addItem(item: Tf2PresetItem): void {
		this.items.add(item);
	}

	addEffect(effect: Tf2PresetEffect): void {
		this.effects.add(effect);
	}

	fromJSON(json: JSONObject): boolean {
		if (json.name !== undefined) {
			this.name = json.name as string;
		}
		if (json.character !== undefined) {
			this.character = json.character as string;
		}
		if (json.items !== undefined) {
			//this.name = json.name as string;
			for (const itemJson of json.items as JSONArray) {
				const presetItem = new Tf2PresetItem();

				if (presetItem.fromJSON(itemJson as JSONObject)) {
					this.addItem(presetItem);
				}
			}

			for (const effectJson of json.effects as JSONArray) {
				const presetEffect = new Tf2PresetEffect();

				if (presetEffect.fromJSON(effectJson as JSONObject)) {
					this.addEffect(presetEffect);
				}
			}
		}
		if (json.decapitation_level !== undefined) {
			this.decapitationLevel = json.decapitation_level as number;
		}
		return true;
	}

	toJSON(): JSONObject {
		const j: { name: string, character: string, items: JSONObject[], effects: JSONObject[], decapitation_level?: number } = {
			name: this.name,
			character: this.character,
			items: [],
			effects: [],
		};

		for (const item of this.items) {
			j.items.push(item.toJSON());
		}

		for (const effect of this.effects) {
			j.effects.push(effect.toJSON());
		}

		if (this.decapitationLevel != 0) {
			j.decapitation_level = this.decapitationLevel;
		}

		return j;
	}
}

export class Tf2Presets {
	#presets = new Map<string, Tf2Preset>();
	selected?: string;

	addPreset(preset: Tf2Preset): void {
		this.#presets.set(preset.name, preset);
	}

	getPreset(name: string): Tf2Preset | undefined {
		return this.#presets.get(name);
	}

	getPresets(): Map<string, Tf2Preset> {
		return this.#presets;
	}

	removePreset(name: string): void {
		if (name == this.selected) {
			this.selected = undefined;
		}

		this.#presets.delete(name);
	}

	fromJSON(json: JSONObject): boolean {

		this.selected = json.selected as string;

		if (json.presets) {
			for (const preset of json.presets as JSONArray) {
				const p = new Tf2Preset();

				if (p.fromJSON(preset as JSONObject)) {
					this.addPreset(p);
				}
			}
		}

		return true;
	}

	toJSON(): JSONObject {
		const j: JSONObject = {};
		const presets: JSONObject[] = [];
		if (this.selected) {
			j.selected = this.selected;
		}
		j.presets = presets;

		for (const [, preset] of this.#presets) {
			presets.push(preset.toJSON());
		}

		return j;
	}
}
