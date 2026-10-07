import { Entity } from 'harmony-3d';
import { JSONObject } from 'harmony-types';
import { JSONValue } from 'harmony-types';
import { Scene } from 'harmony-3d';
import { Source2ModelInstance } from 'harmony-3d';

export declare const DEFAULT_ACTIVITY = "ACT_DOTA_IDLE";

export declare class Dota2AssetModifier {
    #private;
    constructor(item: Dota2Item | null, definition: Dota2AssetModifierJSON);
    get item(): Dota2Item | null;
    get type(): string | undefined;
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
    type?: string;
    style?: string;
    asset?: string;
    level?: string;
    persona?: string;
    skin?: string;
    loadout_default_offset?: string;
    value?: string;
};

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
    getModelName(): string;
    setModelId(modelId: number): Promise<void>;
    getModelId(): number;
    hasItem(itemId: string): boolean;
    getItem(itemId: string): Dota2Item | undefined;
    addItem(itemId: string): Promise<void>;
    removeItem(itemId: string): Promise<void>;
    getItems(): Map<string, Dota2Item>;
    getItemsWithBundle(): Map<string, Dota2Item>;
    getAssetModifiers(): Promise<Dota2AssetModifier[]>;
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
    getModelName(modelID: number): string;
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
    static addEventListener(type: Dota2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
    static dispatchEvent<T>(type: Dota2LoadoutControllerEvent, options?: CustomEventInit<T>): boolean;
    static removeEventListener(type: Dota2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

export declare type Dota2LoadoutControllerEvent = 'heroitemadded' | 'heroitemremoved' | 'herounitschanged' | 'heropersonachanged';

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

export declare function getPersonaId(slot: string): number;

export declare const MODIFIER_ACTIVITY = "activity";

export declare const MODIFIER_ADDITIONAL_WEARABLE = "additional_wearable";

export declare const MODIFIER_ARCANA_LEVEL = "arcana_level";

export declare const MODIFIER_BODYGROUP_VISIBILITY = "bodygroup_visibility";

export declare const MODIFIER_COURIER = "courier";

export declare const MODIFIER_COURIER_FLYING = "courier_flying";

export declare const MODIFIER_ENTITY_CLIENTSIDE_MODEL = "entity_clientside_model";

export declare const MODIFIER_ENTITY_MODEL = "entity_model";

export declare const MODIFIER_HERO_MODEL_CHANGE = "hero_model_change";

export declare const MODIFIER_MODEL = "model";

export declare const MODIFIER_MODEL_SKIN = "model_skin";

export declare const MODIFIER_PARTICLE = "particle";

export declare const MODIFIER_PARTICLE_CREATE = "particle_create";

export declare const MODIFIER_PERSONA = "persona";

export declare const MODIFIER_PET = "pet";

export declare const MODIFIER_PORTRAIT_BACKGROUND_MODEL = "portrait_background_model";

export { }
