import { Camera } from 'harmony-3d';
import { Entity } from 'harmony-3d';
import { JSONObject } from 'harmony-types';
import { JSONValue } from 'harmony-types';
import positionJSON from '../../../json/slotsposition.json';
import { quat } from 'gl-matrix';
import { Scene } from 'harmony-3d';
import { Source1ModelInstance } from 'harmony-3d';
import { Source1ParticleSystem } from 'harmony-3d';
import { Source2ModelInstance } from 'harmony-3d';
import { uint } from 'harmony-types';
import { vec3 } from 'gl-matrix';
import { vec4 } from 'gl-matrix';

export declare const ACCURATE_SKINS_EXTENSION_LINK = "https://accurateskins.com/";

export declare const ACE_EDITOR_URI = "https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12/ace.js";

export declare const ALYX_REPOSITORY = "https://hlacontent.loadout.tf/";

export declare type AttachedParticlesystem = {
    'attachment': string;
    'system': string;
};

export declare const baseAnimDataPath = "./json/animations/";

export declare const baseClassTexturePath = "./css/img/class/";

export declare const BROADCAST_CHANNEL_NAME = "internal_notification";

export declare enum CameraType {
    FirstPerson = "FirstPerson",
    Orbit = "orbit",
    FreeFly = "freefly"
}

export declare type ChangeAnimFrame = {
    frame: number;
    scene: Scene;
};

declare type CharacterPosition = {
    position: vec3;
    orientation: quat;
};

export declare const CHARACTERS_SKINS: string[];

declare class CharacterSlot {
    character: Tf2Character | null;
    readonly position: vec3;
    readonly orientation: vec4;
    setPosition(position: vec3): Promise<void>;
    setOrientation(orientation: quat): Promise<void>;
}

