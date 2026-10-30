import { vec3, vec4 } from 'gl-matrix';
import { Material, Source1MaterialManager, Source1ModelInstance, Source1ParticleControler, Source1ParticleSystem } from 'harmony-3d';
import { WeaponManager } from 'harmony-3d-utils';
import { addTF2Model } from '../addtf2model';
import { Ragdoll, Tf2Character } from '../characters/character';
import { MATERIAL_GOLD_RAGDOLL, MATERIAL_ICE_RAGDOLL, MATERIAL_INVULN_BLU, MATERIAL_INVULN_RED } from '../constants';
import { COMMUNITY_SPARKLE_EFFECT, weaponEffects } from '../effects/effect';
import { Tf2EffectType } from '../effects/effecttemplate';
import { getTf2TeamId, Tf2Team } from '../enums';
import { getKillstreak, Killstreak, KillstreakColor } from '../paints/killstreaks';
import { getPaint, Paint, Paints } from '../paints/paints';
import { colorToVec4 } from '../utils/colors';
import { randomProperty } from '../utils/randomproperty';
import { hasConflict } from './hasconflict';
import { Tf2ItemManager } from './itemmanager';
import { Tf2ItemTemplate } from './itemtemplate';
import { updatePreview } from './updatepreview';

export class Tf2Item {
	readonly id: string;
	#itemTemplate: Tf2ItemTemplate;
	#character: Tf2Character;
	#model: Source1ModelInstance | null = null;
	#modelBlu: Source1ModelInstance | null = null;
	#modelExtraWearable: Source1ModelInstance | null = null;
	#attachedModels: Source1ModelInstance[] = [];
	#festivizerModel?: Source1ModelInstance | null;
	#stattrakModule?: Promise<Source1ModelInstance | null> | null;
	#team: Tf2Team = 'none';
	#killCount: number | null = null;
	#refreshingSkin = false;
	#showFestivizer = false;
	#critBoost = false;
	#critBoostSysRed?: Source1ParticleSystem | null;
	#critBoostSysBlu?: Source1ParticleSystem | null;
	#weaponEffectSystem?: Source1ParticleSystem | null;
	#loaded = false;
	#paint: Paint | null = null;
	#sheen: Killstreak | null = null;
	#weaponEffectId: number | null = null;
	#warpaintWear = 0;
	#warpaintId: number | null = null;
	#warpaintSeed = 0n;
	#materialOverride: string | null = null;
	#textureSize?: number;
	changeTextureSize?: number;
	#customTexture: string | null = null;

