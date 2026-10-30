import { Entity } from 'harmony-3d';
import { JSONObject } from 'harmony-types';
import { JSONValue } from 'harmony-types';
import { Scene } from 'harmony-3d';
import { Source1ModelInstance } from 'harmony-3d';
import { Source1ParticleSystem } from 'harmony-3d';
import { Source2ModelInstance } from 'harmony-3d';
import { vec3 } from 'gl-matrix';
import { vec4 } from 'gl-matrix';

export declare type AttachedParticlesystem = {
    'attachment': string;
    'system': string;
};

export declare const CharactersList: Map<Tf2Class, CharactersType>;

export declare type CharactersType = {
    name: string;
    path: string;
    type: UsePlayerModels;
    icon: string;
    hidden?: boolean;
    npc: string;
};

export declare const ClassRemovablePartsOff: string[];

export declare const COIN_SPIN_EFFECT = 406;

/**
 * Return a css value of a color
 * @param {Number} color The color, in integer format (ie: Indubitably Green: 7511618)
 */
export declare function colorToCss(color?: number): string;

export declare function colorToVec3(color: number, tint?: vec3): vec3;

export declare function colorToVec4(color: number, tint?: vec4): vec4;

export declare const COMMUNITY_SPARKLE_EFFECT = 4;

export declare const DEFAULT_ACTIVITY = "ACT_DOTA_IDLE";

export declare class Dota2AssetModifier {
    #private;
    constructor(item: Dota2Item | null, definition: Dota2AssetModifierJSON);
    get item(): Dota2Item | null;
    get type(): Dota2AssetModifierType | undefined;
    get asset(): string | undefined;
    get modifier(): string | undefined;
    get persona(): string | undefined;
    get skin(): string | undefined;
    get style(): string | 0;
    get loadoutDefaultOffset(): string | undefined;
    get level(): string | undefined;
    get value(): string | undefined;
}

export declare type Dota2AssetModifierJSON = {
    modifier?: string;
    type?: Dota2AssetModifierType;
    style?: string;
    asset?: string;
    level?: string;
    persona?: string;
    skin?: string;
    loadout_default_offset?: string;
    value?: string;
};

export declare type Dota2AssetModifierType = 'activity' | 'additional_wearable' | 'entity_model' | 'hero_model_change' | 'model' | 'model_skin' | 'particle' | 'particle_create' | 'persona' | 'pet' | 'portrait_background_model' | 'courier' | 'courier_flying' | 'entity_clientside_model' | 'arcana_level' | 'bodygroup_visibility' | 'hero_scale' | 'icon_replacement_hero' | 'icon_replacement_hero_minimap' | 'ability_icon' | 'response_criteria' | 'chatwheel' | 'default_idle_expression';

export declare class Dota2Hero {
    #private;
    bundleItem: Dota2Item | null;
    constructor(heroId: string, scene: Scene);
    getModel(): Promise<Source2ModelInstance | null>;
    playSequence(): Promise<void>;
    setVisible(visible: boolean): void;
    get name(): string;
    get id(): string;
    get heroOrderId(): number;
    get itemSlots(): Map<string, Dota2HeroSlot> | undefined;
    isHero(): boolean;
    getModelCount(): number;
    getModelPath(): string;
    setModelId(modelId: number): Promise<void>;
    getModelId(): number;
    hasItem(itemId: string): boolean;
    getItem(itemId: string): Dota2Item | undefined;
    addItem(itemId: string): Promise<void>;
    removeItem(itemId: string): Promise<void>;
    getItems(): Map<string, Dota2Item>;
    getItemsWithBundle(): Map<string, Dota2Item>;
    processModifiers(): Promise<void>;
    setActivity(activity: string): Promise<void>;
    getActivity(): string;
    setModifiers(modifiers: string[]): Promise<void>;
    getModifiers(): string[];
    exportLoadout(): JSONObject | undefined;
    importLoadout(characterJSON: JSONObject): Promise<void>;
    getUnits(): Map<string, Source2ModelInstance>;
    getSpawnedUnits(): Array<string>;
}

export declare type Dota2HeroSlot = {
    DisplayInLoadout?: string;
    SlotIndex: string;
    SlotName: string;
    SlotText: string;
    GeneratesUnits: Record<string, string>;
};

