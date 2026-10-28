import { DOTA2_REPOSITORY, DOTA2_GENERATED_ITEMS } from '../constants';
import { Dota2LoadoutController } from '../controller';
import { Dota2Units } from '../utils/units';
import { Dota2ItemTemplates } from './itemtemplates';

export class Dota2ItemManager {
	static #characterTemplates = new Map();
	static #characters = new Map();
	static #itemsPerCharacter = new Map<string, Promise<Set<string>>>();

	static async #loadItems(characterId: string): Promise<Set<string>> {
		let items = this.#itemsPerCharacter.get(characterId);
		if (items) {
			return items;
		}

		items = new Promise<Set<string>>(async resolve => {
			const response = await fetch(new URL(`${DOTA2_GENERATED_ITEMS}${characterId}.json`, DOTA2_REPOSITORY));

			if (!response) {
				return false;
			}

			const itemsJSON = await response.json();
			if (!itemsJSON) {
				return false;
			}

			const characterItems = new Set<string>();

			for (const item of itemsJSON) {
				Dota2ItemTemplates.addTemplate(item);
				characterItems.add(String(item.id));
			}

			Dota2LoadoutController.dispatchEvent('itemsloaded', { detail: characterId });
			resolve(characterItems);
		});


		this.#itemsPerCharacter.set(characterId, items);

		return items;
	}

	static async #loadNeutralCreeps(characterId: string): Promise<Set<string>> {
		const items = new Set<string>();
		for (const [key, unit] of Dota2Units.getUnits()) {
			if (unit.IsNeutralUnitType == '1' && unit.ConsideredHero != '1') {
				const item = {
					id: key,
					name: unit.name,
					slot: 'neutral_creeps',
					assetmodifiers: [
						{
							"asset": characterId,
							"modifier": unit.Model,
							"type": 'entity_model',
						},
					],
				}

				Dota2ItemTemplates.addTemplate(item);
				items.add(key);
			}
		}

		return items;
	}

	static async getItems(characterId: string): Promise<Set<string>> {
		if (characterId === 'neutralcreeps') {
			return this.#loadNeutralCreeps(characterId);
		} else {
			return this.#loadItems(characterId);
		}
	}

	static async getBaseItemId(characterId: string, slot: string): Promise<string | null> {
		const items = await this.#loadItems(characterId);
		if (!items) {
			return null;
		}
		for (const itemId of items) {
			const item = Dota2ItemTemplates.getTemplate(itemId);
			if (item?.isBaseItem && item?.slot == slot) {
				return itemId;
			}
		}
		return null;
	}
};
