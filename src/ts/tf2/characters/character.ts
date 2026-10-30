import { vec3 } from 'gl-matrix';
import { ChoreographiesManager, ChoreographyEventType, Material, Property, RandomFloat, Repositories, Scene, Source1MaterialManager, Source1ModelInstance, Source1ParticleControler, Source1ParticleSystem, Source1SoundManager } from 'harmony-3d';
import { unserializeDmxSync } from 'harmony-dmx';
import { addTF2Model } from '../addtf2model';
import { EFFECTS_BLU, EFFECTS_RED, ENTITY_FLYING_BIRD_SPEED_MAX, ENTITY_FLYING_BIRD_SPEED_MIN, MATERIAL_GOLD_RAGDOLL, MATERIAL_ICE_RAGDOLL, MATERIAL_INVULN_BLU, MATERIAL_INVULN_RED, MEDIC_RELEASE_DOVE_COUNT } from '../constants';
import { Tf2LoadoutController } from '../controller';
import { Tf2Effect } from '../effects/effect';
import { Tf2EffectTemplate, Tf2EffectType } from '../effects/effecttemplate';
import { getTf2TeamId, Tf2Team } from '../enums';
import { Tf2Item } from '../items/item';
import { Tf2ItemManager } from '../items/itemmanager';
import { Tf2ItemTemplate } from '../items/itemtemplate';
import { getKillstreak, KillstreakColor, killstreakList } from '../paints/killstreaks';
import { Tf2CharactersList, ClassRemovablePartsOff, Tf2Class } from './characters';
import { FlyingBird } from './flyingbird';
import { Tf2Preset, Tf2PresetEffect, Tf2PresetEffectType, Tf2PresetItem } from './preset';

const eyeAttachments = ['eyeglow_R', 'eyeglow_L'];

export const enum Eye {
	Right = 0,
	Left = 1,
}

export const enum Ragdoll {
	None = 0,
	Gold = 1,
	Ice = 2,
}

