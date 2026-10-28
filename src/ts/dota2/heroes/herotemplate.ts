import { JSONObject } from 'harmony-types';

export type Dota2HeroSlot = {
	DisplayInLoadout?: string,
	SlotIndex: string,
	SlotName: string,
	SlotText: string,
	GeneratesUnits: Record<string, string>,
}

export class Dota2HeroTemplate {
	#definition: JSONObject;

	constructor(definition: JSONObject) {
		this.#definition = definition;
	}

	get name(): string {
		return this.#definition.Name as string;
	}

	get id(): string {
		return this.#definition.ID as string;
	}

	get heroOrderId(): number {
		return Number(this.#definition.HeroOrderID);
	}

	get itemSlots(): Map<string, Dota2HeroSlot> | undefined {
		const itemSlots = this.#definition.ItemSlots as JSONObject;
		if (!itemSlots) {
			return;
		}

		const slots = new Map<string, Dota2HeroSlot>();

		for (const slotName in itemSlots) {
			const slot = itemSlots[slotName] as JSONObject;
			const slotLowerCase = (slot.SlotName as string).toLowerCase();
			slots.set(slotLowerCase, {
				...(slot.DisplayInLoadout !== undefined) && { DisplayInLoadout: slot.DisplayInLoadout as string },
				SlotIndex: slot.SlotIndex as string,
				SlotName: slotLowerCase,
				SlotText: slot.SlotText as string,
				GeneratesUnits: slot.GeneratesUnits as Record<string, string>,
			});
		}
		return slots;
	}

	getSpawnedUnits(): Array<string> {
		return Array.from((this.#definition.spawned_units as string[]) ?? []);
	}

	isHero(): boolean {
		return this.#definition['is_hero'] as boolean;
	}

	getModelCount(): number {
		let i = 0;
		for (; i == 0 || this.#definition[`Model${i}`];) {
			++i;
		}
		return i;
	}

	getModelPath(modelID: number): string {
		return (this.#definition[`Model${modelID}`] as string) ?? this.#definition.Model as string ?? '';
	}

	getAdjective(name: string): string | undefined {
		return (this.#definition.Adjectives as Record<string, string>)?.[name];
	}
}
