import { vec3 } from 'gl-matrix';
import { Entity, Group, Scene, Source2ModelInstance, Source2ModelManager, stringToVec3 } from 'harmony-3d';
import { OptionsManager, OptionsManagerEvent, OptionsManagerEvents } from 'harmony-browser-utils';
import { JSONObject } from 'harmony-types';
import { Dota2AssetModifier } from '../assetmodifier';
import { Dota2LoadoutController } from '../controller';
import { Dota2Item } from '../items/item';
import { Dota2ItemTemplates } from '../items/itemtemplates';
import { Dota2Units } from '../utils/units';
import { Dota2HeroSlot, Dota2HeroTemplate } from './herotemplate';
import { Dota2HeroTemplates } from './herotemplates';

export const DEFAULT_ACTIVITY = 'ACT_DOTA_IDLE';

export class Dota2Hero {
	#heroId;
	#modelId = 0;
	#template: Dota2HeroTemplate;
	#items = new Map<string, Dota2Item>();
	#itemsPerSlot = new Map<string, Dota2Item>();
	bundleItem: Dota2Item | null = null;
	//#name = '';
	//#displayName = '';
	#model: Source2ModelInstance | null = null;
	#modelPromise?: Promise<Source2ModelInstance | null>;
	#visible: boolean | undefined = false;
	//#personaId = 0;// Base hero
	#alternateModelPath?: string;
	#activityModifiers = new Set<Dota2AssetModifier>();
	#group: Group;
	#pedestalModel: Source2ModelInstance | null = null;
	#pedestalModels = new Map<string, Source2ModelInstance | null>();
	#petModel: Source2ModelInstance | null = null;
	#metamorphosisModel: Source2ModelInstance | null = null;
	#activity = DEFAULT_ACTIVITY;
	#modifiers: string[] = [];
	#units = new Map<string, Source2ModelInstance>();

	constructor(heroId: string, scene: Scene) {
		this.#group = new Group({ parent: scene, quaternion: [0, 0, -1, 1] });// Face -Y
		this.#heroId = heroId;
		this.#template = Dota2HeroTemplates.getTemplate(heroId)!;
		this.#group.name = this.name;
		OptionsManagerEvents.addEventListener('app.units.display', event => { this.#positionUnits(event as CustomEvent) });
	}

	async getModel(): Promise<Source2ModelInstance | null> {
		if (this.#model) {
			return this.#model;
		}
		if (this.#modelPromise) {
			return this.#modelPromise;
		}

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.#modelPromise = new Promise(async resolve => {
			this.#model = await Source2ModelManager.createInstance('dota2', this.getModelPath(), true);
			this.#group.addChild(this.#model);
			resolve(this.#model);
			await this.playSequence();

		})
		return this.#modelPromise;
	}

	async playSequence(): Promise<void> {
		const sequenceName = this.#activity;

		for (const [, item] of this.#items) {
			await item.playSequence(sequenceName);
		}

		for (const [, entity] of this.#units) {
			entity?.playSequence?.(sequenceName);
		}

		const model = await this.getModel();
		if (!model) {
			return;
		}
		const modifiers: string[] = [];
		//const activityModifier = this.#activityModifiers.get(sequenceName) ?? this.#activityModifiers.get('ALL');
		for (const activityModifier of this.#activityModifiers) {
			if ((activityModifier.asset == sequenceName || activityModifier.asset == 'ALL') && activityModifier.modifier) {
				modifiers.push(activityModifier.modifier);
			}
		}
		modifiers.push(...this.#modifiers);
		model.playSequence(sequenceName, modifiers);

		model.setAttribute('activity', { activity: sequenceName, modifiers: modifiers })
		this.#petModel?.playSequence(sequenceName);
		this.#metamorphosisModel?.playSequence(sequenceName);
	}

	setVisible(visible: boolean): void {
		this.#visible = visible === true ? undefined : visible;
		this.#group.setVisible(visible);
	}

	get name(): string {
		return this.#template.name;
	}

	get id(): string {
		return this.#template.id;
	}

	//todo: NameAliases
	get heroOrderId(): number {
		return this.#template.heroOrderId;
	}

	get itemSlots(): Map<string, Dota2HeroSlot> | undefined {
		return this.#template.itemSlots;
	}

	isHero(): boolean {
		return this.#template.isHero();
	}

	getModelCount(): number {
		return this.#template.getModelCount();
	}

	getModelPath(): string {
		return this.#alternateModelPath ?? this.#template.getModelPath(this.#modelId);
	}

	async setModelId(modelId: number): Promise<void> {
		if (modelId >= 0 && modelId <= this.getModelCount()) {
			this.#modelId = modelId;
		}
		await this.#resetModel();
		await this.processModifiers();
	}

	getModelId(): number {
		return this.#modelId;
	}

	hasItem(itemId: string): boolean {
		return this.#items.has(itemId);
	}

	getItem(itemId: string): Dota2Item | undefined {
		return this.#items.get(itemId);
	}

	async addItem(itemId: string): Promise<void> {
		if (this.hasItem(itemId)) {
			return;
		}
		const itemTemplate = Dota2ItemTemplates.getTemplate(itemId);
		if (!itemTemplate) {
			return;
		}

		const item = new Dota2Item(itemTemplate, this);
		if (!item) {
			return;
		}
		//await item.setVisible(this.#personaId == item.getPersonaId());

		this.#items.set(itemId, item);

		Dota2LoadoutController.dispatchEvent('heroitemadded', { detail: item });

		if (item.slot) {
			await this.#replaceSlot(item);
		}

		await this.#addChild(await item.getModel());
	}

	async #addChild(itemModel: Entity | null): Promise<void> {
		const model = await this.getModel();

		if (model) {
			model.addChild(itemModel);
		} else {
			this.#group.addChild(itemModel);
		}
	}

	async removeItem(itemId: string): Promise<void> {
		const item = this.#items.get(itemId);
		if (!item) {
			return;
		}

		Dota2LoadoutController.dispatchEvent('heroitemremoved', { detail: item });
		await item.remove();
		this.#items.delete(itemId);
		this.#itemsPerSlot.delete(item.slot);
		await this.processModifiers();
	}

	async #replaceSlot(item: Dota2Item): Promise<void> {
		const previousItem = this.#itemsPerSlot.get(item.slot);
		if (previousItem) {
			await this.removeItem(previousItem.id);
		}

		this.#itemsPerSlot.set(item.slot, item);
	}

