import { quat, vec3 } from 'gl-matrix';
import { Camera, Entity, getSceneExplorer, GraphicPickEvent, GraphicsEvents, Scene } from 'harmony-3d';
import { OptionsManager, OptionsManagerEvents } from 'harmony-browser-utils';
import { JSONObject, uint } from 'harmony-types';
import positionJSON from '../../../json/slotsposition.json';
import { TF2_TOOLBOX_MODEL } from '../constants';
import { Tf2LoadoutController } from '../controller';
import { Tf2Team, UsePlayerModels } from '../enums';
import { Tf2ItemManager } from '../items/itemmanager';
import { ClassAnimations, getTf2ClassAnimations } from './animations';
import { Ragdoll, Tf2Character } from './character';
import { Tf2CharactersList, Tf2Class } from './characters';
import { Tf2Preset, Tf2Presets } from './preset';
export { positionJSON };

class CharacterSlot {
	character: Tf2Character | null = null;
	readonly position = vec3.create();
	readonly orientation = quat.clone(DEFAULT_ORIENTATION);

	async setPosition(position: vec3): Promise<void> {
		vec3.copy(this.position, position);
		(await this.character?.getModel())?.setPosition(position);
	}

	async setOrientation(orientation: quat): Promise<void> {
		quat.copy(this.orientation, orientation);
		(await this.character?.getModel())?.setOrientation(orientation);
	}
}

type CharacterPosition = {
	position: vec3;
	orientation: quat;
}

export type CustomDisposition = {
	countX: number,
	countY: number,
	countZ: number,
}

const DEFAULT_ORIENTATION = quat.fromValues(0, 0, -1, 1);
const TOOLBOX_POSITION = vec3.fromValues(-71.0726394653, 195.8566589355, 0);
const TOOLBOX_ORIENTATION = quat.fromValues(0, 0, -0.5927425026893616, 0.8053920269012451);

export class Tf2CharacterManager {
	static readonly #characterSlots: CharacterSlot[] = [new CharacterSlot()];
	static #currentSlot: CharacterSlot | null = null;
	static readonly #unusedCharacters: Tf2Character[] = [];
	static #currentCharacter: Tf2Character | null = null;
	static #team: Tf2Team = 'red';
	static readonly #slotsPositions = new Map<string, CharacterPosition[]>();
	static #applyToAll = true;
	static #useBots: UsePlayerModels = 'human';
	static readonly #presets = new Map<string, Tf2Presets>();
	static #firstPersonCamera?: Camera;

