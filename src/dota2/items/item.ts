import { vec3 } from 'gl-matrix';
import { Entity, Source2ModelInstance, Source2ModelManager, Source2ParticleManager } from 'harmony-3d';
import { OptionsManager } from 'harmony-browser-utils';
import { JSONObject } from 'harmony-types';
import { Dota2AssetModifier } from '../assetmodifier';
import { Dota2Hero } from '../heroes/hero';
import { MODIFIER_ADDITIONAL_WEARABLE, MODIFIER_ENTITY_CLIENTSIDE_MODEL, MODIFIER_ENTITY_MODEL, MODIFIER_PARTICLE_CREATE } from '../modifiers';
import { getPersonaId } from '../utils/persona';
import { Dota2ItemTemplate } from './itemtemplate';

const DIRE_BANNER = 'models/props/creep_banners/creep_banner_dire.vmdl_c';
const RADIANT_BANNER = 'models/props/creep_banners/creep_banner_radiant.vmdl_c';

export class Dota2Item {
	#template: Dota2ItemTemplate;
	readonly #hero: Dota2Hero;
	#model?: Source2ModelInstance | null = null;
	readonly #childEntities = new Set<Entity>();
	readonly #extraEntities = new Set<Entity>();
	#visible?: boolean;
	#alternateModelName?: string;
	#style = 0;
	#heroSkin = 0;
	#arcanaLevel?: number;
	readonly extraAssetModifiers: Dota2AssetModifier[] = [];

	constructor(template: Dota2ItemTemplate, hero: Dota2Hero) {
		this.#template = template;
		this.#hero = hero;
	}

	async getModel(): Promise<Source2ModelInstance | null> {
		if (this.#model) {
			return this.#model;
		}
		const modelName = this.modelName;
		if (!modelName) {
			return null;
		}
		this.#model = await Source2ModelManager.createInstance('dota2', this.modelName, true);

		if (this.#model) {
			this.#model.setVisible(this.#visible);
			this.#model.playSequence('ACT_DOTA_IDLE');
			this.#model.skin = this.skin;
		}
		//loadoutScene.addChild(this.#model);
		return this.#model;
	}

	async playSequence(sequenceName: string) {
		for (const entity of this.getExtraEntities()) {
			(entity as Source2ModelInstance)?.playSequence?.(sequenceName);
		}
		const model = await this.getModel();
		if (!model) {
			return;
		}

		model.playSequence?.(sequenceName);
	}

	getExtraEntities() {
		return this.#extraEntities;
	}

	async remove() {
		this.#model?.remove();
		this.#clearExtraEntities();
	}

	async setVisible(visible: boolean | undefined): Promise<void> {
		if (visible == true) {
			visible = undefined
		}
		this.#visible = visible;

		const model = await this.getModel();
		if (model) {
			model.setVisible(visible);
		}

		for (const extraEntity of this.#extraEntities) {
			extraEntity.setVisible(visible);
		}
	}

	get character() {
		return this.#hero;
	}

	get name() {
		return this.#template.name;
	}

	get id(): string {
		return this.#template.id;
	}

	get imageInventory() {
		return this.#template.imageInventory;
	}

	get slot() {
		return this.#template.slot;
	}

	get modelName(): string {
		return this.#alternateModelName ?? this.#template.getModelName(this.#style) ?? '';
	}

	get assetModifiers() {
		return this.#template.assetModifiers;
	}

	get skin(): number {
		return this.#template.getSkin(this.#style) ?? this.#heroSkin ?? 0;
	}

	set style(style) {
		this.#style = style;
	}

	get style() {
		return this.#style;
	}

	setStyle(styleId: number): void {
		this.#style = styleId;

		//TODO: put that in the caller
		this.#hero.processModifiers();
	}

	hasStyles() {
		return this.#template.hasStyles();
	}

	getStyle(styleId: number) {
		return this.#template.getStyle(styleId);
	}

	getStyles() {
		return this.#template.getStyles();
	}

	getPersonaId() {
		return getPersonaId(this.#template.slot)
	}

	getAssetModifiers() {
		const modifiers = this.assetModifiers as JSONObject[];
		const ret = Array.from(this.extraAssetModifiers);

		if (modifiers) {
			for (const modifierJSON of modifiers) {
				if (modifierJSON.style === undefined || modifierJSON.style == this.#style) {
					ret.push(new Dota2AssetModifier(this, modifierJSON));
				}
			}
		}
		return ret;
	}

	#clearExtraEntities() {
		for (const extraEntity of this.#extraEntities) {
			extraEntity.remove();
		}
		for (const childEntity of this.#childEntities) {
			childEntity.remove();
		}
		this.#childEntities.clear();
		this.#extraEntities.clear();
	}