export class Tf2Character {
	readonly scene: Scene;
	readonly characterClass: Tf2Class;
	readonly name: string;
	readonly npc: string;
	readonly items = new Map<string, Tf2Item>();
	#showBodyParts = new Map<string, boolean>();
	#model: Source1ModelInstance | null = null;
	#extraModels = new Set<Source1ModelInstance>();
	readonly effects = new Set<Tf2Effect>();
	#tauntEffect: Tf2Effect | null = null;
	// [right, left]
	#killstreakEffects: [Tf2Effect | null, Tf2Effect | null] = [null, null];
	#decapitationEffects: [Tf2Effect | null, Tf2Effect | null] = [null, null];
	#team: Tf2Team = 'red';
	#readyPromiseResolve!: (value: any) => void;
	#ready = new Promise<boolean>((resolve) => {
		this.#readyPromiseResolve = resolve;
	});
	#loaded = false;
	#visible = true;
	#zombieSkin = false;
	#isInvulnerable = false;
	#ragdoll = Ragdoll.None;
	#userAnim = '';
	#voicePose?: string;
	#taunt: Tf2Item | null = null;
	#flexControllers = new Map<string, number>;
	#decapitationLevel = 0;
	static autoSelectAnim = true;

	constructor(characterClass: Tf2Class, scene: Scene) {
		this.characterClass = characterClass;
		this.scene = scene;
		this.name = Tf2CharactersList.get(characterClass)?.name ?? '';
		this.npc = Tf2CharactersList.get(characterClass)?.npc ?? '';
	}

	async loadModel(path: string, name: string): Promise<void> {
		if (this.#loaded) {
			return;
		}
		this.#loaded = true;
		this.#model = await addTF2Model(this.scene, path);
		if (!this.#model) {
			this.#readyPromiseResolve(false);
			return;
		}
		this.#readyPromiseResolve(true);
		this.#model.resetFlexParameters();
		this.#model.setPoseParameter('move_x', 1);
		this.#model.setPoseParameter('move_y', 0.5);
		this.#model.setPoseParameter('body_yaw', 0.5);
		this.#model.setPoseParameter('body_pitch', 0.3);
		this.#model.setPoseParameter('r_arm', 0);
		this.#model.setPoseParameter('r_hand_grip', 0);
		this.#model.name = name;
		this.#model.setVisible(this.#visible);
		//modelLayer.addEntity(this.characterModel);
	}

	async getModel(): Promise<Source1ModelInstance | null> {
		await this.#ready;
		return this.#model;
	}

	async addExtraModel(path: string, repository?: string): Promise<Source1ModelInstance | null> {
		const extraModel = await addTF2Model(this.scene, path, repository);

		if (extraModel) {
			extraModel.setVisible(this.#visible);
			this.#extraModels.add(extraModel);
			await this.#refreshSkin();

		}

		return extraModel;
	}

	setVisible(visble: boolean): void {
		this.#visible = visble;
		this.#model?.setVisible(visble);
		for (const extraModel of this.#extraModels) {
			extraModel?.setVisible(visble);
		}
	}

	async setTeam(team: Tf2Team): Promise<void> {
		this.#team = team;

		for (const [, item] of this.items) {
			await item.setTeam(team);
		}
		await this.#refreshSkin();
		await this.#setEffectsTeam();
		await this.#updateKillsteakEffectsTeam();

		await this.#ready;
		if (this.#model) {
			this.#model.materialsParams.team = this.#team;
		}
	}

	async #refreshSkin(): Promise<void> {
		await this.#ready;
		let materialOverride: string
		switch (this.#ragdoll) {
			case Ragdoll.None:
				await this.#setMaterialOverride(null);
				const zombieSkinOffset = (this.characterClass == Tf2Class.Spy ? 22 : 4);
				if (this.#model) {
					await this.#model.setSkinId(getTf2TeamId(this.#team) + (this.#zombieSkin ? zombieSkinOffset : 0) + (this.#isInvulnerable ? 2 : 0));
				}
				for (const extraModel of this.#extraModels) {
					if (this.#isInvulnerable) {
						const materialOverride = this.#team ? MATERIAL_INVULN_BLU : MATERIAL_INVULN_RED;
						const material = await Source1MaterialManager.getMaterial('tf2', materialOverride);
						await extraModel.setMaterialOverride(material);
					} else {
						extraModel.setSkinId(getTf2TeamId(this.#team));
					}
				}
				return;
			case Ragdoll.Gold:
				materialOverride = MATERIAL_GOLD_RAGDOLL;
				break;
			case Ragdoll.Ice:
				materialOverride = MATERIAL_ICE_RAGDOLL;
				break;
		}
		await this.#setMaterialOverride(materialOverride);
	}

	async #setMaterialOverride(materialOverride: string | null): Promise<void> {
		let material: Material | null = null;
		if (materialOverride) {
			material = await Source1MaterialManager.getMaterial('tf2', materialOverride);
		}

		await this.#model?.setMaterialOverride(material);
		for (const extraModel of this.#extraModels) {
			await extraModel.setMaterialOverride(material);
		}
	}

	getTeam(): Tf2Team {
		return this.#team;
	}

	getItemById(itemId: string): Tf2Item | undefined {
		return this.items.get(itemId);
	}

	async toggleItem(template: Tf2ItemTemplate): Promise<[Tf2Item, boolean]> {
		const existingItem = this.items.get(template.id);

		if (existingItem) {
			this.#removeItem(existingItem);
			return [existingItem, false];
		} else {
			return [await this.#addItem(template), true];
		}
	}

	async addItem(template: Tf2ItemTemplate): Promise<Tf2Item> {
		const existingItem = this.items.get(template.id);

		if (existingItem) {
			return existingItem;
		} else {
			return await this.#addItem(template);
		}
	}

	async #removeItem(item: Tf2Item): Promise<void> {
		this.items.delete(item.id);
		if (item == this.#taunt) {
			this.#taunt = null;
			// TODO: play end choreo
			const npc = Tf2CharactersList.get(this.characterClass)!.name

			const choreoName = item.getCustomTauntOutroScenePerClass(npc);
			if (choreoName && this.#model) {
				await this.#ready;
				ChoreographiesManager.stopAll();
				await ChoreographiesManager.init('tf2', './scenes/scenes.image');
				const choreo = await ChoreographiesManager.playChoreography('tf2', choreoName, [this.#model]);
				if (choreo) {
					choreo.addEventListener(ChoreographyEventType.Stop, () => {
						item.remove();
						this.autoSelectAnim();
					});
				} else {
					item.remove();
				}

				const choreoName2 = item.getCustomTauntPropOutroScenePerClass(npc);
				const itemModel = await item.getModel();
				if (choreoName2 && itemModel) {
					await ChoreographiesManager.init('tf2', './scenes/scenes.image');
					ChoreographiesManager.playChoreography('tf2', choreoName2, [itemModel]);
				}
			} else {
				item.remove();
			}
		} else {
			item.remove();
		}
		Tf2LoadoutController.dispatchEvent('itemremoved', { detail: item });

		this.#loadoutChanged();
	}

	async #addItem(template: Tf2ItemTemplate): Promise<Tf2Item> {
		const item = new Tf2Item(template, this);
		this.items.set(template.id, item);
		const npc = Tf2CharactersList.get(this.characterClass)!.name
		await item.loadModel(npc);
		await this.#ready;
		(await this.getModel())?.addChild(await item.getModel());
		(await this.getModel())?.addChild(await item.getModelBlu());
		(await this.getModel())?.addChild(await item.getModelExtraWearable());
		await item.setTeam(this.#team);
		await item.attachSystems(npc);

		if (item.isTaunt()) {
			if (this.#taunt) {
				this.#taunt.remove();
				this.items.delete(this.#taunt.id);
				if (this.#model) {
					this.#model.useNewAnimSystem = false;
					this.#userAnim = '';
				}
			}

			this.#taunt = item;

			const animationPath = item.getWorkshopAnimationPerClass(npc);

			if (animationPath) {
				console.info(animationPath);
				const result = await Repositories.getFileAsArrayBuffer(template.getWorkshopRepository(), animationPath);
				if (!result.error) {
					const dmx = unserializeDmxSync(result.buffer!);
					if (dmx && this.#model) {
						this.#model.importAnimationFromDmx(dmx);
						this.#model.useNewAnimSystem = true;
						this.#userAnim = 'animationPath';
					}
				}
			}

			// Play choreo
			const characterChoreo = item.getCustomTauntScenePerClass(npc);
			const propChoreo = item.getCustomTauntPropScenePerClass(npc);
			if (this.#model && characterChoreo) {
				ChoreographiesManager.stopAll();
				await ChoreographiesManager.init('tf2', './scenes/scenes.image');

				// If the prop is part of the character choreography, set it as weapon so the hide / unhide weapon events work on the prop
				if (!propChoreo) {
					this.#model.setProperty('weapon', new Property('model', await item.getModel()));
				}
				ChoreographiesManager.playChoreography('tf2', characterChoreo, [this.#model]);
			}

			const itemModel = await item.getModel();
			if (propChoreo && itemModel) {
				void itemModel.skeleton?.setParentSkeleton(null);
				await ChoreographiesManager.init('tf2', './scenes/scenes.image');
				ChoreographiesManager.playChoreography('tf2', propChoreo, [itemModel]);
			}
		}

		this.#doTauntAttack(item.getTauntAttackName());

		this.#loadoutChanged();
		Tf2LoadoutController.dispatchEvent('itemadded', { detail: item });
		return item;
	}

	updatePaintColor(): void {
		for (const [, item] of this.items) {
			item.updatePaintColor();
		}
	}

	isInvulnerable(): boolean {
		return this.#isInvulnerable;
	}

	async setInvulnerable(isInvulnerable: boolean): Promise<void> {
		this.#isInvulnerable = isInvulnerable;
		await this.#refreshSkinAll();
	}

	getRagdoll(): Ragdoll {
		return this.#ragdoll;
	}

	async setRagdoll(ragdoll: Ragdoll | null): Promise<void> {
		this.#ragdoll = ragdoll ?? Ragdoll.None;
		await this.#refreshSkinAll();
	}

	async #refreshSkinAll(): Promise<void> {
		const promises: Promise<void>[] = [];
		promises.push(this.#refreshSkin());
		this.items.forEach(item => promises.push(item.setTeam(this.#team)));
		await Promise.all(promises);
	}

	#loadoutChanged(): void {
		this.autoSelectAnim();
		this.#processSoul();
		this.#checkBodyGroups();
		//Controller.dispatchEvent(new CustomEvent('loadout-changed', { detail: { character: this } }));
	}

	async #checkBodyGroups(): Promise<void> {
		await this.#ready;

		let bodyGroupIndex: string;
		let bodyGroup;
		this.#renderBodyParts(true);
		this.#model?.setVisible(this.#visible);
		this.#model?.resetBodyPartModels();

		for (const classRemovableParts of ClassRemovablePartsOff) {
			this.renderBodyPart(classRemovableParts, false);
		}

		for (const [, item] of this.items) {
			const playerBodygroups = item.getTemplate().playerBodygroups;
			if (playerBodygroups) {
				for (bodyGroupIndex in playerBodygroups) {
					bodyGroup = playerBodygroups[bodyGroupIndex];
					this.setBodyPartModel(bodyGroupIndex, Number(bodyGroup));
				}
			}

			const wmBodygroupOverride = item.getTemplate().wmBodygroupOverride;
			if (wmBodygroupOverride) {
				for (bodyGroupIndex in wmBodygroupOverride) {
					bodyGroup = wmBodygroupOverride[bodyGroupIndex];
					this.setBodyPartIdModel(Number(bodyGroupIndex), Number(bodyGroup));
				}
			}
		}
	}

	renderBodyPart(bodyPart: string, render: boolean): void {
		this.#showBodyParts.set(bodyPart, render);
		this.#model?.renderBodyPart(bodyPart, render);
	}

	#renderBodyParts(render: boolean): void {
		this.#model?.renderBodyParts(render);
	}

	setBodyPartIdModel(bodyPartId: number, modelId: number): void {
		this.#model?.setBodyPartIdModel(bodyPartId, modelId);
	}

	setBodyPartModel(bodyPartId: string, modelId: number): void {
		this.#model?.setBodyPartModel(bodyPartId, modelId);
	}

	setPose(pose: string): void {
		this.#voicePose = pose;
		this.autoSelectAnim();
	}

	setUserAnim(userAnim: string): void {
		this.#userAnim = userAnim;
		if (userAnim) {
			this.#playAnim(userAnim);
		} else {
			this.autoSelectAnim();
		}
	}

	async #playAnim(animName: string): Promise<void> {
		await this.#ready;

		this.#model?.playSequence(animName);
		await this.#model?.setAnimation(0, animName, 1);
	}

	autoSelectAnim(): void {
		if (this.#userAnim) {
			return;
		}
		const pose = this.#voicePose ?? 'stand';
		if (Tf2Character.autoSelectAnim) {
			this.#playAnim(pose + '_secondary');
		}
		for (const [, item] of this.items) {
			const animSlot = item.getTemplate().animSlot;
			const itemSlot = item.getTemplate().getItemSlotPerClass(Tf2CharactersList.get(this.characterClass)?.name ?? 'scout'/*TODO: fix* scout*/);
			if (itemSlot != 'action' && animSlot && animSlot.toLowerCase() != 'building') {
				if (animSlot[0] == '#') {
					//this.playAnim(animSlot.substring(1) + currentCharacter.npc.toLowerCase());
				} else if (animSlot[0] == '!') {
					this.#playAnim(animSlot.substring(1));
				} else if (animSlot.toLowerCase() == 'primary2') {
					this.#playAnim(pose + '_primary');
				} else if (animSlot.toLowerCase() != 'force_not_used') {
					this.#playAnim(pose + '_' + animSlot);
				}
			} else {
				let slot;
				switch (itemSlot) {
					case 'primary':
					case 'secondary':
					case 'melee':
					case 'pda':
						slot = itemSlot;
						break;
					case 'building':
						slot = 'sapper';
						break;
					case 'force_building':
						slot = 'building';
						break;
				}

				/*if (item.used_by_classes) {
					for (let c in item.used_by_classes) {
						if (c == currentCharacter.npc.toLowerCase()
							&& isNaN(item.used_by_classes[c])) {
							slot = item.used_by_classes[c];
							break;
						}
					}
				}*/
				if (slot) {
					this.#playAnim(pose + '_' + slot);
				}

			}
		}
	}

	#processSoul(): void {
		this.#zombieSkin = false;
		for (const [, item] of this.items) {
			if (item.getTemplate().name.includes('Voodoo-Cursed')) {
				this.#zombieSkin = true;
			}
		}
		this.#refreshSkin();
	}

	#doTauntAttack(tauntAttackName: string | null): void {
		const spawnClientsideFlyingBird = async (pos: vec3): Promise<void> => {
			const flyAngle = RandomFloat(-Math.PI, Math.PI);
			const flyAngleRate = RandomFloat(-1.5, 1.5);
			const accelZ = RandomFloat(0.5, 2.0);
			const speed = RandomFloat(ENTITY_FLYING_BIRD_SPEED_MIN, ENTITY_FLYING_BIRD_SPEED_MAX);
			const glideTime = RandomFloat(0.25, 1.);

			await this.#ready;
			new FlyingBird(this.#model, pos, flyAngle, flyAngleRate, accelZ, speed, glideTime);
		}

		switch (tauntAttackName) {
			case 'TAUNTATK_ALLCLASS_GUITAR_RIFF':
				//setEffect(this, 'bl_killtaunt', 'bl_killtaunt', 'no_attachment');
				this.#addEffect('bl_killtaunt', 'bl_killtaunt');
				Source1SoundManager.playSound('tf2', 'Taunt.GuitarRiff');
				break;
			case 'TAUNTATK_MEDIC_HEROIC_TAUNT':
				//setEffect(this, 'god_rays', 'god_rays', 'no_attachment');
				this.#addEffect('god_rays', 'god_rays');
				Source1SoundManager.playSound('tf2', 'Taunt.MedicHeroic');
				setTimeout((): void => {
					(async (): Promise<void> => {
						await this.#ready;
						if (!this.#model) {
							return;
						}
						const launchSpot = this.#model.getWorldPosition();
						for (let i = 0; i < MEDIC_RELEASE_DOVE_COUNT; ++i) {
							const pos = vec3.clone(launchSpot);
							pos[2] = pos[2] + Math.random() * 30 - 10 + 50;
							spawnClientsideFlyingBird(pos);
						}
					})()
				}, 3000);

				break;
		}
	}

	async #addEffect(name: string, systemName: string, attachment?: string, offset?: vec3): Promise<Tf2Effect> {
		const effect = new Tf2Effect(new Tf2EffectTemplate(Tf2EffectType.Other, -1, {}));
		this.effects.add(effect);

		//const system = await Source1ParticleControler.createSystem('tf2', systemName);
		effect.system = await Source1ParticleControler.createSystem('tf2', systemName);
		effect.system.name = name;

		await this.#ready;
		this.#model?.attachSystem(effect.system, attachment, 0, offset);
		effect.system.start();

		return effect;
	}

	async #attachSystem(system: Source1ParticleSystem, attachmentName: string, attachmentType?: any, offset?: vec3): Promise<void> {
		await this.#ready;
		this.#model?.attachSystem(system, attachmentName, 0, offset);
	}

	async setFlexControllerValue(name: string, value: number): Promise<void> {
		this.#flexControllers.set(name, value);
		await this.#updateFlexes();
	}

	async resetFlexes(): Promise<void> {
		this.#flexControllers.clear();
		await this.#updateFlexes();
	}

	async #updateFlexes(): Promise<void> {
		await this.#ready;
		this.#model?.setFlexes(this.#flexControllers);
		for (const [, item] of this.items) {
			(await item.getModel())?.setFlexes(this.#flexControllers);
		}

		for (const extraModel of this.#extraModels) {
			extraModel.setFlexes(this.#flexControllers);
		}
	}

	async addEffect(template: Tf2EffectTemplate): Promise<Tf2Effect> {
		const effect = new Tf2Effect(template);
		this.effects.add(effect);

		await this.#createEffect(effect);
		this.#setEffectsTeam();

		return effect;
	}

	async #createEffect(effect: Tf2Effect, systemName?: string, eyeAttachment?: string): Promise<void> {
		effect.system = await Source1ParticleControler.createSystem('tf2', systemName ?? effect.template.getSystem());
		effect.system.name = effect.template.getName();

		await this.#ready;
		let attachment = '';
		switch (effect.template.type) {
			case Tf2EffectType.Cosmetic:
				attachment = 'bip_head';
				break;
			case Tf2EffectType.Killstreak:
				attachment = eyeAttachment ?? '';
				break;
			default:
				break;
		}

		if (this.characterClass == Tf2Class.Empty) {
			for (const [, item] of this.items) {
				const model = await item.getModel();
				if (model) {
					model.attachSystem(effect.system, attachment, 0);// TODO: offset
					break;
				}
			}
		} else {
			this.#model?.attachSystem(effect.system, attachment, 0);// TODO: offset
		}

		effect.system.start();
	}

	removeEffect(effect: Tf2Effect): void {
		effect.system?.stop();
		effect.system?.remove();
		this.effects.delete(effect);
	}

	async #setEffectsTeam(): Promise<void> {
		for (const effect of this.effects) {
			// TODO: parallelize
			await this.#setEffectTeam(effect);
		}

		for (const effect of this.#killstreakEffects) {
			// TODO: parallelize
			if (effect) {
				await this.#setEffectTeam(effect);
			}
		}

		for (const effect of this.#decapitationEffects) {
			// TODO: parallelize
			if (effect) {
				await this.#setEffectTeam(effect);
			}
		}

		if (this.#tauntEffect) {
			await this.#setEffectTeam(this.#tauntEffect);
		}
	}

	async #setEffectTeam(effect: Tf2Effect): Promise<void> {
		let from: string;
		let to: string;
		if (this.#team == 'red') {
			from = EFFECTS_BLU;
			to = EFFECTS_RED;
		} else {
			to = EFFECTS_BLU;
			from = EFFECTS_RED;
		}

		const oldName = effect.system?.system ?? '';
		if (oldName.includes(from)) {
			const newName = oldName.replace(from, to);
			effect.system?.stop();
			effect.system?.remove();
			await this.#createEffect(effect, newName);
		}
	}

	async setKillsteakEffect(template: Tf2EffectTemplate | null, color?: KillstreakColor): Promise<[Tf2Effect | null, Tf2Effect | null]> {
		return this.#setKillsteakEffect(this.#killstreakEffects, template, Eye.Right, color);
	}

	async #setKillsteakEffect(array: [Tf2Effect | null, Tf2Effect | null], template: Tf2EffectTemplate | null, demoEye: Eye, color?: KillstreakColor): Promise<[Tf2Effect | null, Tf2Effect | null]> {
		for (let i = 0; i < 2; i++) {
			const effect = array[i]!;
			if (effect) {
				effect.system?.stop();
				effect.system?.remove();
			}
			array[i] = null;

			// No left eye for demoman
			if ((i as Eye) != demoEye && (this.characterClass == Tf2Class.Demoman || this.characterClass == Tf2Class.DemomanBot)) {
				continue;
			}

			if (template) {
				const effect = new Tf2Effect(template);
				effect.killstreakColor = color;
				await this.#createEffect(effect, undefined, eyeAttachments[i]);

				const sys = effect?.system;
				if (sys && color) {
					const killstreakColor = getKillstreak(color)?.getKillstreakColor1(this.#team);
					if (killstreakColor) {
						sys.getControlPoint(9)!.setPosition(killstreakColor);
					}
				}
				array[i] = effect;
			}
		}

		// Check team color
		this.#setEffectsTeam();

		return array;
	}

	async #updateKillsteakEffectsTeam(): Promise<void> {
		const effect = this.#killstreakEffects[0] ?? this.#killstreakEffects[1];
		if (effect) {
			const killstreakColor = effect.killstreakColor!;
			const killstreak = killstreakList.get(killstreakColor);

			// Only update if the effects is team colored
			if (killstreak?.teamColored) {
				await this.setKillsteakEffect(effect.template, effect.killstreakColor);
			}
		}
	}

	async setDecapitationLevel(level: number): Promise<[Tf2Effect | null, Tf2Effect | null]> {
		this.#decapitationLevel = level;
		let template: Tf2EffectTemplate | null = null;
		if (level > 0) {
			template = new Tf2EffectTemplate(Tf2EffectType.Killstreak, 20000, { 'name': 'Eye glow', 'system': 'eye_powerup_green_lvl_' + level, });
		}
		return this.#setKillsteakEffect(this.#decapitationEffects, template, Eye.Left);
	}

	getDecapitationLevel(): number {
		return this.#decapitationLevel;
	}

	async setTauntEffect(template: Tf2EffectTemplate | null): Promise<Tf2Effect | null> {
		if (this.#tauntEffect) {
			this.#tauntEffect.system?.stop();
			this.#tauntEffect.system?.remove();
		}

		if (!template) {
			this.#tauntEffect = null;
			return null;
		}

		const effect = new Tf2Effect(template);
		this.#tauntEffect = effect;

		await this.#createEffect(effect);
		this.#setEffectsTeam();

		return effect;
	}

	getTauntEffect(): Tf2Effect | null {
		return this.#tauntEffect;
	}

	getKillstreakEffects(): [Tf2Effect | null, Tf2Effect | null] {
		return this.#killstreakEffects;
	}

	setPoseParameter(name: string, value: number): void {
		this.#model?.setPoseParameter(name, value);
		for (const extraModel of this.#extraModels) {
			extraModel.setPoseParameter(name, value);
		}
	}

	savePreset(name: string): Tf2Preset {
		const preset = new Tf2Preset(name);

		const npc = Tf2CharactersList.get(this.characterClass)!.name;
		preset.character = npc;
		preset.decapitationLevel = this.#decapitationLevel;

		for (const [, item] of this.items) {
			const presetItem = new Tf2PresetItem();

			presetItem.id = item.id;
			if (presetItem.id.startsWith('w')) {
				// Remove leading w
				presetItem.id = presetItem.id.substring(1);
			}
			presetItem.isWorkshop = item.getTemplate().isWorkshop();
			presetItem.isTournamentMedal = item.getTemplate().isTournamentMedal();

			if (item.getWarpaintId() !== null) {
				presetItem.warpaintId = item.getWarpaintId()!;
			}

			if (item.getWarpaintSeed() != 0n) {
				presetItem.warpaintSeed = item.getWarpaintSeed();
			}

			if (item.getWarpaintWear() != 0) {
				presetItem.warpaintWear = item.getWarpaintWear();
			}

			const paint = item.getPaint();
			if (paint) {
				presetItem.paint = paint;
			}

			presetItem.weaponEffect = item.getWeaponEffectId() ?? undefined;
			presetItem.showFestivizer = item.getShowFestivizer();
			presetItem.killCount = item.getKillCount() ?? undefined;
			const sheen = item.getSheen();
			if (sheen) {
				presetItem.sheen = sheen;
			}

			preset.addItem(presetItem);
		}

		const addPresetEffect = (effect: Tf2Effect | null): void => {
			if (!effect) {
				return;
			}
			const presetEffect = new Tf2PresetEffect();

			presetEffect.id = effect.template.id;
			presetEffect.setType(effect.template.type);
			presetEffect.attachment = effect.attachment;
			presetEffect.color = effect.killstreakColor;
			if (effect.offset) {
				vec3.copy(presetEffect.offset, effect.offset);
			}

			preset.addEffect(presetEffect);
		}

		for (const effect of this.effects) {
			addPresetEffect(effect);
		}

		addPresetEffect(this.#tauntEffect);

		for (const effect of this.#killstreakEffects) {
			if (effect) {
				addPresetEffect(effect);
				// we only need to serialize the first non nul effect
				break;
			}
		}

		return preset;
	}

	async loadPreset(preset: Tf2Preset): Promise<void> {
		this.removeAllItems();
		this.removeAllEffects();

		const itemPromises: Promise<void>[] = [];

		for (const presetItem of preset.items) {
			itemPromises.push(this.#loadPresetItem(presetItem));
		}
		await Promise.all(itemPromises);

		this.setDecapitationLevel(preset.decapitationLevel);

		for (const presetEffect of preset.effects) {
			const template = Tf2ItemManager.getEffectTemplate(presetEffect.getType(), presetEffect.id);
			if (!template) {
				continue;
			}

			switch (presetEffect.type) {
				case Tf2PresetEffectType.Unusual:
					this.addEffect(template);
					break;
				case Tf2PresetEffectType.Killstreak:
					this.setKillsteakEffect(template, presetEffect.color);
					break;
				case Tf2PresetEffectType.Taunt:
					this.setTauntEffect(template);
					break;
			}
		}
	}

	async #loadPresetItem(presetItem: Tf2PresetItem): Promise<void> {
		let itemId = presetItem.id;

		if (presetItem.isWorkshop) {
			itemId = 'w' + itemId;
		}

		const template = Tf2ItemManager.getItemTemplate(itemId);
		if (!template) {
			return;
		}

		const item = await this.#addItem(template);

		if (item) {
			item.setWarpaintId(presetItem.warpaintId ?? null);
			item.setWarpaintWear(presetItem.warpaintWear ?? 0);
			item.setWarpaintSeed(presetItem.warpaintSeed ?? 0n);

			if (presetItem.paint) {
				item.setPaint(presetItem.paint);
			}

			//item.paintId = presetItem.paint ?? DEFAULT_PAINT_ID;
			//item.weaponEffectId = presetItem.weaponEffect;
			item.setWeaponEffectId(presetItem.weaponEffect ?? null);
			item.showFestivizer(presetItem.showFestivizer);
			item.setKillCount(presetItem.killCount ?? null);
			item.setSheen(presetItem.sheen ?? 0);
		}
	}

	removeAll(): void {
		this.removeAllItems();
		this.removeAllEffects();
	}

	removeAllItems(): void {
		for (const [, item] of this.items) {
			this.#removeItem(item);
		}
	}

	removeAllEffects(): void {
		for (const effect of this.effects) {
			this.removeEffect(effect);
		}
		this.setKillsteakEffect(null);
		this.setTauntEffect(null);
	}

	async copy(other: Tf2Character): Promise<void> {
		this.removeAll();

		for (const [, copiedItem] of other.items) {
			const item = await this.addItem(copiedItem.getTemplate());

			item.setKillCount(copiedItem.getKillCount());
			item.showFestivizer(copiedItem.getShowFestivizer());
			item.setCustomTexture(copiedItem.getCustomTexture());
			item.critBoost(copiedItem.isCritBoosted());
			item.setPaint(copiedItem.getPaint());
			item.setSheen(copiedItem.getSheen());
			item.setWeaponEffectId(copiedItem.getWeaponEffectId());

			const textureSize = copiedItem.getTextureSize();
			if (textureSize) {
				item.setTextureSize(textureSize);
			}

			const warpaintId = copiedItem.getWarpaintId()
			if (warpaintId !== null) {
				item.setWarpaint(warpaintId, copiedItem.getWarpaintWear(), copiedItem.getWarpaintSeed());
			}
		}

		for (const effect of other.effects) {
			await this.addEffect(effect.template);
		}

		const tauntEffect = other.getTauntEffect();
		if (tauntEffect) {
			this.setTauntEffect(tauntEffect.template);
		}

		const killstreakEffects = other.getKillstreakEffects();
		if (killstreakEffects) {
			for (const effect of killstreakEffects) {
				if (effect) {
					this.setKillsteakEffect(effect.template, effect.killstreakColor);
				}
			}
		}

		if (other.getDecapitationLevel() > 0) {
			this.setDecapitationLevel(other.getDecapitationLevel());
		}
	}
}