	getItems(): Map<string, Dota2Item> {
		return new Map(this.#items);
	}

	getItemsWithBundle(): Map<string, Dota2Item> {
		const items = this.getItems();
		if (this.bundleItem) {
			items.set(this.bundleItem.id, this.bundleItem);
		}
		return items;
	}

	async getAssetModifiers(): Promise<Dota2AssetModifier[]> {
		let modifiers: Dota2AssetModifier[] = [];
		for (const [, item] of this.#items) {
			const itemModifiers = item.getAssetModifiers();
			if (itemModifiers) {
				modifiers = modifiers.concat(itemModifiers);
			}
		}
		await this.#setPersonaId(0);
		return modifiers;
	}

	#clearExtraEntities(): void {
		this.#pedestalModel?.remove();
		this.#petModel?.remove();
		this.#metamorphosisModel?.remove();

		this.#pedestalModel = null;
		this.#petModel = null;
		this.#metamorphosisModel = null;

		for (const [, entity] of this.#units) {
			entity?.remove();
		}
		this.#units.clear();
		Dota2LoadoutController.dispatchEvent('herounitschanged');
	}

	async processModifiers(): Promise<void> {
		this.#group.setAttribute('desaturate', OptionsManager.getItem('app.characters.desaturate'));
		this.#clearExtraEntities();
		const modifiers = await this.getAssetModifiers()

		await this.#processGeneratedUnits();

		//this.usePersonaModel(this.#personaId);
		let alternateModelPath: string | undefined;
		const replacements = new Map<string, string>();
		let skin = 0;
		let arcanaLevel = 0;

		this.#activityModifiers.clear();

		const bodygroups = new Map<string, number>();

		for (const modifier of modifiers) {
			switch (modifier.type) {
				case 'persona':
					console.log(modifier);
					await this.#setPersonaId(Number(modifier.persona));
					break;
				case 'entity_model':
				case 'courier':
				case 'courier_flying':
					if (modifier.asset && modifier.asset.startsWith(this.id)) {
						if (modifier.asset.startsWith(`${this.id}_variant_`)) {
							if (modifier.asset.endsWith(`_variant_${this.#modelId}`)) {
								alternateModelPath = modifier.modifier;
							}
						} else {
							alternateModelPath = modifier.modifier;
						}
					} else {
						//console.error('Have a modifier for another entity: ', modifier);
						await this.#setUnit(modifier);
					}
					break;
				case 'model':
				case 'particle':
					replacements.set(modifier.asset!, modifier.modifier!);
					break;
				case 'model_skin':
					skin = Number(modifier.skin ?? 0);
					break;
				case 'bodygroup_visibility':
					// TODO: use modifier.asset to determine the model to replace
					bodygroups.set(modifier.modifier!, Number(modifier.value));
					break;
				case 'activity':
					this.#activityModifiers.add(modifier);
					break;
				case 'pet':
				case 'portrait_background_model':
				case 'hero_model_change':
					const modelPath = replacements.get(modifier.asset!) ?? modifier.modifier ?? modifier.asset ?? '';
					const model = await Source2ModelManager.createInstance('dota2', modelPath, true);
					if (model) {
						model.setVisible(this.#visible);
						model.skin = Number(modifier.skin ?? 0);
						const loadoutDefaultOffset = modifier.loadoutDefaultOffset;
						if (loadoutDefaultOffset) {
							model.setPosition(stringToVec3(loadoutDefaultOffset));
						}
						if (modifier.type == 'pet') {
							this.#petModel = model;
						} else if (modifier.type == 'hero_model_change') {
							this.#metamorphosisModel = model;
						} else {
							this.#pedestalModel = model;
						}
					}
					break;
				case 'arcana_level':
					arcanaLevel = Number(modifier.level ?? 0);
					break;
				default:
					console.warn('character_unknown_modifier_type', modifier.type, modifier);
					break;
			}
		}

		if (!this.#pedestalModel) {
			await this.#initPedestal();
		}

		await this.#setCharacterModel(alternateModelPath);
		const model = await this.getModel();
		model?.resetBodyGroups();
		await this.#setSkin(skin);
		await this.#setArcanaLevel(arcanaLevel);

		this.#group.addChild(this.#pedestalModel);
		this.#group.addChild(this.#petModel);
		this.#group.addChild(this.#metamorphosisModel);

		const desaturateItems = OptionsManager.getItem('app.items.desaturate');
		this.#pedestalModel?.setAttribute('desaturate', desaturateItems);
		this.#petModel?.setAttribute('desaturate', desaturateItems);

		if (this.#pedestalModel) {
			if (OptionsManager.getItem('app.showpedestal')) {
				this.#pedestalModel.setVisible(undefined);
			} else {
				this.#pedestalModel.setVisible(false);
			}
		}

		if (this.#metamorphosisModel) {
			if (OptionsManager.getItem('app.showmetamorphosis')) {
				this.#metamorphosisModel.setVisible(undefined);
				this.#model?.setVisible(false);
			} else {
				this.#metamorphosisModel.setVisible(false);
				this.#model?.setVisible(undefined);
			}
		}

		for (const [, item] of this.#items) {
			await item.processModifiers(replacements, this.#modelId);
			for (const entity of item.getExtraEntities()) {
				await this.#addChild(entity);
			}
		}

		for (const [name, value] of bodygroups) {
			model?.setBodyGroup(name, value);
		}

		await this.#reparentItems();
		await this.playSequence();
	}

	async #processGeneratedUnits(): Promise<void> {
		const itemSlots = this.itemSlots;
		if (itemSlots) {
			for (const [, itemSlot] of itemSlots) {
				if (itemSlot.GeneratesUnits) {
					for (const i in itemSlot.GeneratesUnits) {
						const unitID = itemSlot.GeneratesUnits[i];
						if (!unitID) {
							continue;
						}
						const model = Dota2Units.getModel(unitID);
						if (model) {
							await this.#setUnit(new Dota2AssetModifier(null, { asset: unitID, modifier: model }));
						}
					}
				}
			}
		}
	}

	async #setUnit(modifier: Dota2AssetModifier): Promise<void> {
		let modifierAsset = modifier.asset;
		if (!modifierAsset) {
			return;
		}
		const modifierType = modifier.type;
		if (modifierType == 'courier' || modifierType == 'courier_flying') {
			modifierAsset += '_' + modifierType;
		}
		const modelPath = modifier.modifier ?? '';
		const model = await Source2ModelManager.createInstance('dota2', modelPath, true);
		if (model) {
			this.#group.addChild(model);
			model.setVisible(this.#visible);
			model.skin = Number(modifier.skin ?? modifier.item?.skin ?? 0);
			const loadoutDefaultOffset = modifier.loadoutDefaultOffset;
			if (loadoutDefaultOffset) {
				model.setPosition(stringToVec3(loadoutDefaultOffset));
			}
			this.#units.get(modifierAsset)?.remove();
			this.#units.delete(modifierAsset);
			this.#units.set(modifierAsset, model);
			model.setPosition(getUnitPlacement(this.#units.size + (this.getModelPath() ? 1 : 0)));
			model.setVisible(await OptionsManager.getSubItem('app.units.display', modifierAsset) ? undefined : false);

			OptionsManagerEvents.addEventListener('app.units.display', (event) => {
				model.setVisible(((event as CustomEvent<OptionsManagerEvent<Record<string, boolean>>>).detail.value)[modifierAsset] ? undefined : false);
			});

			Dota2LoadoutController.dispatchEvent('herounitschanged');

		}
		this.#positionUnits();
	}

	#positionUnits(event?: CustomEvent<OptionsManagerEvent<Record<string, boolean>>>): void {
		const display = (event?.detail?.value ?? OptionsManager.getItem('app.units.display')) as Record<string, boolean>;
		console.info(display);
		let unit = this.getModelPath() ? 1 : 0;
		for (const [unitId, model] of this.#units) {
			console.info(unitId, model);
			if (display[unitId]) {
				model.setPosition(getUnitPlacement(unit));
				++unit;
			}
		}
	}

	async #initPedestal(): Promise<void> {
		const path = OptionsManager.getItem('app.loadout.pedestalmodel') as string;

		if (!path) {
			return;
		}

		let model: Source2ModelInstance | undefined | null = this.#pedestalModels.get(path);
		if (model === undefined) {
			model = await Source2ModelManager.createInstance('dota2', path, true);
			this.#pedestalModels.set(path, model);
		}

		this.#pedestalModel = model;
	}

	async #setSkin(skin: number): Promise<void> {
		const model = await this.getModel();
		if (!model) {
			return;
		}
		model.skin = skin;
		for (const [, item] of this.#items) {
			item.setCharacterSkin(skin);
		}
	}

