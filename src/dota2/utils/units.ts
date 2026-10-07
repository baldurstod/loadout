export type Dota2Unit = {
	name: string;
	Model?: string;
	include_keys_from?: string;
	IsNeutralUnitType?: string;
	ConsideredHero?: string;
}

export class Dota2Units {
	static #units = new Map<string, Dota2Unit>();

	static addUnit(id: string, unit: Dota2Unit): void {
		this.#units.set(id, unit);
	}

	static addUnits(units: Record<string, Dota2Unit>) {
		for (const id in units) {
			const unit = units[id]!;
			this.addUnit(id, unit);
		}
	}

	static getUnit(id: string): Dota2Unit | undefined {
		return this.#units.get(id);
	}

	static getModel(id: string): string | null {
		let unit = this.#units.get(id);
		if (!unit) {
			for (const [i, u] of this.#units) {
				if (i.startsWith(id)) {
					unit = u;
					break;
				}
			}
		}

		if (!unit) {
			return null;
		}

		if (unit.Model) {
			return unit.Model;
		}

		if (unit.include_keys_from) {
			return this.getModel(unit.include_keys_from);
		}
		return null;
	}

	static getName(id: string): string | null {
		let unit = this.#units.get(id);
		if (!unit) {
			for (const [i, u] of this.#units) {
				if (i.startsWith(id)) {
					//return u;
					unit = u;
					break;
				}
			}
		}

		if (!unit) {
			return null;
		}

		if (unit.name) {
			return unit.name;
		}

		if (unit.include_keys_from) {
			return this.getName(unit.include_keys_from);
		}
		return null;
	}

	static getUnits() {
		return this.#units;
	}
}