	static {
		GraphicsEvents.addEventListener('tick', () => this.#updatePaintColor());
		GraphicsEvents.addEventListener('pick', (event: Event) => this.#pickedModel(event as CustomEvent<GraphicPickEvent>));
		Tf2LoadoutController.addEventListener('setinvulnerable', event => { this.#setInvulnerable(event.detail); return; },);
		Tf2LoadoutController.addEventListener('setragdoll', event => { this.#setRagdoll(event.detail); return; },);
		Tf2LoadoutController.addEventListener('setanim', event => this.#setAnim(event.detail));
		Tf2LoadoutController.addEventListener('setapplytoall', event => this.#applyToAll = (event as CustomEvent<boolean>).detail);
		Tf2LoadoutController.addEventListener('usebots', event => this.#useBots = (event as CustomEvent<UsePlayerModels>).detail);
		Tf2LoadoutController.addEventListener('importpresets', event => { this.#importPresets(event.detail) });
		Tf2LoadoutController.addEventListener('changeanimframe', event => { this.#changeAnimFrame(event.detail) });

		OptionsManagerEvents.addEventListener('app.loadout.presets', (event: Event) => this.#loadPresets((event as CustomEvent).detail.value));
		this.#initDispositions();
	}

	static setFirstPersonCamera(camera: Camera): void {
		this.#firstPersonCamera = camera;
	}

	static async selectCharacter(characterClass: Tf2Class, scene: Scene, slotId?: uint): Promise<Tf2Character> {
		const slot = this.getSlot(slotId);

		if (slot.character?.characterClass == characterClass) {
			slot.character.setVisible(true);
			// the same character is selected again
			return slot.character;
		}

		this.#removeCharacter(slot);
		const character = this.#getUnusedCharacter(characterClass) ?? new Tf2Character(characterClass);
		slot.character = character;
		// set the character visible
		character.setVisible(true);
		character.setTeam(this.#team);

		const characterTemplate = Tf2CharactersList.get(characterClass);
		if (characterTemplate) {
			const modelName = characterTemplate.name;
			character.loadModel(scene, characterTemplate.path, modelName);

			const model = await character.getModel();
			if (model) {
				model.sourceModel.mdl.addExternalMdl('models/player/loadout_tf/' + modelName.toLowerCase().replace(/bots\/[^\/]*\/bot_/, 'player/') + '_loadout_tf_animations.mdl');
				if (model) {
					character.autoSelectAnim();
					//model.playSequence(startAnim);
					//model.setAnimation(0, startAnim, 1);
					model.setPosition(slot.position);
					model.setOrientation(slot.orientation);
				}
			}
		}

		this.#setCurrentCharacter(character);

		return character;
	}

	static removeCharacter(slotId?: uint): void {
		const slot = this.getSlot(slotId);
		this.#removeCharacter(slot);
	}

	static #getUnusedCharacter(characterClass: Tf2Class): Tf2Character | null {
		for (let i = 0; i < this.#unusedCharacters.length; i++) {
			const character = this.#unusedCharacters[i]!;
			if (character.characterClass == characterClass) {
				this.#unusedCharacters.splice(i, 1);
				return character;
			}
		}
		return null;
	}

	static #setCurrentCharacter(character: Tf2Character): void {
		this.#currentCharacter = character;
		//ItemManager.setCharacterClass(character.characterClass);
		Tf2ItemManager.setCurrentCharacter(character);
		//EffectManager.setCurrentCharacter(character);
		Tf2LoadoutController.dispatchEvent('characterchanged', { detail: character });

		(async (): Promise<void> => {
			const model = await character.getModel();
			if (model) {
				const selectedEntity = getSceneExplorer().getSelectedEntity();

				if (!selectedEntity || !selectedEntity.isParent(model)) { // Only switch entity if not parent of currently selected entity
					getSceneExplorer().selectEntity(model);
				}

				model.getBoneByName('bip_head')?.addChild(this.#firstPersonCamera);
			}
		})();
	}

	static #removeCharacter(slot: CharacterSlot): void {
		const character = slot?.character;
		if (character) {
			character.setVisible(false);
			this.#unusedCharacters.push(character);
			slot.character = null;
		}
	}

	static getSlot(slotId?: uint): CharacterSlot {

		if (slotId !== undefined) {
			const slot = this.#characterSlots[slotId];
			if (slot) {
				return slot;
			}
		}

		for (const slot of this.#characterSlots) {
			if (slot == this.#currentSlot || !slot.character || slot.character.characterClass == Tf2Class.None || slot.character.characterClass == Tf2Class.Empty || slot.character.characterClass == Tf2Class.CompareWarpaints) {
				return slot;
			}
		}

		return this.#characterSlots[this.#characterSlots.length - 1]!;
	}

	static setSlotsCount(size: uint, removeExisting = false): void {
		const slots = this.#characterSlots;

		size = Math.max(size, 1);

		const removeStart = removeExisting ? 0 : size - 1;
		for (let i = removeStart; i < slots.length; i++) {
			this.#removeCharacter(slots[i]!);
		}
		for (let i = slots.length; i < size; i++) {
			slots.push(new CharacterSlot());
		}
	}

	static async setTeam(team: Tf2Team): Promise<void> {
		const slots = this.#characterSlots;

		this.#team = team;
		if (this.#applyToAll) {
			for (const slot of slots) {
				if (slot) {
					await slot.character?.setTeam(team);
				}
			}
		} else {
			const character = this.getCurrentCharacter();
			if (character) {
				character.setTeam(team);
			}
		}
	}

	static getTeam(): Tf2Team {
		return this.#team;
	}

	static getCurrentCharacter(): Tf2Character | null {
		return this.#currentCharacter;
	}

	static setCustomTexture(itemId: string, customTextureName: string): void {
		const currentCharacter = this.getCurrentCharacter();
		if (currentCharacter) {
			const item = currentCharacter.getItemById(itemId);
			if (item) {
				item.setCustomTexture(customTextureName);
			}
		}
	};

	static #updatePaintColor(): void {
		for (const slot of this.#characterSlots) {
			if (slot) {
				slot.character?.updatePaintColor();
			}
		}
	};

	static async #setInvulnerable(invulnerable: boolean): Promise<void> {
		const slots = this.#characterSlots;

		if (this.#applyToAll) {
			for (const slot of slots) {
				if (slot) {
					await slot.character?.setInvulnerable(invulnerable);
				}
			}
		} else {
			await this.getCurrentCharacter()?.setInvulnerable(invulnerable);
		}
	}

	static async #setRagdoll(ragdoll: Ragdoll): Promise<void> {
		if (this.#applyToAll) {
			for (const slot of this.#characterSlots) {
				if (slot) {
					await slot.character?.setRagdoll(ragdoll);
				}
			}
		} else {
			await this.getCurrentCharacter()?.setRagdoll(ragdoll);
		}
	}

	static #initDispositions(): void {
		const dispositions = positionJSON.dispositions as Record<string, { p: number[], o: number[] }[]>;
		for (const key in dispositions) {
			const slotPosition = dispositions[key]!;
			const positions: CharacterPosition[] = [];
			for (const position of slotPosition) {
				positions.push({
					position: position.p,
					orientation: position.o,
				});
			}
			this.#slotsPositions.set(key, positions);
		}
	}

	static useDisposition(name: string | number): void {
		const slots = this.#characterSlots;

		//console.info('use disposition: ', name)
		const dispositions = this.#slotsPositions.get(String(name));
		if (!dispositions) {
			return;
		}

		this.setSlotsCount(dispositions.length, false);

		for (let i = 0; i < slots.length; i++) {
			const slot = slots[i]!;
			const disposition = dispositions[i];

			if (disposition) {
				slot.setPosition(disposition.position);
				slot.setOrientation(disposition.orientation);

				if (slot.character) {
					slot.character.getModel().then((model) => {
						model?.setPosition(disposition.position);
						model?.setOrientation(disposition.orientation);
					});
				}
			}
		}
	}

	static async setupMeetTheTeam(scene: Scene): Promise<void> {
		this.setSlotsCount(9, true);
		this.useDisposition('mtt');

		let botDelta = 0;
		if (this.#useBots === 'bot') {
			botDelta = Tf2Class.ScoutBot;
		} else if (this.#useBots === 'infected') {
			botDelta = Tf2Class.ScoutInfected;
		}

		await this.selectCharacter(Tf2Class.Pyro + botDelta, scene, 0);
		const engy = await this.selectCharacter(Tf2Class.Engineer + botDelta, scene, 1);
		await this.selectCharacter(Tf2Class.Spy + botDelta, scene, 2);
		await this.selectCharacter(Tf2Class.Heavy + botDelta, scene, 3);
		await this.selectCharacter(Tf2Class.Sniper + botDelta, scene, 4);
		await this.selectCharacter(Tf2Class.Scout + botDelta, scene, 5);
		await this.selectCharacter(Tf2Class.Soldier + botDelta, scene, 6);
		await this.selectCharacter(Tf2Class.Demoman + botDelta, scene, 7);
		await this.selectCharacter(Tf2Class.Medic + botDelta, scene, 8);
		this.#selectAnim('meettheteam', true, false);

		const toolbox = await engy.addExtraModel(scene, TF2_TOOLBOX_MODEL);
		if (toolbox) {
			toolbox.setPosition(TOOLBOX_POSITION);
			toolbox.setOrientation(TOOLBOX_ORIENTATION);
		}
		Tf2LoadoutController.dispatchEvent('activatemeettheteammap');
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	static #selectAnim(anim: string, applyToAll: boolean, force = false): void {
		/*
		if (!force && this.#htmlAnimSelector.value != '') {
			return;
		}
		*/
		if (applyToAll) {
			for (const slot of this.#characterSlots) {
				slot.character?.setUserAnim(anim);
			}
		} else {
			this.getCurrentCharacter()?.setUserAnim(anim)
		}
	}

	static #setAnim(anim: string): void {
		this.#selectAnim(anim, this.#applyToAll, false);
	}

	static getAnimList(): ClassAnimations | null {
		const currentClass: Tf2Class | null = this.getCurrentCharacter()?.characterClass ?? null;
		if (currentClass !== null) {
			return getTf2ClassAnimations(currentClass);
		}
		return null;
	}

	static #loadPresets(presets: any): void {
		const j = JSON.parse(presets);

		this.#presets.clear();
		//#presets = new Map<string, Presets>();

		for (const name in j) {
			//const preset = presets[name];
			const p = new Tf2Presets();
			p.fromJSON(j[name]);
			this.#presets.set(name, p);
		}
		Tf2LoadoutController.dispatchEvent('presetsupdated');
		//this.#updatePresetsPanel();
	}

	static loadPreset(name: string): void {
		const currentCharacter = this.getCurrentCharacter();
		if (!currentCharacter) {
			return;
		}

		const npc = Tf2CharactersList.get(currentCharacter.characterClass)!.name
		const presets = this.#presets.get(npc);
		if (!presets) {
			return;
		}

		const preset = presets.getPreset(name);
		if (!preset) {
			return;
		}

		currentCharacter.loadPreset(preset);
	}


	static savePresets(): void {
		const j: JSONObject = {};

		for (const [name, presets] of this.#presets) {
			//#presets = new Map<string, Presets>();
			j[name] = presets.toJSON();
		}

		OptionsManager.setItem('app.loadout.presets', JSON.stringify(j));
	}

	static savePreset(name?: string,): void {
		const currentCharacter = this.getCurrentCharacter();
		if (!currentCharacter || name == '') {
			return;
		}

		const npc = currentCharacter.npc;
		let presets = this.#presets.get(npc)!;
		if (!presets) {
			presets = new Tf2Presets();
			this.#presets.set(npc, presets);
		}

		if (!presets.selected && !name) {
			return;
		}

		presets.addPreset(currentCharacter.savePreset(name ?? presets.selected!));
		if (name) {
			presets.selected = name;
		}

		//#presets = new Map<string, Presets>();
		this.savePresets();
		//this.#updatePresetsPanel();
		Tf2LoadoutController.dispatchEvent('presetsupdated');
	}

	static async #importPresets(files: File[]): Promise<void> {
		for (const file of files) {
			await this.#importPreset(file,);
		}
		Tf2LoadoutController.dispatchEvent('presetsupdated');
	}

	static async #importPreset(file: File): Promise<void> {
		const currentCharacter = this.getCurrentCharacter();
		if (!currentCharacter) {
			return;
		}
		let json: JSONObject;
		try {
			json = JSON.parse(await file.text()) as JSONObject;

			if (!json) {
				return;
			}
		} catch (e) {
			console.error(e);
			return;
		}

		const npc = currentCharacter.npc;
		let presets = this.#presets.get(npc)!;
		if (!presets) {
			presets = new Tf2Presets();
			this.#presets.set(npc, presets);
		}

		const preset = new Tf2Preset();
		preset.fromJSON(json);

		if (!preset.name || presets.getPreset(preset.name)) {
			preset.name = this.createPresetName();
		}

		presets.addPreset(preset);
	}

	static createPresetName(): string {
		const currentCharacter = this.getCurrentCharacter();
		if (!currentCharacter) {
			return '';
		}

		function* nameGenerator(): Generator<string, string, unknown> {
			let gen;
			try {
				const names = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
				let subName = '';

				while (true) {
					if (gen) {
						subName = gen.next().value;
					}
					for (const name of names) {
						yield subName + name;
					}
					if (!gen) {
						gen = nameGenerator();
					}
				}
			} finally {
				gen?.return('');
			}
		}

		const gen = nameGenerator();

		const npc = Tf2CharactersList.get(currentCharacter.characterClass)!.name
		const presets = this.#presets.get(npc);
		if (!presets) {
			return gen.next().value;
		}

		while (true) {
			const name = gen.next().value;

			if (!name) {
				continue;
			}

			if (!presets.getPreset(name)) {
				gen.return('');
				return name;
			}
		}
	}

	/*
	static setSelectedPreset(preset: string): void {
		if (!this.#currentCharacter) {
			return;
		}
		const npc = CharactersList.get(this.#currentCharacter?.characterClass)!.name
		const presets = this.#presets.get(npc);
		if (presets) {
			presets.selected = preset;
		}
	}
	*/

	static getPresets(): Tf2Presets | null {
		const currentCharacter = this.getCurrentCharacter();
		if (!currentCharacter) {
			return null;
		}
		const npc = Tf2CharactersList.get(currentCharacter.characterClass)?.name
		if (!npc) {
			return null;
		}
		return this.#presets.get(npc) ?? null;
	}

	static getCharacters(): Set<Tf2Character> {
		const slots = this.#characterSlots;
		const characters = new Set<Tf2Character>();

		if (slots) {
			for (const slot of slots) {
				if (slot.character) {
					characters.add(slot.character);
				}
			}
		}

		return characters;
	}

	static async #changeAnimFrame(frame: number): Promise<void> {
		const source1Model = await this.getCurrentCharacter()?.getModel();
		if (source1Model) {
			const sequence = source1Model.sequences[Object.keys(source1Model.sequences)[0]!];
			if (sequence) {
				source1Model.frame = frame * (sequence.s?.length ?? 1);
			}
		}
	}

	static getSlotsPositions(): Map<string, CharacterPosition[]> {
		return this.#slotsPositions;
	}

	static refreshCustomDisposition(customDisposition: CustomDisposition): void {
		const positions: CharacterPosition[] = [];
		const deltaX = 40;
		const deltaY = 50;
		const deltaZ = 80;

		const startX = -deltaX * 0.5 * (customDisposition.countX - 1);
		const startY = -deltaY * 0.5 * (customDisposition.countY - 1);
		const startZ = -deltaZ * 0.5 * (customDisposition.countZ - 1);

		this.setSlotsCount(customDisposition.countX * customDisposition.countY * customDisposition.countZ, false);

		for (let x = 0; x < customDisposition.countX; x++) {
			for (let y = 0; y < customDisposition.countY; y++) {
				for (let z = 0; z < customDisposition.countZ; z++) {
					positions.push({
						//origin: [0, deltaY * ((x % 2) * -2 + 1) * Math.floor((x + 1) / 2), 0],
						position: [
							startX + x * deltaX,
							startY + y * deltaY,
							startZ + z * deltaZ,
						],
						orientation: [0, 0, -1, 1],
					})
				}
			}
		}

		this.#slotsPositions.set('custom', positions);
		//this.#setCharactersPositions(new CharactersPositions(positions, true));

		this.useDisposition('custom');
	}

	static #pickedModel(pickEvent: CustomEvent<GraphicPickEvent>): void {
		const model = pickEvent.detail.entity;
		if (model) {
			this.#selectCharacterPerDynamicProp(model);
		}
	}

	static async #selectCharacterPerDynamicProp(prop: Entity): Promise<void> {
		const slots = this.#characterSlots;
		if (!slots) {
			return;
		}

		for (const slot of slots) {
			if (!slot.character) {
				continue;
			}

			const characterModel = await slot.character?.getModel();
			let currentEntity: Entity | null = prop;
			while (currentEntity) {
				if (characterModel == currentEntity) {
					this.#currentSlot = slot;
					this.#setCurrentCharacter(slot.character);
					return;
				}

				currentEntity = currentEntity.parent;
			}
		}
	}
}