	#readyPromiseResolve!: (value: any) => void;
	#ready = new Promise<boolean>((resolve) => {
		this.#readyPromiseResolve = resolve;
	});

	constructor(itemTemplate: Tf2ItemTemplate, character: Tf2Character) {
		this.#itemTemplate = itemTemplate;
		this.#character = character;
		this.id = itemTemplate.id;
		/*
		this.#ready = new Promise((resolve, reject) => {
			this.#readyPromiseResolve = resolve;
		});
		*/
	}

	getTemplate(): Tf2ItemTemplate {
		return this.#itemTemplate;
	}

	async setTeam(team: Tf2Team): Promise<void> {
		this.#team = team;
		await this.#refreshSkin();
		await this.#refreshSheen();
		this.#refreshWarPaint();
	}

	getEquipRegions(): string[] {
		return this.#itemTemplate.equipRegions;
	}

	async setKillCount(count: number | null): Promise<void> {
		this.#killCount = count;
		if (!this.#stattrakModule) {
			const stattrakPath = this.#itemTemplate.weaponUsesStattrakModule;
			if (stattrakPath) {
				this.#stattrakModule = addTF2Model(this.#model, stattrakPath, undefined, 'Stat clock');
				//modelLayer.addEntity(this.#stattrakModule);
				if (await this.#stattrakModule) {
					//this.#model?.addChild(await this.#stattrakModule);
					this.#refreshSkin();
				}
			}
		}

		const module = await this.#stattrakModule;
		if (module) {
			module.setVisible(count == null ? false : undefined);
			const stattrakScale = Number.parseFloat(this.#itemTemplate.weaponStattrakModuleScale ?? 1);
			module.materialsParams['StatTrakNumber'] = count;
			const stattrackBone = this.#model?.getBoneByName('c_weapon_stattrack');
			if (stattrackBone) {
				stattrackBone.scale = [stattrakScale, stattrakScale, stattrakScale];
			}
		}
	}

	getKillCount(): number | null {
		return this.#killCount;
	}

	async #refreshSkin(): Promise<void> {
		// TODO
		if (this.#refreshingSkin) {
			return;
		}
		this.#refreshingSkin = true;

		const skin = this.#team === 'blu' ? this.#itemTemplate.bluSkin : this.#itemTemplate.redSkin;

		if (this.#critBoostSysRed) {
			this.#critBoostSysRed.stop();
			this.#critBoostSysRed.remove();
			this.#critBoostSysRed = null;
		}

		if (this.#critBoostSysBlu) {
			this.#critBoostSysBlu.stop();
			this.#critBoostSysBlu.remove();
			this.#critBoostSysBlu = null;
		}

		await this.#ready;

		if (this.#character?.isInvulnerable() || this.#character?.getRagdoll() !== Ragdoll.None) {
			let materialName: string | null = null;
			switch (this.#character?.getRagdoll()) {
				case Ragdoll.None:
					materialName = this.#team ? MATERIAL_INVULN_BLU : MATERIAL_INVULN_RED;
					break;
				case Ragdoll.Gold:
					materialName = MATERIAL_GOLD_RAGDOLL;
					break;
				case Ragdoll.Ice:
					materialName = MATERIAL_ICE_RAGDOLL;
					break;
			}

			this.#setMaterialOverride(materialName);
		} else {
			this.#setMaterialOverride(null);

			const materialOverride = this.#itemTemplate.getMaterialOverride();
			if (materialOverride) {
				this.#setMaterialOverride(materialOverride);
			} else {
				await this.#model?.setSkinId(skin);
			}

			if (this.#warpaintId !== null) {
				this.#refreshWarPaint();
			}
		}


		// TODO
		//this.setBurnLevel(this.#character.burnLevel);

		const sourceModelBlu = this.#modelBlu;
		if (sourceModelBlu) {
			if (this.#team == 'red') {
				this.#model?.setVisible(undefined);
				sourceModelBlu.setVisible(false);
			} else {
				this.#model?.setVisible(false);
				sourceModelBlu.setVisible(undefined);
			}
		}

		if (this.#model && this.#critBoost) {
			let systemName = '';
			let glowColor = null;
			let sys = null;
			if (this.#team == 'red') {
				sys = this.#critBoostSysRed;
				glowColor = [80, 8, 5];
				systemName = 'critgun_weaponmodel_red';
			} else {
				sys = this.#critBoostSysBlu;
				glowColor = [5, 20, 80]
				systemName = 'critgun_weaponmodel_blu';
			}

			//for soda popper hype
			//glowColor = [50, 2, 48];
			if (systemName && glowColor) {
				if (!sys) {
					sys = await Source1ParticleControler.createSystem('tf2', systemName);
				}
				sys.start();
				this.#model.addChild(sys);
				this.#model.attachSystem(sys, '');
				for await (const child of this.getAllModels()) {
					child.materialsParams['ModelGlowColor'] = glowColor;
				}
				/*
				this.#model.materialsParams['ModelGlowColor'] = glowColor;

				const module = await this.#stattrakModule;
				if (module) {
					module.materialsParams['ModelGlowColor'] = glowColor;
				}
				*/
			}
			if (this.#team == 'red') {
				this.#critBoostSysRed = sys;
			} else {
				this.#critBoostSysBlu = sys;
			}

		} else {
			/*
			if (this.#model) {
				this.#model.materialsParams['ModelGlowColor'] = null;
			}
			const module = await this.#stattrakModule;
			if (module) {
				module.materialsParams['ModelGlowColor'] = null;
			}
				*/
			for await (const child of this.getAllModels()) {
				child.materialsParams['ModelGlowColor'] = null;
			}
		}


		/*

			// TODO
		if (this.#character.isInvulnerable) {
			let materialName = this.#team ? MATERIAL_INVULN_BLU : MATERIAL_INVULN_RED;
			this.#setMaterialOverride(materialName);
		} else {
			this.#setMaterialOverride();

			const materialOverride = this.#itemTemplate.materialOverride;
			if (materialOverride) {
				//TODO: fix this
				await setTimeoutPromise(1000);// Ensure this is done after the material are set. This is lame but it works
				this.#setMaterialOverride(materialOverride);
			}
		}
		*/

		await this.#modelExtraWearable?.setSkinId(skin);
		for (const extraModel of this.#attachedModels) {
			await extraModel.setSkinId(skin);
		}

		await this.#festivizerModel?.setSkinId(getTf2TeamId(this.#team));
		await (await this.#stattrakModule)?.setSkinId(skin % 2);

		this.#refreshingSkin = false;
	}

	getRepository(): string {
		return this.#itemTemplate.repository ?? 'tf2';
	}

	async showFestivizer(showFestivizer: boolean): Promise<void> {
		this.#showFestivizer = showFestivizer;

		if (showFestivizer && !this.#festivizerModel) {
			const festivizerPath = this.#itemTemplate.attachedModelsFestive;
			if (festivizerPath) {
				this.#festivizerModel = await addTF2Model(this.#model, festivizerPath, this.getRepository(), this.#itemTemplate.name + ' Festivizer');
				if (this.#festivizerModel) {
					//this.#model?.addChild(this.#festivizerModel);
					this.#refreshSkin();
				}
			}
		}

		this.#festivizerModel?.setVisible(showFestivizer ? undefined : false);
	}

	getShowFestivizer(): boolean {
		return this.#showFestivizer;
	}

	async toggleFestivizer(): Promise<void> {
		await this.showFestivizer(!this.#showFestivizer);
	}

	setCustomTexture(textureName: string | null): void {
		this.#customTexture = textureName;
		if (this.#model) {
			this.#model.materialsParams.customtexture = textureName;
		}
	}

	getCustomTexture(): string | null {
		return this.#customTexture;
	}

	critBoost(boost?: boolean): void {
		if (boost !== undefined) {
			this.#critBoost = boost;
		} else {
			this.#critBoost = !this.#critBoost;
		}
		this.#refreshSkin();
	}

	isCritBoosted(): boolean {
		return this.#critBoost;
	}

	async loadModel(npc: string): Promise<void> {
		if (this.#loaded) {
			return;
		}
		this.#loaded = true;
		const path = await this.#itemTemplate.getModel(npc);
		if (path) {
			this.#model = await addTF2Model(null, path, this.getRepository());
		}

		const pathBlu = this.#itemTemplate.getModelBlue(npc);
		if (pathBlu) {
			this.#modelBlu = await addTF2Model(null, pathBlu, this.getRepository());
			this.#modelBlu?.setVisible(false);
		}

		const attachedModels = this.#itemTemplate.getAttachedModels();
		if (attachedModels) {
			const attachedModel = attachedModels;
			//for (const attachedModel of attachedModels)
			{
				const extraModel = await addTF2Model(this.#model, attachedModel, this.getRepository()/*, this.name + ' attached'*/);
				if (extraModel) {
					//this.#model?.addChild(extraModel);
					this.#attachedModels.push(extraModel);
				}
			}
		}

		const pathExtraWearable = this.#itemTemplate.getExtraWearable();
		if (pathExtraWearable) {
			this.#modelExtraWearable = await addTF2Model(null, pathExtraWearable, this.getRepository());
		}

		if (this.#model) {
			if (this.#itemTemplate.usePerClassBodygroups) {
				this.#model.setBodyPartModel('class', this.#character.characterClass);
			}

			this.#readyPromiseResolve(true);
			//this.#model.setFlexes();
			this.#model.setPoseParameter('move_x', 1);
			this.#model.setPoseParameter('move_y', 0.5);
			this.#model.setPoseParameter('body_yaw', 0.5);
			this.#model.setPoseParameter('body_pitch', 0.3);
			this.#model.setPoseParameter('r_arm', 0);
			this.#model.setPoseParameter('r_hand_grip', 0);
			this.#model.name = this.#itemTemplate.name;
		} else {
			this.#readyPromiseResolve(false);
		}
		//this.#model.setVisible(this.#visible);

		/*
		if (this.#character) {
			(await this.#character.getModel())?.addChild(this.#model);
		} else {
			loadoutScene.addChild(this.#model);
		}
		*/
	}


	async attachSystems(npc: string): Promise<void> {
		if (!this.#model) {
			return;
		}

		let s = Tf2ItemManager.getEffectTemplate(Tf2EffectType.Cosmetic, Number(this.#itemTemplate.setAttachedParticleStatic));
		if (s) {
			let sys = await Source1ParticleControler.createSystem('tf2', s.getSystem());
			sys.start();
			this.#model.attachSystem(sys, s.getAttachment());
		}

		let attachedParticlesystems = this.#itemTemplate.attachedParticlesystems;
		if (attachedParticlesystems) {
			for (let attachedSystem of attachedParticlesystems) {
				let sys = await Source1ParticleControler.createSystem('tf2', attachedSystem.system);
				sys.start();
				this.#model.attachSystem(sys, attachedSystem.attachment);
			}
		}
	}

	async getModel(): Promise<Source1ModelInstance | null> {
		await this.#ready;
		return this.#model;
	}

	async getModelBlu(): Promise<Source1ModelInstance | null> {
		await this.#ready;
		return this.#modelBlu;
	}

	async getModelExtraWearable(): Promise<Source1ModelInstance | null> {
		await this.#ready;
		return this.#modelExtraWearable;
	}

	async remove(): Promise<void> {
		await this.#ready;
		this.#model?.remove();
		this.#modelBlu?.remove();
		this.#modelExtraWearable?.remove();
		for (const extraModel of this.#attachedModels) {
			extraModel.remove();
		}
	}

	isConflicting(other: Tf2Item): boolean {
		return hasConflict(this.getEquipRegions(), other.getEquipRegions());
	}

	setPaint(paint: Paints | null): void {
		if (paint == Paints.None) {
			paint = null;
		}
		if (paint !== null) {
			this.#paint = getPaint(paint);
		} else {
			this.#paint = paint;
		}

		if (this.#model) {
			if (paint == null) {
				this.#model.setTint(null);
				if (this.#team == 'red') {
					if (this.#itemTemplate.setItemTintRGB) {
						this.#model.setTint(colorToVec4(Number(this.#itemTemplate.setItemTintRGB)));
					}
				} else {
					if (this.#itemTemplate.setItemTintRGB2) {
						this.#model.setTint(colorToVec4(Number(this.#itemTemplate.setItemTintRGB2)));
					}
				}
			} else {
				this.#refreshPaint();
			}
		}
	}

	getPaint(): Paints | null {
		return this.#paint?.paint ?? null;
	}

	async #refreshPaint(): Promise<void> {
		await this.#ready;
		if (this.#model) {
			//this.#sourceModel.tint = null;
			if (this.#paint != null) {
				const tint = this.#paint.getTint(this.#team);
				this.#model.setTint(vec4.fromValues(tint[0], tint[1], tint[2], 255));
				/*
				if (paint && this.#paintId != DEFAULT_PAINT_ID) {
				}
				*/
			}
		}
	}

	updatePaintColor(): void {
		this.#refreshPaint();
	}

	async #setMaterialOverride(materialOverride: string | null): Promise<void> {
		let material: Material | null = null;
		this.#materialOverride = materialOverride;
		if (materialOverride) {
			material = await Source1MaterialManager.getMaterial('tf2', materialOverride);
		}

		void this.#model?.setMaterialOverride(material);
		void this.#modelBlu?.setMaterialOverride(material);

		void this.#modelExtraWearable?.setMaterialOverride(material);
		for (const extraModel of this.#attachedModels) {
			void extraModel.setMaterialOverride(material);
		}

		void this.#festivizerModel?.setMaterialOverride(material);

		void (await this.#stattrakModule)?.setMaterialOverride(material);
	}

	setSheen(sheen: KillstreakColor | null): void {
		this.#sheen = getKillstreak(sheen ?? KillstreakColor.None);
		if (this.#model) {
			if (sheen == null) {
				//this.#model.sheen = null;
			} else {
				this.#refreshSheen();
			}
		} else {
			// TODO: character sheen
		}
	}

	getSheen(): KillstreakColor | null {
		return this.#sheen?.killstreak ?? null;
	}

	async #refreshSheen(): Promise<void> {
		await this.#ready;
		const sheen = this.#sheen;
		if (sheen && this.#model) {
			this.#model.sheen = sheen.getSheenColor(this.#team);
		}
	}

	isTaunt(): boolean {
		return this.#itemTemplate.isTaunt();
	}

	getCustomTauntScenePerClass(npc: string): string | null {
		const customTauntScenePerClass = this.#itemTemplate.customTauntScenePerClass;
		if (!customTauntScenePerClass) {
			return null;
		}
		const scene = customTauntScenePerClass[npc];
		if (scene) {
			if (typeof scene == 'object') {
				return randomProperty(scene);
			}
			return scene;
		}
		return null;
	}

	getCustomTauntPropScenePerClass(npc: string): string | null {
		const customTauntPropScenePerClass = this.#itemTemplate.customTauntPropScenePerClass;
		if (!customTauntPropScenePerClass) {
			return null;
		}
		const scene = customTauntPropScenePerClass[npc];
		if (scene) {
			if (typeof scene == 'object') {
				return randomProperty(scene)
			}
			return scene;
		}
		return null;
	}

	getCustomTauntOutroScenePerClass(npc: string): string | null {
		const customTauntOutroScenePerClass = this.#itemTemplate.customTauntOutroScenePerClass;
		return customTauntOutroScenePerClass?.[npc] ?? null;
	}

	getCustomTauntPropOutroScenePerClass(npc: string): string | null {
		const customTauntPropOutroScenePerClass = this.#itemTemplate.customTauntPropOutroScenePerClass;
		return customTauntPropOutroScenePerClass?.[npc] ?? null;
	}

	getWorkshopAnimationPerClass(npc: string): string | null {
		const importSessionClasses = this.#itemTemplate.getImportSessionClasses();
		if (!importSessionClasses) {
			return null;
		}
		const c = importSessionClasses[npc];
		return c?.['animation']?.['source_file'] ?? null;
	}

	getTauntAttackName(): string | null {
		return this.#itemTemplate.tauntAttackName;
	}

	setWeaponEffectId(weaponEffectId: number | null): void {
		this.#weaponEffectId = weaponEffectId;

		if (this.#weaponEffectSystem) {
			this.#weaponEffectSystem.stop();
			this.#weaponEffectSystem.remove();
			this.#weaponEffectSystem = null;
		}

		if (weaponEffectId == null) {
			return;
		}

		const weaponEffect = weaponEffects.get(weaponEffectId);
		const particleSuffix = this.getTemplate().particleSuffix;
		if (particleSuffix && weaponEffect) {
			//item.weaponEffects = item.weaponEffects || {};

			(async (): Promise<void> => {
				let systemName = COMMUNITY_SPARKLE_EFFECT === weaponEffectId ? weaponEffect[0] : `weapon_unusual_${weaponEffect[0]}_${particleSuffix}`;
				const particleSystem1 = await Source1ParticleControler.createSystem('tf2', systemName);
				//particleSystem1.visible = true;

				const model = this.#model;
				if (particleSystem1 && model) {
					model.attachSystem(particleSystem1, 'unusual_1', 1, vec3.create());
					model.attachSystem(particleSystem1, 'unusual_2', 2);
					model.attachSystem(particleSystem1, 'unusual_3', 3);
					model.attachSystem(particleSystem1, 'unusual_4', 4);
					model.attachSystem(particleSystem1, 'unusual_5', 5);
					model.attachSystem(particleSystem1, 'unusual_0');
				}
				if (particleSystem1) {
					particleSystem1.start();
					this.#weaponEffectSystem = particleSystem1;
					//item.weaponEffects[weaponEffect] = particleSystem1;
				}
			})();
		}
	}

	getWeaponEffectId(): number | null {
		return this.#weaponEffectId;
	}

	setWarpaintId(warpaintId: number | null): void {
		if (this.#warpaintId != warpaintId) {
			this.#warpaintId = warpaintId;
			this.#textureSize = this.changeTextureSize;
			this.#refreshWarPaint();
		}
	}

	getWarpaintId(): number | null {
		return this.#warpaintId ?? null;
	}

	setWarpaintWear(warpaintWear: number): void {
		if (this.#warpaintWear != warpaintWear) {
			this.#warpaintWear = warpaintWear;
			this.#textureSize = this.changeTextureSize;
			this.#refreshWarPaint();
		}
	}

	getWarpaintWear(): number {
		return this.#warpaintWear;
	}

	setWarpaintSeed(warpaintSeed: bigint | number): void {
		warpaintSeed = BigInt(warpaintSeed);
		if (this.#warpaintSeed != warpaintSeed) {
			this.#warpaintSeed = warpaintSeed;
			this.#textureSize = this.changeTextureSize;
			this.#refreshWarPaint();
		}
	}

	getWarpaintSeed(): bigint {
		return this.#warpaintSeed;
	}

	setWarpaint(warpaintId: number, warpaintWear: number, warpaintSeed: bigint | number): void {
		warpaintSeed = BigInt(warpaintSeed);
		if (this.#warpaintId != warpaintId || this.#warpaintWear != warpaintWear || this.#warpaintSeed != warpaintSeed) {

			this.#warpaintId = warpaintId;
			this.#warpaintWear = warpaintWear;
			this.#warpaintSeed = warpaintSeed;
			this.#textureSize = this.changeTextureSize;
			this.#refreshWarPaint();
		}
	}

	setTextureSize(textureSize: number): void {
		if (this.#textureSize !== undefined && this.#textureSize >= textureSize) {
			return;
		}
		this.#textureSize = textureSize;

		this.#refreshWarPaint();
	}

	getTextureSize(): number | undefined {
		return this.#textureSize;
	}

	#refreshWarPaint(): void {
		if (this.#model && this.#warpaintId !== null && this.#materialOverride === null) {
			WeaponManager.refreshWarpaint({
				id: this.id,
				warpaintId: this.#warpaintId,
				warpaintWear: this.#warpaintWear,
				warpaintSeed: this.#warpaintSeed,
				model: this.#model,
				team: getTf2TeamId(this.#team),
				textureSize: this.#textureSize,
				updatePreview,
			});
		}
	}

	getCharacter(): Tf2Character {
		return this.#character;
	}

	async *getAllModels(): AsyncGenerator<Source1ModelInstance, void, unknown> {
		if (this.#model) {
			yield this.#model;
		}

		for (const attachedModel of this.#attachedModels) {
			yield attachedModel;
		}

		if (this.#festivizerModel) {
			yield this.#festivizerModel;
		}

		if (this.#modelExtraWearable) {
			yield this.#modelExtraWearable;
		}

		const stattrakModule = await this.#stattrakModule;
		if (stattrakModule) {
			yield stattrakModule;
		}
	}
}
