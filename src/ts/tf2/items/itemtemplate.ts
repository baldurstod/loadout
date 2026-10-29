import { ChoreographiesManager, Repositories, VcdParser, WebRepository } from 'harmony-3d';
import { JSONObject } from 'harmony-types';
import { CharactersList, Tf2Class } from '../characters/characters';
import { WORKSHOP_UGC_URL } from '../constants';

type Warpaint = {
	weapon: string,
	title: string,
}

export type AttachedParticlesystem = {
	'attachment': string,
	'system': string,
}

export class Tf2ItemTemplate {
	#definition: JSONObject/*TODO: improve type*/;
	#keywords = new Set<string>();
	readonly id: string;
	readonly creatorid64?: string;
	readonly warpaints = new Map<string, Warpaint>();
	#initWorkshopPromise?: Promise<void>;

	constructor(id: string, definition: JSONObject/*TODO: improve type*/) {
		this.#definition = definition;
		this.id = id;
	}

	get name(): string {
		return this.#definition.name as string ?? '';
	}

	get realName(): string {
		return this.#definition.realname as string ?? '';
	}

	isUsedByClass(characterClass: Tf2Class): boolean {
		const usedByClasses = this.#definition.used_by_classes as Record<string, string>/*TODO: improve type*/;
		if (usedByClasses) {
			const className = CharactersList.get(characterClass)?.name;
			if (className === undefined || usedByClasses[className]) {
				return true;
			}
		}
		return false;
	}

	getUsedByClasses(): Set<string> {
		const usedByClasses = this.#definition.used_by_classes as Record<string, string>/*TODO: improve type*/;
		if (usedByClasses) {
			const used = new Set<string>;
			for (const usedByClass in usedByClasses) {
				if (usedByClasses[usedByClass] == '1') {
					used.add(usedByClass);
				}
			}
			return used;
		}
		return new Set();
	}

	classCount(): number {
		const usedByClasses = this.#definition.used_by_classes as Record<string, string>/*TODO: improve type*/;
		if (usedByClasses) {
			return Object.keys(usedByClasses).length;
		}
		return 0;
	}

	async getModel(npc: string): Promise<string | null> {
		function convertDemo(npc: string): string {
			if (npc == 'demoman') {
				return 'demo';
			} else {
				return npc;
			}
		}

		if (this.isWorkshop()) {
			await this.#initWorkshopItemMetadatas();
		}

		npc = npc.replace(/bot_/, '');

		const modelPlayerPerClass = this.#definition.model_player_per_class as Record<string, string>/*TODO: improve type*/;

		if (modelPlayerPerClass) {
			if (modelPlayerPerClass[npc]) {
				return modelPlayerPerClass[npc] ?? null;
			}

			const basename = modelPlayerPerClass['basename'];
			if (basename) {
				const usedByClasses = this.#definition.used_by_classes as Record<string, string>/*TODO: improve type*/;
				if (usedByClasses) {
					if (usedByClasses[npc] == '1') {
						return basename.replace(/%s/g, convertDemo(npc));
					} else {
						const arr = Object.keys(usedByClasses);
						if (arr.length > 0) {
							return basename.replace(/%s/g, convertDemo(arr[0]!));
						}
					}
				}
			}
		}

		const modelPlayer = this.#definition.model_player as string/*TODO: improve type*/;
		if (modelPlayer) {
			return modelPlayer;
		}

		const customTauntPropPerClass = this.#definition.custom_taunt_prop_per_class as Record<string, string>/*TODO: improve type*/;
		if (customTauntPropPerClass?.[npc]) {
			return customTauntPropPerClass[npc] ?? null;
		}

		// Look for the first model_player_per_class
		if (modelPlayerPerClass) {
			const arr = Object.keys(modelPlayerPerClass);
			if (arr.length > 0) {
				return modelPlayerPerClass[arr[0]!] ?? null;
			}
		}
		return null;
	}

	getModelBlue(npc: string): string | null {
		const modelPlayerPerClassBlue = this.#definition.model_player_per_class_blue as Record<string, string>/*TODO: improve type*/;

		if (modelPlayerPerClassBlue) {
			return modelPlayerPerClassBlue[npc] ?? null;
		}
		return null;
	}

	get imageInventory(): string | null {
		return this.#definition.image_inventory as (string | undefined) ?? null;
	}