declare type ClassAnimations = {
    character: string;
    animations: Record<string, {
        name: string;
        file: string;
    }>;
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

export declare const COMPARE_WARPAINTS_LAYOUT = "compare warpaints";

export declare const CSGO_REPOSITORY = "https://cs2content.csloadout.com/";

export declare type CustomDisposition = {
    countX: number;
    countY: number;
    countZ: number;
};

export declare const DEADLOCK_REPOSITORY = "https://dlcontent.deadlockloadout.com/";

export declare const DEFAULT_ACTIVITY = "ACT_DOTA_IDLE";

export declare const DOTA2_REPOSITORY = "https://dota2content.dotaloadout.com/";

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

export declare const EFFECTS_BLU = "teamcolor_blue";

export declare const EFFECTS_RED = "teamcolor_red";

export declare const ENTITY_FLYING_BIRD_SPEED_MAX = 500;

export declare const ENTITY_FLYING_BIRD_SPEED_MIN = 200;

export declare const enum Eye {
    Right = 0,
    Left = 1
}

export declare const FIRST_LEGACY_WARPAINT = 15000;

export declare function getKillstreak(killstreak: KillstreakColor): Killstreak | null;

export declare function getKillstreakColor(color: vec3): KillstreakColor | null;

export declare function getPaint(paint: Paints): Paint | null;

export declare function getPaintByTint(tint: number): Paints | null;

export declare function getPersonaId(slot: string): number;

export declare function getTf2TeamId(team: Tf2Team): 0 | 1;

export declare const HTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";

export declare type ImportPresets = {
    files: File[];
    scene: Scene;
};

export declare const inventoryPath: string;

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

export declare const LAST_LEGACY_WARPAINT = 15158;

export declare const LOADOUT_DISPOSITIONS_URL = "./json/characters_positions.json";

export declare const LOADOUT_LAYOUT = "loadout";

export declare const LOW_QUALITY_TEXTURE_SIZE = 256;

export declare const MAIN_CANVAS = "main_canvas";

export declare const MATERIAL_GOLD_RAGDOLL = "models/player/shared/gold_player.vmt";

export declare const MATERIAL_ICE_RAGDOLL = "models/player/shared/ice_player.vmt";

export declare const MATERIAL_INVULN_BLU = "models/effects/invulnfx_blue.vmt";

export declare const MATERIAL_INVULN_RED = "models/effects/invulnfx_red.vmt";

export declare const MAX_UNUSUAL_EFFECTS_PER_CHARACTER = 5;

export declare const MEDIC_RELEASE_DOVE_COUNT = 10;

export declare const MID_QUALITY_TEXTURE_SIZE = 512;

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

export { positionJSON }

export declare const enum Ragdoll {
    None = 0,
    Gold = 1,
    Ice = 2
}

export declare function randomProperty(obj: Record<string, any>): string;

export declare const RECORDER_DEFAULT_FILENAME = "Loadout.tf recording.webm";

export declare const SCOUT_BLUE_PANTS_DEST = "/img/misc/scout_blue.vtf";

export declare const SCOUT_BLUE_PANTS_ORIGIN = "materials/models/player/scout/scout_blue.vtf";

export declare type SetAnim = {
    anim: string;
    scene: Scene;
};

export declare type SetInvulnerable = {
    invulnerable: boolean;
    scene: Scene;
};

export declare type SetItemFilter = {
    attribute: ItemFilterAttribute;
    value: string | boolean | undefined;
};

export declare type SetRagdoll = {
    ragdoll: Ragdoll;
    scene: Scene;
};

export declare function setUpdatePreview(update: boolean): void;

export declare const SFM_DEFAULT_ANIMATION_GROUPS_URL = "./json/sfm_defaultanimationgroups.json";

export declare const SFM_WORKSHOP_UGC_URL = "__sfmEndpoint__/ugc/";

export declare enum SfmSortField {
    Index = "sfm-index",
    Name = "sfm-name",
    Subscriptions = "sfm-subscriptions",
    Updated = "sfm-updated",
    Created = "sfm-created",
    Random = "sfm-random"
}

export declare const SHADERTOY_DIRECTORY = "./shadertoy/";

export declare const SHADERTOY_VIEW_URL = "https://www.shadertoy.com/view/";

export declare const SHARE_LOADOUT_URL = "https://share.loadout.tf/";

export declare const SNIPPET_URL = "https://github.com/baldurstod/pyodide-snippets";

export declare const startAnim = "stand_secondary";

export declare const STEAM_DEFAULT_PROFILE_URL: string;

export declare const STEAM_ECONOMY_IMAGE_PREFIX = "https://steamcommunity-a.akamaihd.net/economy/image/";

export declare const STEAM_PROFILE_URL = "https://steamcommunity.com/profiles/";

export declare const STEAM_WORKSHOP_URL = "http://steamcommunity.com/sharedfiles/filedetails/?id=";

export declare const TESTING_LOADOUT_ID = "WaGFMmx8KyPwVIBi";

export declare const TF2_CASUAL_BADGE = "models/vgui/12v12_badge";

export declare const TF2_COMPETITIVE_STAGE = "models/props_ui/competitive_stage";

export declare const TF2_DOVE_MODEL = "models/props_forest/dove";

export declare const TF2_GROUP_URL = "https://steamcommunity.com/groups/tf2loadout/discussions/1";

export declare const TF2_MAP_LIST_URL = "https://tf2content.loadout.tf/maps_manifest.json";

export declare const TF2_REPOSITORY = "https://tf2content.loadout.tf/";

export declare const TF2_TOOLBOX_MODEL = "models/weapons/w_models/w_toolbox";

export declare const TF2_WARPAINT_DEFINITIONS_URL: string;

export declare const TF2_WARPAINT_ENGLISH_URL: string;

export declare const TF2_WARPAINT_PICTURES_URL: string;

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

export declare class Tf2CharacterManager {
    #private;
    static setScene(scene: Scene): void;
    static setFirstPersonCamera(camera: Camera): void;
    static selectCharacter(characterClass: Tf2Class, scene: Scene, slotId?: uint): Promise<Tf2Character>;
    static removeCharacter(scene: Scene, slotId?: uint): void;
    static getSlot(scene: Scene, slotId?: uint): CharacterSlot;
    static setSlotsCount(size: uint, removeExisting: boolean | undefined, scene: Scene): void;
    static setTeam(team: Tf2Team, scene: Scene): Promise<void>;
    static getTeam(): Tf2Team;
    static getCurrentCharacter(scene: Scene): Tf2Character | null;
    static setCustomTexture(itemId: string, customTextureName: string, scene: Scene): void;
    static useDisposition(name: string | number, scene: Scene): void;
    static setupMeetTheTeam(scene: Scene): Promise<void>;
    static getAnimList(scene: Scene): ClassAnimations | null;
    static loadPreset(name: string, scene: Scene): void;
    static savePresets(): void;
    static savePreset(scene: Scene, name?: string): void;
    static createPresetName(scene: Scene): string;
    static getPresets(scene: Scene): Tf2Presets | null;
    static getCharacters(scene: Scene): Set<Tf2Character>;
    static getSlotsPositions(): Map<string, CharacterPosition[]>;
    static refreshCustomDisposition(customDisposition: CustomDisposition, scene: Scene): void;
}

export declare const Tf2CharactersList: Map<Tf2Class, Tf2CharactersType>;

export declare type Tf2CharactersType = {
    name: string;
    path: string;
    type: UsePlayerModels;
    icon: string;
    hidden?: boolean;
    npc: string;
};

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
    static addEventListener(type: 'setinvulnerable', callback: (evt: CustomEvent<SetInvulnerable>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setragdoll', callback: (evt: CustomEvent<SetRagdoll>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setanim', callback: (evt: CustomEvent<SetAnim>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'setapplytoall', callback: (evt: CustomEvent<boolean>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'usebots', callback: (evt: CustomEvent<UsePlayerModels>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'importpresets', callback: (evt: CustomEvent<ImportPresets>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'changeanimframe', callback: (evt: CustomEvent<ChangeAnimFrame>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'characterchanged', callback: (evt: CustomEvent<Tf2Character>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'activatemeettheteammap', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
    static addEventListener(type: 'presetsupdated', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
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
    static dispatchEvent(type: 'setinvulnerable', options: Tf2LoadoutControllerEventInit<SetInvulnerable>): boolean;
    static dispatchEvent(type: 'setragdoll', options: Tf2LoadoutControllerEventInit<SetRagdoll>): boolean;
    static dispatchEvent(type: 'setanim', options: Tf2LoadoutControllerEventInit<SetAnim>): boolean;
    static dispatchEvent(type: 'setapplytoall', options: Tf2LoadoutControllerEventInit<boolean>): boolean;
    static dispatchEvent(type: 'usebots', options: Tf2LoadoutControllerEventInit<UsePlayerModels>): boolean;
    static dispatchEvent(type: 'importpresets', options: Tf2LoadoutControllerEventInit<ImportPresets>): boolean;
    static dispatchEvent(type: 'changeanimframe', options: Tf2LoadoutControllerEventInit<ChangeAnimFrame>): boolean;
    static dispatchEvent(type: 'characterchanged', options: Tf2LoadoutControllerEventInit<Tf2Character>): boolean;
    static dispatchEvent(type: 'activatemeettheteammap', options?: CustomEventInit<void>): boolean;
    static dispatchEvent(type: 'presetsupdated', options?: CustomEventInit<void>): boolean;
    static removeEventListener(type: Tf2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

export declare type Tf2LoadoutControllerEvent = 'itemadded' | 'itemremoved' | 'inititems' | 'itemsloaded' | 'sfmitemsloaded' | 'systemsloaded' | 'setitemfilter' | 'setitemsortascending' | 'setsfmitemsortascending' | 'filtersupdated' | 'setitemsorttype' | 'setsfmsortfield' | 'itempinned' | 'setinvulnerable' | 'setragdoll' | 'setanim' | 'setapplytoall' | 'usebots' | 'importpresets' | 'changeanimframe' | 'characterchanged' | 'activatemeettheteammap' | 'presetsupdated';

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

export declare const UNUSUALS_IMAGES_DIR = "./img/unusuals/";

export declare let updatePreview: boolean;

export declare type UsePlayerModels = 'human' | 'bot' | 'infected';

declare type Warpaint = {
    weapon: string;
    title: string;
};

export declare const weaponEffects: Map<number, [string, string]>;

export declare const WORKSHOP_REPO = "workshop_";

export declare const WORKSHOP_UGC_IMG_PREFIX = "https://images.steamusercontent.com/ugc/";

export declare const WORKSHOP_UGC_URL = "https://ugc.workshop.tf/";

export declare const WORKSHOP_URL = "https://workshop.tf/php/workshop/getAllItems.php";

export { }