	async #setArcanaLevel(arcanaLevel: number): Promise<void> {
		const model = await this.getModel();
		if (!model) {
			return;
		}
		//model.skin = skin;
		this.#model?.setBodyGroup('arcana', arcanaLevel);
		for (const [, item] of this.#items) {
			item.setArcanaLevel(arcanaLevel);
		}
	}

	async #reparentItems(): Promise<void> {
		for (const [, item] of this.#items) {
			await this.#addChild(await item.getModel());
			item.reparentChilds();
		}
	}

	async #setCharacterModel(modelPath: string | undefined): Promise<void> {
		if (this.#alternateModelPath != modelPath) {
			this.#alternateModelPath = modelPath;
			await this.#resetModel();
		}
	}

	async #resetModel(): Promise<void> {
		const oldModel = await this.getModel();
		if (oldModel) {
			oldModel.remove();
		}
		this.#model = null;
		this.#modelPromise = undefined;
	}

	async #setPersonaId(personaId: number): Promise<void> {
		const promises: Promise<void>[] = [];
		for (const [, item] of this.#items) {
			promises.push(item.setVisible(item.slot === 'persona_selector' || personaId == item.getPersonaId()));
		}
		await Promise.all(promises);
		Dota2LoadoutController.dispatchEvent('heropersonachanged', { detail: personaId });
	}

	async setActivity(activity: string): Promise<void> {
		this.#activity = activity;
		await this.playSequence();
	}

	getActivity(): string {
		return this.#activity;
	}

	async setModifiers(modifiers: string[]): Promise<void> {
		this.#modifiers = modifiers;
		await this.playSequence();
	}

	getModifiers(): string[] {
		return this.#modifiers;
	}

	exportLoadout(): JSONObject | undefined {
		if (this.#visible === false) {
			return;
		}

		const items = [];
		for (const [, item] of this.#items) {
			items.push({
				id: item.id,
				style: item.style
			});
		}

		const json = {
			npc: this.#heroId,
			items: items
		}

		return json;
	}

	async importLoadout(characterJSON: JSONObject): Promise<void> {
		const itemsJSON = characterJSON.items as JSONObject[];
		if (itemsJSON) {
			for (const itemJSON of itemsJSON) {
				const itemId = String(itemJSON.id as number);
				const item = await this.addItem(itemId);
				console.info(item);
			}

		}
		//await this.#importLoadoutUnusualEffects(characterJSON.unusualEffects);
	}

	getUnits(): Map<string, Source2ModelInstance> {
		return this.#units;
	}

	getSpawnedUnits(): Array<string> {
		return this.#template.getSpawnedUnits();
	}
}

function getUnitPlacement(i: number): vec3 {
	return vec3.fromValues(0, 400 * (i % 2 - 0.5) * Math.floor((i + 1) / 2), 0);
}