	get redSkin(): number {
		const skinRed = Number(this.#definition.skin_red as string);
		return isNaN(skinRed) ? 0 : skinRed;
	}

	get bluSkin(): number {
		const skinBlu = Number(this.#definition.skin_blu as string);
		return isNaN(skinBlu) ? 1 : skinBlu;
	}

	get playerBodygroups(): Record<string, string> {
		return this.#definition.player_bodygroups as Record<string, string>;
	}

	get wmBodygroupOverride(): Record<string, string> {
		return this.#definition.wm_bodygroup_override as Record<string, string>;
	}

	get usePerClassBodygroups(): boolean {
		return this.#definition.use_per_class_bodygroups == '1';
	}

	getExtraWearable(): string {
		return this.#definition.extra_wearable as string/*TODO: improve type*/;
	}

	getAttachedModels(): string {
		// TODO: turn into string[] for Festive Flamethrower 2011
		return this.#definition.attached_models as string/*TODO: improve type*/;
	}

	get animSlot(): string {
		return this.#definition.anim_slot as string/*TODO: fix type*/;
	}

	getItemSlot(): string | null {
		return this.#definition.item_slot as string ?? null;
	}

	getItemSlotPerClass(npc: string): string | null {
		const usedByClasses = this.#definition.used_by_classes as Record<string, string>/*TODO: improve type*/;
		if (usedByClasses) {
			const usedByClass = usedByClasses[npc];
			if (usedByClass == 'primary' || usedByClass == 'secondary') {
				return usedByClass;
			}
		}
		return this.#definition.item_slot as string ?? null;
	}

	get attachedModelsFestive(): string {
		return this.#definition.attached_models_festive as string/*TODO: improve type*/;
	}

	get weaponUsesStattrakModule(): string {
		return this.#definition.weapon_uses_stattrak_module as string/*TODO: improve type*/;
	}

	get weaponStattrakModuleScale(): string {
		return this.#definition.weapon_stattrak_module_scale as string/*TODO: improve type*/;
	}

	get particleSuffix(): string | null {
		return this.#definition.particle_suffix as string ?? null;
	}

	get repository(): string {
		return this.#definition.repository as string;
	}

	get equipRegions(): string[] {
		return this.#definition.equip_regions as (string[] | undefined) ?? [];
	}

	get setItemTintRGB(): string {
		return this.#definition.set_item_tint_rgb as string/*TODO: improve type*/;
	}

	get setItemTintRGB2(): string | null {
		return this.#definition.set_item_tint_rgb_2 as (string | undefined) ?? this.#definition.set_item_tint_rgb as (string | undefined) ?? null;
	}

	get setAttachedParticleStatic(): string | null {
		if (this.#definition.use_smoke_particle_effect == '0' || this.#definition.use_coin_particle_effect == '0') {
			return null;
		}

		return this.#definition.set_attached_particle_static as string;
	}

	get attachedParticlesystems(): AttachedParticlesystem[] {
		return this.#definition.attached_particlesystems as AttachedParticlesystem[];
	}

	get customTauntScenePerClass(): Record<string, string> | undefined {
		return this.#definition.custom_taunt_scene_per_class as Record<string, string>;
	}

	get customTauntOutroScenePerClass(): Record<string, string> | undefined {
		return this.#definition.custom_taunt_outro_scene_per_class as Record<string, string>;
	}

	get customTauntPropScenePerClass(): Record<string, string> | undefined {
		return this.#definition.custom_taunt_prop_scene_per_class as Record<string, string>;
	}

	get customTauntPropOutroScenePerClass(): Record<string, string> | undefined {
		return this.#definition.custom_taunt_prop_outro_scene_per_class as Record<string, string>;
	}

	getImportSessionClasses(): Record<string, any> | undefined {
		return (this.#definition.import_session as JSONObject | undefined)?.classes as Record<string, any>;
	}

	get tauntAttackName(): string | null {
		return this.#definition.taunt_attack_name as string /*TODO: improve type*/;
	}

	get tauntSuccessSoundLoop(): string {
		return this.#definition.taunt_success_sound_loop as string /*TODO: improve type*/;
	}

	get tauntSuccessSoundLoopOffset(): number {
		return Number(this.#definition.taunt_success_sound_loop_offset as string) /*TODO: improve type*/;;
	}

	getMaterialOverride(): string {
		return this.#definition.material_override as string/*TODO: improve type*/;
	}

	getTags(): string[] {
		return this.#definition.tags as string[] ?? [];
	}

	getSubscriptions(): number {
		return this.#definition.subscriptions as number;
	}

	getUpdated(): number {
		return this.#definition.time_updated as number;
	}

	getCreated(): number {
		return this.#definition.time_created as number;
	}

	isWorkshop(): boolean {
		return this.#definition.is_workshop as boolean ?? false;
	}

	isSfmWorkshop(): boolean {
		return this.#definition.is_sfm_workshop as boolean ?? false;
	}

	isTournamentMedal(): boolean {
		return this.#definition.is_tournament_medal as boolean/*TODO: improve type*/;
	}

	isPaintable(): boolean {
		return this.#definition.paintable == '1';
	}

	isWarPaintable(): boolean {
		return this.#definition.paintkit_base == '1';
	}

	isHalloweenRestricted(): boolean {
		return this.#definition.holiday_restriction == 'halloween_or_fullmoon';
	}

	getItemTypeName(): string {
		return this.#definition.item_type_name as string;
	}

	getCollection(): string {
		return this.#definition.collection as string;
	}

	getGrade(): string {
		return this.#definition.grade as string;
	}

	getHide(): boolean {
		return this.#definition.hide == 1;
	}

	addKeyword(keyword: string): void {
		this.#keywords.add(keyword.toLowerCase());
	}

	hasKeyword(search: string): boolean {
		for (const keyword of this.#keywords) {
			if (keyword.includes(search)) {
				return true;
			}
		}
		return false;
	}

	canCustomizeTexture(): boolean {
		return this.#definition.can_customize_texture == '1';
	}

	isTaunt(): boolean {
		return this.#definition.is_taunt_item == '1';
	}

	getPaintkitProtoDefIndex(): string | null {
		return (this.#definition.paintkit_proto_def_index as string | undefined) ?? null;
	}

	addWarpaint(id: string, weapon: string, title: string): void {
		this.warpaints.set(id, { weapon, title });
	}

	async #initWorkshopItemMetadatas(): Promise<void> {
		if (!this.#initWorkshopPromise) {
			this.#initWorkshopPromise = new Promise<void>((resolve): void => {
				(async (): Promise<void> => {

					const itemId = this.#definition.id as string;
					const url = WORKSHOP_UGC_URL + (this.#definition.creatorid64 as string) + '/' + itemId + '/' + itemId + '.json';
					const itemRepository = WORKSHOP_UGC_URL + (this.#definition.creatorid64 as string) + '/' + itemId + '/';

					const repositoryName = this.getWorkshopGameRepository();
					Repositories.addRepository(new WebRepository(this.getWorkshopRepository(), itemRepository, true));
					Repositories.addRepository(new WebRepository(repositoryName, itemRepository + 'game/', true));

					this.#definition.repository = repositoryName;

					const response = await fetch(new Request(url));
					const json = await response.json();
					const jsonItem = json?.item;
					const keys = [
						'model_player',
						'model_player_per_class',
						'player_bodygroups',
						'is_taunt_item',
						'custom_taunt_scene_per_class',
						'custom_taunt_outro_scene_per_class',
						'custom_taunt_prop_scene_per_class',
						'custom_taunt_prop_outro_scene_per_class',
						'import_session',
					];

					if (json.result && jsonItem) {
						for (const key of keys) {
							const jsonValue = jsonItem[key];
							if (jsonValue) {
								this.#definition[key] = jsonValue;
							}

							if (key.startsWith('custom_taunt')) {
								if (typeof jsonValue == 'string') {
									await addVcd(repositoryName, jsonValue);
								} else {
									for (const key2 in jsonValue) {
										await addVcd(repositoryName, jsonValue[key2]);
									}
								}
							}
						}
					}

					resolve();
				})()
			});
		}
		await this.#initWorkshopPromise;
	}

	getWorkshopGameRepository(): string {
		return `tf2_workshop_${this.#definition.id}_game`;
	}

	getWorkshopRepository(): string {
		return `tf2_workshop_${this.#definition.id}`;
	}
}

async function addVcd(itemRepository: string, path: string): Promise<void> {
	const result = await Repositories.getFileAsText(itemRepository, path);
	if (result.error) {
		return;
	}

	const choreography = VcdParser.parse('tf2', result.text!);
	if (choreography) {
		// TODO: we should probably use the workshop item repository for that, but the choreography manager doesn't have a great repository support
		ChoreographiesManager.addChoreography('tf2', path, choreography);
	}
}