export declare class Dota2HeroTemplate {
    #private;
    constructor(definition: JSONObject);
    get name(): string;
    get id(): string;
    get heroOrderId(): number;
    get itemSlots(): Map<string, Dota2HeroSlot> | undefined;
    getSpawnedUnits(): Array<string>;
    isHero(): boolean;
    getModelCount(): number;
    getModelPath(modelID: number): string;
    getAdjective(name: string): string | undefined;
}

export declare class Dota2HeroTemplates {
    #private;
    static heroCount: number;
    static addTemplate(templateJSON: JSONObject): void;
    static getTemplate(id: string): Dota2HeroTemplate | undefined;
    static getTemplates(): Map<string, Dota2HeroTemplate>;
}

export declare class Dota2Item {
    #private;
    readonly extraAssetModifiers: Dota2AssetModifier[];
    constructor(template: Dota2ItemTemplate, hero: Dota2Hero);
    getModel(): Promise<Source2ModelInstance | null>;
    playSequence(sequenceName: string): Promise<void>;
    getExtraEntities(): Set<Entity>;
    remove(): Promise<void>;
    setVisible(visible: boolean | undefined): Promise<void>;
    isVisible(): boolean;
    get character(): Dota2Hero;
    get name(): string;
    get id(): string;
    get imageInventory(): JSONValue;
    get slot(): string;
    get modelName(): string;
    get assetModifiers(): JSONValue;
    get skin(): number;
    set style(style: number);
    get style(): number;
    setStyle(styleId: number): void;
    hasStyles(): boolean;
    getStyle(styleId: number): JSONObject;
    getStyles(): Map<string, JSONObject>;
    getPersonaId(): number;
    getAssetModifiers(): Dota2AssetModifier[];
    processModifiers(replacements: Map<string, string>, characterModelId: number): Promise<void>;
    reparentChilds(): void;
    setCharacterSkin(skin: number): void;
    setArcanaLevel(arcanaLevel: number | undefined): void;
}

export declare class Dota2ItemManager {
    #private;
    static getItems(characterId: string): Promise<Set<string>>;
    static getBaseItemId(characterId: string, slot: string): Promise<string | null>;
}

export declare class Dota2ItemTemplate {
    #private;
    constructor(definition: JSONObject);
    get name(): string;
    get imageInventory(): JSONValue;
    get slot(): string;
    get id(): string;
    getModelName(styleId: number, model?: number): string;
    get repository(): JSONValue;
    get isBaseItem(): boolean;
    get bundle(): JSONValue;
    get assetModifiers(): JSONValue;
    get rarity(): JSONValue;
    get skin(): JSONValue;
    getSkin(styleId: number): number;
    hasStyles(): boolean;
    getStyle(styleId: number): JSONObject;
    getStyles(): Map<string, JSONObject>;
}

export declare class Dota2ItemTemplates {
    #private;
    static addTemplate(templateJSON: JSONObject): void;
    static getTemplate(id: string): Dota2ItemTemplate | undefined;
    static getTemplateByName(name: string): string | undefined;
    static getTemplates(): Map<string, Dota2ItemTemplate>;
}