	async processModifiers(replacements: Map<string, string>, characterModelId: number): Promise<void> {
		this.#clearExtraEntities();

		const modifiers = this.getAssetModifiers();
		let originalModelName = this.#template.getModelName(this.#style, characterModelId);
		if (!originalModelName && modifiers) {
			for (const modifier of modifiers) {
				if (modifier.type == MODIFIER_ENTITY_MODEL && modifier.asset && modifier.asset.endsWith(`_variant_${characterModelId}`)) {
					originalModelName = modifier.modifier ?? originalModelName;
					break;
				}
			}
		}

		await this.#setItemModel(replacements.get(originalModelName) ?? originalModelName);

		const model = await this.getModel();
		if (model) {
			model.skin = this.skin;
			model.setAttribute('desaturate', OptionsManager.getItem('app.items.desaturate'));

			model.setBodyGroup('arcana', this.#arcanaLevel ?? 0);
		}

		if (!modifiers) {
			return;
		}

		let position;
		for (const modifier of modifiers) {
			switch (modifier.type) {
				case MODIFIER_PARTICLE_CREATE:
					if (!OptionsManager.getItem('app.showeffects') || !modifier.modifier) {
						break;
					}
					const systemName = replacements.get(modifier.modifier) ?? modifier.modifier;
					let system = await Source2ParticleManager.getSystem('dota2', systemName/*, snapshotModifiers TODO */);
					if (!system) {
						break;
					}
					system.start();
					if (this.modelName) {
						this.#model?.addChild(system);
						this.#childEntities.add(system);
					} else {
						this.#extraEntities.add(system);
						system.setVisible(this.#visible);
					}

					break;
				case MODIFIER_ADDITIONAL_WEARABLE:
					if (!modifier.asset) {
						break;
					}
					const modelName = replacements.get(modifier.asset) ?? modifier.asset;
					const model = await Source2ModelManager.createInstance('dota2', modelName, true);
					if (model) {
						model.setVisible(this.#visible);
						model.skin = Number(modifier.skin ?? 0);
						this.#extraEntities.add(model);
					}
					break;
				case MODIFIER_ENTITY_MODEL:
					break;
					/*
					TODO ?
					if (modifier.asset == this.#character.id) {
						break;
					}
					const entityModelName = replacements.get(modifier.modifier) ?? modifier.modifier;
					const entityModel = await Source2ModelManager.createInstance('dota2', entityModelName, true);
					if (entityModel) {
						entityModel.setVisible(this.#visible);
						entityModel.skin = modifier.skin ?? this.skin ?? 0;
						this.#extraEntities.add(entityModel);
					}
					*/
					break;
				case MODIFIER_ENTITY_CLIENTSIDE_MODEL:
					if (!modifier.asset || !modifier.modifier) {
						break;
					}
					position = vec3.create();
					let extraModel = '';

					const banner = this.#hero.id === 'direcreeps' ? DIRE_BANNER : RADIANT_BANNER

					if (modifier.asset.endsWith('_melee')) {
						position[1] -= 300;
					}
					if (modifier.asset.endsWith('_melee_upgraded_mega')) {
						position[1] -= 175;
					}
					if (modifier.asset.endsWith('_ranged')) {
						position[1] -= 50;
					}
					if (modifier.asset.endsWith('_ranged_upgraded_mega')) {
						position[1] += 50;
					}
					if (modifier.asset.endsWith('_flagbearer')) {
						position[1] += 175;
						extraModel = banner;
					}
					if (modifier.asset.endsWith('_flagbearer_upgraded_mega')) {
						position[1] += 300;
						extraModel = banner;
					}

					// Only keep one tower
					if (
						(modifier.asset.startsWith('npc_dota_goodguys_tower') || modifier.asset.startsWith('npc_dota_badguys_tower'))
						&& !modifier.asset.endsWith('_tower1_mid')) {
						break;
					}

					// Remove bogus towers
					if (modifier.asset.startsWith('dota_goodguys_tower') || modifier.asset.startsWith('dota_badguys_tower')) {
						break;
					}


					const clientsideModelName = replacements.get(modifier.modifier) ?? modifier.modifier;
					const clientsideModel = await Source2ModelManager.createInstance('dota2', clientsideModelName, true);
					if (clientsideModel) {
						clientsideModel.setVisible(this.#visible);
						clientsideModel.skin = Number(modifier.skin ?? this.skin ?? 0);
						this.#extraEntities.add(clientsideModel);
						clientsideModel.position = position;

						if (extraModel) {
							const model = await Source2ModelManager.createInstance('dota2', extraModel, true);
							clientsideModel.addChild(model);
							clientsideModel.getAttachment('attach_banner')?.addChild(model);
						}
					}
					break;
				default:
					console.warn('item_unknown_modifier_type', modifier.type);
					break;
			}
		}
	}

	reparentChilds() {
		for (let child of this.#childEntities) {
			this.#model?.removeChild(child);
			this.#model?.addChild(child);
		}
	}

	async #setItemModel(modelName?: string): Promise<void> {
		if (this.#alternateModelName != modelName) {
			this.#alternateModelName = modelName;
			await this.#resetModel();
		}
	}

	setCharacterSkin(skin: number) {
		if (!this.#template.isBaseItem) {
			this.#heroSkin = skin;
		}
	}

	setArcanaLevel(arcanaLevel: number | undefined) {
		this.#arcanaLevel = arcanaLevel;
	}

	async #resetModel() {
		const oldModel = await this.getModel();
		if (oldModel) {
			oldModel.remove();
		}
		this.#model = null;
		//this.#modelPromise = null;

		const model = await this.getModel();
	}
}
