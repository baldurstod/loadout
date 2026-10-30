import { quat, vec3 } from 'gl-matrix';
import { Entity, getSceneExplorer, GraphicPickEvent, GraphicsEvents, Scene } from 'harmony-3d';
import { OptionsManager, OptionsManagerEvents } from 'harmony-browser-utils';
import { JSONObject, uint } from 'harmony-types';
import positionJSON from '../../../json/slotsposition.json';
import { TF2_TOOLBOX_MODEL } from '../constants';
import { SetInvulnerable, SetRagdoll, Tf2LoadoutController } from '../controller';
import { Tf2Team, UsePlayerModels } from '../enums';
import { Tf2ItemManager } from '../items/itemmanager';
import { firstPersonCamera, loadoutScene } from '../loadout/scene';
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
	static #characterSlots = new Map<Scene, CharacterSlot[]>([[loadoutScene, [new CharacterSlot()]]])// = [new CharacterSlot()];
	static #currentSlot: CharacterSlot | null = null;
	static #unusedCharacters: Tf2Character[] = [];
	static #currentCharacter = new Map<Scene, Tf2Character | null>();
	static #team: Tf2Team = 'red';
	static #slotsPositions = new Map<string, CharacterPosition[]>();
	static #applyToAll = true;
	static #useBots: UsePlayerModels = 'human';
	static #presets = new Map<string, Tf2Presets>();

	static {
		GraphicsEvents.addEventListener('tick', () => this.#updatePaintColor());
		GraphicsEvents.addEventListener('pick', (event: Event) => this.#pickedModel(event as CustomEvent<GraphicPickEvent>));
		Tf2LoadoutController.addEventListener('setinvulnerable', (event: Event) => { this.#setInvulnerable((event as CustomEvent<SetInvulnerable>).detail.invulnerable, (event as CustomEvent<SetInvulnerable>).detail.scene); return; },);
		Tf2LoadoutController.addEventListener('setragdoll', (event: Event) => { this.#setRagdoll((event as CustomEvent<SetRagdoll>).detail.ragdoll, (event as CustomEvent<SetRagdoll>).detail.scene); return; },);
		Tf2LoadoutController.addEventListener('setanim', (event: Event) => this.#setAnim((event as CustomEvent<string>).detail));
		Tf2LoadoutController.addEventListener('setapplytoall', (event: Event) => this.#applyToAll = (event as CustomEvent<boolean>).detail);
		Tf2LoadoutController.addEventListener('usebots', (event: Event) => this.#useBots = (event as CustomEvent<UsePlayerModels>).detail);
		Tf2LoadoutController.addEventListener('importpresets', (event: Event) => { this.#importPresets((event as CustomEvent<File[]>).detail) });
		Tf2LoadoutController.addEventListener('changeanimframe', (event: Event) => { this.#changeAnimFrame((event as CustomEvent<number>).detail) });

		OptionsManagerEvents.addEventListener('app.loadout.presets', (event: Event) => this.#loadPresets((event as CustomEvent).detail.value));
		this.#initDispositions();
	}

	static async selectCharacter(characterClass: Tf2Class, slotId?: uint, scene: Scene = loadoutScene): Promise<Tf2Character> {
		const slot = this.getSlot(slotId, scene);

		if (slot.character?.characterClass == characterClass) {
			slot.character.setVisible(true);
			// the same character is selected again
			return slot.character;
		}

		this.#removeCharacter(slot);
		const character = this.#getUnusedCharacter(characterClass) ?? new Tf2Character(characterClass, scene);
		slot.character = character;
		// set the character visible
		character.setVisible(true);
		character.setTeam(this.#team);

		const characterTemplate = Tf2CharactersList.get(characterClass);
		if (characterTemplate) {
			const modelName = characterTemplate.name;
			character.loadModel(characterTemplate.path, modelName);

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

		this.#setCurrentCharacter(character, scene);

		return character;
	}

	static removeCharacter(slotId?: uint, scene: Scene = loadoutScene): void {
		const slot = this.getSlot(slotId, scene);
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

	static #setCurrentCharacter(character: Tf2Character, scene: Scene = loadoutScene): void {
		this.#currentCharacter.set(scene, character);
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

				model.getBoneByName('bip_head')?.addChild(firstPersonCamera);
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

	static getSlot(slotId?: uint, scene: Scene = loadoutScene): CharacterSlot {
		let slots = this.#characterSlots.get(scene);
		if (!slots) {
			slots = [new CharacterSlot()];
			this.#characterSlots.set(scene, slots);
		}

		if (slotId !== undefined) {
			const slot = slots[slotId];
			if (slot) {
				return slot;
			}
		}

		for (const slot of slots) {
			if (slot == this.#currentSlot || !slot.character || slot.character.characterClass == Tf2Class.None || slot.character.characterClass == Tf2Class.Empty || slot.character.characterClass == Tf2Class.CompareWarpaints) {
				return slot;
			}
		}

		return slots[slots.length - 1]!;
	}

	static setSlotsCount(size: uint, removeExisting = false, scene: Scene = loadoutScene): void {
		const slots = this.#characterSlots.get(scene);
		if (!slots) {
			return;
		}

		size = Math.max(size, 1);

		const removeStart = removeExisting ? 0 : size - 1;
		for (let i = removeStart; i < slots.length; i++) {
			this.#removeCharacter(slots[i]!);
		}
		for (let i = slots.length; i < size; i++) {
			slots.push(new CharacterSlot());
		}
	}

	static async setTeam(team: Tf2Team, scene: Scene = loadoutScene): Promise<void> {
		const slots = this.#characterSlots.get(scene);
		if (!slots) {
			return;
		}

		this.#team = team;
		if (this.#applyToAll) {
			for (const slot of slots) {
				if (slot) {
					await slot.character?.setTeam(team);
				}
			}
		} else {
			const character = this.getCurrentCharacter(scene);
			if (character) {
				character.setTeam(team);
			}
		}
	}

	static getTeam(): Tf2Team {
		return this.#team;
	}

	static getCurrentCharacter(scene: Scene = loadoutScene): Tf2Character | null {
		return this.#currentCharacter.get(scene) ?? null;
	}

	static setCustomTexture(itemId: string, customTextureName: string, scene: Scene = loadoutScene): void {
		const currentCharacter = this.getCurrentCharacter(scene);
		if (currentCharacter) {
			const item = currentCharacter.getItemById(itemId);
			if (item) {
				item.setCustomTexture(customTextureName);
			}
		}
	};

	static #updatePaintColor(): void {
		for (const [, slots] of this.#characterSlots) {
			for (const slot of slots) {
				if (slot) {
					slot.character?.updatePaintColor();
				}
			}
		}
	};

	static async #setInvulnerable(invulnerable: boolean, scene: Scene = loadoutScene): Promise<void> {
		const slots = this.#characterSlots.get(scene);
		if (!slots) {
			return;
		}

		if (this.#applyToAll) {
			for (const slot of slots) {
				if (slot) {
					await slot.character?.setInvulnerable(invulnerable);
				}
			}
		} else {
			await this.getCurrentCharacter(scene)?.setInvulnerable(invulnerable);
		}
	}

	static async #setRagdoll(ragdoll: Ragdoll, scene: Scene = loadoutScene): Promise<void> {
		const slots = this.#characterSlots.get(scene);
		if (!slots) {
			return;
		}

		if (this.#applyToAll) {
			for (const slot of slots) {
				if (slot) {
					await slot.character?.setRagdoll(ragdoll);
				}
			}
		} else {
			await this.getCurrentCharacter(scene)?.setRagdoll(ragdoll);
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

	static useDisposition(name: string | number, scene: Scene = loadoutScene): void {
		const slots = this.#characterSlots.get(scene);
		if (!slots) {
			return;
		}
		//console.info('use disposition: ', name)
		const dispositions = this.#slotsPositions.get(String(name));
		if (!dispositions) {
			return;
		}

		this.setSlotsCount(dispositions.length, false, scene);

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

	static async setupMeetTheTeam(scene: Scene = loadoutScene): Promise<void> {
		this.setSlotsCount(9, true, scene);
		this.useDisposition('mtt', scene);

		let botDelta = 0;
		if (this.#useBots === 'bot') {
			botDelta = Tf2Class.ScoutBot;
		} else if (this.#useBots === 'infected') {
			botDelta = Tf2Class.ScoutInfected;
		}

		await this.selectCharacter(Tf2Class.Pyro + botDelta, 0, scene);
		const engy = await this.selectCharacter(Tf2Class.Engineer + botDelta, 1, scene);
		await this.selectCharacter(Tf2Class.Spy + botDelta, 2, scene);
		await this.selectCharacter(Tf2Class.Heavy + botDelta, 3, scene);
		await this.selectCharacter(Tf2Class.Sniper + botDelta, 4, scene);
		await this.selectCharacter(Tf2Class.Scout + botDelta, 5, scene);
		await this.selectCharacter(Tf2Class.Soldier + botDelta, 6, scene);
		await this.selectCharacter(Tf2Class.Demoman + botDelta, 7, scene);
		await this.selectCharacter(Tf2Class.Medic + botDelta, 8, scene);
		this.#selectAnim('meettheteam', true, false, scene);

		const toolbox = await engy.addExtraModel(TF2_TOOLBOX_MODEL);
		if (toolbox) {
			toolbox.setPosition(TOOLBOX_POSITION);
			toolbox.setOrientation(TOOLBOX_ORIENTATION);
		}
		Tf2LoadoutController.dispatchEvent('activatemeettheteammap');
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	static #selectAnim(anim: string, applyToAll: boolean, force = false, scene: Scene = loadoutScene): void {
		/*
		if (!force && this.#htmlAnimSelector.value != '') {
			return;
		}
		*/
		if (applyToAll) {
			for (const [, slots] of this.#characterSlots) {
				for (const slot of slots) {
					slot.character?.setUserAnim(anim);
				}
			}
		} else {
			this.getCurrentCharacter(scene)?.setUserAnim(anim)
		}
	}

	static #setAnim(anim: string, scene: Scene = loadoutScene): void {
		this.#selectAnim(anim, this.#applyToAll, false, scene);
	}

	static getAnimList(scene: Scene = loadoutScene): ClassAnimations | null {
		const currentClass: Tf2Class | null = this.getCurrentCharacter(scene)?.characterClass ?? null;
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

	static loadPreset(name: string, scene: Scene = loadoutScene): void {
		const currentCharacter = this.getCurrentCharacter(scene);
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

	static savePreset(name?: string, scene: Scene = loadoutScene): void {
		const currentCharacter = this.getCurrentCharacter(scene);
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

	static async #importPresets(files: File[], scene: Scene = loadoutScene): Promise<void> {
		for (const file of files) {
			await this.#importPreset(file, scene);
		}
		Tf2LoadoutController.dispatchEvent('presetsupdated');
	}

	static async #importPreset(file: File, scene: Scene = loadoutScene): Promise<void> {
		const currentCharacter = this.getCurrentCharacter(scene);
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
			preset.name = this.createPresetName(scene);
		}

		presets.addPreset(preset);
	}

	static createPresetName(scene: Scene = loadoutScene): string {
		const currentCharacter = this.getCurrentCharacter(scene);
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

	static getPresets(scene: Scene = loadoutScene): Tf2Presets | null {
		const currentCharacter = this.getCurrentCharacter(scene);
		if (!currentCharacter) {
			return null;
		}
		const npc = Tf2CharactersList.get(currentCharacter.characterClass)?.name
		if (!npc) {
			return null;
		}
		return this.#presets.get(npc) ?? null;
	}

	static getCharacters(scene: Scene = loadoutScene): Set<Tf2Character> {
		const slots = this.#characterSlots.get(scene);
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

	static async #changeAnimFrame(frame: number, scene: Scene = loadoutScene): Promise<void> {
		const source1Model = await this.getCurrentCharacter(scene)?.getModel();
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

	static refreshCustomDisposition(customDisposition: CustomDisposition, scene: Scene = loadoutScene): void {
		const positions: CharacterPosition[] = [];
		const deltaX = 40;
		const deltaY = 50;
		const deltaZ = 80;

		const startX = -deltaX * 0.5 * (customDisposition.countX - 1);
		const startY = -deltaY * 0.5 * (customDisposition.countY - 1);
		const startZ = -deltaZ * 0.5 * (customDisposition.countZ - 1);

		this.setSlotsCount(customDisposition.countX * customDisposition.countY * customDisposition.countZ, false, scene);

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

		this.useDisposition('custom', scene);
	}

	static #pickedModel(pickEvent: CustomEvent<GraphicPickEvent>): void {
		const model = pickEvent.detail.entity;
		if (model) {
			this.#selectCharacterPerDynamicProp(model);
		}
	}

	static async #selectCharacterPerDynamicProp(prop: Entity, scene: Scene = loadoutScene): Promise<void> {
		const slots = this.#characterSlots.get(scene);
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
					this.#setCurrentCharacter(slot.character, scene);
					return;
				}

				currentEntity = currentEntity.parent;
			}
		}
	}
}