export declare class Dota2LoadoutController {
    #private;
    static addEventListener(type: 'heroitemadded', callback: (evt: CustomEvent<Dota2Item>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'heroitemremoved', callback: (evt: CustomEvent<Dota2Item>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'herounitschanged', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'heropersonachanged', callback: (evt: CustomEvent<number>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'itemsloaded', callback: (evt: CustomEvent<string>) => void, options?: AddEventListenerOptions | boolean): void;
    static dispatchEvent(type: 'heroitemadded', options: Dota2LoadoutControllerEventInit<Dota2Item>): boolean;
    static dispatchEvent(type: 'heroitemremoved', options: Dota2LoadoutControllerEventInit<Dota2Item>): boolean;
    static dispatchEvent(type: 'herounitschanged', options?: CustomEventInit<void>): boolean;
    static dispatchEvent(type: 'heropersonachanged', options: Dota2LoadoutControllerEventInit<number>): boolean;
    static dispatchEvent(type: 'itemsloaded', options: Dota2LoadoutControllerEventInit<string>): boolean;
    static removeEventListener(type: Dota2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

export declare type Dota2LoadoutControllerEvent = 'heroitemadded' | 'heroitemremoved' | 'herounitschanged' | 'heropersonachanged' | 'itemsloaded';

export declare interface Dota2LoadoutControllerEventInit<T = any> extends EventInit {
    detail: T;
}

export declare type Dota2Unit = {
    name: string;
    Model?: string;
    include_keys_from?: string;
    IsNeutralUnitType?: string;
    ConsideredHero?: string;
};

export declare class Dota2Units {
    #private;
    static addUnit(id: string, unit: Dota2Unit): void;
    static addUnits(units: Record<string, Dota2Unit>): void;
    static getUnit(id: string): Dota2Unit | undefined;
    static getModel(id: string): string | null;
    static getName(id: string): string | null;
    static getUnits(): Map<string, Dota2Unit>;
}

export declare const enum Eye {
    Right = 0,
    Left = 1
}

export declare function getKillstreak(killstreak: KillstreakColor): Killstreak | null;

export declare function getKillstreakColor(color: vec3): KillstreakColor | null;

export declare function getPaint(paint: Paints): Paint | null;

export declare function getPaintByTint(tint: number): Paints | null;

export declare function getPersonaId(slot: string): number;

export declare function getTf2TeamId(team: Tf2Team): 0 | 1;

export declare enum ItemFilterAttribute {
    Name = 0,
    Selected = 1,
    Workshop = 2,
    SfmWorkshop = 3,
    SfmUniverse = 4,
    SfmModel = 5,
    HideConflict = 6,
    TournamentMedals = 7,
    ShowMultiClass = 8,
    ShowOneClass = 9,
    ShowAllClass = 10,
    DoNotFilterPerClass = 11,
    Paintable = 12,
    Warpaintable = 13,
    Halloween = 14,
    DisplayMedals = 15,
    DisplayWeapons = 16,
    DisplayCosmetics = 17,
    DisplayTaunts = 18,
    Collection = 19
}

export declare type ItemPinned = {
    item: Tf2ItemTemplate;
    pinned: boolean;
};

/**
 * A TF2 Sheen
 */
export declare class Killstreak {
    #private;
    readonly id: number;
    readonly killstreak: KillstreakColor;
    readonly teamColored: boolean;
    constructor(definition: KillstreakDefinition);
    /**
     * Compute the sheen color for the given team
     * @param team The team to compute the color for
     * @returns vec3
     */
    getSheenColor(team: Tf2Team): vec3;
    getKillstreakColor1(team: Tf2Team): vec3;
}

export declare enum KillstreakColor {
    None = 0,
    TeamShine = 1,
    DeadlyDaffodil = 2,
    Manndarin = 3,
    MeanGreen = 4,
    AgonizingEmerald = 5,
    VillainousViolet = 6,
    Hotrod = 7,
    Custom = 1000
}

export declare type KillstreakDefinition = {
    id: number;
    name: string;
    sheen: KillstreakColor;
    teamColored: boolean;
    sheenRed: number;
    sheenBlu: number;
    color1Red: number;
    color1Blu: number;
    color2Red: number;
    color2Blu: number;
};

export declare const killstreakList: Map<KillstreakColor, KillstreakDefinition>;

export declare function npcToClass(npc: string): Tf2Class | null;

/**
 * A TF2 paint
 */
export declare class Paint {
    #private;
    readonly id: number;
    readonly paint: Paints;
    spell: boolean;
    teamColored: boolean;
    time?: number;
    constructor(definition: PaintDefinition);
    /**
     * Compute the paint tint for the given team
     * @param team The team to compute the tint for
     * @returns vec3
     */
    getTint(team: Tf2Team): vec3;
}

export declare type PaintDefinition = {
    id: number;
    name: string;
    paint: Paints;
    teamColored: boolean;
    tintRed: number;
    tintBlu: number;
    spell: boolean;
    time?: number;
};

export declare const paintList: Map<Paints, PaintDefinition>;

export declare enum Paints {
    None = 0,
    IndubitablyGreen = 1,
    ZepheniahsGreed = 2,
    NobleHattersViolet = 3,
    ColorNo216_190_216 = 4,
    ADeepCommitmentToPurple = 5,
    MannCoOrange = 6,
    Muskelmannbraun = 7,
    PeculiarlyDrabTincture = 8,
    RadiganConagherBrown = 9,
    YeOldeRusticColour = 10,
    AustraliumGold = 11,
    AgedMoustacheGrey = 12,
    AnExtraordinaryAbundanceOfTinge = 13,
    ADistinctiveLackOfHue = 14,
    PinkAsHell = 15,
    AColorSimilarToSlate = 16,
    DrablyOlive = 17,
    TheBitterTasteOfDefeatAndLime = 18,
    TheColorOfAGentlemannsBusinessPants = 19,
    DarkSalmonInjustice = 20,
    AMannsMint = 21,
    AfterEight = 22,
    TeamSpirit = 101,
    OperatorsOveralls = 102,
    WaterloggedLabCoat = 103,
    BalaclavasAreForever = 104,
    AnAirOfDebonair = 105,
    TheValueOfTeamwork = 106,
    PutrescentPigmentation = 201,
    DieJob = 202,
    ChromaticCorruption = 203,
    SpectralSpectrum = 204,
    SinisterStaining = 205,
    Custom = 1000
}

export declare enum Panel {
    None = "none",
    Items = "items",
    Printful = "printful",
    Options = "options",
    Effects = "effects",
    Presets = "presets",
    Paints = "paints",
    Sheens = "sheens",
    WeaponEffects = "weaponeffects",
    Warpaints = "warpaints",
    Flexes = "flexes",
    SfmRepositories = "sfmrepositories"
}

export declare const enum Ragdoll {
    None = 0,
    Gold = 1,
    Ice = 2
}

export declare function randomProperty(obj: Record<string, any>): string;

export declare type SetItemFilter = {
    attribute: ItemFilterAttribute;
    value: string | boolean | undefined;
};

export declare function setUpdatePreview(update: boolean): void;

export declare enum SfmSortField {
    Index = "sfm-index",
    Name = "sfm-name",
    Subscriptions = "sfm-subscriptions",
    Updated = "sfm-updated",
    Created = "sfm-created",
    Random = "sfm-random"
}

export declare class Tf2Character {
    #private;
    readonly scene: Scene;
    readonly characterClass: Tf2Class;
    readonly name: string;
    readonly npc: string;
    readonly items: Map<string, Tf2Item>;
    readonly effects: Set<Tf2Effect>;
    static autoSelectAnim: boolean;
    constructor(characterClass: Tf2Class, scene: Scene);
    loadModel(path: string, name: string): Promise<void>;
    getModel(): Promise<Source1ModelInstance | null>;
    addExtraModel(path: string, repository?: string): Promise<Source1ModelInstance | null>;
    setVisible(visble: boolean): void;
    setTeam(team: Tf2Team): Promise<void>;
    getTeam(): Tf2Team;
    getItemById(itemId: string): Tf2Item | undefined;
    toggleItem(template: Tf2ItemTemplate): Promise<[Tf2Item, boolean]>;
    addItem(template: Tf2ItemTemplate): Promise<Tf2Item>;
    updatePaintColor(): void;
    isInvulnerable(): boolean;
    setInvulnerable(isInvulnerable: boolean): Promise<void>;
    getRagdoll(): Ragdoll;
    setRagdoll(ragdoll: Ragdoll | null): Promise<void>;
    renderBodyPart(bodyPart: string, render: boolean): void;
    setBodyPartIdModel(bodyPartId: number, modelId: number): void;
    setBodyPartModel(bodyPartId: string, modelId: number): void;
    setPose(pose: string): void;
    setUserAnim(userAnim: string): void;
    autoSelectAnim(): void;
    setFlexControllerValue(name: string, value: number): Promise<void>;
    resetFlexes(): Promise<void>;
    addEffect(template: Tf2EffectTemplate): Promise<Tf2Effect>;
    removeEffect(effect: Tf2Effect): void;
    setKillsteakEffect(template: Tf2EffectTemplate | null, color?: KillstreakColor): Promise<[Tf2Effect | null, Tf2Effect | null]>;
    setDecapitationLevel(level: number): Promise<[Tf2Effect | null, Tf2Effect | null]>;
    getDecapitationLevel(): number;
    setTauntEffect(template: Tf2EffectTemplate | null): Promise<Tf2Effect | null>;
    getTauntEffect(): Tf2Effect | null;
    getKillstreakEffects(): [Tf2Effect | null, Tf2Effect | null];
    setPoseParameter(name: string, value: number): void;
    savePreset(name: string): Tf2Preset;
    loadPreset(preset: Tf2Preset): Promise<void>;
    removeAll(): void;
    removeAllItems(): void;
    removeAllEffects(): void;
    copy(other: Tf2Character): Promise<void>;
}

export declare enum Tf2Class {
    Scout = 0,
    Sniper = 1,
    Soldier = 2,
    Demoman = 3,
    Medic = 4,
    Heavy = 5,
    Pyro = 6,
    Spy = 7,
    Engineer = 8,
    ScoutBot = 100,
    SniperBot = 101,
    SoldierBot = 102,
    DemomanBot = 103,
    MedicBot = 104,
    HeavyBot = 105,
    PyroBot = 106,
    SpyBot = 107,
    EngineerBot = 108,
    ScoutInfected = 200,
    SniperInfected = 201,
    SoldierInfected = 202,
    DemomanInfected = 203,
    MedicInfected = 204,
    HeavyInfected = 205,
    PyroInfected = 206,
    SpyInfected = 207,
    EngineerInfected = 208,
    Random = 1000,
    None = 1001,
    Empty = 1002,
    CompareWarpaints = 1003
}

export declare class Tf2Effect {
    readonly template: Tf2EffectTemplate;
    name: string;
    system: Source1ParticleSystem | null;
    attachment?: string;
    offset: vec3;
    killstreakColor?: KillstreakColor;
    constructor(template: Tf2EffectTemplate);
    getId(): number;
    getType(): Tf2EffectType;
}

export declare class Tf2EffectTemplate {
    #private;
    readonly id: number;
    readonly type: Tf2EffectType;
    constructor(type: Tf2EffectType, id: number, definition: JSONObject);
    getName(): string;
    getSystem(): string;
    isTeamColored(): boolean;
    getImage(): string;
    getAttachment(): string;
}

export declare enum Tf2EffectType {
    Cosmetic = "cosmetic_unusual_effects",
    Killstreak = "killstreak_eyeglows",
    Taunt = "taunt_unusual_effects",
    Weapon = "weapon_unusual_effects",
    Other = "other_particles"
}

export declare class Tf2Item {
    #private;
    readonly id: string;
    changeTextureSize?: number;
    constructor(itemTemplate: Tf2ItemTemplate, character: Tf2Character);
    getTemplate(): Tf2ItemTemplate;
    setTeam(team: Tf2Team): Promise<void>;
    getEquipRegions(): string[];
    setKillCount(count: number | null): Promise<void>;
    getKillCount(): number | null;
    getRepository(): string;
    showFestivizer(showFestivizer: boolean): Promise<void>;
    getShowFestivizer(): boolean;
    toggleFestivizer(): Promise<void>;
    setCustomTexture(textureName: string | null): void;
    getCustomTexture(): string | null;
    critBoost(boost?: boolean): void;
    isCritBoosted(): boolean;
    loadModel(npc: string): Promise<void>;
    attachSystems(npc: string): Promise<void>;
    getModel(): Promise<Source1ModelInstance | null>;
    getModelBlu(): Promise<Source1ModelInstance | null>;
    getModelExtraWearable(): Promise<Source1ModelInstance | null>;
    remove(): Promise<void>;
    isConflicting(other: Tf2Item): boolean;
    setPaint(paint: Paints | null): void;
    getPaint(): Paints | null;
    updatePaintColor(): void;
    setSheen(sheen: KillstreakColor | null): void;
    getSheen(): KillstreakColor | null;
    isTaunt(): boolean;
    getCustomTauntScenePerClass(npc: string): string | null;
    getCustomTauntPropScenePerClass(npc: string): string | null;
    getCustomTauntOutroScenePerClass(npc: string): string | null;
    getCustomTauntPropOutroScenePerClass(npc: string): string | null;
    getWorkshopAnimationPerClass(npc: string): string | null;
    getTauntAttackName(): string | null;
    setWeaponEffectId(weaponEffectId: number | null): void;
    getWeaponEffectId(): number | null;
    setWarpaintId(warpaintId: number | null): void;
    getWarpaintId(): number | null;
    setWarpaintWear(warpaintWear: number): void;
    getWarpaintWear(): number;
    setWarpaintSeed(warpaintSeed: bigint | number): void;
    getWarpaintSeed(): bigint;
    setWarpaint(warpaintId: number, warpaintWear: number, warpaintSeed: bigint | number): void;
    setTextureSize(textureSize: number): void;
    getTextureSize(): number | undefined;
    getCharacter(): Tf2Character;
    getAllModels(): AsyncGenerator<Source1ModelInstance, void, unknown>;
}

export declare class Tf2ItemManager {
    #private;
    static setCurrentCharacter(character: Tf2Character): void;
    static setLang(lang: string): void;
    static getItems(): Map<string, Tf2ItemTemplate>;
    static getItemTemplate(id: string | number, style?: number): Tf2ItemTemplate | null;
    static getEffectTemplate(type: Tf2EffectType, id: number): Tf2EffectTemplate | null;
    static getEffectTemplateById(id: number): [Tf2EffectType, Tf2EffectTemplate] | null;
    static getEffectTemplateBySystem(system: string): [Tf2EffectType, number, Tf2EffectTemplate] | null;
    static getFilteredItems(excluded: {
        e: number;
    }): [Map<string, Tf2ItemTemplate>, Map<string, Tf2ItemTemplate>];
    static getSelectedItems(): Set<string>;
    static getSelectedEffects(): Set<Tf2Effect>;
    static getConflictingItems(): Set<string>;
    static initItems(): Promise<void>;
    static getEffects(type: Tf2EffectType): Map<number, Tf2EffectTemplate>;
    static getCollections(): Set<string>;
    static initWorkshopItems(): Promise<void>;
    static initTournamentMedals(): Promise<void>;
}

export declare class Tf2ItemTemplate {
    #private;
    readonly id: string;
    readonly creatorid64?: string;
    readonly warpaints: Map<string, Warpaint>;
    constructor(id: string, definition: JSONObject);
    get name(): string;
    get realName(): string;
    isUsedByClass(characterClass: Tf2Class): boolean;
    getUsedByClasses(): Set<string>;
    classCount(): number;
    getModel(npc: string): Promise<string | null>;
    getModelBlue(npc: string): string | null;
    get imageInventory(): string | null;
    get redSkin(): number;
    get bluSkin(): number;
    get playerBodygroups(): Record<string, string>;
    get wmBodygroupOverride(): Record<string, string>;
    get usePerClassBodygroups(): boolean;
    getExtraWearable(): string;
    getAttachedModels(): string;
    get animSlot(): string;
    getItemSlot(): string | null;
    getItemSlotPerClass(npc: string): string | null;
    get attachedModelsFestive(): string;
    get weaponUsesStattrakModule(): string;
    get weaponStattrakModuleScale(): string;
    get particleSuffix(): string | null;
    get repository(): string;
    get equipRegions(): string[];
    get setItemTintRGB(): string;
    get setItemTintRGB2(): string | null;
    get setAttachedParticleStatic(): string | null;
    get attachedParticlesystems(): AttachedParticlesystem[];
    get customTauntScenePerClass(): Record<string, string> | undefined;
    get customTauntOutroScenePerClass(): Record<string, string> | undefined;
    get customTauntPropScenePerClass(): Record<string, string> | undefined;
    get customTauntPropOutroScenePerClass(): Record<string, string> | undefined;
    getImportSessionClasses(): Record<string, any> | undefined;
    get tauntAttackName(): string | null;
    get tauntSuccessSoundLoop(): string;
    get tauntSuccessSoundLoopOffset(): number;
    getMaterialOverride(): string;
    getTags(): string[];
    getSubscriptions(): number;
    getUpdated(): number;
    getCreated(): number;
    isWorkshop(): boolean;
    isSfmWorkshop(): boolean;
    isTournamentMedal(): boolean;
    isPaintable(): boolean;
    isWarPaintable(): boolean;
    isHalloweenRestricted(): boolean;
    getItemTypeName(): string;
    getCollection(): string;
    getGrade(): string;
    getHide(): boolean;
    addKeyword(keyword: string): void;
    hasKeyword(search: string): boolean;
    canCustomizeTexture(): boolean;
    isTaunt(): boolean;
    getPaintkitProtoDefIndex(): string | null;
    addWarpaint(id: string, weapon: string, title: string): void;
    getWorkshopGameRepository(): string;
    getWorkshopRepository(): string;
}

export declare class Tf2LoadoutController {
    #private;
    static addEventListener(type: 'itemadded', callback: (evt: CustomEvent<Tf2Item>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'itemremoved', callback: (evt: CustomEvent<Tf2Item>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'itemsloaded', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'inititems', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'sfmitemsloaded', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'systemsloaded', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setitemfilter', callback: (evt: CustomEvent<SetItemFilter>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setitemsortascending', callback: (evt: CustomEvent<boolean>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setsfmitemsortascending', callback: (evt: CustomEvent<boolean>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'filtersupdated', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setitemsorttype', callback: (evt: CustomEvent<string>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setsfmsortfield', callback: (evt: CustomEvent<string>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'itempinned', callback: (evt: CustomEvent<ItemPinned>) => void, options?: AddEventListenerOptions | boolean): void;
    static dispatchEvent(type: 'itemadded', options: Tf2LoadoutControllerEventInit<Tf2Item>): boolean;
    static dispatchEvent(type: 'itemremoved', options: Tf2LoadoutControllerEventInit<Tf2Item>): boolean;
    static dispatchEvent(type: 'itemsloaded', options?: CustomEventInit<void>): boolean;
    static dispatchEvent(type: 'inititems', options?: CustomEventInit<void>): boolean;
    static dispatchEvent(type: 'sfmitemsloaded', options?: CustomEventInit<void>): boolean;
    static dispatchEvent(type: 'systemsloaded', options?: CustomEventInit<void>): boolean;
    static dispatchEvent(type: 'setitemfilter', options: Tf2LoadoutControllerEventInit<SetItemFilter>): boolean;
    static dispatchEvent(type: 'setitemsortascending', options: Tf2LoadoutControllerEventInit<boolean>): boolean;
    static dispatchEvent(type: 'setsfmitemsortascending', options: Tf2LoadoutControllerEventInit<boolean>): boolean;
    static dispatchEvent(type: 'filtersupdated', options?: CustomEventInit<void>): boolean;
    static dispatchEvent(type: 'setitemsorttype', options: Tf2LoadoutControllerEventInit<string>): boolean;
    static dispatchEvent(type: 'setsfmsortfield', options: Tf2LoadoutControllerEventInit<string>): boolean;
    static dispatchEvent(type: 'itempinned', options: Tf2LoadoutControllerEventInit<ItemPinned>): boolean;
    static removeEventListener(type: Tf2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

export declare type Tf2LoadoutControllerEvent = 'itemadded' | 'itemremoved' | 'inititems' | 'itemsloaded' | 'sfmitemsloaded' | 'systemsloaded' | 'setitemfilter' | 'setitemsortascending' | 'setsfmitemsortascending' | 'filtersupdated' | 'setitemsorttype' | 'setsfmsortfield' | 'itempinned';

export declare interface Tf2LoadoutControllerEventInit<T = any> extends EventInit {
    detail: T;
}

export declare class Tf2Preset {
    character: string;
    name: string;
    items: Set<Tf2PresetItem>;
    effects: Set<Tf2PresetEffect>;
    decapitationLevel: number;
    constructor(name?: string);
    addItem(item: Tf2PresetItem): void;
    addEffect(effect: Tf2PresetEffect): void;
    fromJSON(json: JSONObject): boolean;
    toJSON(): JSONObject;
}

export declare class Tf2PresetEffect {
    id: number;
    type: Tf2PresetEffectType;
    attachment?: string | undefined;
    offset: vec3;
    color?: KillstreakColor;
    setType(type: Tf2EffectType): void;
    getType(): Tf2EffectType;
    fromJSON(json: JSONObject): boolean;
    toJSON(): JSONObject;
}

export declare enum Tf2PresetEffectType {
    Unusual = "unusual",
    Taunt = "taunt",
    Killstreak = "killstreak",
    Weapon = "weapon",
    Other = "other"
}

export declare class Tf2PresetItem {
    id: string;
    paint?: number;
    warpaintId?: number;
    warpaintWear?: number;
    warpaintSeed?: bigint;
    isTournamentMedal: boolean;
    isWorkshop: boolean;
    weaponEffect?: number;
    sheen?: number;
    showFestivizer: boolean;
    killCount?: number;
    fromJSON(json: JSONObject): boolean;
    toJSON(): JSONObject;
}

export declare class Tf2Presets {
    #private;
    selected?: string;
    addPreset(preset: Tf2Preset): void;
    getPreset(name: string): Tf2Preset | undefined;
    getPresets(): Map<string, Tf2Preset>;
    removePreset(name: string): void;
    fromJSON(json: JSONObject): boolean;
    toJSON(): JSONObject;
}

export declare type Tf2Team = 'none' | 'red' | 'blu';

export declare let updatePreview: boolean;

export declare type UsePlayerModels = 'human' | 'bot' | 'infected';

declare type Warpaint = {
    weapon: string;
    title: string;
};

export declare const weaponEffects: Map<number, [string, string]>;

export { }
