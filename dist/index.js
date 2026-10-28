import { vec3, quat, vec4, vec2 } from 'gl-matrix';
import { Source2ModelManager, Source2ParticleManager, Group, stringToVec3, Source1ModelManager, Graphics, TextureManager, Color as Color$1, NodeParamOrigin, Source1TextureManager, NodeEventType, DEG_TO_RAD, DEFAULT_TEXTURE_SIZE, NodeImageEditor, Source1MaterialManager, AnimatedTexture, Repositories, WebRepository, VcdParser, ChoreographiesManager, Source1ParticleControler, GraphicsEvents, ChoreographyEventType, Property, Source1SoundManager, RandomFloat } from 'harmony-3d';
import { OptionsManager, OptionsManagerEvents } from 'harmony-browser-utils';

class Dota2AssetModifier {
    #item;
    #definition;
    constructor(item, definition) {
        this.#item = item;
        this.#definition = definition;
    }
    get item() {
        return this.#item;
    }
    get type() {
        return this.#definition.type;
    }
    get asset() {
        return this.#definition.asset;
    }
    get modifier() {
        return this.#definition.modifier;
    }
    get persona() {
        return this.#definition.persona;
    }
    get skin() {
        return this.#definition.skin;
    }
    get style() {
        return this.#definition.style ?? 0;
    }
    get loadoutDefaultOffset() {
        return this.#definition.loadout_default_offset;
    }
    get level() {
        return this.#definition.level;
    }
    get value() {
        return this.#definition.value;
    }
}

class Dota2LoadoutController {
    static #eventTarget = new EventTarget();
    static addEventListener(type, callback, options) {
        this.#eventTarget.addEventListener(type, callback, options);
    }
    static dispatchEvent(type, options) {
        return this.#eventTarget.dispatchEvent(new CustomEvent(type, options));
    }
    static removeEventListener(type, callback, options) {
        this.#eventTarget.removeEventListener(type, callback, options);
    }
}

function getPersonaId(slot) {
    const result = /\_persona\_(\d)$/.exec(slot);
    if (result?.length == 2) {
        return Number(result[1]);
    }
    return 0;
}

const DIRE_BANNER = 'models/props/creep_banners/creep_banner_dire.vmdl_c';
const RADIANT_BANNER = 'models/props/creep_banners/creep_banner_radiant.vmdl_c';
class Dota2Item {
    #template;
    #hero;
    #model = null;
    #childEntities = new Set();
    #extraEntities = new Set();
    #visible;
    #alternateModelName;
    #style = 0;
    #heroSkin = 0;
    #arcanaLevel;
    extraAssetModifiers = [];
    constructor(template, hero) {
        this.#template = template;
        this.#hero = hero;
    }
    async getModel() {
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
    async playSequence(sequenceName) {
        for (const entity of this.getExtraEntities()) {
            entity?.playSequence?.(sequenceName);
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
    async setVisible(visible) {
        if (visible == true) {
            visible = undefined;
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
    isVisible() {
        return this.#visible ?? true;
    }
    get character() {
        return this.#hero;
    }
    get name() {
        return this.#template.name;
    }
    get id() {
        return this.#template.id;
    }
    get imageInventory() {
        return this.#template.imageInventory;
    }
    get slot() {
        return this.#template.slot;
    }
    get modelName() {
        return this.#alternateModelName ?? this.#template.getModelName(this.#style) ?? '';
    }
    get assetModifiers() {
        return this.#template.assetModifiers;
    }
    get skin() {
        return this.#template.getSkin(this.#style) ?? this.#heroSkin ?? 0;
    }
    set style(style) {
        this.#style = style;
    }
    get style() {
        return this.#style;
    }
    setStyle(styleId) {
        this.#style = styleId;
        //TODO: put that in the caller
        this.#hero.processModifiers();
    }
    hasStyles() {
        return this.#template.hasStyles();
    }
    getStyle(styleId) {
        return this.#template.getStyle(styleId);
    }
    getStyles() {
        return this.#template.getStyles();
    }
    getPersonaId() {
        return getPersonaId(this.#template.slot);
    }
    getAssetModifiers() {
        const modifiers = this.assetModifiers;
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
    async processModifiers(replacements, characterModelId) {
        this.#clearExtraEntities();
        const modifiers = this.getAssetModifiers();
        let originalModelName = this.#template.getModelName(this.#style, characterModelId);
        if (!originalModelName && modifiers) {
            for (const modifier of modifiers) {
                if (modifier.type == 'entity_model' && modifier.asset && modifier.asset.endsWith(`_variant_${characterModelId}`)) {
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
                case 'particle_create':
                    if (!OptionsManager.getItem('app.showeffects') || !modifier.modifier) {
                        break;
                    }
                    const systemName = replacements.get(modifier.modifier) ?? modifier.modifier;
                    let system = await Source2ParticleManager.getSystem('dota2', systemName /*, snapshotModifiers TODO */);
                    if (!system) {
                        break;
                    }
                    system.start();
                    if (this.modelName) {
                        this.#model?.addChild(system);
                        this.#childEntities.add(system);
                    }
                    else {
                        this.#extraEntities.add(system);
                        system.setVisible(this.#visible);
                    }
                    break;
                case 'additional_wearable':
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
                case 'entity_model':
                    break;
                case 'entity_clientside_model':
                    if (!modifier.asset || !modifier.modifier) {
                        break;
                    }
                    position = vec3.create();
                    let extraModel = '';
                    const banner = this.#hero.id === 'direcreeps' ? DIRE_BANNER : RADIANT_BANNER;
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
                    if ((modifier.asset.startsWith('npc_dota_goodguys_tower') || modifier.asset.startsWith('npc_dota_badguys_tower'))
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
                case 'persona':
                case 'particle':
                    // Dealt with in hero processModifiers() method
                    break;
                case 'hero_scale':
                case 'response_criteria':
                case 'icon_replacement_hero':
                case 'icon_replacement_hero_minimap':
                case 'ability_icon':
                case 'default_idle_expression':
                case 'chatwheel':
                    // TODO
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
    async #setItemModel(modelName) {
        if (this.#alternateModelName != modelName) {
            this.#alternateModelName = modelName;
            await this.#resetModel();
        }
    }
    setCharacterSkin(skin) {
        if (!this.#template.isBaseItem) {
            this.#heroSkin = skin;
        }
    }
    setArcanaLevel(arcanaLevel) {
        this.#arcanaLevel = arcanaLevel;
    }
    async #resetModel() {
        const oldModel = await this.getModel();
        if (oldModel) {
            oldModel.remove();
        }
        this.#model = null;
        //this.#modelPromise = null;
        await this.getModel();
    }
}

class Dota2ItemTemplate {
    #definition;
    constructor(definition) {
        this.#definition = definition;
    }
    get name() {
        return this.#definition.name ?? '';
    }
    get imageInventory() {
        return this.#definition.imageInventory;
    }
    get slot() {
        return this.#definition.slot?.toLowerCase();
    }
    get id() {
        return String(this.#definition.id);
    }
    getModelName(styleId, model = 0) {
        const style = this.#definition.styles?.[styleId];
        if (model == 0) {
            return style?.model_player ?? this.#definition.modelPlayer ?? '';
        }
        else {
            return style?.['model_player' + model] ?? style?.model_player ?? this.#definition['modelPlayer' + model] ?? this.#definition.modelPlayer ?? '';
        }
    }
    get repository() {
        return this.#definition.repository;
    }
    get isBaseItem() {
        return this.#definition.baseItem == 1;
    }
    get bundle() {
        return this.#definition.bundle;
    }
    get assetModifiers() {
        return this.#definition.assetmodifiers;
    }
    get rarity() {
        return this.#definition.rarity;
    }
    get skin() {
        return this.#definition.skin;
    }
    getSkin(styleId) {
        const style = this.#definition.styles?.[styleId];
        return Number(style?.skin ?? this.#definition.skin ?? 0);
    }
    hasStyles() {
        return Object.keys(this.#definition.styles ?? {}).length > 1;
    }
    getStyle(styleId) {
        return this.#definition.styles?.[styleId];
    }
    getStyles() {
        const ret = new Map();
        const styles = this.#definition.styles;
        if (styles) {
            for (const styleId in styles) {
                ret.set(styleId, styles[styleId]);
            }
        }
        return ret;
    }
}

class Dota2ItemTemplates {
    static #templates = new Map();
    static #templatesByName = new Map();
    static addTemplate(templateJSON) {
        this.#templates.set(String(templateJSON.id), new Dota2ItemTemplate(templateJSON));
        this.#templatesByName.set(templateJSON.name, String(templateJSON.id));
    }
    static getTemplate(id) {
        return this.#templates.get(id);
    }
    static getTemplateByName(name) {
        return this.#templatesByName.get(name);
    }
    static getTemplates() {
        return this.#templates;
    }
}

class Dota2Units {
    static #units = new Map();
    static addUnit(id, unit) {
        this.#units.set(id, unit);
    }
    static addUnits(units) {
        for (const id in units) {
            const unit = units[id];
            this.addUnit(id, unit);
        }
    }
    static getUnit(id) {
        return this.#units.get(id);
    }
    static getModel(id) {
        let unit = this.#units.get(id);
        if (!unit) {
            for (const [i, u] of this.#units) {
                if (i.startsWith(id)) {
                    unit = u;
                    break;
                }
            }
        }
        if (!unit) {
            return null;
        }
        if (unit.Model) {
            return unit.Model;
        }
        if (unit.include_keys_from) {
            return this.getModel(unit.include_keys_from);
        }
        return null;
    }
    static getName(id) {
        let unit = this.#units.get(id);
        if (!unit) {
            for (const [i, u] of this.#units) {
                if (i.startsWith(id)) {
                    //return u;
                    unit = u;
                    break;
                }
            }
        }
        if (!unit) {
            return null;
        }
        if (unit.name) {
            return unit.name;
        }
        if (unit.include_keys_from) {
            return this.getName(unit.include_keys_from);
        }
        return null;
    }
    static getUnits() {
        return this.#units;
    }
}

class Dota2HeroTemplate {
    #definition;
    constructor(definition) {
        this.#definition = definition;
    }
    get name() {
        return this.#definition.Name;
    }
    get id() {
        return this.#definition.ID;
    }
    get heroOrderId() {
        return Number(this.#definition.HeroOrderID);
    }
    get itemSlots() {
        const itemSlots = this.#definition.ItemSlots;
        if (!itemSlots) {
            return;
        }
        const slots = new Map();
        for (const slotName in itemSlots) {
            const slot = itemSlots[slotName];
            const slotLowerCase = slot.SlotName.toLowerCase();
            slots.set(slotLowerCase, {
                ...(slot.DisplayInLoadout !== undefined) && { DisplayInLoadout: slot.DisplayInLoadout },
                SlotIndex: slot.SlotIndex,
                SlotName: slotLowerCase,
                SlotText: slot.SlotText,
                GeneratesUnits: slot.GeneratesUnits,
            });
        }
        return slots;
    }
    getSpawnedUnits() {
        return Array.from(this.#definition.spawned_units ?? []);
    }
    isHero() {
        return this.#definition['is_hero'];
    }
    getModelCount() {
        let i = 0;
        for (; i == 0 || this.#definition[`Model${i}`];) {
            ++i;
        }
        return i;
    }
    getModelPath(modelID) {
        return this.#definition[`Model${modelID}`] ?? this.#definition.Model ?? '';
    }
    getAdjective(name) {
        return this.#definition.Adjectives?.[name];
    }
}

class Dota2HeroTemplates {
    static #templates = new Map();
    static heroCount = 0;
    static addTemplate(templateJSON /*TODO: improve type*/) {
        const template = new Dota2HeroTemplate(templateJSON);
        this.#templates.set(templateJSON.ID, template);
        if (template.isHero()) {
            ++this.heroCount;
        }
    }
    static getTemplate(id) {
        return this.#templates.get(id);
    }
    static getTemplates() {
        return this.#templates;
    }
}

const DEFAULT_ACTIVITY = 'ACT_DOTA_IDLE';
class Dota2Hero {
    #heroId;
    #modelId = 0;
    #template;
    #items = new Map();
    #itemsPerSlot = new Map();
    bundleItem = null;
    //#name = '';
    //#displayName = '';
    #model = null;
    #modelPromise;
    #visible = false;
    //#personaId = 0;// Base hero
    #alternateModelPath;
    #activityModifiers = new Set();
    #group;
    #pedestalModel = null;
    #pedestalModels = new Map();
    #petModel = null;
    #metamorphosisModel = null;
    #activity = DEFAULT_ACTIVITY;
    #modifiers = [];
    #units = new Map();
    constructor(heroId, scene) {
        this.#group = new Group({ parent: scene, quaternion: [0, 0, -1, 1] }); // Face -Y
        this.#heroId = heroId;
        this.#template = Dota2HeroTemplates.getTemplate(heroId);
        this.#group.name = this.name;
        OptionsManagerEvents.addEventListener('app.units.display', event => { this.#positionUnits(event); });
    }
    async getModel() {
        if (this.#model) {
            return this.#model;
        }
        if (this.#modelPromise) {
            return this.#modelPromise;
        }
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.#modelPromise = new Promise(async (resolve) => {
            this.#model = await Source2ModelManager.createInstance('dota2', this.getModelPath(), true);
            this.#group.addChild(this.#model);
            resolve(this.#model);
            await this.playSequence();
        });
        return this.#modelPromise;
    }
    async playSequence() {
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
        const modifiers = [];
        //const activityModifier = this.#activityModifiers.get(sequenceName) ?? this.#activityModifiers.get('ALL');
        for (const activityModifier of this.#activityModifiers) {
            if ((activityModifier.asset == sequenceName || activityModifier.asset == 'ALL') && activityModifier.modifier) {
                modifiers.push(activityModifier.modifier);
            }
        }
        modifiers.push(...this.#modifiers);
        model.playSequence(sequenceName, modifiers);
        model.setAttribute('activity', { activity: sequenceName, modifiers: modifiers });
        this.#petModel?.playSequence(sequenceName);
        this.#metamorphosisModel?.playSequence(sequenceName);
    }
    setVisible(visible) {
        this.#visible = visible === true ? undefined : visible;
        this.#group.setVisible(visible);
    }
    get name() {
        return this.#template.name;
    }
    get id() {
        return this.#template.id;
    }
    //todo: NameAliases
    get heroOrderId() {
        return this.#template.heroOrderId;
    }
    get itemSlots() {
        return this.#template.itemSlots;
    }
    isHero() {
        return this.#template.isHero();
    }
    getModelCount() {
        return this.#template.getModelCount();
    }
    getModelPath() {
        return this.#alternateModelPath ?? this.#template.getModelPath(this.#modelId);
    }
    async setModelId(modelId) {
        if (modelId >= 0 && modelId <= this.getModelCount()) {
            this.#modelId = modelId;
        }
        await this.#resetModel();
        await this.processModifiers();
    }
    getModelId() {
        return this.#modelId;
    }
    hasItem(itemId) {
        return this.#items.has(itemId);
    }
    getItem(itemId) {
        return this.#items.get(itemId);
    }
    async addItem(itemId) {
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
        await item.setVisible(item.getPersonaId() === 0);
        this.#items.set(itemId, item);
        Dota2LoadoutController.dispatchEvent('heroitemadded', { detail: item });
        if (item.slot) {
            await this.#replaceSlot(item);
        }
        await this.#addChild(await item.getModel());
        await this.processModifiers();
    }
    async #addChild(itemModel) {
        const model = await this.getModel();
        if (model) {
            model.addChild(itemModel);
        }
        else {
            this.#group.addChild(itemModel);
        }
    }
    async removeItem(itemId) {
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
    async #replaceSlot(item) {
        const previousItem = this.#itemsPerSlot.get(item.slot);
        if (previousItem) {
            await this.removeItem(previousItem.id);
        }
        this.#itemsPerSlot.set(item.slot, item);
    }
    getItems() {
        return new Map(this.#items);
    }
    getItemsWithBundle() {
        const items = this.getItems();
        if (this.bundleItem) {
            items.set(this.bundleItem.id, this.bundleItem);
        }
        return items;
    }
    async #getAssetModifiers() {
        let modifiers = [];
        for (const [, item] of this.#items) {
            const itemModifiers = item.getAssetModifiers();
            if (itemModifiers) {
                modifiers = modifiers.concat(itemModifiers);
            }
        }
        await this.#setPersonaId(0);
        return modifiers;
    }
    #clearExtraEntities() {
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
    async processModifiers() {
        this.#group.setAttribute('desaturate', OptionsManager.getItem('app.characters.desaturate'));
        this.#clearExtraEntities();
        const modifiers = await this.#getAssetModifiers();
        await this.#processGeneratedUnits();
        //this.usePersonaModel(this.#personaId);
        let alternateModelPath;
        const replacements = new Map();
        let skin = 0;
        let arcanaLevel = 0;
        this.#activityModifiers.clear();
        const bodygroups = new Map();
        for (const modifier of modifiers) {
            switch (modifier.type) {
                case 'persona':
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
                        }
                        else {
                            alternateModelPath = modifier.modifier;
                        }
                    }
                    else {
                        //console.error('Have a modifier for another entity: ', modifier);
                        await this.#setUnit(modifier);
                    }
                    break;
                case 'model':
                case 'particle':
                    replacements.set(modifier.asset, modifier.modifier);
                    break;
                case 'model_skin':
                    skin = Number(modifier.skin ?? 0);
                    break;
                case 'bodygroup_visibility':
                    // TODO: use modifier.asset to determine the model to replace
                    bodygroups.set(modifier.modifier, Number(modifier.value));
                    break;
                case 'activity':
                    this.#activityModifiers.add(modifier);
                    break;
                case 'pet':
                case 'portrait_background_model':
                case 'hero_model_change':
                    const modelPath = replacements.get(modifier.asset) ?? modifier.modifier ?? modifier.asset ?? '';
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
                        }
                        else if (modifier.type == 'hero_model_change') {
                            this.#metamorphosisModel = model;
                        }
                        else {
                            this.#pedestalModel = model;
                        }
                    }
                    break;
                case 'arcana_level':
                    arcanaLevel = Number(modifier.level ?? 0);
                    break;
                case 'particle_create':
                    // Dealt with in item processModifiers() method
                    break;
                case 'hero_scale':
                case 'icon_replacement_hero':
                case 'icon_replacement_hero_minimap':
                case 'ability_icon':
                case 'response_criteria':
                case 'chatwheel':
                case 'default_idle_expression':
                    // TODO
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
            }
            else {
                this.#pedestalModel.setVisible(false);
            }
        }
        if (this.#metamorphosisModel) {
            if (OptionsManager.getItem('app.showmetamorphosis')) {
                this.#metamorphosisModel.setVisible(undefined);
                this.#model?.setVisible(false);
            }
            else {
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
    async #processGeneratedUnits() {
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
    async #setUnit(modifier) {
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
                model.setVisible((event.detail.value)[modifierAsset] ? undefined : false);
            });
            Dota2LoadoutController.dispatchEvent('herounitschanged');
        }
        this.#positionUnits();
    }
    #positionUnits(event) {
        const display = (event?.detail?.value ?? OptionsManager.getItem('app.units.display'));
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
    async #initPedestal() {
        const path = OptionsManager.getItem('app.loadout.pedestalmodel');
        if (!path) {
            return;
        }
        let model = this.#pedestalModels.get(path);
        if (model === undefined) {
            model = await Source2ModelManager.createInstance('dota2', path, true);
            this.#pedestalModels.set(path, model);
        }
        this.#pedestalModel = model;
    }
    async #setSkin(skin) {
        const model = await this.getModel();
        if (!model) {
            return;
        }
        model.skin = skin;
        for (const [, item] of this.#items) {
            item.setCharacterSkin(skin);
        }
    }
    async #setArcanaLevel(arcanaLevel) {
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
    async #reparentItems() {
        for (const [, item] of this.#items) {
            await this.#addChild(await item.getModel());
            item.reparentChilds();
        }
    }
    async #setCharacterModel(modelPath) {
        if (this.#alternateModelPath != modelPath) {
            this.#alternateModelPath = modelPath;
            await this.#resetModel();
        }
    }
    async #resetModel() {
        const oldModel = await this.getModel();
        if (oldModel) {
            oldModel.remove();
        }
        this.#model = null;
        this.#modelPromise = undefined;
    }
    async #setPersonaId(personaId) {
        const promises = [];
        for (const [, item] of this.#items) {
            promises.push(item.setVisible(item.slot === 'persona_selector' || personaId == item.getPersonaId()));
        }
        await Promise.all(promises);
        Dota2LoadoutController.dispatchEvent('heropersonachanged', { detail: personaId });
    }
    async setActivity(activity) {
        this.#activity = activity;
        await this.playSequence();
    }
    getActivity() {
        return this.#activity;
    }
    async setModifiers(modifiers) {
        this.#modifiers = modifiers;
        await this.playSequence();
    }
    getModifiers() {
        return this.#modifiers;
    }
    exportLoadout() {
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
        };
        return json;
    }
    async importLoadout(characterJSON) {
        const itemsJSON = characterJSON.items;
        if (itemsJSON) {
            for (const itemJSON of itemsJSON) {
                const itemId = String(itemJSON.id);
                const item = await this.addItem(itemId);
                console.info(item);
            }
        }
        //await this.#importLoadoutUnusualEffects(characterJSON.unusualEffects);
    }
    getUnits() {
        return this.#units;
    }
    getSpawnedUnits() {
        return this.#template.getSpawnedUnits();
    }
}
function getUnitPlacement(i) {
    return vec3.fromValues(0, 400 * (i % 2 - 0.5) * Math.floor((i + 1) / 2), 0);
}

const DOTA2_REPOSITORY = 'https://dota2content.dotaloadout.com/';
const DOTA2_GENERATED_ITEMS = 'generated/items/';

class Dota2ItemManager {
    static #characterTemplates = new Map();
    static #characters = new Map();
    static #itemsPerCharacter = new Map();
    static async #loadItems(characterId) {
        let items = this.#itemsPerCharacter.get(characterId);
        if (items) {
            return items;
        }
        items = new Promise(async (resolve) => {
            const response = await fetch(new URL(`${DOTA2_GENERATED_ITEMS}${characterId}.json`, DOTA2_REPOSITORY));
            if (!response) {
                return false;
            }
            const itemsJSON = await response.json();
            if (!itemsJSON) {
                return false;
            }
            const characterItems = new Set();
            for (const item of itemsJSON) {
                Dota2ItemTemplates.addTemplate(item);
                characterItems.add(String(item.id));
            }
            Dota2LoadoutController.dispatchEvent('itemsloaded', { detail: characterId });
            resolve(characterItems);
        });
        this.#itemsPerCharacter.set(characterId, items);
        return items;
    }
    static async #loadNeutralCreeps(characterId) {
        const items = new Set();
        for (const [key, unit] of Dota2Units.getUnits()) {
            if (unit.IsNeutralUnitType == '1' && unit.ConsideredHero != '1') {
                const item = {
                    id: key,
                    name: unit.name,
                    slot: 'neutral_creeps',
                    assetmodifiers: [
                        {
                            'asset': characterId,
                            'modifier': unit.Model,
                            'type': 'entity_model',
                        },
                    ],
                };
                Dota2ItemTemplates.addTemplate(item);
                items.add(key);
            }
        }
        return items;
    }
    static async getItems(characterId) {
        if (characterId === 'neutralcreeps') {
            return this.#loadNeutralCreeps(characterId);
        }
        else {
            return this.#loadItems(characterId);
        }
    }
    static async getBaseItemId(characterId, slot) {
        const items = await this.#loadItems(characterId);
        if (!items) {
            return null;
        }
        for (const itemId of items) {
            const item = Dota2ItemTemplates.getTemplate(itemId);
            if (item?.isBaseItem && item?.slot == slot) {
                return itemId;
            }
        }
        return null;
    }
}

var _a$2;
const TWO_POW_10 = 1024;
const TWO_POW_MINUS_14 = Math.pow(2, -14);
function getCharCodes(str) {
    let codes = new Uint8Array(str.length);
    for (var i = 0, length = str.length; i < length; i++) {
        codes[i] = str.charCodeAt(i) & 0xff;
    }
    return codes;
}
class BinaryReader {
    #dataView = new DataView(new ArrayBuffer(0));
    #byteOffset = 0;
    #littleEndian;
    constructor(buffer, byteOffset, byteLength, littleEndian = true) {
        this.#littleEndian = littleEndian;
        this.#initDataview(buffer, byteOffset, byteLength);
    }
    #initDataview(buffer, byteOffset, byteLength) {
        switch (true) {
            case buffer instanceof _a$2:
                this.#dataView = new DataView(buffer.buffer, byteOffset ? byteOffset + buffer.#dataView.byteOffset : buffer.#dataView.byteOffset, byteLength);
                break;
            case buffer instanceof Uint8Array || buffer?.constructor?.name === 'Uint8Array':
                this.#dataView = new DataView(buffer.buffer, byteOffset ? byteOffset + buffer.byteOffset : buffer.byteOffset, byteLength);
                break;
            case buffer instanceof ArrayBuffer || buffer?.constructor?.name === 'ArrayBuffer':
                this.#dataView = new DataView(buffer, byteOffset, byteLength);
                break;
            case typeof buffer === 'string':
                this.#dataView = new DataView(getCharCodes(buffer).buffer, byteOffset, byteLength);
                break;
            case typeof buffer === 'number':
                this.#dataView = new DataView(new Uint8Array(buffer).buffer, byteOffset, byteLength);
                break;
            case Array.isArray(buffer):
                this.#dataView = new DataView(Uint8Array.from(buffer).buffer, byteOffset, byteLength);
                break;
            default:
                console.error(`Unknow buffer type : ${buffer}`);
                break;
        }
    }
    get buffer() {
        return this.#dataView.buffer;
    }
    get byteLength() {
        return this.#dataView.byteLength;
    }
    getDataView() {
        return this.#dataView;
    }
    tell() {
        return this.#byteOffset;
    }
    seek(byteOffset = this.#byteOffset) {
        // /_checkBounds
        this.#byteOffset = byteOffset;
    }
    skip(byteLength = 0) {
        // /_checkBounds
        this.#byteOffset += byteLength;
    }
    getString(byteLength, byteOffset = this.#byteOffset) {
        let string = '';
        let readBuffer = new Uint8Array(this.buffer, byteOffset + this.#dataView.byteOffset, byteLength);
        // /_checkBounds
        this.#byteOffset = byteOffset + byteLength;
        for (var i = 0; i < byteLength; i++) {
            string += String.fromCharCode(readBuffer[i]);
        }
        return string;
    }
    getNullString(byteOffset = this.#byteOffset) {
        let string = '';
        let readBuffer = new Uint8Array(this.buffer, this.#dataView.byteOffset);
        this.#byteOffset = byteOffset;
        let c;
        do {
            c = String.fromCharCode(readBuffer[this.#byteOffset++]);
            if (c == '\0') ;
            else {
                string += c;
            }
        } while (c != '\0');
        return string;
    }
    setString(str, byteOffset = this.#byteOffset) {
        let length = str.length;
        this.#byteOffset = byteOffset + length;
        let writeBuffer = new Uint8Array(this.buffer, byteOffset + this.#dataView.byteOffset, length);
        //TODO: check len
        for (var i = 0, l = length; i < l; i++) {
            writeBuffer[i] = str.charCodeAt(i) & 0xff;
        }
    }
    getBytes(byteLength, byteOffset = this.#byteOffset) {
        let readBuffer = new Uint8Array(this.buffer, byteOffset + this.#dataView.byteOffset, byteLength);
        this.#byteOffset = byteOffset + byteLength;
        return readBuffer;
    }
    getInt8(byteOffset = this.#byteOffset) {
        this.#byteOffset = byteOffset + 1;
        return this.#dataView.getInt8(byteOffset);
    }
    getUint8(byteOffset = this.#byteOffset) {
        this.#byteOffset = byteOffset + 1;
        return this.#dataView.getUint8(byteOffset);
    }
    getInt16(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 2;
        return this.#dataView.getInt16(byteOffset, littleEndian);
    }
    getUint16(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 2;
        return this.#dataView.getUint16(byteOffset, littleEndian);
    }
    getFloat16(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        //TODO: fix endianness
        this.#byteOffset = byteOffset + 2;
        let readBuffer = new Uint8Array(this.buffer, byteOffset + this.#dataView.byteOffset, 2); //TODOv3: optimize
        let b = readBuffer; //this._getBytes(2, byteOffset, littleEndian);
        let sign = b[1] >> 7;
        let exponent = ((b[1] & 0x7C) >> 2);
        let mantissa = ((b[1] & 0x03) << 8) | b[0];
        if (exponent == 0) {
            return (sign ? -1 : 1) * TWO_POW_MINUS_14 * (mantissa / TWO_POW_10);
        }
        else if (exponent == 0x1F) {
            return mantissa ? NaN : ((sign ? -1 : 1) * Infinity);
        }
        return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + (mantissa / TWO_POW_10));
    }
    getInt32(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 4;
        return this.#dataView.getInt32(byteOffset, littleEndian);
    }
    getUint32(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 4;
        return this.#dataView.getUint32(byteOffset, littleEndian);
    }
    getFloat32(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 4;
        return this.#dataView.getFloat32(byteOffset, littleEndian);
    }
    getBigInt64(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 8;
        return this.#dataView.getBigInt64(byteOffset, littleEndian);
    }
    getBigUint64(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 8;
        return this.#dataView.getBigUint64(byteOffset, littleEndian);
    }
    getFloat64(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 8;
        return this.#dataView.getFloat64(byteOffset, littleEndian);
    }
    getVector2(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian, vec = new Float32Array(2)) {
        vec[0] = this.getFloat32(byteOffset, littleEndian);
        vec[1] = this.getFloat32(undefined, littleEndian);
        return vec;
    }
    getVector3(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian, vec = new Float32Array(3)) {
        vec[0] = this.getFloat32(byteOffset, littleEndian);
        vec[1] = this.getFloat32(undefined, littleEndian);
        vec[2] = this.getFloat32(undefined, littleEndian);
        return vec;
    }
    getVector4(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian, vec = new Float32Array(4)) {
        vec[0] = this.getFloat32(byteOffset, littleEndian);
        vec[1] = this.getFloat32(undefined, littleEndian);
        vec[2] = this.getFloat32(undefined, littleEndian);
        vec[3] = this.getFloat32(undefined, littleEndian);
        return vec;
    }
    getVector48(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian, vec = new Float32Array(3)) {
        vec[0] = this.getFloat16(byteOffset, littleEndian);
        vec[1] = this.getFloat16(undefined, littleEndian);
        vec[2] = this.getFloat16(undefined, littleEndian);
        return vec;
    }
    getQuaternion(byteOffset = this.#byteOffset, littleEndian = this.#littleEndian, vec = new Float32Array(4)) {
        vec[0] = this.getFloat32(byteOffset, littleEndian);
        vec[1] = this.getFloat32(undefined, littleEndian);
        vec[2] = this.getFloat32(undefined, littleEndian);
        vec[3] = this.getFloat32(undefined, littleEndian);
        return vec;
    }
    setBigInt64(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 8;
        return this.#dataView.setBigInt64(byteOffset, value, littleEndian);
    }
    setBigUint64(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 8;
        return this.#dataView.setBigUint64(byteOffset, value, littleEndian);
    }
    setFloat32(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 4;
        return this.#dataView.setFloat32(byteOffset, value, littleEndian);
    }
    setFloat64(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 8;
        return this.#dataView.setFloat64(byteOffset, value, littleEndian);
    }
    setInt8(value, byteOffset = this.#byteOffset) {
        this.#byteOffset = byteOffset + 1;
        return this.#dataView.setInt8(byteOffset, value);
    }
    setInt16(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 2;
        return this.#dataView.setInt16(byteOffset, value, littleEndian);
    }
    setInt32(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 4;
        return this.#dataView.setInt32(byteOffset, value, littleEndian);
    }
    setUint8(value, byteOffset = this.#byteOffset) {
        this.#byteOffset = byteOffset + 1;
        return this.#dataView.setUint8(byteOffset, value);
    }
    setUint16(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 2;
        return this.#dataView.setUint16(byteOffset, value, littleEndian);
    }
    setUint32(value, byteOffset = this.#byteOffset, littleEndian = this.#littleEndian) {
        this.#byteOffset = byteOffset + 4;
        return this.#dataView.setUint32(byteOffset, value, littleEndian);
    }
    setBytes(bytes, byteOffset = this.#byteOffset) {
        let length = bytes.length;
        this.#byteOffset = byteOffset + length;
        new Uint8Array(this.#dataView.buffer, byteOffset + this.#dataView.byteOffset, length).set(bytes);
    }
}
_a$2 = BinaryReader;

function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s;
    const l = (max + min) / 2;
    if (max == min) {
        h = s = 0; // achromatic
    }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }
    return [h, s, l];
}
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s == 0) {
        r = g = b = l; // achromatic
    }
    else {
        function hue2rgb(p, q, t) {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b];
}
class Color {
    #rgba;
    constructor({ red = 0, green = 0, blue = 0, alpha = 1, hex = '' } = {}) {
        this.#rgba = [red, green, blue, alpha];
        if (hex) {
            this.setHex(hex);
        }
    }
    setHue(hue) {
        const hsl = rgbToHsl(this.#rgba[0], this.#rgba[1], this.#rgba[2]);
        const rgb = hslToRgb(hue, hsl[1], hsl[2]);
        this.#rgba[0] = rgb[0];
        this.#rgba[1] = rgb[1];
        this.#rgba[2] = rgb[2];
    }
    setSatLum(sat, lum) {
        const hsl = rgbToHsl(this.#rgba[0], this.#rgba[1], this.#rgba[2]);
        const rgb = hslToRgb(hsl[0], sat, lum);
        this.#rgba[0] = rgb[0];
        this.#rgba[1] = rgb[1];
        this.#rgba[2] = rgb[2];
    }
    setHex(hex) {
        hex = (hex.startsWith('#') ? hex.slice(1) : hex)
            .replace(/^(\w{3})$/, '$1F') //987      -> 987F
            .replace(/^(\w)(\w)(\w)(\w)$/, '$1$1$2$2$3$3$4$4') //9876     -> 99887766
            .replace(/^(\w{6})$/, '$1FF'); //987654   -> 987654FF
        if (!hex.match(/^([0-9a-fA-F]{8})$/)) {
            throw new Error('Unknown hex color; ' + hex);
        }
        const rgba = hex
            .match(/^(\w\w)(\w\w)(\w\w)(\w\w)$/)?.slice(1) //98765432 -> 98 76 54 32
            .map(x => parseInt(x, 16)); //Hex to decimal
        if (rgba) {
            this.#rgba[0] = rgba[0] / 255;
            this.#rgba[1] = rgba[1] / 255;
            this.#rgba[2] = rgba[2] / 255;
            this.#rgba[3] = rgba[3] / 255;
        }
    }
    getHex() {
        const hex = this.#rgba.map(x => Math.round(x * 255).toString(16));
        return '#' + hex.map(x => x.padStart(2, '0')).join('');
    }
    getHue() {
        return rgbToHsl(this.#rgba[0], this.#rgba[1], this.#rgba[2])[0];
    }
    getHsl() {
        return rgbToHsl(this.#rgba[0], this.#rgba[1], this.#rgba[2]);
    }
    getRgba() {
        return this.#rgba;
    }
    setRgba(rgba) {
        this.#rgba[0] = rgba[0];
        this.#rgba[1] = rgba[1];
        this.#rgba[2] = rgba[2];
        this.#rgba[3] = rgba[3];
    }
    set red(red) {
        this.#rgba[0] = red;
    }
    get red() {
        return this.#rgba[0];
    }
    set green(green) {
        this.#rgba[1] = green;
    }
    get green() {
        return this.#rgba[1];
    }
    set blue(blue) {
        this.#rgba[2] = blue;
    }
    get blue() {
        return this.#rgba[2];
    }
    set alpha(alpha) {
        this.#rgba[3] = alpha;
    }
    get alpha() {
        return this.#rgba[3];
    }
    getLuminance() {
        return 0.2126 * this.#rgba[0] + 0.7152 * this.#rgba[1] + 0.0722 * this.#rgba[2];
    }
}

/**
 * Map2 holds a key-key-value triplet using an underlying Map
 * Any value can be used as either keys or value
 */
class Map2 {
    #map = new Map();
    clear() {
        this.#map.clear();
    }
    delete(key1, key2) {
        return this.#map.get(key1)?.delete(key2) ?? false;
    }
    forEach(callbackfn, thisArg) {
        this.#map.forEach((value, key1) => {
            value.forEach((value, key2) => callbackfn.call(thisArg, value, key1, key2, this));
        });
    }
    get(key1, key2) {
        return this.#map.get(key1)?.get(key2);
    }
    getMap() {
        return this.#map;
    }
    getSubMap(key1) {
        return this.#map.get(key1);
    }
    has(key1, key2) {
        return this.#map.get(key1)?.has(key2) ?? false;
    }
    set(key1, key2, value) {
        if (!this.#map.has(key1)) {
            this.#map.set(key1, new Map());
        }
        this.#map.get(key1).set(key2, value);
        return this;
    }
    get size() {
        let size = 0;
        for (const [, m] of this.#map) {
            size += m.size;
        }
        return size;
    }
    [Symbol.iterator] = () => {
        const iterator1 = this.#map.entries();
        let iterator2 = null;
        let current1;
        const next = () => {
            if (iterator2 == null) {
                current1 = iterator1.next();
                if (current1.done) {
                    return { done: true };
                }
                iterator2 = current1.value[1].entries();
            }
            const current2 = iterator2.next();
            if (current2.done) {
                iterator2 = null;
                return next();
            }
            return { value: [current1.value[0], current2.value[0], current2.value[1]], done: false };
        };
        return {
            next: next,
            [Symbol.iterator]() {
                return this;
            },
        };
    };
}

let messages;
function messageOnce(level, message, max) {
    if (!messages) {
        messages = new Map2();
    }
    if (!messages.has(level, message)) {
        messages.set(level, message, 0);
    }
    const newCount = messages.get(level, message) + 1;
    messages.set(level, message, newCount);
    if (newCount <= max) {
        console[level](message);
    }
}
function errorOnce(message, max = 1) {
    messageOnce('error', message, max);
}

/**
 * Set2 holds a key-key pair using an underlying Set
 * Any value can be used as either keys
 */
class Set2 {
    #map = new Map();
    clear() {
        this.#map.clear();
    }
    delete(key1, key2) {
        return this.#map.get(key1)?.delete(key2) ?? false;
    }
    forEach(callbackfn, thisArg) {
        this.#map.forEach((value, key1) => {
            value.forEach((key2) => callbackfn.call(thisArg, key1, key2, this));
        });
    }
    getMap() {
        return this.#map;
    }
    getSubSet(key1) {
        return this.#map.get(key1);
    }
    has(key1, key2) {
        return this.#map.get(key1)?.has(key2) ?? false;
    }
    add(key1, key2) {
        if (!this.#map.has(key1)) {
            this.#map.set(key1, new Set());
        }
        this.#map.get(key1).add(key2);
        return this;
    }
    get size() {
        let size = 0;
        for (const [, m] of this.#map) {
            size += m.size;
        }
        return size;
    }
    [Symbol.iterator] = () => {
        const iterator1 = this.#map.entries();
        let iterator2 = null;
        let current1;
        const next = () => {
            if (iterator2 == null) {
                current1 = iterator1.next();
                if (current1.done) {
                    return { done: true };
                }
                iterator2 = current1.value[1].keys();
            }
            const current2 = iterator2.next();
            if (current2.done) {
                iterator2 = null;
                return next();
            }
            return { value: [current1.value[0], current2.value], done: false };
        };
        return {
            next: next,
            [Symbol.iterator]() {
                return this;
            },
        };
    };
}

class BugReporter {
    static #eventTarget = new EventTarget();
    static #dispatched = new Set2();
    static addEventListener(type, callback, options) {
        this.#eventTarget.addEventListener(type, callback, options);
    }
    static removeEventListener(type, callback, options) {
        this.#eventTarget.removeEventListener(type, callback, options);
    }
    static reportBug(severity, message) {
        if (this.#dispatched.has(severity, message)) {
            return;
        }
        this.#dispatched.add(severity, message);
        this.#eventTarget.dispatchEvent(new CustomEvent('report', {
            detail: {
                severity,
                message,
            },
        }));
    }
}

/**
 * The purpose of this class is to circumvent the bug below
 * Extend MyEventTarget instead of EventTarget
 * https://bugzilla.mozilla.org/show_bug.cgi?id=1473306
 */
class MyEventTarget {
    #eventTarget = new EventTarget();
    addEventListener(type, callback, options) {
        this.#eventTarget.addEventListener(type, callback, options);
    }
    dispatchEvent(event) {
        return this.#eventTarget.dispatchEvent(event);
    }
    removeEventListener(type, callback, options) {
        this.#eventTarget.removeEventListener(type, callback, options);
    }
    getEventTarget() {
        return this.#eventTarget;
    }
}

class Item {
    data;
    next = null;
    constructor(data) {
        this.data = data;
    }
}

/**
 * Static version of MyEventTarget
 */
class StaticEventTarget {
    static eventTarget = new EventTarget();
    static addEventListener(type, callback, options) {
        this.eventTarget.addEventListener(type, callback, options);
    }
    static dispatchEvent(event) {
        return this.eventTarget.dispatchEvent(event);
    }
    static removeEventListener(type, callback, options) {
        this.eventTarget.removeEventListener(type, callback, options);
    }
}

class Dmx {
    root = null;
    format = '';
    version = 0;
    constructor(format = '', version = 0) {
        this.format = format;
        this.version = version;
    }
}

var DmxAttributeType;
(function (DmxAttributeType) {
    // TODO: check values
    DmxAttributeType[DmxAttributeType["Unknown"] = 0] = "Unknown";
    DmxAttributeType[DmxAttributeType["Element"] = 1] = "Element";
    DmxAttributeType[DmxAttributeType["Integer"] = 2] = "Integer";
    DmxAttributeType[DmxAttributeType["Float"] = 3] = "Float";
    DmxAttributeType[DmxAttributeType["Boolean"] = 4] = "Boolean";
    DmxAttributeType[DmxAttributeType["String"] = 5] = "String";
    DmxAttributeType[DmxAttributeType["Binary"] = 6] = "Binary";
    DmxAttributeType[DmxAttributeType["Time"] = 7] = "Time";
    DmxAttributeType[DmxAttributeType["Color"] = 8] = "Color";
    DmxAttributeType[DmxAttributeType["Vec2"] = 9] = "Vec2";
    DmxAttributeType[DmxAttributeType["Vec3"] = 10] = "Vec3";
    DmxAttributeType[DmxAttributeType["Vec4"] = 11] = "Vec4";
    DmxAttributeType[DmxAttributeType["QAngle"] = 12] = "QAngle";
    DmxAttributeType[DmxAttributeType["Quaternion"] = 13] = "Quaternion";
    DmxAttributeType[DmxAttributeType["VMatrix"] = 14] = "VMatrix";
    DmxAttributeType[DmxAttributeType["ElementArray"] = 15] = "ElementArray";
    DmxAttributeType[DmxAttributeType["IntegerArray"] = 16] = "IntegerArray";
    DmxAttributeType[DmxAttributeType["FloatArray"] = 17] = "FloatArray";
    DmxAttributeType[DmxAttributeType["BooleanArray"] = 18] = "BooleanArray";
    DmxAttributeType[DmxAttributeType["StringArray"] = 19] = "StringArray";
    DmxAttributeType[DmxAttributeType["BinaryArray"] = 20] = "BinaryArray";
    DmxAttributeType[DmxAttributeType["TimeArray"] = 21] = "TimeArray";
    DmxAttributeType[DmxAttributeType["ColorArray"] = 22] = "ColorArray";
    DmxAttributeType[DmxAttributeType["Vec2Array"] = 23] = "Vec2Array";
    DmxAttributeType[DmxAttributeType["Vec3Array"] = 24] = "Vec3Array";
    DmxAttributeType[DmxAttributeType["Vec4Array"] = 25] = "Vec4Array";
    DmxAttributeType[DmxAttributeType["QAngleArray"] = 26] = "QAngleArray";
    DmxAttributeType[DmxAttributeType["QuaternionArray"] = 27] = "QuaternionArray";
    DmxAttributeType[DmxAttributeType["VMatrixArray"] = 28] = "VMatrixArray";
})(DmxAttributeType || (DmxAttributeType = {}));
class DmxAttribute {
    type;
    value;
    constructor(type, value) {
        this.type = type;
        this.value = value;
    }
}

class DmxElement {
    id;
    class;
    name;
    attributes = new Map;
    constructor(id, clas, name) {
        this.id = id;
        this.class = clas;
        this.name = name;
    }
    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }
    addAttribute(name, attribute) {
        this.attributes.set(name, attribute);
    }
    addElementAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Element, value));
    }
    addIntegerAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Integer, value));
    }
    addFloatAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Float, value));
    }
    addBooleanAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Boolean, value));
    }
    addStringAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.String, value));
    }
    addBinaryAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Binary, value));
    }
    addTimeAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Time, value));
    }
    addColorAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Color, value));
    }
    addVec2Attribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Vec2, value));
    }
    addVec3Attribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Vec3, value));
    }
    addVec4Attribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Vec4, value));
    }
    addQAngleAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.QAngle, value));
    }
    addQuaternionAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Quaternion, value));
    }
    addVMatrixAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.VMatrix, value));
    }
    // Start of arrays
    addElementArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.ElementArray, value));
    }
    addIntegerArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.IntegerArray, value));
    }
    addFloatArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.FloatArray, value));
    }
    addBooleanArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.BooleanArray, value));
    }
    addStringArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.StringArray, value));
    }
    addBinaryArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.BinaryArray, value));
    }
    addTimeArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.TimeArray, value));
    }
    addColorArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.ColorArray, value));
    }
    addVec2ArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Vec2Array, value));
    }
    addVec3ArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Vec3Array, value));
    }
    addVec4ArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.Vec4Array, value));
    }
    addQAngleArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.QAngleArray, value));
    }
    addQuaternionArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.QuaternionArray, value));
    }
    addVMatrixArrayAttribute(name, value) {
        this.attributes.set(name, new DmxAttribute(DmxAttributeType.VMatrixArray, value));
    }
}

const dataSize = [
    0, 4, 4, 4, 1, 0, 0, 4, 4, 8, 12, 16, 12, 16, 64,
    4, 4, 4, 1, 0, 0, 4, 4, 8, 12, 16, 12, 16, 64,
];
function unserializeDmxSync(content) {
    return unserialize(new BinaryReader(content));
}
function unserialize(reader) {
    const str = reader.getString(Math.min(1000, reader.byteLength));
    let startOffset = str.indexOf('-->');
    if (startOffset === 0) {
        return null;
    }
    startOffset += 5;
    const result = /<!-- dmx encoding (.+) (\d+) format (.+) (\d+) -->/.exec(str.substring(0, startOffset));
    if (!result || result?.length < 5) {
        return null;
    }
    const dmx = new Dmx(result[3], Number(result[4]));
    const encodingVersion = Number(result[2]);
    if (result[1] == 'binary') {
        return unserializeBinary({
            dmx,
            reader,
            encodingVersion,
            elements: [],
            strings: [],
        }, startOffset);
    }
    else {
        return unserializeText();
    }
}
function unserializeBinary(context, startOffset) {
    unserializeHeader(context, startOffset);
    return context.dmx;
}
function unserializeHeader(context, startOffset) {
    const reader = context.reader;
    reader.seek(startOffset);
    let nStrings = 0;
    let nElements = 0;
    if (context.encodingVersion < 5) {
        nStrings = reader.getUint16();
    }
    else {
        nStrings = reader.getUint32();
    }
    for (let i = 0; i < nStrings; ++i) {
        context.strings.push(reader.getNullString());
    }
    nElements = reader.getUint32();
    context.elements = new Array(nElements);
    const elements = context.elements;
    for (let i = 0; i < nElements; i++) {
        elements[i] = unserializeElement(context);
    }
    for (let i = 0; i < nElements; i++) {
        const nAttributes = context.reader.getUint32();
        for (let j = 0; j < nAttributes; ++j) {
            unserializeAttribute(context, elements[i]);
        }
    }
    context.dmx.root = elements[0] ?? null;
    return;
}
function unserializeElement(context) {
    const reader = context.reader;
    let type;
    let name;
    if (context.encodingVersion < 5) {
        type = getString(context, reader.getUint16());
    }
    else {
        type = getString(context, reader.getUint32());
    }
    if (context.encodingVersion < 5) {
        name = reader.getNullString();
    }
    else {
        name = getString(context, reader.getUint32());
    }
    const element = new DmxElement(guidToString(reader.getBytes(16)), type, name);
    return element;
}
/*
function unserializeAttributes(context: UnserializeContext, element: DmxElement): void {
    const nAttributes = context.reader.getUint32();
    for (let i = 0; i < nAttributes; ++i) {
        attributes.push(this.#parseAttribute(reader, pcf));
    }
}
*/
function unserializeAttribute(context, element) {
    const reader = context.reader;
    let typeName;
    let type;
    let value;
    if (context.encodingVersion < 5) {
        typeName = getString(context, reader.getUint16());
    }
    else {
        typeName = getString(context, reader.getUint32());
    }
    type = reader.getUint8();
    if (type > 14) {
        value = unserializeArray(context, type);
    }
    else {
        value = unserializeValue(context, type);
    }
    element.addAttribute(typeName, new DmxAttribute(type, value));
}
function unserializeArray(context, type) {
    const valuesCount = context.reader.getUint32();
    const value = new Array(valuesCount);
    for (let i = 0; i < valuesCount; ++i) {
        value[i] = unserializeValue(context, type);
    }
    return value;
}
function unserializeValue(context, type) {
    let size = dataSize[type];
    let value;
    const reader = context.reader;
    switch (type % 14) {
        case DmxAttributeType.Element:
            value = getElement(context, reader.getInt32());
            break;
        case DmxAttributeType.Integer:
            value = reader.getInt32();
            break;
        case DmxAttributeType.Float:
            value = reader.getFloat32();
            break;
        case DmxAttributeType.Boolean:
            value = reader.getInt8();
            break;
        case DmxAttributeType.Time:
            value = reader.getInt32() / 10000.0;
            break;
        case DmxAttributeType.Color:
            //value = {r:reader.getUint8(), g:reader.getUint8(), b:reader.getUint8(), a:reader.getUint8()};
            value = new Color({ red: reader.getUint8(), green: reader.getUint8(), blue: reader.getUint8(), alpha: reader.getUint8() });
            //value = [reader.getUint8(), reader.getUint8(), reader.getUint8(), reader.getUint8()];
            break;
        case DmxAttributeType.Vec2:
            value = vec2.fromValues(reader.getFloat32(), reader.getFloat32());
            break;
        case DmxAttributeType.Vec3:
            value = vec3.fromValues(reader.getFloat32(), reader.getFloat32(), reader.getFloat32());
            break;
        case DmxAttributeType.Vec4:
            value = vec4.fromValues(reader.getFloat32(), reader.getFloat32(), reader.getFloat32(), reader.getFloat32());
            break;
        case DmxAttributeType.Quaternion:
            value = quat.fromValues(reader.getFloat32(), reader.getFloat32(), reader.getFloat32(), reader.getFloat32());
            break;
        case DmxAttributeType.String:
            // Read string depending on attribute type:
            // - For single value, it depends on the encoding version
            // - For arrays values, it it stored as an array of null terminated strings
            if (context.encodingVersion < 5 || type > 15) {
                // Single value with encoding version < 5 or string array
                // Read a null terminated string
                value = reader.getNullString();
            }
            else {
                // Single value with encoding version >= 5
                // Read from dictionary
                value = getString(context, reader.getInt32());
            }
            break;
        case DmxAttributeType.Binary:
            size = reader.getInt32();
            reader.seek(reader.tell() + size);
            break;
        default:
            console.error('unknown type', type, 'in #parseValue', context);
            throw 'fix me';
    }
    return value;
}
function getString(context, index) {
    const s = context.strings[index];
    if (s) {
        return s;
    }
    else {
        return '';
    }
}
function getElement(context, index) {
    const e = context.elements[index];
    return e ?? null;
}
function guidToString(bytes) {
    let a = Array.from(bytes);
    // Reverse some bytes because microsoft
    a = a.slice(0, 4).reverse().concat(a.slice(4, 6).reverse()).concat(a.slice(6, 8).reverse()).concat(a.slice(8));
    return a.map((b) => ('00' + b.toString(16)).slice(-2))
        .join('')
        .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}
function unserializeText(context) {
    throw new Error('TODO');
}

async function addTF2Model(parent, path, repository, name) {
    const model = await Source1ModelManager.createInstance(repository ?? 'tf2', path, true);
    if (!model) {
        return null;
    }
    if (name) {
        model.name = name;
    }
    model.setupPickingId();
    parent?.addChild(model);
    const itemStartSeq = model.sourceModel.mdl.getSequenceById(0);
    if (itemStartSeq) {
        model.playSequence(itemStartSeq.name);
        model.setAnimation(0, itemStartSeq.name, 1);
    }
    model.frame = 0.;
    return model;
}

const TF2_REPOSITORY = 'https://tf2content.loadout.tf/';
const UNUSUALS_IMAGES_DIR = './img/unusuals/';
const MEDIC_RELEASE_DOVE_COUNT = 10;
const TF2_DOVE_MODEL = 'models/props_forest/dove';
const ENTITY_FLYING_BIRD_SPEED_MIN = 200;
const ENTITY_FLYING_BIRD_SPEED_MAX = 500;
const WORKSHOP_UGC_URL = 'https://ugc.workshop.tf/';
const WORKSHOP_UGC_IMG_PREFIX = 'https://images.steamusercontent.com/ugc/';
const WORKSHOP_URL = 'https://workshop.tf/php/workshop/getAllItems.php';
const MATERIAL_INVULN_BLU = 'models/effects/invulnfx_blue.vmt';
const MATERIAL_INVULN_RED = 'models/effects/invulnfx_red.vmt';
const MATERIAL_GOLD_RAGDOLL = 'models/player/shared/gold_player.vmt';
const MATERIAL_ICE_RAGDOLL = 'models/player/shared/ice_player.vmt';
const EFFECTS_RED = 'teamcolor_red';
const EFFECTS_BLU = 'teamcolor_blue';
const FIRST_LEGACY_WARPAINT = 15000;
const LAST_LEGACY_WARPAINT = 15158;

class Tf2LoadoutController {
    static #eventTarget = new EventTarget();
    static addEventListener(type, callback, options) {
        this.#eventTarget.addEventListener(type, callback, options);
    }
    static dispatchEvent(type, options) {
        return this.#eventTarget.dispatchEvent(new CustomEvent(type, options));
    }
    static removeEventListener(type, callback, options) {
        this.#eventTarget.removeEventListener(type, callback, options);
    }
}
var ItemFilterAttribute;
(function (ItemFilterAttribute) {
    ItemFilterAttribute[ItemFilterAttribute["Name"] = 0] = "Name";
    ItemFilterAttribute[ItemFilterAttribute["Selected"] = 1] = "Selected";
    ItemFilterAttribute[ItemFilterAttribute["Workshop"] = 2] = "Workshop";
    ItemFilterAttribute[ItemFilterAttribute["SfmWorkshop"] = 3] = "SfmWorkshop";
    ItemFilterAttribute[ItemFilterAttribute["SfmUniverse"] = 4] = "SfmUniverse";
    ItemFilterAttribute[ItemFilterAttribute["SfmModel"] = 5] = "SfmModel";
    ItemFilterAttribute[ItemFilterAttribute["HideConflict"] = 6] = "HideConflict";
    ItemFilterAttribute[ItemFilterAttribute["TournamentMedals"] = 7] = "TournamentMedals";
    ItemFilterAttribute[ItemFilterAttribute["ShowMultiClass"] = 8] = "ShowMultiClass";
    ItemFilterAttribute[ItemFilterAttribute["ShowOneClass"] = 9] = "ShowOneClass";
    ItemFilterAttribute[ItemFilterAttribute["ShowAllClass"] = 10] = "ShowAllClass";
    ItemFilterAttribute[ItemFilterAttribute["DoNotFilterPerClass"] = 11] = "DoNotFilterPerClass";
    ItemFilterAttribute[ItemFilterAttribute["Paintable"] = 12] = "Paintable";
    ItemFilterAttribute[ItemFilterAttribute["Warpaintable"] = 13] = "Warpaintable";
    ItemFilterAttribute[ItemFilterAttribute["Halloween"] = 14] = "Halloween";
    ItemFilterAttribute[ItemFilterAttribute["DisplayMedals"] = 15] = "DisplayMedals";
    ItemFilterAttribute[ItemFilterAttribute["DisplayWeapons"] = 16] = "DisplayWeapons";
    ItemFilterAttribute[ItemFilterAttribute["DisplayCosmetics"] = 17] = "DisplayCosmetics";
    ItemFilterAttribute[ItemFilterAttribute["DisplayTaunts"] = 18] = "DisplayTaunts";
    ItemFilterAttribute[ItemFilterAttribute["Collection"] = 19] = "Collection";
})(ItemFilterAttribute || (ItemFilterAttribute = {}));

const COMMUNITY_SPARKLE_EFFECT = 4;
const COIN_SPIN_EFFECT = 406;
const weaponEffects = new Map([
    [701, ['hot', 'Hot']],
    [702, ['isotope', 'Isotope']],
    [703, ['cool', 'Cool']],
    [704, ['energyorb', 'Energy orb']],
    [COMMUNITY_SPARKLE_EFFECT, ['community_sparkle', 'Community Sparkle']],
]);
class Effect {
    template;
    name = '';
    system = null;
    attachment;
    offset = vec3.create();
    killstreakColor;
    constructor(template) {
        this.template = template;
    }
    getId() {
        return this.template.id;
    }
    getType() {
        return this.template.type;
    }
}

var EffectType;
(function (EffectType) {
    EffectType["Cosmetic"] = "cosmetic_unusual_effects";
    EffectType["Killstreak"] = "killstreak_eyeglows";
    EffectType["Taunt"] = "taunt_unusual_effects";
    EffectType["Weapon"] = "weapon_unusual_effects";
    EffectType["Other"] = "other_particles";
})(EffectType || (EffectType = {}));
class EffectTemplate {
    id;
    type;
    //#type: EffectType;
    #definition;
    constructor(type, id, definition) {
        this.id = id;
        this.type = type;
        this.#definition = definition;
    }
    /*
    getType(): EffectType {
        return this.#type;
    }
    */
    getName() {
        return this.#definition.name ?? '';
    }
    getSystem() {
        return this.#definition.system;
    }
    isTeamColored() {
        const system = this.getSystem();
        return system.includes('_teamcolor_red') || system.includes('_teamcolor_blue');
    }
    getImage() {
        return `${UNUSUALS_IMAGES_DIR}${this.getSystem()}.webp`;
    }
    getAttachment() {
        return this.#definition.attachment ?? '';
    }
}

var Team;
(function (Team) {
    Team[Team["None"] = -1] = "None";
    Team[Team["Red"] = 0] = "Red";
    Team[Team["Blu"] = 1] = "Blu";
})(Team || (Team = {}));
var Panel;
(function (Panel) {
    Panel["None"] = "none";
    Panel["Items"] = "items";
    Panel["Printful"] = "printful";
    Panel["Options"] = "options";
    Panel["Effects"] = "effects";
    Panel["Presets"] = "presets";
    Panel["Paints"] = "paints";
    Panel["Sheens"] = "sheens";
    Panel["WeaponEffects"] = "weaponeffects";
    Panel["Warpaints"] = "warpaints";
    Panel["Flexes"] = "flexes";
    Panel["SfmRepositories"] = "sfmrepositories";
})(Panel || (Panel = {}));

const closeSVG = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>';

var panelCSS = ":host {\n\tdisplay: flex;\n\tflex: 1;\n\tflex-direction: column;\n\t/*flex: 0 0 auto;*/\n\tbox-sizing: border-box;\n\tpointer-events: all;\n\tposition: relative;\n\tbox-sizing: border-box;\n\n\tmax-width: 100%;\n\tmax-height: 100%;\n\n\t--header-bg-color: var(--harmony-panel-header-bg-color, var(--main-bg-color-dark, black));\n\t--content-bg-color: var(--harmony-panel-content-bg-color, var(--main-bg-color-dark, black));\n\t--border-color: var(--harmony-panel-border-color, var(--text-primary, white));\n\n\t--resize-bar-size: 0.5rem;\n\t--layout: column;\n}\n\n/* Prevent child panel header to appear for tabs layout */\n@container style(--layout: tabs) {\n\t:host {\n\t\t--display-header: none;\n\t}\n}\n\n@container style(--layout: column) {\n\t:host {\n\t\t--display-header: initial;\n\t}\n}\n\n@container style(--layout: row) {\n\t:host {\n\t\t--display-header: initial;\n\t}\n}\n\n:host(.collapsed) {\n\tflex: 0 0 auto;\n}\n\n.harmony-panel-row,\n:host(.harmony-panel-row) {\n\t--layout: row;\n}\n\n.harmony-panel-row>harmony-panel {\n\theight: 100%;\n}\n\n.harmony-panel-column,\n:host(.harmony-panel-column) {\n\t--layout: column;\n}\n\n.harmony-panel-tabs,\n:host(.harmony-panel-tabs) {\n\t--layout: tabs;\n}\n\n.harmony-panel-column>harmony-panel {\n\twidth: 100%;\n}\n\n.harmony-panel-splitter {\n\tdisplay: none;\n\tflex: 0 0 10px;\n\tbackground-color: red;\n}\n\n.header {\n\tcursor: pointer;\n\tfont-size: 1.5em;\n\tpadding: 0.25rem;\n\toverflow: hidden;\n\tflex: 0 0 2rem;\n\tbackground-color: var(--header-bg-color);\n\tdisplay: var(--display-header, flex);\n\talign-items: center;\n\tdisplay: flex;\n\talign-items: center;\n}\n\n.header-title {\n\tflex: 1;\n}\n\n.header-close {\n\tdisplay: flex;\n}\n\n.header.hidden {\n\tdisplay: var(--harmony-panel-display-headers, none);\n}\n\n.content {\n\twidth: 100%;\n\tbox-sizing: border-box;\n\tbackground-color: var(--content-bg-color);\n\tflex: 1;\n\toverflow: hidden;\n\tdisplay: flex;\n\tposition: relative;\n\tflex-direction: var(--layout, column);\n}\n\n.header.target {\n\tbackground: blue;\n}\n\n.content.target {\n\tbackground: blue;\n}\n\n[collapsible='1']>.title::after,\n:host(.collapsible)>.title::after {\n\tcontent: \"-\";\n\tright: 0.25rem;\n\tposition: absolute;\n}\n\n[collapsed='1']>.title::after,\n:host(.collapsed)>.title::after {\n\tcontent: \"+\";\n}\n\n.panel-resize {\n\tpointer-events: none;\n\tdisplay: none;\n\ttop: 0;\n\tleft: 0;\n\twidth: 100%;\n\theight: 100%;\n\tposition: absolute;\n}\n\n.panel-resize>* {\n\tpointer-events: all;\n\tposition: absolute;\n}\n\n.panel-resize>.side {\n\tinset: calc(var(--resize-bar-size) * 0.5);\n}\n\n.panel-resize>.corner {\n\theight: var(--resize-bar-size);\n\twidth: var(--resize-bar-size);\n}\n\n.panel-resize>.top,\n.panel-resize>.bottom {\n\theight: var(--resize-bar-size);\n\twidth: auto;\n\tcursor: ns-resize;\n}\n\n.panel-resize>.right,\n.panel-resize>.left {\n\twidth: var(--resize-bar-size);\n\theight: auto;\n\tcursor: ew-resize;\n}\n\n.panel-resize>.top {\n\ttop: calc(var(--resize-bar-size) * -0.5);\n\tbottom: unset;\n}\n\n.panel-resize>.bottom {\n\ttop: unset;\n\tbottom: calc(var(--resize-bar-size) * -0.5);\n}\n\n.panel-resize>.left {\n\tleft: calc(var(--resize-bar-size) * -0.5);\n\tright: unset;\n}\n\n.panel-resize>.right {\n\tleft: unset;\n\tright: calc(var(--resize-bar-size) * -0.5);\n}\n\n.panel-resize>.top_right {\n\ttop: calc(var(--resize-bar-size) * -0.5);\n\tright: calc(var(--resize-bar-size) * -0.5);\n\tcursor: ne-resize;\n}\n\n.panel-resize>.bottom_right {\n\tbottom: calc(var(--resize-bar-size) * -0.5);\n\tright: calc(var(--resize-bar-size) * -0.5);\n\tcursor: se-resize;\n}\n\n.panel-resize>.top_left {\n\ttop: calc(var(--resize-bar-size) * -0.5);\n\tleft: calc(var(--resize-bar-size) * -0.5);\n\tcursor: nw-resize;\n}\n\n.panel-resize>.bottom_left {\n\tbottom: calc(var(--resize-bar-size) * -0.5);\n\tleft: calc(var(--resize-bar-size) * -0.5);\n\tcursor: sw-resize;\n}\n\n:host(.floating) {\n\tz-index: 10000;\n\tborder: 0.1rem solid var(--border-color);\n}\n\n:host(.floating) .panel-resize {\n\tdisplay: initial;\n}\n";

async function documentStyle(cssText) {
    return await shadowRootStyle(document, cssText);
}
async function shadowRootStyle(shadowRoot, cssText) {
    const sheet = new CSSStyleSheet;
    await sheet.replace(cssText);
    shadowRoot.adoptedStyleSheets.push(sheet);
}

const ET = new EventTarget();

const I18N_DELAY_BEFORE_REFRESH = 100;
var I18nEvents;
(function (I18nEvents) {
    I18nEvents["LangChanged"] = "langchanged";
    I18nEvents["TranslationsUpdated"] = "translationsupdated";
    I18nEvents["Any"] = "*";
})(I18nEvents || (I18nEvents = {}));
const targets = ['innerHTML', 'innerText', 'placeholder', 'title', 'label'];
const I18nElements = new Map();
function AddI18nElement(element, descriptor) {
    if (typeof descriptor == 'string') {
        descriptor = { innerText: descriptor };
    }
    const existing = I18nElements.get(element);
    if (existing) {
        if (descriptor === null) {
            I18nElements.delete(element);
            return;
        }
        for (const target of targets) {
            const desc = descriptor[target];
            if (desc === null) {
                delete existing[target];
            }
            else if (desc !== undefined) {
                existing[target] = desc;
            }
        }
        if (descriptor.values) {
            if (!existing.values) {
                existing.values = {};
            }
            for (const name in descriptor.values) {
                existing.values[name] = descriptor.values[name];
            }
        }
    }
    else {
        if (descriptor) {
            I18nElements.set(element, descriptor);
        }
    }
}
class I18n {
    static #started = false;
    static #lang = 'english';
    static #defaultLang = 'english';
    static #translations = new Map();
    static #executing = false;
    static #refreshTimeout;
    static #observerConfig = { childList: true, subtree: true, attributeFilter: ['i18n', 'data-i18n-json', 'data-i18n-values'] };
    static #observer;
    static #observed = new Set();
    static #eventTarget = new EventTarget();
    static #missingKeys;
    static start() {
        if (this.#started) {
            return;
        }
        this.#started = true;
        this.observeElement(document.body);
        ET.addEventListener('created', (event) => this.#processElement2(event.detail));
        ET.addEventListener('updated', (event) => this.#processElement2(event.detail));
    }
    static setOptions(options) {
        if (options.translations) {
            for (const translation of options.translations) {
                this.#addTranslation(translation);
            }
            this.#eventTarget.dispatchEvent(new CustomEvent(I18nEvents.TranslationsUpdated));
            this.#eventTarget.dispatchEvent(new CustomEvent(I18nEvents.Any));
        }
        this.i18n();
    }
    /**
     * Add a translation
     * @param translation The tranaslation to add
     * @param overwrite If an existing translation for the same language and the same string, should we keep or overwrite that string
     */
    static addTranslation(translation, overwrite = false) {
        this.#addTranslation(translation, overwrite);
        if (translation.lang == this.#lang) {
            this.i18n();
        }
    }
    static #addTranslation(translation, overwrite = false) {
        const existing = this.#translations.get(translation.lang);
        if (!existing) {
            this.#translations.set(translation.lang, translation);
            return;
        }
        for (const key in translation.strings) {
            if (existing.strings[key] === undefined || overwrite) {
                existing.strings[key] = translation.strings[key];
            }
        }
        if (translation.authors && !existing.authors) {
            existing.authors = [];
        }
        for (const author in translation.authors) {
            if (!existing.authors?.includes(author)) {
                existing.authors?.push(author);
            }
        }
    }
    static #initObserver() {
        if (this.#observer) {
            return;
        }
        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLElement) {
                            this.updateElement(node);
                        }
                    }
                }
                else if (mutation.type === 'attributes') {
                    this.updateElement(mutation.target);
                }
            }
        };
        this.#observer = new MutationObserver(callback);
    }
    static observeElement(element) {
        this.#observed.add(element);
        this.#initObserver();
        this.#observer?.observe(element, this.#observerConfig);
        this.updateElement(element);
    }
    static #processList(parentNode, className, attribute, subElement) {
        const elements = parentNode.querySelectorAll('.' + className);
        if (parentNode.classList?.contains(className)) {
            this.#processElement(parentNode, attribute, subElement);
        }
        for (const element of elements) {
            this.#processElement(element, attribute, subElement);
        }
    }
    static #processJSON(parentNode) {
        const className = 'i18n';
        const elements = parentNode.querySelectorAll('.' + className);
        if (parentNode.classList?.contains(className)) {
            this.#processElementJSON(parentNode);
        }
        for (const element of elements) {
            this.#processElementJSON(element);
        }
    }
    static #processElement(htmlElement, attribute, subElement) {
        const dataLabel = htmlElement.getAttribute(attribute);
        if (dataLabel) {
            htmlElement[subElement] = this.getString(dataLabel);
        }
    }
    // TODO: merge with function above
    static #processElement2(htmlElement) {
        const descriptor = I18nElements.get(htmlElement);
        if (descriptor) {
            const values = descriptor.values ?? {};
            for (const target of targets) {
                const desc = descriptor[target];
                if (desc && (htmlElement[target] !== undefined)) {
                    htmlElement[target] = this.formatString(desc, values);
                }
            }
        }
    }
    static #processElementJSON(htmlElement) {
        const str = htmlElement.getAttribute('data-i18n-json');
        if (!str) {
            return;
        }
        const dataJSON = JSON.parse(str);
        if (!dataJSON) {
            return;
        }
        let valuesJSON;
        const values = htmlElement.getAttribute('data-i18n-values');
        if (values) {
            valuesJSON = JSON.parse(values);
        }
        else {
            valuesJSON = dataJSON.values;
        }
        const innerHTML = dataJSON.innerHTML;
        if (innerHTML) {
            htmlElement.innerHTML = this.formatString(innerHTML, valuesJSON);
        }
        const innerText = dataJSON.innerText;
        if (innerText && (htmlElement.innerText !== undefined)) {
            htmlElement.innerText = this.formatString(innerText, valuesJSON);
        }
    }
    static i18n() {
        if (!this.#refreshTimeout) {
            this.#refreshTimeout = setTimeout(() => this.#i18n(), I18N_DELAY_BEFORE_REFRESH);
        }
    }
    static #i18n() {
        this.#refreshTimeout = null;
        if (this.#executing) {
            return;
        }
        this.#executing = true;
        for (const element of this.#observed) {
            this.#processList(element, 'i18n', 'data-i18n', 'innerHTML');
            this.#processJSON(element);
        }
        for (const [element] of I18nElements) {
            this.#processElement2(element);
        }
        this.#executing = false;
        return;
    }
    static updateElement(htmlElement) {
        this.#processList(htmlElement, 'i18n', 'data-i18n', 'innerHTML');
        this.#processJSON(htmlElement);
    }
    /**
     * @deprecated use setLang() instead
     */
    static set lang(lang) {
        throw new Error('Deprecated, use setLang() instead');
    }
    static setLang(lang) {
        if (this.#lang != lang) {
            const oldLang = this.#lang;
            this.#lang = lang;
            this.#eventTarget.dispatchEvent(new CustomEvent(I18nEvents.LangChanged, { detail: { oldLang: oldLang, newLang: lang } }));
            this.#eventTarget.dispatchEvent(new CustomEvent(I18nEvents.Any));
            this.i18n();
        }
    }
    static setDefaultLang(defaultLang) {
        this.#defaultLang = defaultLang;
    }
    static addEventListener(type, callback, options) {
        this.#eventTarget.addEventListener(type, callback, options);
    }
    static getString(s) {
        const s2 = this.#translations.get(this.#lang)?.strings?.[s] ?? this.#translations.get(this.#defaultLang)?.strings?.[s];
        if (typeof s2 == 'string') {
            return s2;
        }
        else {
            if (!this.#missingKeys) {
                this.#missingKeys = new Set();
                console.warn('Missing translation for the following keys', this.#missingKeys);
            }
            this.#missingKeys.add(s);
            return s;
        }
    }
    static formatString(s, values) {
        let str = this.getString(s);
        for (const key in values) {
            str = str.replace(new RegExp("\\${" + key + "\\}", "gi"), String(values[key]));
            str = str.replace(new RegExp("\\#{" + key + "\\}", "gi"), this.getString(String(values[key])));
        }
        return str;
    }
    /**
     * @deprecated use getAuthors() instead
     */
    static get authors() {
        throw new Error('Deprecated, use getAuthors() instead');
    }
    static getAuthors() {
        return this.#translations.get(this.#lang)?.authors ?? [];
    }
    static setValue(element, name, value) {
        if (!element) {
            return;
        }
        const i18n = {};
        i18n[name] = value;
        AddI18nElement(element, { values: i18n });
        this.#processElement2(element);
    }
}

var helpCSS = ":host {\n\tposition: absolute;\n\theight: 100%;\n\twidth: 100%;\n\ttop: 0;\n\tleft: 0;\n\tpointer-events: none;\n\tz-index: 10000;\n\tfont-size: var(--harmony-help-font-size, 2rem);\n}\n\ndiv {\n\tposition: fixed;\n\tleft: 20%;\n\ttop: 5%;\n\tmax-height: 30%;\n\twidth: 60%;\n\ttext-align: center;\n\tbackground-color: #772222;\n\tborder-radius: 1rem;\n\toverflow: auto;\n\tz-index: 10;\n\tfont-family: tf2build, Verdana, sans-serif;\n\tpadding: 1rem;\n\tbox-sizing: border-box;\n}\n\n.help.html {\n\ttext-align: unset;\n\tmax-height: 90%;\n}\n";

class Help {
    static #html;
    static #shadowRoot;
    static #elements = new Map();
    static {
        document.body.addEventListener('keydown', (event) => this.#handleKeyDown(event));
        document.body.addEventListener('keyup', (event) => this.#handleKeyUp(event));
        this.#shadowRoot = createShadowRoot('div', {
            parent: document.body,
            hidden: true,
            childs: [
                this.#html = createElement('div', {
                    class: 'help',
                    hidden: true,
                }),
            ],
        });
        void shadowRootStyle(this.#shadowRoot, helpCSS);
    }
    static #handleKeyDown(event) {
        if (event.key == 'F1' && !event.repeat) {
            event.preventDefault();
            show(this.#shadowRoot);
        }
    }
    static #handleKeyUp(event) {
        if (event.key == 'F1') {
            hide(this.#shadowRoot);
        }
    }
    static #handleMouseOver(element) {
        const i18n = this.#elements.get(element);
        if (i18n) {
            this.#html.classList.remove('html');
            if (i18n && typeof i18n !== 'string' && i18n.innerHTML) {
                this.#html.classList.add('html');
            }
            updateElement(this.#html, {
                i18n: i18n,
            });
            show(this.#html);
        }
        else {
            hide(this.#html);
        }
    }
    static #handleMouseOut() {
        hide(this.#html);
    }
    static addElement(element, i18n) {
        if (!this.#elements.has(element)) {
            element.addEventListener('mouseover', () => Help.#handleMouseOver(element));
            element.addEventListener('mouseout', () => Help.#handleMouseOut());
        }
        this.#elements.set(element, i18n);
    }
}
function createElement(tagName, options) {
    const element = document.createElement(tagName);
    createElementOptions(element, options);
    ET.dispatchEvent(new CustomEvent('created', { detail: element }));
    return element;
}
function createShadowRoot(tagName, options, shadowOptions) {
    const element = document.createElement(tagName);
    const shadowRoot = element.attachShadow({
        clonable: shadowOptions?.clonable,
        customElementRegistry: shadowOptions?.customElementRegistry,
        delegatesFocus: shadowOptions?.delegatesFocus,
        mode: shadowOptions?.mode ?? 'closed',
        serializable: shadowOptions?.serializable,
        slotAssignment: shadowOptions?.slotAssignment,
    });
    createElementOptions(element, options, shadowRoot);
    return shadowRoot;
}
function updateElement(element, options) {
    if (!element) {
        return;
    }
    createElementOptions(element, options);
    ET.dispatchEvent(new CustomEvent('updated', { detail: element }));
    return element;
}
function updateShadowRoot(shadowRoot, options) {
    if (!shadowRoot) {
        return;
    }
    createElementOptions(shadowRoot.host, options, shadowRoot);
    ET.dispatchEvent(new CustomEvent('updated', { detail: shadowRoot }));
    return shadowRoot;
}
function append(element, child) {
    if (child === null || child === undefined) {
        return;
    }
    if (child instanceof ShadowRoot) {
        element.append(child.host);
    }
    else {
        element.append(child);
    }
}
function createElementOptions(element, options, shadowRoot) {
    if (options) {
        for (const optionName in options) {
            const optionValue = options[optionName];
            if (optionName.startsWith('$')) {
                element.addEventListener(optionName.substring(1), optionValue);
                continue;
            }
            if (optionName.startsWith('@')) {
                element.setAttribute(optionName.substring(1), optionValue);
                continue;
            }
            switch (optionName) {
                case 'id':
                    element.id = optionValue;
                    break;
                case 'class':
                    element.classList.add(...optionValue.split(' ').filter((n) => n));
                    break;
                case 'i18n':
                    if (element.setTitleI18n) {
                        element.setTitleI18n(optionValue);
                    }
                    else {
                        AddI18nElement(element, optionValue);
                    }
                    break;
                case 'parent':
                    optionValue?.append(element);
                    break;
                case 'after':
                    optionValue?.after(element);
                    break;
                case 'before':
                    optionValue?.before(element);
                    break;
                case 'child':
                    append(shadowRoot ?? element, optionValue);
                    break;
                case 'childs':
                    optionValue.forEach((entry) => append(shadowRoot ?? element, entry));
                    break;
                case 'events':
                    for (const eventType in optionValue) {
                        const eventParams = optionValue[eventType];
                        element.addEventListener(eventType, eventParams);
                    }
                    break;
                case 'properties':
                    for (const name in optionValue) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                        element[name] = optionValue[name];
                    }
                    break;
                case 'hidden':
                    if (optionValue) {
                        hide(element);
                    }
                    break;
                case 'innerHTML':
                    (shadowRoot ?? element).innerHTML = optionValue ?? '';
                    break;
                case 'innerText':
                    element.innerText = optionValue ?? '';
                    break;
                case 'attributes':
                    for (const attributeName in optionValue) {
                        element.setAttribute(attributeName, optionValue[attributeName]);
                    }
                    break;
                case 'slot':
                    element.slot = optionValue;
                    break;
                case 'htmlFor':
                    element.htmlFor = optionValue;
                    break;
                case 'adoptStyle':
                    if (optionValue) {
                        void adoptStyle(shadowRoot ?? element, optionValue);
                    }
                    break;
                case 'adoptStyles':
                    (optionValue ?? []).forEach((entry) => {
                        void adoptStyle(shadowRoot ?? element, entry);
                    });
                    break;
                case 'adoptStyleSheet':
                    if (optionValue) {
                        adoptStyleSheet(shadowRoot ?? element, optionValue);
                    }
                    break;
                case 'adoptStyleSheets':
                    (optionValue ?? []).forEach((entry) => {
                        adoptStyleSheet(shadowRoot ?? element, entry);
                    });
                    break;
                case 'style':
                    element.style.cssText = optionValue;
                    break;
                case 'checked':
                    element.checked = optionValue;
                    break;
                case 'help':
                    Help.addElement(element, optionValue);
                    break;
                case 'elementCreated':
                    break;
                default:
                    element.setAttribute(optionName, optionValue);
                    break;
            }
        }
        options.elementCreated?.(element, shadowRoot);
    }
}
async function adoptStyle(element, cssText) {
    const sheet = new CSSStyleSheet;
    await sheet.replace(cssText);
    adoptStyleSheet(element, sheet);
}
function adoptStyleSheet(element, sheet) {
    if (element.adoptStyleSheet) {
        element.adoptStyleSheet(sheet);
    }
    else {
        if (element.adoptedStyleSheets) {
            element.adoptedStyleSheets.push(sheet);
        }
    }
}
function display(htmlElement, visible) {
    if (Array.isArray(htmlElement)) {
        for (const e of htmlElement) {
            disp(e, visible);
        }
    }
    else {
        disp(htmlElement, visible);
    }
}
function disp(htmlElement, visible) {
    if (!htmlElement) {
        return;
    }
    if (htmlElement instanceof ShadowRoot) {
        htmlElement = htmlElement.host;
    }
    if (visible) {
        htmlElement.style.display = '';
    }
    else {
        htmlElement.style.display = 'none';
    }
}
function show(htmlElement) {
    display(htmlElement, true);
}
function hide(htmlElement) {
    display(htmlElement, false);
}
let customElementRegistry;
function getCustomElementRegistry() {
    if (!customElementRegistry) {
        try {
            // As of writing, firefox doesn't support CustomElementRegistry constructor
            customElementRegistry = new CustomElementRegistry();
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        catch (e) {
            return;
        }
    }
    return customElementRegistry;
}
function defineElement(name, constructor, options) {
    if (window.customElements) {
        customElements.define(name, constructor, options);
    }
    getCustomElementRegistry()?.define(name, constructor, options);
}
function addRemoveClass(element, clas, add) {
    if (add) {
        element?.classList.add(clas);
    }
    else {
        element?.classList.remove(clas);
    }
}

var tabCSS$1 = ":host {\n\tdisplay: inline-block;\n\tbackground-color: var(--main-bg-color-bright);\n\t/*padding: 10px;*/\n\tborder: 0.1rem solid var(--harmony-ui-text-primary);\n\tborder-top: 0px;\n\tposition: relative;\n\tcolor: var(--harmony-ui-text-primary);\n\tcursor: pointer;\n\tuser-select: none;\n\tpointer-events: all;\n\tflex: 0 0;\n\ttext-align: center;\n\twhite-space: nowrap;\n\tdisplay: flex;\n\talign-items: center;\n}\n\ndiv {\n\tpadding: 0.2rem;\n}\n";

class HarmonyTab extends MyEventTarget {
    htmlElement = createElement('div', {
        $click: () => this.#click(),
    });
    #shadowRoot;
    #disabled = false;
    #active = false;
    //#header?: HTMLElement;
    #htmlHeader;
    #htmlTitle;
    #htmlClose;
    #group;
    #closable = false;
    #closed = false;
    #draggable = false;
    content;
    panel;
    constructor(params = {}) {
        super();
        this.setParams(params);
    }
    setParams(params) {
        if (params.title !== undefined) {
            this.setTitle(params.title);
        }
        if (params.titleI18n !== undefined) {
            this.setTitleI18n(params.titleI18n);
        }
        this.#draggable = params.draggable ?? false;
        this.content = params.content;
        this.panel = params.panel;
    }
    #initHTML() {
        if (this.#shadowRoot) {
            return;
        }
        this.#shadowRoot = this.htmlElement.attachShadow({ mode: 'closed' });
        I18n.observeElement(this.#shadowRoot);
        void shadowRootStyle(this.#shadowRoot, tabCSS$1);
        this.#htmlHeader = createElement('div', {
            class: 'tab',
            parent: this.#shadowRoot,
            childs: [
                this.#htmlTitle = createElement('span'),
                this.#htmlClose = createElement('span', {
                    class: 'close',
                    innerHTML: closeSVG,
                    hidden: !this.#closable,
                    $click: (event) => { event.stopPropagation(); this.close(); },
                }),
            ],
            $click: () => this.#click(),
            $contextmenu: (event) => this.#onContextMenu(event),
            $mousedown: (event) => this.#handleMouseDown(event),
        });
    }
    setTitle(title) {
        this.#initHTML();
        this.#htmlTitle.innerText = title;
        show(this.#htmlTitle);
    }
    setTitleI18n(i18n) {
        this.#initHTML();
        if (typeof i18n === 'string') {
            updateElement(this.#htmlTitle, {
                i18n,
            });
        }
        else {
            errorOnce('unhandled type ' + typeof i18n + i18n);
        }
        show(this.#htmlTitle);
    }
    setDisabled(disabled) {
        this.#disabled = disabled ? true : false;
        addRemoveClass(this.#htmlHeader, 'disabled', this.#disabled);
    }
    getDisabled() {
        return this.#disabled;
    }
    activate() {
        this.setActive(true);
    }
    close() {
        if (this.#closed) {
            return false;
        }
        if (!this.dispatchEvent(new CustomEvent('close', { cancelable: true, detail: { tab: this } }))) {
            return false;
        }
        this.#group?.closeTab(this);
        return true;
    }
    setActive(active) {
        if (this.#active != active) {
            this.#active = active;
            if (active) {
                this.dispatchEvent(new CustomEvent('activated', { detail: { tab: this } }));
            }
            else {
                this.dispatchEvent(new CustomEvent('deactivated', { detail: { tab: this } }));
            }
        }
        //display(this.htmlElement, active);
        this.#initHTML();
        addRemoveClass(this.#htmlHeader, 'activated', active);
        if (active && this.#group) {
            this.#group.activateTab(this);
        }
        display(this.content, active);
    }
    isActive() {
        return this.#active;
    }
    isClosed() {
        return this.#closed;
    }
    #click() {
        if (!this.dispatchEvent(new CustomEvent('click', { cancelable: true, detail: { tab: this } }))) {
            return;
        }
        if (!this.#disabled) {
            this.activate();
        }
    }
    #onContextMenu(event) {
        this.dispatchEvent(new CustomEvent('contextmenu', { detail: { tab: this, originalEvent: event } }));
    }
    scrollIntoView() {
        this.#initHTML();
        this.#htmlHeader.scrollIntoView();
    }
    setClosable(closable) {
        this.#closable = closable;
        display(this.#htmlClose, closable);
    }
    setGroup(group) {
        this.#group = group;
    }
    #handleMouseDown(event) {
        if (this.#draggable && event.button === 0 && this.panel) {
            // Activate this tab before dragging
            this.activate();
            this.panel.getHeader().dispatchEvent(cloneEvent(event));
        }
    }
}

var tabGroupCSS$1 = ":host>div {\n\twidth: 100%;\n\theight: 100%;\n\tdisplay: flex;\n\tflex-direction: row;\n\tposition: relative;\n\tgap: 0.1rem;\n}\n";

class HarmonyTabGroup {
    htmlElement = createElement('div');
    #shadowRoot;
    #htmlTabs;
    #tabs = new Set();
    #activeTab;
    constructor(params = {}) {
        this.setParams(params);
    }
    setParams(params) {
        if (params.adoptStyle || params.adoptStyles || params.adoptStyleSheet || params.adoptStyleSheets) {
            this.#initHTML();
            updateShadowRoot(this.#shadowRoot, {
                adoptStyle: params.adoptStyle,
                adoptStyles: params.adoptStyles,
                adoptStyleSheet: params.adoptStyleSheet,
                adoptStyleSheets: params.adoptStyleSheets,
            });
        }
    }
    #initHTML() {
        if (this.#shadowRoot) {
            return;
        }
        this.#shadowRoot = this.htmlElement.attachShadow({ mode: 'closed' });
        I18n.observeElement(this.#shadowRoot);
        void shadowRootStyle(this.#shadowRoot, tabGroupCSS$1);
        this.#htmlTabs = createElement('div', {
            parent: this.#shadowRoot,
        });
    }
    /*
    addTabs(...tabs: HarmonyTab[]): void {
        for (const tab of tabs) {
            this.#tabs.add(tab);
            this.htmlElement.append(tab.htmlElement);
        }
    }
    */
    append(...tabs) {
        this.#initHTML();
        for (const tab of tabs) {
            this.#tabs.add(tab);
            this.#htmlTabs.append(tab.htmlElement);
            tab.setActive(!this.#activeTab || this.#activeTab === tab);
            tab.setGroup(this);
        }
    }
    prepend(...tabs) {
        this.#initHTML();
        for (const tab of tabs) {
            this.#tabs.add(tab);
            this.#htmlTabs.prepend(tab.htmlElement);
            tab.setActive(!this.#activeTab || this.#activeTab === tab);
            tab.setGroup(this);
        }
    }
    addTab(tab) {
        this.#tabs.add(tab);
        if (!this.#activeTab) {
            this.#activeTab = tab;
        }
        else {
            tab.setActive(false);
        }
        tab.setGroup(this);
        this.#refresh();
    }
    getTabs() {
        return new Set(this.#tabs);
    }
    #refresh() {
        this.#initHTML();
        //this.#header.replaceChildren();
        this.#htmlTabs.replaceChildren();
        for (const tab of this.#tabs) {
            this.#htmlTabs.append(tab.htmlElement);
            //this.#content.append(tab);
            if (tab != this.#activeTab) {
                tab.setActive(false);
            }
        }
        this.#activeTab?.setActive(true);
        setTimeout(() => {
            this.#activeTab?.htmlElement.scrollIntoView();
        }, 0);
    }
    activateTab(tab) {
        if (this.#activeTab != tab) {
            this.#activeTab = tab;
            this.#refresh();
        }
    }
    closeTab(tab) {
        this.#tabs.delete(tab);
        if (this.#activeTab == tab) {
            this.#activeTab = this.#tabs.values().next().value;
        }
        this.#refresh();
    }
    closeAllTabs() {
        for (const tab of this.#tabs) {
            tab.close();
        }
    }
    clear() {
        this.#tabs.clear();
        this.#activeTab = undefined;
        this.#htmlTabs?.replaceChildren();
    }
}

var _a$1;
//const dragged = null;
let nextId$1 = 0;
//let spliter: HTMLElement = createElement('div', { class: 'harmony-panel-splitter' }) as HTMLElement;
let highlitPanel$1;
const DRAG_THRESHOLD$1 = 15;
class HarmonyPanel {
    htmlElement = createElement('div');
    isHarmonyPanel = true;
    #doOnce = true;
    #parent = null;
    #size = 1;
    #layout;
    isMovable = false;
    #collapsible = true;
    #collapsed = false;
    #closable;
    #startClosed = false;
    #dropTarget;
    customPanelId = nextId$1++;
    #htmlHeader;
    #htmlHeaderTitle;
    #htmlTabGroup;
    #htmlContent;
    #htmlResize;
    #isDummy = false;
    #shadowRoot;
    #headerVisible = false;
    #isDraggable = true;
    #floating = false;
    #floatingWidth;
    #floatingHeight;
    #childPanels = new Set;
    #title;
    #titleI18n;
    #parentTab;
    #tabIndex;
    static #dragMode = 'none';
    static #resizeX = 0;
    static #resizeY = 0;
    static #dragging = false;
    static #draggedPanel;
    static #deltaX = 0;
    static #deltaY = 0;
    static #startClientX = 0;
    static #startClientY = 0;
    static #mouseDown = false;
    static #panels = new Set;
    static #target = null;
    static #startRect;
    static {
        document.addEventListener('mousedown', (event) => _a$1.#handleDocumentMouseDown(event));
        document.addEventListener('mousemove', (event) => _a$1.#handleDocumentMouseMove(event));
        document.addEventListener('mouseup', (event) => _a$1.#handleDocumentMouseUp(event));
    }
    constructor(params = {}) {
        _a$1.#panels.add(this);
        this.setParams(params);
    }
    setParams(params) {
        this.#startClosed = params.closed ?? false;
        this.setCollapsible(params.collapsible ?? true);
        this.setCollapsed(params.collapsed ?? false);
        this.isMovable = params.movable ?? false;
        this.#closable = params.closable ?? false;
        this.#dropTarget = params.dropTarget ?? false;
        this.#tabIndex = params.tabIndex;
        this.setLayout(params.layout ?? 'row');
        if (params.floating) {
            this.setFloating(params.width, params.height);
            // If we start in floating mode, force a the presence of a header
            this.getHeader();
        }
        if (params.size !== undefined) {
            this.setSize(params.size);
        }
        if (params.title !== undefined) {
            this.setTitle(params.title);
        }
        if (params.titleI18n !== undefined) {
            this.setTitleI18n(params.titleI18n);
        }
        if (params.adoptStyle || params.adoptStyles || params.adoptStyleSheet || params.adoptStyleSheets) {
            this.#initHTML();
            updateShadowRoot(this.#shadowRoot, {
                adoptStyle: params.adoptStyle,
                adoptStyles: params.adoptStyles,
                adoptStyleSheet: params.adoptStyleSheet,
                adoptStyleSheets: params.adoptStyleSheets,
            });
        }
    }
    #initHTML() {
        if (this.#shadowRoot) {
            return;
        }
        this.#shadowRoot = this.htmlElement.attachShadow({ mode: 'closed' });
        I18n.observeElement(this.#shadowRoot);
        void shadowRootStyle(this.#shadowRoot, panelCSS);
        this.#htmlContent = createElement('div', {
            class: 'content',
            parent: this.#shadowRoot,
            ...(this.#tabIndex !== undefined && { '@tabindex': this.#tabIndex }),
        });
        display(this.#shadowRoot.host, !this.#startClosed);
        this.#htmlResize = createElement('div', {
            class: 'panel-resize',
            parent: this.#shadowRoot,
            childs: [
                createElement('div', { class: 'side top', $mousedown: (event) => this.#startResize(event, 0, -1) }),
                createElement('div', { class: 'side right', $mousedown: (event) => this.#startResize(event, 1, 0) }),
                createElement('div', { class: 'side bottom', $mousedown: (event) => this.#startResize(event, 0, 1) }),
                createElement('div', { class: 'side left', $mousedown: (event) => this.#startResize(event, -1, 0) }),
                createElement('div', { class: 'corner top_right', $mousedown: (event) => this.#startResize(event, 1, -1) }),
                createElement('div', { class: 'corner bottom_right', $mousedown: (event) => this.#startResize(event, 1, 1) }),
                createElement('div', { class: 'corner bottom_left', $mousedown: (event) => this.#startResize(event, -1, 1) }),
                createElement('div', { class: 'corner top_left', $mousedown: (event) => this.#startResize(event, -1, -1) }),
            ],
            $mousedown: (event) => this.#handleMouseDown(event),
        });
    }
    getHtml() {
        this.#initHTML();
        return this.#shadowRoot.host;
    }
    getHeader() {
        this.#initHTML();
        if (!this.#htmlHeader) {
            const childs = [
                this.#htmlHeaderTitle = createElement('div', {
                    class: 'header-title',
                }),
            ];
            if (this.#closable) {
                childs.push(createElement('span', {
                    class: 'header-close',
                    innerHTML: closeSVG,
                    $click: () => this.close(),
                }));
            }
            this.#htmlHeader = createElement('div', {
                class: 'header',
                childs,
                $dblclick: () => this.#toggleCollapse(),
                $mousedown: (event) => this.#handleMouseDown(event),
            });
        }
        this.#shadowRoot.prepend(this.#htmlHeader);
        return this.#htmlHeader;
    }
    getContent() {
        this.#initHTML();
        return this.#htmlContent;
    }
    append(...nodes) {
        this.#initHTML();
        for (const node of nodes) {
            const htmlElement = node.htmlElement;
            if (htmlElement) {
                if (node.isHarmonyPanel) {
                    this.#childPanels.add(node);
                    if (this.#layout === 'tabs') {
                        this.#addTab(node);
                    }
                }
                this.#htmlContent.append(htmlElement);
            }
            else {
                // eslint-disable-next-line prefer-rest-params
                this.#htmlContent.append(node);
            }
        }
    }
    prepend(...nodes) {
        this.#initHTML();
        for (const node of nodes) {
            const htmlElement = node.htmlElement;
            if (htmlElement) {
                if (node.isHarmonyPanel) {
                    this.#childPanels.add(node);
                    if (this.#layout === 'tabs') {
                        this.#addTab(node);
                    }
                }
                this.#htmlContent.prepend(htmlElement);
            }
            else {
                // eslint-disable-next-line prefer-rest-params
                this.#htmlContent.prepend(node);
            }
        }
    }
    /*
        appendChild(child: HTMLElement) {
            this.htmlContent.appendChild(child);
        }
    */
    /*
    get innerHTML(): string {
        return this.#htmlContent.innerHTML;
    }

    set innerHTML(innerHTML) {
        this.#htmlContent.innerHTML = innerHTML;
    }
    */
    /*
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
        if (oldValue == newValue) {
            return;
        }

        switch (name) {
            case 'panel-direction':
                this.#direction = newValue;
                break;
            case 'panel-size':
                this.size = Number(newValue);
                break;
            case 'is-movable':
                this.isMovable = toBool(newValue);
                break;
            case 'collapsible':
                this.collapsible = toBool(newValue);
                break;
            case 'collapsed':
                this.collapsed = toBool(newValue);
                break;
            case 'title':
                this.setTitle(newValue);
                break;
            case 'has-header':
                this.hasHeader = toBool(newValue);
                break;
            case 'draggable':
                this.#isDraggable = toBool(newValue);
                this.#htmlHeader.setAttribute('draggable', newValue);
                break;
            case 'hidden-title':
                if (toBool(newValue)) {
                    this.#htmlHeader.classList.add('hidden');
                } else {
                    this.#htmlHeader.classList.remove('hidden');
                }
                break;
        }
    }
    */
    /*
    static get observedAttributes(): string[] {
        return ['panel-direction', 'panel-size', 'is-movable', 'title', 'collapsible', 'collapsed', 'has-header', 'draggable', 'hidden-title'];
    }
    */
    /*
        _handleDragStart(event) {
            if (this._isMovable == false) {
                event.preventDefault();
                return;
            }
            event.stopPropagation();
            event.dataTransfer.setData('text/plain', null);
            dragged = event.target;
        }

        _handleDragOver(event) {
            if (this._isContainer != false) {
                event.preventDefault();
            }
            event.stopPropagation();
        }

        _handleDrop(event) {
            if (this._isContainer != false) {
                event.stopPropagation();
                event.preventDefault();
                if (dragged) {
                    if (this != dragged) {
                        this._addChild(dragged, event.offsetX, event.offsetY);
                        //OptionsManager.setItem('app.layout.disposition', HTMLHarmonyPanelElement.saveDisposition());
                    }
                }
            }
            dragged = null;
        }

        _handleMouseEnter(event) {
            //console.error(this, event);
            //clearInterval(HTMLHarmonyPanelElement._interval);
            //HTMLHarmonyPanelElement._interval = setInterval(event => this.style.opacity = (Math.floor(new Date().getTime() / 500) % 2) / 2 + 0.5, 100);
            //event.stopPropagation();
        }

        _handleMouseMove(event) {
            const delta = 5;
            //console.error(event.offsetX, event.offsetY);
            //this.style.opacity = (Math.floor(new Date().getTime() / 1000) % 2);
            //HTMLHarmonyPanelElement.highlitPanel = this;
            event.stopPropagation();
            if (event.offsetX < delta || event.offsetY < delta) {
                HTMLHarmonyPanelElement.highlitPanel = this;
                this.parentNode.insertBefore(HTMLHarmonyPanelElement._spliter, this);
            } else if ((this.offsetWidth - event.offsetX) < delta || (this.offsetHeight - event.offsetY) < delta) {
                HTMLHarmonyPanelElement.highlitPanel = this;
                this.parentNode.insertBefore(HTMLHarmonyPanelElement._spliter, this.nextSibling);
            } else {
                HTMLHarmonyPanelElement.highlitPanel = null;
            }

        }

        _handleMouseLeave(event) {
            //console.error(this, event);
            //clearInterval(HTMLHarmonyPanelElement._interval);
        }
            */
    static set highlitPanel(panel) {
        if (highlitPanel$1) {
            highlitPanel$1.style.filter = '';
        }
        highlitPanel$1 = panel;
        if (highlitPanel$1) {
            highlitPanel$1.style.filter = 'grayscale(80%)'; ///'contrast(200%)';
        }
    }
    /*
        _addChild(child, x, y) {
            let percent = 0.2;
            let percent2 = 0.8;
            let height = this.clientHeight;
            let width = this.clientWidth;

            if (this._direction == undefined) {
                if (x <= width * percent) {
                    this.prepend(dragged);
                    this.direction = 'row';
                }
                if (x >= width * percent2) {
                    this.append(dragged);
                    this.direction = 'row';
                }
                if (y <= height * percent) {
                    this.prepend(dragged);
                    this.direction = 'column';
                }
                if (y >= height * percent2) {
                    this.append(dragged);
                    this.direction = 'column';
                }
            } else if (this._direction == 'row') {
                if (x <= width * percent) {
                    this.prepend(dragged);
                }
                if (x >= width * percent2) {
                    this.append(dragged);
                }
                if (y <= height * percent) {
                    this._split(dragged, true, 'column');
                }
                if (y >= height * percent2) {
                    this._split(dragged, false, 'column');
                }
            } else if (this._direction == 'column') {
                if (x <= width * percent) {
                    this._split(dragged, true, 'row');
                }
                if (x >= width * percent2) {
                    this._split(dragged, false, 'row');
                }
                if (y <= height * percent) {
                    this.prepend(dragged);
                }
                if (y >= height * percent2) {
                    this.append(dragged);
                }
            }
        }*/
    /*
        _split(newNode, before, direction) {
            let panel = HTMLHarmonyPanelElement._createDummy();//document.createElement('harmony-panel');
            /*panel.id = HTMLHarmonyPanelElement.nextId;
            panel._isDummy = true;
            panel.classList.add('dummy');* /
            panel.size = this.size;
            this.style.flex = this.style.flex;
            this.after(panel);
            if (before) {
                panel.append(newNode);
                panel.append(this);
            } else {
                panel.append(this);
                panel.append(newNode);
            }
            panel.direction = direction;
        }
    */
    /*
        static _createDummy() {
            let dummy = document.createElement('harmony-panel');
            dummy.id = HTMLHarmonyPanelElement.#nextId;
            dummy._isDummy = true;
            dummy.classList.add('dummy');
            return dummy;
        }
    */
    /*
        _addPanel(panel) {
            this._panels.add(panel);
        }

        _removePanel(panel) {
            this._panels.delete(panel);
            if (this._isDummy) {
                if (this._panels.size == 0) {
                    this.remove();
                } else if (this._panels.size == 1) {
                    this.after(this._panels.values().next().value);
                    this.remove();
                }
            }
        }
    */
    /*
        set active(active) {
            if (this._active != active) {
                this.dispatchEvent(new CustomEvent('activated'));
            }
            this._active = active;
            this.style.display = active ? '' : 'none';
            if (active) {
                this._header.classList.add('activated');
            } else {
                this._header.classList.remove('activated');
            }
        }
        */
    /*
        _click() {
            this.active = true;
            if (this._group) {
                this._group.active = this;
            }
        }
    */
    setLayout(layout) {
        this.#layout = layout;
        this.htmlElement.classList.remove('harmony-panel-row');
        this.htmlElement.classList.remove('harmony-panel-column');
        if (layout) {
            this.htmlElement.classList.add(`harmony-panel-${layout}`);
        }
        if (layout === 'tabs') {
            for (const panel of this.#childPanels) {
                this.#addTab(panel);
            }
        }
        else {
            hide(this.#htmlTabGroup?.htmlElement);
        }
    }
    #addTab(panel) {
        if (!this.#htmlTabGroup) {
            this.#initHTML();
            this.#htmlTabGroup = new HarmonyTabGroup();
            this.#htmlContent.before(this.#htmlTabGroup.htmlElement);
        }
        const tab = new HarmonyTab({
            title: panel.#title,
            titleI18n: panel.#titleI18n,
            content: panel.htmlElement,
            draggable: true,
            panel,
        });
        this.#htmlTabGroup.addTab(tab);
        //tab.activate();
        panel.#parentTab = tab;
    }
    getLayout() {
        return this.#layout;
    }
    setSize(size) {
        /*if (size === undefined) {
            return;
        }*/
        this.#size = size;
        //this.style.flexBasis = size;
        this.htmlElement.style.flex = String(size);
    }
    getSize() {
        return this.#size;
    }
    setCollapsible(collapsible) {
        this.#collapsible = collapsible;
        //this.htmlElement.setAttribute('collapsible', String(this.#collapsible ? 1 : 0));
        addRemoveClass(this.htmlElement, 'collapsible', collapsible);
    }
    setCollapsed(collapsed) {
        this.#collapsed = collapsed && this.#collapsible;
        //this.htmlElement.setAttribute('collapsed', String(this.#isCollapsed ? 1 : 0));
        addRemoveClass(this.htmlElement, 'collapsed', this.#collapsed);
        if (this.#collapsed) {
            this.collapse();
        }
        else {
            this.expand();
        }
    }
    displayHeader(visible) {
        this.#headerVisible = visible;
        display(this.#htmlHeader, visible);
    }
    headerVisible() {
        return this.#headerVisible;
    }
    collapse() {
        hide(this.#htmlContent);
        this.#collapsed = true;
    }
    expand() {
        show(this.#htmlContent);
        this.#collapsed = false;
    }
    setTitle(title) {
        this.#title = title;
        const header = this.getHeader();
        header.innerText = title;
        show(header);
        /*
        if (title) {
            //this.#htmlTitle = this.#htmlTitle ?? document.createElement('div');
            super.prepend(this.#htmlTitle);
        } else {
            this.#htmlTitle.remove();
        }
        */
    }
    setTitleI18n(i18n) {
        this.getHeader();
        this.#titleI18n = i18n;
        if (typeof i18n === 'string') {
            updateElement(this.#htmlHeaderTitle, {
                i18n,
            });
        }
        else {
            errorOnce('unhandled type ' + typeof i18n + i18n);
        }
        show(this.#htmlHeader);
    }
    #toggleCollapse() {
        this.setCollapsed(!this.#collapsed);
    }
    /*
    static getNextId(): string {
        return `harmony-panel-dummy-${++nextId}`;
    }
    */
    /*
    static saveDisposition(): JSONObject {
        const list = document.getElementsByTagName('harmony-panel');
        const json: { panels: Record<string, any>, dummies: any[] } = { panels: {}, dummies: [] };
        for (const panel of list) {
            if (panel.id && panel.parentElement && panel.parentElement.id && panel.parentElement.tagName == 'HARMONY-PANEL') {
                json.panels[(panel as any).id] = { parent: panel.parentElement.id, size: (panel as any).size, direction: (panel as any).direction };
                if ((panel as HTMLHarmonyPanelElement).#isDummy) {
                    json.dummies.push((panel as any).id);
                }
            }
        }
        return json;
    }
    */
    /*
    static restoreDisposition(json: Record<string, any>): void {
        return;
        /*
        if (!json || !json.dummies || !json.panels) { return; }

        let dummiesList = new Map();
        for (let oldDummy of json.dummies) {
            let newDummy = HTMLHarmonyPanelElement._createDummy();
            document.body.append(newDummy);
            dummiesList.set(oldDummy, newDummy.id);
        }

        let list = document.getElementsByTagName('harmony-panel');
        for (let panel of list) {
            if (panel.id) {
                let p = json.panels[panel.id];
                if (p) {
                    if (p.size != 1 || panel._isDummy) {
                        panel.size = p.size;
                    }
                    panel.direction = p.direction;
                    let newParentId = dummiesList.get(p.parent) || p.parent;
                    if (p && newParentId) {
                        let parent = document.getElementById(newParentId);
                        /*if (!parent && p.dummy) {
                            parent = document.createElement('harmony-panel');
                        }* /
                        if (parent) {
                            parent.append(panel);
                        } else {
                            console.error('no parent', panel, newParentId);
                        }
                    }
                }
            }
        }* /
    }
    */
    adoptStyleSheet(styleSheet) {
        this.#initHTML();
        this.#shadowRoot.adoptedStyleSheets.push(styleSheet);
    }
    #handleMouseDown(event) {
        if (this.#isDraggable && event.button === 0) {
            _a$1.#draggedPanel = this;
        }
    }
    #startDrag() {
        if (_a$1.#dragging) {
            return;
        }
        _a$1.#dragging = true;
        _a$1.#dragMode = 'move';
        if (this.#parentTab) {
            this.#parentTab.close();
            this.#parentTab = undefined;
        }
        const rect = this.htmlElement.getBoundingClientRect();
        this.setFloating();
        this.#floatingWidth = this.#floatingWidth ?? rect.width;
        this.#floatingHeight = this.#floatingHeight ?? rect.height;
        this.htmlElement.style.left = `${rect.x}px`;
        this.htmlElement.style.top = `${rect.y}px`;
        this.htmlElement.style.width = `${this.#floatingWidth}px`;
        this.htmlElement.style.height = `${this.#floatingHeight}px`;
        this.htmlElement.style.position = 'absolute';
        _a$1.#deltaX = rect.x - _a$1.#startClientX;
        _a$1.#deltaY = rect.y - _a$1.#startClientY;
    }
    setFloating(width, height) {
        document.body.append(this.htmlElement);
        this.#floating = true;
        this.htmlElement.classList.add('floating');
        this.htmlElement.classList.remove('docked');
        width = (width ?? 50);
        height = (height ?? 50);
        this.htmlElement.style.left = `${(100 - width) / 2}%`;
        this.htmlElement.style.top = `${(100 - height) / 2}%`;
        this.htmlElement.style.width = `${width}%`;
        this.htmlElement.style.height = `${height}%`;
        this.htmlElement.style.position = 'absolute';
    }
    setDocked(parentPanel) {
        parentPanel.append(this);
        this.#floating = false;
        this.htmlElement.classList.remove('floating');
        this.htmlElement.classList.add('docked');
        // Reset styles used during drag
        this.htmlElement.style.left = '';
        this.htmlElement.style.top = '';
        this.htmlElement.style.width = '';
        this.htmlElement.style.height = '';
        this.htmlElement.style.position = '';
        this.htmlElement.style.flex = '';
    }
    #drag(event) {
        if (!_a$1.#dragging) {
            return;
        }
        this.htmlElement.style.left = `${event.clientX + _a$1.#deltaX}px`;
        this.htmlElement.style.top = `${event.clientY + _a$1.#deltaY}px`;
        if (event.ctrlKey) {
            _a$1.#setTarget(null);
        }
        else {
            const panel = this.#getDropTargetAtMousePosition(event);
            _a$1.#setTarget(panel);
        }
    }
    #stopDrag() {
        _a$1.#dragging = false;
        _a$1.#dragMode = 'none';
        if (_a$1.#target) {
            this.setDocked(_a$1.#target);
        }
    }
    #resize(event) {
        if (_a$1.#dragMode !== 'resize' || !_a$1.#startRect) {
            return;
        }
        const deltaX = event.clientX - _a$1.#startClientX;
        const deltaY = event.clientY - _a$1.#startClientY;
        const rect = _a$1.#startRect;
        let deltaTop = 0, deltaWidth = 0, deltaHeight = 0, deltaLeft = 0;
        switch (_a$1.#resizeX) {
            case -1:
                deltaLeft += deltaX;
                deltaWidth -= deltaX;
                break;
            case 1:
                deltaWidth += deltaX;
                break;
        }
        switch (_a$1.#resizeY) {
            case -1:
                deltaTop += deltaY;
                deltaHeight -= deltaY;
                break;
            case 1:
                deltaHeight += deltaY;
                break;
        }
        this.#floatingWidth = rect.width + deltaWidth;
        this.#floatingHeight = rect.height + deltaHeight;
        this.htmlElement.style.left = `${rect.x + deltaLeft}px`;
        this.htmlElement.style.top = `${rect.y + deltaTop}px`;
        this.htmlElement.style.width = `${this.#floatingWidth}px`;
        this.htmlElement.style.height = `${this.#floatingHeight}px`;
    }
    #stopResize() {
        _a$1.#dragging = false;
        _a$1.#dragMode = 'none';
    }
    static #setTarget(target) {
        if (this.#target) {
            this.#target.#htmlHeader?.classList.remove('target');
            this.#target.#htmlContent?.classList.remove('target');
        }
        if (target) {
            target.#htmlHeader?.classList.add('target');
            target.#htmlContent?.classList.add('target');
        }
        this.#target = target;
    }
    static #handleDocumentMouseMove(event) {
        if (!this.#mouseDown || !this.#draggedPanel) {
            return;
        }
        switch (_a$1.#dragMode) {
            case 'none':
                const deltaX = event.clientX - this.#startClientX;
                const deltaY = event.clientY - this.#startClientY;
                if (deltaX * deltaX + deltaY * deltaY > DRAG_THRESHOLD$1) {
                    this.#draggedPanel.#startDrag();
                }
                break;
            case 'move':
                this.#draggedPanel.#drag(event);
                break;
            case 'resize':
                this.#draggedPanel.#resize(event);
                break;
        }
    }
    static #handleDocumentMouseDown(event) {
        this.#mouseDown = true;
        this.#startClientX = event.clientX;
        this.#startClientY = event.clientY;
    }
    static #handleDocumentMouseUp(event) {
        this.#mouseDown = false;
        _a$1.#dragging = false;
        _a$1.#dragMode = 'none';
        if (this.#draggedPanel) {
            this.#draggedPanel.#stopDrag();
            this.#draggedPanel.#stopResize();
        }
        this.#draggedPanel = undefined;
        this.#setTarget(null);
    }
    #getDropTargetAtMousePosition(event) {
        let best = null;
        let bestRect;
        for (const panel of _a$1.#panels) {
            if (panel === this || !panel.htmlElement.isConnected || !panel.#dropTarget) {
                continue;
            }
            const rect = panel.htmlElement.getBoundingClientRect();
            if (event.clientX >= rect.left
                && event.clientX < rect.right
                && event.clientY >= rect.top
                && event.clientY < rect.bottom) {
                if (!best ||
                    (bestRect.left <= rect.left
                        && bestRect.right >= rect.right
                        && bestRect.top <= rect.top
                        && bestRect.bottom >= rect.bottom)) {
                    best = panel;
                    bestRect = rect;
                }
            }
        }
        return best;
    }
    #startResize(event, x, y) {
        if (_a$1.#dragMode !== 'none') {
            return;
        }
        _a$1.#dragMode = 'resize';
        _a$1.#resizeX = x;
        _a$1.#resizeY = y;
        _a$1.#startRect = this.htmlElement.getBoundingClientRect();
    }
    activate() {
        this.#parentTab?.activate();
    }
    open() {
        this.#initHTML();
        show(this.#shadowRoot);
    }
    close() {
        if (this.#shadowRoot) {
            hide(this.#shadowRoot);
        }
    }
}
_a$1 = HarmonyPanel;

var treeCSS = ":host {\n\t--child-margin: var(--harmony-tree-child-margin, 1rem);\n\t--header-bg-color: var(--harmony-tree-header-bg-color, var(--main-bg-color-dark, black));\n\t--header-bg-color-hover: var(--harmony-tree-header-bg-color-hover, var(--main-bg-color-bright, #41454d));\n\t--selected-bg-color: var(--harmony-tree-selected-bg-color, var(--accent-primary, rgb(26, 172, 201)));\n\tcolor: var(--main-text-color-dark2, white);\n\tbackground-color: var(--header-bg-color);\n}\n\n.item {\n\twidth: 100%;\n}\n\n.header {\n\twidth: 100%;\n\theight: 1rem;\n\tbackground-color: var(--header-bg-color);\n\tcursor: pointer;\n\tdisplay: flex;\n\tgap: 0.2rem;\n\talign-items: center;\n}\n\n.header:hover {\n\tbackground-color: var(--header-bg-color-hover);\n}\n\n.title {\n\tflex: 1;\n\ttext-wrap: nowrap;\n\toverflow: hidden;\n\ttext-overflow: ellipsis;\n}\n\n.childs {\n\tmargin-left: var(--child-margin);\n}\n\n.root>.header {\n\tdisplay: var(--harmony-tree-display-root, none);\n}\n\n.root>.childs {\n\tmargin-left: unset;\n}\n\n.actions {\n\tdisplay: flex;\n\tflex: 0;\n\tvisibility: hidden;\n}\n\n.header:hover>.actions {\n\tvisibility: visible;\n}\n\n.header.selected {\n\tbackground-color: var(--selected-bg-color);\n}\n";

var menuCSS = ":host {\n\tfont-size: 1.5em;\n\tcursor: not-allowed;\n\tcolor: var(--harmony-ui-text-primary);\n\tbackground-color: var(--harmony-ui-menu-bg-color);\n\toverflow: auto;\n\tz-index: 100000;\n}\n\n.harmony-menu-item {\n\tbackground-color: green;\n\tcursor: pointer;\n\tbackground-color: var(--harmony-ui-menu-item-bg-color);\n}\n\n.harmony-menu-item.disabled {\n\tpointer-events: none;\n}\n\n.harmony-menu-item.selected {\n\tbackground-color: var(--harmony-ui-menu-item-selected-bg-color);\n}\n\n\n.harmony-menu-item.separator {\n\theight: 5px;\n\tbackground-color: black;\n}\n\n.harmony-menu-item>.harmony-menu-item-title:hover {\n\tbackground-color: var(--harmony-ui-menu-item-hover-bg-color);\n}\n\n.harmony-menu-item.selected>.harmony-menu-item-title::after {\n\tcontent: \"✔\";\n}\n\n.harmony-menu-item>.harmony-menu-item-title::after {\n\ttransition: all 0.2s ease 0s;\n\twidth: 32px;\n\theight: 32px;\n}\n\n.harmony-menu-item.closed>.harmony-menu-item-title,\n.harmony-menu-item.opened>.harmony-menu-item-title {\n\tpadding-right: 32px;\n}\n\n.harmony-menu-item.closed>.harmony-menu-item-title::after {\n\tcontent: \"➤\";\n}\n\n.harmony-menu-item.opened>.harmony-menu-item-title::after {\n\tcontent: \"➤\";\n\ttransform: rotate(90deg);\n}\n\n.harmony-menu-item .submenu {\n\tbackground-color: var(--harmony-ui-menu-submenu-bg-color);\n\tpadding-left: 10px;\n\tmargin-left: 2px;\n\tdisplay: none;\n\toverflow: hidden;\n\tposition: relative;\n\tbackground-color: var(--harmony-ui-menu-submenu-fg-color);\n}\n\n.harmony-menu-item.opened>.submenu {\n\tdisplay: block;\n}\n";

var uiCSS = "@media (prefers-color-scheme: light) {\n\t:root:not(.light):not(.dark) {\n\t\t--harmony-ui-background-primary: #ccc;\n\t\t--harmony-ui-background-secondary: #f9f9fb;\n\t\t--harmony-ui-background-tertiary: #fff;\n\n\t\t--harmony-ui-input-background-primary: #aaa;\n\t\t--harmony-ui-input-background-secondary: #ccc;\n\t\t--harmony-ui-input-background-tertiary: #4e4e4e;\n\n\t\t--harmony-ui-border-primary: #222;\n\t\t--harmony-ui-border-secondary: #222;\n\n\t\t--harmony-ui-input-border-primary: #222;\n\t\t--harmony-ui-input-border-secondary: #222;\n\n\t\t--harmony-ui-text-primary: #222;\n\t\t--harmony-ui-text-secondary: #222;\n\t\t--harmony-ui-text-inactive: #9e9e9ea6;\n\t\t--harmony-ui-text-link: #0069c2;\n\t\t--harmony-ui-text-invert: #fff;\n\n\t\t--harmony-ui-accent-primary: #1072eb;\n\t\t--harmony-ui-accent-secondary: #1040c1;\n\n\t\t--harmony-ui-scrollbar-bg: transparent;\n\t\t--harmony-ui-scrollbar-color: rgba(0, 0, 0, 0.25);\n\n\t\t--harmony-ui-menu-bg-color: #ccc;\n\t\t--harmony-ui-menu-item-bg-color: #ccc;\n\t\t--harmony-ui-menu-item-selected-bg-color: #ccc;\n\t\t--harmony-ui-menu-submenu-bg-color: #ccc;\n\t\t--harmony-ui-menu-submenu-fg-color: #777;\n\t\t--harmony-ui-menu-item-hover-bg-color: #fff;\n\t}\n}\n\n@media (prefers-color-scheme: dark) {\n\t:root:not(.light):not(.dark) {\n\t\t--harmony-ui-background-primary: #1b1b1b;\n\t\t--harmony-ui-background-secondary: #464747;\n\t\t--harmony-ui-background-tertiary: #4e4e4e;\n\n\t\t--harmony-ui-input-background-primary: #555;\n\t\t--harmony-ui-input-background-secondary: #333;\n\t\t--harmony-ui-input-background-tertiary: #fff;\n\n\t\t--harmony-ui-border-primary: #858585;\n\t\t--harmony-ui-border-secondary: #696969;\n\n\t\t--harmony-ui-input-border-primary: #aaa;\n\t\t--harmony-ui-input-border-secondary: #696969;\n\n\t\t--harmony-ui-text-primary: #fff;\n\t\t--harmony-ui-text-secondary: #cdcdcd;\n\t\t--harmony-ui-text-inactive: #cdcdcda6;\n\t\t--harmony-ui-text-link: #8cb4ff;\n\t\t--harmony-ui-text-invert: #1b1b1b;\n\n\t\t--harmony-ui-accent-primary: #1072eb;\n\t\t--harmony-ui-accent-secondary: #1040c1;\n\n\t\t--harmony-ui-scrollbar-bg: transparent;\n\t\t--harmony-ui-scrollbar-color: rgba(255, 255, 255, 0.25);\n\n\t\t--harmony-ui-menu-bg-color: #333333;\n\t\t--harmony-ui-menu-item-bg-color: #333333;\n\t\t--harmony-ui-menu-item-selected-bg-color: #333333;\n\t\t--harmony-ui-menu-submenu-bg-color: #333333;\n\t\t--harmony-ui-menu-submenu-fg-color: #888888;\n\t\t--harmony-ui-menu-item-hover-bg-color: #000000;\n\t}\n}\n\n:root.light {\n\t--harmony-ui-background-primary: #ccc;\n\t--harmony-ui-background-secondary: #f9f9fb;\n\t--harmony-ui-background-tertiary: #fff;\n\n\t--harmony-ui-input-background-primary: #aaa;\n\t--harmony-ui-input-background-secondary: #ccc;\n\t--harmony-ui-input-background-tertiary: #4e4e4e;\n\n\t--harmony-ui-border-primary: #222;\n\t--harmony-ui-border-secondary: #222;\n\n\t--harmony-ui-input-border-primary: #222;\n\t--harmony-ui-input-border-secondary: #222;\n\n\t--harmony-ui-text-primary: #222;\n\t--harmony-ui-text-secondary: #222;\n\t--harmony-ui-text-inactive: #9e9e9ea6;\n\t--harmony-ui-text-link: #0069c2;\n\t--harmony-ui-text-invert: #fff;\n\n\t--harmony-ui-accent-primary: #1072eb;\n\t--harmony-ui-accent-secondary: #1040c1;\n\n\t--harmony-ui-scrollbar-bg: transparent;\n\t--harmony-ui-scrollbar-color: rgba(0, 0, 0, 0.25);\n\n\t--harmony-ui-menu-bg-color: #ccc;\n\t--harmony-ui-menu-item-bg-color: #ccc;\n\t--harmony-ui-menu-item-selected-bg-color: #ccc;\n\t--harmony-ui-menu-submenu-bg-color: #ccc;\n\t--harmony-ui-menu-submenu-fg-color: #777;\n\t--harmony-ui-menu-item-hover-bg-color: #fff;\n}\n\n:root.dark {\n\t--harmony-ui-background-primary: #1b1b1b;\n\t--harmony-ui-background-secondary: #464747;\n\t--harmony-ui-background-tertiary: #4e4e4e;\n\n\t--harmony-ui-input-background-primary: #555;\n\t--harmony-ui-input-background-secondary: #333;\n\t--harmony-ui-input-background-tertiary: #fff;\n\n\t--harmony-ui-border-primary: #858585;\n\t--harmony-ui-border-secondary: #696969;\n\n\t--harmony-ui-input-border-primary: #aaa;\n\t--harmony-ui-input-border-secondary: #696969;\n\n\t--harmony-ui-text-primary: #fff;\n\t--harmony-ui-text-secondary: #cdcdcd;\n\t--harmony-ui-text-inactive: #cdcdcda6;\n\t--harmony-ui-text-link: #8cb4ff;\n\t--harmony-ui-text-invert: #1b1b1b;\n\n\t--harmony-ui-accent-primary: #1072eb;\n\t--harmony-ui-accent-secondary: #1040c1;\n\n\t--harmony-ui-scrollbar-bg: transparent;\n\t--harmony-ui-scrollbar-color: rgba(255, 255, 255, 0.25);\n\n\t--harmony-ui-menu-bg-color: #333333;\n\t--harmony-ui-menu-item-bg-color: #333333;\n\t--harmony-ui-menu-item-selected-bg-color: #333333;\n\t--harmony-ui-menu-submenu-bg-color: #333333;\n\t--harmony-ui-menu-submenu-fg-color: #888888;\n\t--harmony-ui-menu-item-hover-bg-color: #000000;\n}\n";

let injected = false;
function injectGlobalCss() {
    if (injected) {
        return;
    }
    void documentStyle(uiCSS);
    injected = true;
}

class HTMLHarmonyMenuElement extends HTMLElement {
    #doOnce = true;
    #subMenus = new Map();
    #shadowRoot;
    #contextual = false;
    constructor() {
        super();
        this.#shadowRoot = this.attachShadow({ mode: 'closed' });
        document.addEventListener('click', (event) => {
            if (this.#contextual && !this.contains(event.target)) {
                this.close();
            }
        });
    }
    #show(items, userData) {
        this.#setItems(items, userData);
        this.#checkSize();
    }
    show(items, userData) {
        this.#show(items, userData);
        this.setContextual(false);
    }
    showContextual(items, clientX, clientY, userData) {
        document.body.append(this);
        this.style.left = clientX + 'px';
        this.style.top = clientY + 'px';
        this.setContextual(true);
        this.#show(items, userData);
    }
    setContextual(contextual) {
        this.style.position = contextual ? 'absolute' : '';
        this.#contextual = contextual;
    }
    #checkSize() {
        const bodyRect = document.body.getBoundingClientRect();
        const elemRect = this.getBoundingClientRect();
        this.style.maxWidth = bodyRect.width + 'px';
        this.style.maxHeight = bodyRect.height + 'px';
        if (elemRect.right > bodyRect.right) {
            this.style.left = Math.max((bodyRect.width - elemRect.width), 0) + 'px';
            /*if (elemRect.width > bodyRect.width) {
                this.style.maxWidth = bodyRect.width + 'px';
            } else {
                this.style.maxWidth = '';
            }*/
        }
        if (elemRect.bottom > bodyRect.bottom) {
            this.style.top = Math.max((bodyRect.height - elemRect.height), 0) + 'px';
            /*if (elemRect.height > bodyRect.height) {
                this.style.maxHeight = bodyRect.height + 'px';
            } else {
                this.style.maxHeight = '';
            }*/
        }
        if (elemRect.left < 0) {
            this.style.left = '0px';
        }
        if (elemRect.top < 0) {
            this.style.top = '0px';
        }
    }
    close() {
        if (this.#contextual) {
            this.remove();
        }
    }
    connectedCallback() {
        if (this.#doOnce) {
            I18n.observeElement(this.#shadowRoot);
            void shadowRootStyle(this.#shadowRoot, menuCSS);
            const callback = (entries) => {
                entries.forEach(() => {
                    this.#checkSize();
                });
            };
            const resizeObserver = new ResizeObserver(callback);
            resizeObserver.observe(this);
            resizeObserver.observe(document.body);
            this.#doOnce = false;
        }
    }
    #setItems(items, userData) {
        this.#shadowRoot.replaceChildren();
        if (items instanceof Array) {
            for (const item of items) {
                this.#shadowRoot.append(this.addItem(item, userData));
            }
        }
        else {
            for (const itemId in items) {
                const item = items[itemId];
                this.#shadowRoot.append(this.addItem(item, userData));
            }
        }
    }
    #openSubMenu(htmlSubMenu) {
        for (const [htmlItem, sub] of this.#subMenus) {
            if (sub == htmlSubMenu || sub.contains(htmlSubMenu)) {
                htmlItem.classList.add('opened');
                htmlItem.classList.remove('closed');
            }
            else {
                htmlItem.classList.remove('opened');
                htmlItem.classList.add('closed');
            }
        }
        this.#checkSize();
    }
    addItem(item, userData) {
        const htmlItem = createElement('div', {
            class: 'harmony-menu-item',
        });
        if (!item) {
            htmlItem.classList.add('separator');
        }
        else {
            const htmlItemTitle = createElement('div', {
                class: 'harmony-menu-item-title',
            });
            if (item.i18n) {
                htmlItemTitle.classList.add('i18n');
                htmlItemTitle.setAttribute('data-i18n', item.i18n);
                htmlItemTitle.innerText = item.i18n;
            }
            else {
                htmlItemTitle.innerText = item.name ?? '';
            }
            htmlItem.append(htmlItemTitle);
            if (item.selected) {
                htmlItem.classList.add('selected');
            }
            if (item.disabled) {
                htmlItem.classList.add('disabled');
            }
            if (item.submenu) {
                const htmlSubMenu = createElement('div', {
                    class: 'submenu',
                });
                this.#subMenus.set(htmlItem, htmlSubMenu);
                let subItems = 0;
                if (item.submenu instanceof Array) {
                    for (const subItem of item.submenu) {
                        htmlSubMenu.append(this.addItem(subItem, userData));
                        ++subItems;
                    }
                }
                else {
                    for (const subItemName in item.submenu) {
                        const subItem = item.submenu[subItemName];
                        htmlSubMenu.append(this.addItem(subItem, userData));
                        ++subItems;
                    }
                }
                htmlItem.append(htmlSubMenu);
                //htmlSubMenu.style.display = 'none';
                htmlItem.classList.add('closed');
                if (item.opened) {
                    this.#openSubMenu(htmlSubMenu);
                }
                htmlItem.addEventListener('click', event => {
                    this.#openSubMenu(htmlSubMenu);
                    if (item.cmd) {
                        this.dispatchEvent(new CustomEvent(item.cmd));
                    }
                    if (item.f) {
                        void item.f(userData);
                    }
                    event.stopPropagation();
                });
                if (subItems == 0) {
                    hide(htmlItem);
                }
            }
            else {
                htmlItem.addEventListener('click', (event) => {
                    if (item.cmd) {
                        this.dispatchEvent(new CustomEvent(item.cmd));
                    }
                    if (item.f) {
                        void item.f(userData);
                    }
                    event.stopPropagation();
                });
                htmlItem.addEventListener('click', () => this.close());
            }
        }
        return htmlItem;
    }
}
let definedMenu = false;
function defineHarmonyMenu() {
    if (!definedMenu) {
        defineElement('harmony-menu', HTMLHarmonyMenuElement);
        definedMenu = true;
        injectGlobalCss();
    }
}

class HTMLHarmonyElement extends HTMLElement {
    initialized = false;
    initElement() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.createElement();
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    createElement() {
    }
    connectedCallback() {
        this.initElement();
    }
    attributeChangedCallback(name, oldValue, newValue) {
        this.initElement();
        this.onAttributeChanged(name, oldValue, newValue);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    onAttributeChanged(name, oldValue, newValue) {
    }
    static get observedAttributes() {
        return ['label'];
    }
}

var TreeItemKind;
(function (TreeItemKind) {
    TreeItemKind["Root"] = "root";
    TreeItemKind["Directory"] = "directory";
    TreeItemKind["File"] = "file";
    TreeItemKind["Item"] = "item";
})(TreeItemKind || (TreeItemKind = {}));
class TreeItem {
    name;
    icon;
    kind;
    parent;
    childs = new Set;
    actions = new Set();
    userData;
    constructor(name, options = {}) {
        this.name = name;
        this.icon = options.icon;
        this.kind = options.kind ?? TreeItemKind.File;
        this.parent = options.parent;
        this.userData = options.userData;
        if (options.parent) {
            options.parent.addChild(this);
        }
        if (options.childs) {
            for (const child of options.childs) {
                this.addChild(child);
            }
        }
        this.#sortByName();
    }
    addChild(child) {
        this.childs.add(child);
    }
    #sortByName() {
        this.childs[Symbol.iterator] = function* () {
            yield* [...this.values()].sort((a, b) => {
                return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
            });
        };
    }
    getPath(separator = '/') {
        let path = '';
        if (this.parent) {
            const parentPath = this.parent.getPath(separator);
            if (parentPath) {
                path = parentPath + separator;
            }
        }
        return path + this.name;
    }
    getLevel() {
        if (this.parent) {
            return 1 + this.parent.getLevel();
        }
        return 0;
    }
    addAction(action) {
        this.actions.add(action);
    }
    addActions(actions) {
        for (const action of actions) {
            this.actions.add(action);
        }
    }
    removeAction(action) {
        this.actions.delete(action);
    }
    static createFromPathList(paths, options = {}) {
        class element {
            tree;
            childs = new Map();
            constructor(tree) {
                this.tree = tree;
            }
        }
        const root = new TreeItem(options.rootName ?? '', { userData: options.rootUserData ?? options.userData, kind: TreeItemKind.Root });
        const top = new element(root);
        for (const [path, perElementUserData] of paths.entries()) {
            const segments = path.split(options.pathSeparator ?? '/');
            let current = top;
            let parent = root;
            for (let i = 0, l = segments.length; i < l; i++) {
                const s = segments[i];
                if (s == '') {
                    continue;
                }
                let kind = TreeItemKind.Directory;
                if (i == l - 1) {
                    kind = TreeItemKind.File;
                }
                if (!current.childs.has(s)) {
                    current.childs.set(s, new element(new TreeItem(s, { parent: parent, kind: kind, userData: perElementUserData != path ? perElementUserData : options.userData })));
                }
                parent = current.childs.get(s).tree;
                current = current.childs.get(s);
            }
        }
        return root;
    }
    #matchFilter(filter) {
        if (!filter) {
            return true;
        }
        const lowerName = this.name.toLowerCase();
        if (filter.name) {
            if (!lowerName.includes(filter.name.toLowerCase())) {
                return false;
            }
            if (this.kind != TreeItemKind.File) {
                return false;
            }
        }
        if (filter.kinds) {
            let match = false;
            for (const tf of filter.kinds) {
                if (tf === this.kind) {
                    match = true;
                    break;
                }
            }
            if (!match) {
                return false;
            }
        }
        if (filter.kind !== undefined) {
            if (filter.kind !== this.kind) {
                return false;
            }
        }
        if (filter.extensions) {
            if (this.kind != TreeItemKind.File) {
                return false;
            }
            const extension = lowerName.split('.').pop() ?? '';
            if (!filter.extensions.has(extension)) {
                if (filter.extensions.get('^') === false) {
                    return false;
                }
            }
            else {
                if ((filter.extensions.get(extension) ?? filter.extensions.get('*')) === false) {
                    return false;
                }
            }
        }
        if (filter.customFilter) {
            return filter.customFilter(this);
        }
        return true;
    }
    *walk(filter) {
        const stack = [this];
        let current;
        do {
            current = stack.pop();
            if (!current) {
                break;
            }
            if (current.#matchFilter(filter)) {
                yield current;
            }
            for (const child of current.childs) {
                stack.push(child);
            }
        } while (current);
    }
}

class HarmonyTree extends MyEventTarget {
    htmlElement = createElement('div');
    #shadowRoot;
    #root;
    #htmlContextMenu;
    #isInitialized = new Set();
    #isExpanded = new Map();
    #filter;
    #isVisible = new Set();
    #actions = new Map();
    #itemElements = new Map();
    #elementItem = new Map();
    #selectedItem = null;
    #rootLevel;
    #sticky = new Set();
    #dynamicSheet = new CSSStyleSheet();
    #cssLevel = new Set();
    #initHTML() {
        if (this.#shadowRoot) {
            return;
        }
        this.#shadowRoot = this.htmlElement.attachShadow({ mode: 'closed' });
        I18n.observeElement(this.#shadowRoot);
        void shadowRootStyle(this.#shadowRoot, treeCSS);
        this.#shadowRoot.adoptedStyleSheets.push(this.#dynamicSheet);
        this.#refresh();
        this.htmlElement.addEventListener('scroll', () => this.#handleScroll());
    }
    adoptStyle(css) {
        this.#initHTML();
        void shadowRootStyle(this.#shadowRoot, css);
    }
    #refresh() {
        if (!this.#shadowRoot) {
            return;
        }
        if (!this.#root) {
            return;
        }
        this.#createItem(this.#root, null, true);
        this.#refreshFilter();
    }
    #refreshFilter() {
        for (const [item, itemElement] of this.#itemElements) {
            const show = (!this.#filter || this.#isVisible.has(item)) && this.#isFullyExpanded(item);
            display(itemElement.element, show);
        }
    }
    #isFullyExpanded(item) {
        let current = item.parent;
        if (!current) {
            return true;
        }
        do {
            if (!this.#isExpanded.get(current)) {
                return false;
            }
            current = current.parent;
        } while (current);
        return true;
    }
    setRoot(root) {
        this.#initHTML();
        this.#root = root;
        this.#shadowRoot?.replaceChildren();
        this.#filterItems();
    }
    #buildContextMenu(contextMenu, x, y) {
        if (!this.#htmlContextMenu) {
            defineHarmonyMenu();
            this.#htmlContextMenu = createElement('harmony-menu');
        }
        this.#htmlContextMenu.showContextual(contextMenu, x, y);
    }
    #contextMenuHandler(event, item) {
        if (!event.shiftKey) {
            this.dispatchEvent(new CustomEvent('contextmenu', {
                detail: {
                    item: item,
                    buildContextMenu: (menu) => this.#buildContextMenu(menu, event.clientX, event.clientY),
                },
            }));
            event.preventDefault();
            event.stopPropagation();
        }
    }
    #createItem(item, predecessor, createExpanded) {
        let element;
        const itemElement = this.#itemElements.get(item);
        if (itemElement) {
            element = itemElement.element;
            if (predecessor) {
                predecessor.after(element);
            }
            else {
                this.#shadowRoot?.append(element);
            }
        }
        else {
            const itemLevel = item.getLevel();
            let header;
            let actions;
            this.#addCssLevel(itemLevel);
            element = createElement('div', {
                class: `item level${itemLevel}`,
                parent: this.#shadowRoot,
                childs: [
                    header = createElement('div', {
                        class: 'header',
                        childs: [
                            createElement('div', {
                                class: 'padding',
                            }),
                            createElement('div', {
                                class: 'title',
                                innerText: item.name,
                            }),
                            actions = createElement('div', {
                                class: 'actions',
                            }),
                        ],
                        $click: () => {
                            const expanded = this.#isExpanded.get(item);
                            const event = new CustomEvent('itemclick', { detail: { item: item }, cancelable: true, });
                            this.dispatchEvent(event);
                            if (event.defaultPrevented) {
                                return;
                            }
                            if (expanded) {
                                this.collapseItem(item);
                            }
                            else {
                                this.expandItem(item);
                                this.#refreshFilter();
                            }
                        },
                        $contextmenu: (event) => this.#contextMenuHandler(event, item),
                    }),
                ]
            });
            if (predecessor) {
                predecessor.after(element);
            }
            this.#itemElements.set(item, { element: element, header: header, actions: actions });
            this.#elementItem.set(element, item);
        }
        if (item.kind == TreeItemKind.Root && item.name == '') {
            element.classList.add('root');
        }
        if (item.kind) {
            element.classList.add(`type-${item.kind}`);
        }
        if (createExpanded || this.#isExpanded.get(item)) {
            this.expandItem(item);
        }
        this.refreshActions(item);
        return element;
    }
    isExpanded(item) {
        return this.#isExpanded.get(item) ?? false;
    }
    expandItem(item) {
        this.#initHTML();
        if (item.parent) {
            this.expandItem(item.parent);
        }
        if (this.#isExpanded.get(item)) {
            return;
        }
        this.#isExpanded.set(item, true);
        if (!this.#isInitialized.has(item)) {
            this.#initItem(item);
        }
        else {
            for (const child of item.childs) {
                this.showItem(child);
            }
        }
    }
    #initItem(item) {
        const element = this.#itemElements.get(item)?.element;
        if (!element) {
            return;
        }
        let predecessor = element;
        for (const child of item.childs) {
            const childElement = this.#createItem(child, predecessor, false);
            predecessor = childElement;
        }
        this.#isInitialized.add(item);
    }
    collapseItem(item) {
        this.#initHTML();
        this.#isExpanded.set(item, false);
        for (const child of item.childs) {
            this.hideItem(child);
        }
    }
    refreshItem(item) {
        this.#isInitialized.delete(item);
        this.#initItem(item);
    }
    showItem(item) {
        this.#initHTML();
        const element = this.#itemElements.get(item);
        if (element) {
            show(element.element);
        }
        if (this.#isExpanded.get(item)) {
            for (const child of item.childs) {
                this.showItem(child);
            }
        }
    }
    hideItem(item) {
        const element = this.#itemElements.get(item);
        if (element) {
            hide(element.element);
        }
        for (const child of item.childs) {
            this.hideItem(child);
        }
    }
    selectItem(item, scrollIntoView = true) {
        this.#initHTML();
        if (item == this.#selectedItem) {
            return;
        }
        if (this.#selectedItem) {
            this.#itemElements.get(this.#selectedItem)?.header?.classList.remove('selected');
        }
        if (item) {
            if (item.parent) {
                this.expandItem(item.parent);
            }
            const itemElement = this.#itemElements.get(item)?.header;
            itemElement?.classList.add('selected');
            if (scrollIntoView) {
                setTimeout(() => {
                    itemElement?.scrollIntoView({ block: 'center' });
                }, 0);
            }
        }
        this.#selectedItem = item;
    }
    addAction(name, img, tooltip) {
        const action = {
            name: name,
            tooltip: tooltip,
        };
        if (typeof img == 'string') {
            action.innerHTML = img;
        }
        else {
            action.element = img;
        }
        this.#actions.set(name, action);
    }
    refreshActions(item) {
        const htmlActions = this.#itemElements.get(item)?.actions;
        htmlActions?.replaceChildren();
        for (const actionName of item.actions) {
            const action = this.#actions.get(actionName);
            if (action) {
                createElement('div', {
                    child: action.element,
                    innerHTML: action.innerHTML,
                    parent: htmlActions,
                    i18n: {
                        title: action.tooltip,
                    },
                    $click: (event) => this.#actionHandler(event, item, actionName),
                });
            }
        }
    }
    #actionHandler(event, item, action) {
        this.dispatchEvent(new CustomEvent('itemaction', {
            detail: {
                item: item,
                action: action,
            },
        }));
        event.preventDefault();
        event.stopPropagation();
    }
    setFilter(filter) {
        this.#initHTML();
        this.#filter = filter;
        this.#filterItems();
    }
    #filterItems() {
        this.#isVisible.clear();
        if (this.#filter && this.#root) {
            for (const item of this.#root.walk(this.#filter)) {
                let current = item;
                do {
                    this.#isVisible.add(current);
                    current = current.parent;
                } while (current);
            }
        }
        this.#refresh();
    }
    #handleScroll() {
        let stickyHeight = 0;
        for (const sticky of this.#sticky) {
            const rect = sticky.getBoundingClientRect();
            stickyHeight += rect.height;
        }
        const rect = this.htmlElement.getBoundingClientRect();
        const elements = this.#shadowRoot.elementsFromPoint(rect.x + 1, rect.y + stickyHeight + 1);
        if (!elements) {
            return;
        }
        for (const element of elements) {
            let treeItem = this.#elementItem.get(element);
            if (!treeItem) {
                continue;
            }
            treeItem = treeItem.parent;
            if (!treeItem) {
                continue;
            }
            this.#setSticky(treeItem);
            break;
        }
    }
    #addCssLevel(level) {
        if (level == 0) {
            return;
        }
        if (!this.#cssLevel.has(level)) {
            this.#cssLevel.add(level);
            this.#dynamicSheet.insertRule(`.level${level} .padding{flex: 0 0 ${level}rem}`);
        }
    }
    #setSticky(item) {
        for (const treeItemElement of this.#sticky) {
            treeItemElement.style.cssText = '';
        }
        this.#sticky.clear();
        let current = item;
        while (current) {
            const treeItemElement = this.#itemElements.get(current);
            if (treeItemElement) {
                this.#sticky.add(treeItemElement.element);
                treeItemElement.element.style.cssText = `position:sticky;top:${current.getLevel()}rem;`;
            }
            current = current.parent;
        }
    }
}

function toBool(s) {
    return s === '1' || s === 'true';
}

var ManipulatorDirection;
(function (ManipulatorDirection) {
    ManipulatorDirection["All"] = "all";
    ManipulatorDirection["X"] = "x";
    ManipulatorDirection["Y"] = "y";
    ManipulatorDirection["None"] = "none";
})(ManipulatorDirection || (ManipulatorDirection = {}));
var ManipulatorUpdatedEventType;
(function (ManipulatorUpdatedEventType) {
    ManipulatorUpdatedEventType["Position"] = "position";
    ManipulatorUpdatedEventType["Size"] = "size";
    ManipulatorUpdatedEventType["Rotation"] = "rotation";
})(ManipulatorUpdatedEventType || (ManipulatorUpdatedEventType = {}));
var ManipulatorCorner;
(function (ManipulatorCorner) {
    ManipulatorCorner[ManipulatorCorner["None"] = -1] = "None";
    ManipulatorCorner[ManipulatorCorner["TopLeft"] = 0] = "TopLeft";
    ManipulatorCorner[ManipulatorCorner["TopRight"] = 1] = "TopRight";
    ManipulatorCorner[ManipulatorCorner["BottomLeft"] = 2] = "BottomLeft";
    ManipulatorCorner[ManipulatorCorner["BottomRight"] = 3] = "BottomRight";
})(ManipulatorCorner || (ManipulatorCorner = {}));
var ManipulatorSide;
(function (ManipulatorSide) {
    ManipulatorSide[ManipulatorSide["None"] = -1] = "None";
    ManipulatorSide[ManipulatorSide["Top"] = 0] = "Top";
    ManipulatorSide[ManipulatorSide["Bottom"] = 1] = "Bottom";
    ManipulatorSide[ManipulatorSide["Left"] = 2] = "Left";
    ManipulatorSide[ManipulatorSide["Right"] = 3] = "Right";
})(ManipulatorSide || (ManipulatorSide = {}));
var ManipulatorResizeOrigin;
(function (ManipulatorResizeOrigin) {
    ManipulatorResizeOrigin[ManipulatorResizeOrigin["OppositeCorner"] = 0] = "OppositeCorner";
    ManipulatorResizeOrigin[ManipulatorResizeOrigin["Center"] = 1] = "Center";
})(ManipulatorResizeOrigin || (ManipulatorResizeOrigin = {}));

function cloneEvent(event) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    return new event.constructor(event.type, event);
}

/**
 * For list like filters, determine the type of options
 */
var HarmonyFilterListType;
(function (HarmonyFilterListType) {
    /** Value can be true or false. Default option value is false */
    HarmonyFilterListType[HarmonyFilterListType["Boolean"] = 0] = "Boolean";
    /** Value can be true, false or undefined. Default option value is undefined */
    HarmonyFilterListType[HarmonyFilterListType["Ternary"] = 1] = "Ternary";
})(HarmonyFilterListType || (HarmonyFilterListType = {}));

var HTMLHarmonyInfoBoxElementType;
(function (HTMLHarmonyInfoBoxElementType) {
    HTMLHarmonyInfoBoxElementType["Ok"] = "ok";
    HTMLHarmonyInfoBoxElementType["Warning"] = "warning";
    HTMLHarmonyInfoBoxElementType["Error"] = "error";
})(HTMLHarmonyInfoBoxElementType || (HTMLHarmonyInfoBoxElementType = {}));

var _a;
//const dragged = null;
let nextId = 0;
//let spliter: HTMLElement = createElement('div', { class: 'harmony-panel-splitter' }) as HTMLElement;
let highlitPanel;
const DRAG_THRESHOLD = 15;
class HTMLHarmonyPanelElement extends HTMLElement {
    #doOnce = true;
    #parent = null;
    #size = 1;
    #direction = 'undefined';
    #isMovable = false;
    #isCollapsible = true;
    #isCollapsed = false;
    customPanelId = nextId++;
    #htmlHeader;
    #htmlContent;
    #htmlResize;
    #isDummy = false;
    #shadowRoot;
    #hasHeader = true;
    #isDraggable = true;
    #floating = false;
    #floatingWidth;
    #floatingHeight;
    static #dragMode = 'none';
    static #resizeX = 0;
    static #resizeY = 0;
    static #dragging = false;
    static #draggedPanel;
    static #deltaX = 0;
    static #deltaY = 0;
    static #startClientX = 0;
    static #startClientY = 0;
    static #mouseDown = false;
    static #panels = new Set;
    static #target = null;
    static #startRect;
    static {
        document.addEventListener('mousedown', (event) => _a.#handleDocumentMouseDown(event));
        document.addEventListener('mousemove', (event) => _a.#handleDocumentMouseMove(event));
        document.addEventListener('mouseup', (event) => _a.#handleDocumentMouseUp(event));
    }
    constructor() {
        super();
        _a.#panels.add(this);
        this.#shadowRoot = this.attachShadow({ mode: 'closed' });
        void shadowRootStyle(this.#shadowRoot, panelCSS);
        this.#htmlHeader = createElement('div', {
            class: 'header',
            parent: this.#shadowRoot,
            hidden: true,
            $dblclick: () => this.#toggleCollapse(),
            $mousedown: (event) => this.#handleMouseDown(event),
        });
        this.#htmlContent = createElement('div', {
            class: 'content',
            parent: this.#shadowRoot,
        });
        this.#htmlResize = createElement('div', {
            class: 'panel-resize',
            parent: this.#shadowRoot,
            childs: [
                createElement('div', { class: 'side top', $mousedown: (event) => this.#startResize(event, 0, -1) }),
                createElement('div', { class: 'side right', $mousedown: (event) => this.#startResize(event, 1, 0) }),
                createElement('div', { class: 'side bottom', $mousedown: (event) => this.#startResize(event, 0, 1) }),
                createElement('div', { class: 'side left', $mousedown: (event) => this.#startResize(event, -1, 0) }),
                createElement('div', { class: 'corner top_right', $mousedown: (event) => this.#startResize(event, 1, -1) }),
                createElement('div', { class: 'corner bottom_right', $mousedown: (event) => this.#startResize(event, 1, 1) }),
                createElement('div', { class: 'corner bottom_left', $mousedown: (event) => this.#startResize(event, -1, 1) }),
                createElement('div', { class: 'corner top_left', $mousedown: (event) => this.#startResize(event, -1, -1) }),
            ],
            $mousedown: (event) => this.#handleMouseDown(event),
        });
    }
    connectedCallback() {
        if (this.#doOnce) {
            //this.append(...this.childNodes);
            this.#doOnce = false;
        }
        //super.append(this.#htmlTitle);
        //super.append(this.#htmlContent);
        //let parentElement = this.parentElement;
        /*if (this._parent && (this._parent != parentElement)) {
            this._parent._removePanel(this);
        }

        if (parentElement && parentElement.tagName == 'HARMONY-PANEL') {
            parentElement._addPanel(this);
            this._parent = parentElement;
        }*/
        /*if (!this._firstTime) {
            this._firstTime = true;
            //this.style.backgroundColor = `rgb(${255*Math.random()},${255*Math.random()},${255*Math.random()})`;
            //this.append(this.CustomPanelId);
            this.title = this.CustomPanelId;
            this.direction = this._direction;
            //this.size = this._size;
            //this.draggable = true;
        }*/
    }
    append(...nodes) {
        // eslint-disable-next-line prefer-rest-params
        this.#htmlContent.append(...nodes);
    }
    prepend(...nodes) {
        // eslint-disable-next-line prefer-rest-params
        this.#htmlContent.prepend(...nodes);
    }
    /*
        appendChild(child: HTMLElement) {
            this.htmlContent.appendChild(child);
        }
    */
    get innerHTML() {
        return this.#htmlContent.innerHTML;
    }
    set innerHTML(innerHTML) {
        this.#htmlContent.innerHTML = innerHTML;
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue == newValue) {
            return;
        }
        switch (name) {
            case 'panel-direction':
                this.#direction = newValue;
                break;
            case 'panel-size':
                this.size = Number(newValue);
                break;
            case 'is-movable':
                this.isMovable = toBool(newValue);
                break;
            case 'collapsible':
                this.collapsible = toBool(newValue);
                break;
            case 'collapsed':
                this.collapsed = toBool(newValue);
                break;
            case 'title':
                this.setTitle(newValue);
                break;
            case 'has-header':
                this.hasHeader = toBool(newValue);
                break;
            case 'draggable':
                this.#isDraggable = toBool(newValue);
                this.#htmlHeader.setAttribute('draggable', newValue);
                break;
            case 'hidden-title':
                if (toBool(newValue)) {
                    this.#htmlHeader.classList.add('hidden');
                }
                else {
                    this.#htmlHeader.classList.remove('hidden');
                }
                break;
        }
    }
    static get observedAttributes() {
        return ['panel-direction', 'panel-size', 'is-movable', 'title', 'collapsible', 'collapsed', 'has-header', 'draggable', 'hidden-title'];
    }
    /*
        _handleDragStart(event) {
            if (this._isMovable == false) {
                event.preventDefault();
                return;
            }
            event.stopPropagation();
            event.dataTransfer.setData('text/plain', null);
            dragged = event.target;
        }

        _handleDragOver(event) {
            if (this._isContainer != false) {
                event.preventDefault();
            }
            event.stopPropagation();
        }

        _handleDrop(event) {
            if (this._isContainer != false) {
                event.stopPropagation();
                event.preventDefault();
                if (dragged) {
                    if (this != dragged) {
                        this._addChild(dragged, event.offsetX, event.offsetY);
                        //OptionsManager.setItem('app.layout.disposition', HTMLHarmonyPanelElement.saveDisposition());
                    }
                }
            }
            dragged = null;
        }

        _handleMouseEnter(event) {
            //console.error(this, event);
            //clearInterval(HTMLHarmonyPanelElement._interval);
            //HTMLHarmonyPanelElement._interval = setInterval(event => this.style.opacity = (Math.floor(new Date().getTime() / 500) % 2) / 2 + 0.5, 100);
            //event.stopPropagation();
        }

        _handleMouseMove(event) {
            const delta = 5;
            //console.error(event.offsetX, event.offsetY);
            //this.style.opacity = (Math.floor(new Date().getTime() / 1000) % 2);
            //HTMLHarmonyPanelElement.highlitPanel = this;
            event.stopPropagation();
            if (event.offsetX < delta || event.offsetY < delta) {
                HTMLHarmonyPanelElement.highlitPanel = this;
                this.parentNode.insertBefore(HTMLHarmonyPanelElement._spliter, this);
            } else if ((this.offsetWidth - event.offsetX) < delta || (this.offsetHeight - event.offsetY) < delta) {
                HTMLHarmonyPanelElement.highlitPanel = this;
                this.parentNode.insertBefore(HTMLHarmonyPanelElement._spliter, this.nextSibling);
            } else {
                HTMLHarmonyPanelElement.highlitPanel = null;
            }

        }

        _handleMouseLeave(event) {
            //console.error(this, event);
            //clearInterval(HTMLHarmonyPanelElement._interval);
        }
            */
    static set highlitPanel(panel) {
        if (highlitPanel) {
            highlitPanel.style.filter = '';
        }
        highlitPanel = panel;
        if (highlitPanel) {
            highlitPanel.style.filter = 'grayscale(80%)'; ///'contrast(200%)';
        }
    }
    /*
        _addChild(child, x, y) {
            let percent = 0.2;
            let percent2 = 0.8;
            let height = this.clientHeight;
            let width = this.clientWidth;

            if (this._direction == undefined) {
                if (x <= width * percent) {
                    this.prepend(dragged);
                    this.direction = 'row';
                }
                if (x >= width * percent2) {
                    this.append(dragged);
                    this.direction = 'row';
                }
                if (y <= height * percent) {
                    this.prepend(dragged);
                    this.direction = 'column';
                }
                if (y >= height * percent2) {
                    this.append(dragged);
                    this.direction = 'column';
                }
            } else if (this._direction == 'row') {
                if (x <= width * percent) {
                    this.prepend(dragged);
                }
                if (x >= width * percent2) {
                    this.append(dragged);
                }
                if (y <= height * percent) {
                    this._split(dragged, true, 'column');
                }
                if (y >= height * percent2) {
                    this._split(dragged, false, 'column');
                }
            } else if (this._direction == 'column') {
                if (x <= width * percent) {
                    this._split(dragged, true, 'row');
                }
                if (x >= width * percent2) {
                    this._split(dragged, false, 'row');
                }
                if (y <= height * percent) {
                    this.prepend(dragged);
                }
                if (y >= height * percent2) {
                    this.append(dragged);
                }
            }
        }*/
    /*
        _split(newNode, before, direction) {
            let panel = HTMLHarmonyPanelElement._createDummy();//document.createElement('harmony-panel');
            /*panel.id = HTMLHarmonyPanelElement.nextId;
            panel._isDummy = true;
            panel.classList.add('dummy');* /
            panel.size = this.size;
            this.style.flex = this.style.flex;
            this.after(panel);
            if (before) {
                panel.append(newNode);
                panel.append(this);
            } else {
                panel.append(this);
                panel.append(newNode);
            }
            panel.direction = direction;
        }
    */
    /*
        static _createDummy() {
            let dummy = document.createElement('harmony-panel');
            dummy.id = HTMLHarmonyPanelElement.#nextId;
            dummy._isDummy = true;
            dummy.classList.add('dummy');
            return dummy;
        }
    */
    /*
        _addPanel(panel) {
            this._panels.add(panel);
        }

        _removePanel(panel) {
            this._panels.delete(panel);
            if (this._isDummy) {
                if (this._panels.size == 0) {
                    this.remove();
                } else if (this._panels.size == 1) {
                    this.after(this._panels.values().next().value);
                    this.remove();
                }
            }
        }
    */
    /*
        set active(active) {
            if (this._active != active) {
                this.dispatchEvent(new CustomEvent('activated'));
            }
            this._active = active;
            this.style.display = active ? '' : 'none';
            if (active) {
                this._header.classList.add('activated');
            } else {
                this._header.classList.remove('activated');
            }
        }
        */
    /*
        _click() {
            this.active = true;
            if (this._group) {
                this._group.active = this;
            }
        }
    */
    set direction(direction) {
        this.#direction = direction;
        this.classList.remove('harmony-panel-row');
        this.classList.remove('harmony-panel-column');
        if (direction == 'row') {
            this.classList.add('harmony-panel-row');
        }
        else if (direction == 'column') {
            this.classList.add('harmony-panel-column');
        }
    }
    get direction() {
        return this.#direction;
    }
    set size(size) {
        /*if (size === undefined) {
            return;
        }*/
        this.#size = size;
        //this.style.flexBasis = size;
        this.style.flex = String(size);
    }
    get size() {
        return this.#size;
    }
    set isMovable(isMovable) {
        this.#isMovable = isMovable;
    }
    set collapsible(collapsible) {
        this.#isCollapsible = collapsible;
        this.setAttribute('collapsible', String(this.#isCollapsible ? 1 : 0));
    }
    set collapsed(collapsed) {
        this.#isCollapsed = (collapsed == true) ? this.#isCollapsible : false;
        this.setAttribute('collapsed', String(this.#isCollapsed ? 1 : 0));
        if (this.#isCollapsed) {
            this.collapse();
        }
        else {
            this.expand();
        }
    }
    set hasHeader(hasHeader) {
        this.#hasHeader = hasHeader;
        display(this.#htmlHeader, hasHeader);
    }
    get hasHeader() {
        return this.#hasHeader;
    }
    collapse() {
        hide(this.#htmlContent);
        this.#isCollapsed = true;
    }
    expand() {
        show(this.#htmlContent);
        this.#isCollapsed = false;
    }
    setTitle(title) {
        this.#htmlHeader.innerText = title;
        show(this.#htmlHeader);
        /*
        if (title) {
            //this.#htmlTitle = this.#htmlTitle ?? document.createElement('div');
            super.prepend(this.#htmlTitle);
        } else {
            this.#htmlTitle.remove();
        }
        */
    }
    setTitleI18n(i18n) {
        if (typeof i18n === 'string') {
            this.#setTitleI18n(i18n);
        }
        else {
            errorOnce('unhandled type ' + typeof i18n + i18n);
        }
        show(this.#htmlHeader);
    }
    #setTitleI18n(titleI18n) {
        AddI18nElement(this.#htmlHeader, titleI18n);
    }
    #toggleCollapse() {
        this.collapsed = !this.#isCollapsed;
    }
    static get nextId() {
        return `harmony-panel-dummy-${++nextId}`;
    }
    /*
    static saveDisposition(): JSONObject {
        const list = document.getElementsByTagName('harmony-panel');
        const json: { panels: Record<string, any>, dummies: any[] } = { panels: {}, dummies: [] };
        for (const panel of list) {
            if (panel.id && panel.parentElement && panel.parentElement.id && panel.parentElement.tagName == 'HARMONY-PANEL') {
                json.panels[(panel as any).id] = { parent: panel.parentElement.id, size: (panel as any).size, direction: (panel as any).direction };
                if ((panel as HTMLHarmonyPanelElement).#isDummy) {
                    json.dummies.push((panel as any).id);
                }
            }
        }
        return json;
    }
    */
    /*
    static restoreDisposition(json: Record<string, any>): void {
        return;
        /*
        if (!json || !json.dummies || !json.panels) { return; }

        let dummiesList = new Map();
        for (let oldDummy of json.dummies) {
            let newDummy = HTMLHarmonyPanelElement._createDummy();
            document.body.append(newDummy);
            dummiesList.set(oldDummy, newDummy.id);
        }

        let list = document.getElementsByTagName('harmony-panel');
        for (let panel of list) {
            if (panel.id) {
                let p = json.panels[panel.id];
                if (p) {
                    if (p.size != 1 || panel._isDummy) {
                        panel.size = p.size;
                    }
                    panel.direction = p.direction;
                    let newParentId = dummiesList.get(p.parent) || p.parent;
                    if (p && newParentId) {
                        let parent = document.getElementById(newParentId);
                        /*if (!parent && p.dummy) {
                            parent = document.createElement('harmony-panel');
                        }* /
                        if (parent) {
                            parent.append(panel);
                        } else {
                            console.error('no parent', panel, newParentId);
                        }
                    }
                }
            }
        }* /
    }
    */
    adoptStyleSheet(styleSheet) {
        this.#shadowRoot.adoptedStyleSheets.push(styleSheet);
    }
    #handleMouseDown(event) {
        if (this.#isDraggable && event.button === 0) {
            _a.#draggedPanel = this;
        }
    }
    #startDrag() {
        if (_a.#dragging) {
            return;
        }
        _a.#dragging = true;
        _a.#dragMode = 'move';
        const rect = this.getBoundingClientRect();
        document.body.append(this);
        this.setFloating();
        this.#floatingWidth = this.#floatingWidth ?? rect.width;
        this.#floatingHeight = this.#floatingHeight ?? rect.height;
        this.style.left = `${rect.x}px`;
        this.style.top = `${rect.y}px`;
        this.style.width = `${this.#floatingWidth}px`;
        this.style.height = `${this.#floatingHeight}px`;
        this.style.position = 'absolute';
        _a.#deltaX = rect.x - _a.#startClientX;
        _a.#deltaY = rect.y - _a.#startClientY;
    }
    setFloating() {
        this.#floating = true;
        this.classList.add('floating');
        this.classList.remove('docked');
    }
    setDocked() {
        this.#floating = false;
        this.classList.remove('floating');
        this.classList.add('docked');
    }
    #drag(event) {
        if (!_a.#dragging) {
            return;
        }
        this.style.left = `${event.clientX + _a.#deltaX}px`;
        this.style.top = `${event.clientY + _a.#deltaY}px`;
        if (event.ctrlKey) {
            _a.#setTarget(null);
        }
        else {
            const panel = this.#getPanelAtMousePosition(event);
            _a.#setTarget(panel);
        }
    }
    #stopDrag() {
        _a.#dragging = false;
        _a.#dragMode = 'none';
        if (_a.#target) {
            _a.#target.append(this);
            this.setDocked();
            this.style = '';
        }
    }
    #resize(event) {
        if (_a.#dragMode !== 'resize' || !_a.#startRect) {
            return;
        }
        const deltaX = event.clientX - _a.#startClientX;
        const deltaY = event.clientY - _a.#startClientY;
        const rect = _a.#startRect;
        let deltaTop = 0, deltaWidth = 0, deltaHeight = 0, deltaLeft = 0;
        switch (_a.#resizeX) {
            case -1:
                deltaLeft += deltaX;
                deltaWidth -= deltaX;
                break;
            case 1:
                deltaWidth += deltaX;
                break;
        }
        switch (_a.#resizeY) {
            case -1:
                deltaTop += deltaY;
                deltaHeight -= deltaY;
                break;
            case 1:
                deltaHeight += deltaY;
                break;
        }
        this.#floatingWidth = rect.width + deltaWidth;
        this.#floatingHeight = rect.height + deltaHeight;
        this.style.left = `${rect.x + deltaLeft}px`;
        this.style.top = `${rect.y + deltaTop}px`;
        this.style.width = `${this.#floatingWidth}px`;
        this.style.height = `${this.#floatingHeight}px`;
    }
    #stopResize() {
        _a.#dragging = false;
        _a.#dragMode = 'none';
    }
    static #setTarget(target) {
        if (this.#target) {
            this.#target.#htmlHeader.classList.remove('target');
            this.#target.#htmlContent.classList.remove('target');
        }
        if (target) {
            target.#htmlHeader.classList.add('target');
            target.#htmlContent.classList.add('target');
        }
        this.#target = target;
    }
    static #handleDocumentMouseMove(event) {
        if (!this.#mouseDown || !this.#draggedPanel) {
            return;
        }
        switch (_a.#dragMode) {
            case 'none':
                const deltaX = event.clientX - this.#startClientX;
                const deltaY = event.clientY - this.#startClientY;
                if (deltaX * deltaX + deltaY * deltaY > DRAG_THRESHOLD) {
                    this.#draggedPanel.#startDrag();
                }
                break;
            case 'move':
                this.#draggedPanel.#drag(event);
                break;
            case 'resize':
                this.#draggedPanel.#resize(event);
                break;
        }
    }
    static #handleDocumentMouseDown(event) {
        this.#mouseDown = true;
        this.#startClientX = event.clientX;
        this.#startClientY = event.clientY;
    }
    static #handleDocumentMouseUp(event) {
        this.#mouseDown = false;
        _a.#dragging = false;
        _a.#dragMode = 'none';
        if (this.#draggedPanel) {
            this.#draggedPanel.#stopDrag();
            this.#draggedPanel.#stopResize();
        }
        this.#draggedPanel = undefined;
        this.#setTarget(null);
    }
    #getPanelAtMousePosition(event) {
        for (const panel of _a.#panels) {
            if (panel === this || !panel.isConnected) {
                continue;
            }
            const rect = panel.getBoundingClientRect();
            if (event.clientX >= rect.left
                && event.clientX < rect.right
                && event.clientY >= rect.top
                && event.clientY < rect.bottom) {
                return panel;
            }
        }
        return null;
    }
    #startResize(event, x, y) {
        if (_a.#dragMode !== 'none') {
            return;
        }
        _a.#dragMode = 'resize';
        _a.#resizeX = x;
        _a.#resizeY = y;
        _a.#startRect = this.getBoundingClientRect();
    }
}
_a = HTMLHarmonyPanelElement;

var Tf2Team;
(function (Tf2Team) {
    Tf2Team[Tf2Team["None"] = -1] = "None";
    Tf2Team[Tf2Team["Red"] = 0] = "Red";
    Tf2Team[Tf2Team["Blu"] = 1] = "Blu";
})(Tf2Team || (Tf2Team = {}));

const legacyWarpaints = new Map();
function setLegacyWarpaint(oldId, newId) {
    legacyWarpaints.set(oldId, newId.replace(/\~\d+/, ''));
}
function getLegacyWarpaint(id) {
    return legacyWarpaints.get(id) ?? id;
}

const NTAB = 32;
const IA = 16807;
const IM = 2147483647;
const IQ = 127773;
const IR = 2836;
const NDIV = (1 + (IM - 1) / NTAB);
const MAX_RANDOM_RANGE = 0x7FFFFFFF;
const AM = (1.0 / IM);
const EPS = 1.2e-7;
const RNMX = (1.0 - EPS);
class UniformRandomStream {
    #m_idum = 0;
    #m_iy = 0;
    #m_iv = [];
    constructor(seed = 0) {
        this.seed = seed;
    }
    set seed(seed) {
        this.#m_idum = ((seed < 0) ? seed : -seed);
        this.#m_iy = 0;
        this.#m_iv = new Array(NTAB);
    }
    #generateRandomNumber() {
        let j;
        let k;
        if (this.#m_idum <= 0 || !this.#m_iy) {
            if (-(this.#m_idum) < 1)
                this.#m_idum = 1;
            else
                this.#m_idum = -(this.#m_idum);
            for (j = NTAB + 7; j >= 0; j--) {
                k = Math.trunc((this.#m_idum) / IQ);
                this.#m_idum = Math.trunc(IA * (this.#m_idum - k * IQ) - IR * k);
                if (this.#m_idum < 0)
                    this.#m_idum += IM;
                if (j < NTAB)
                    this.#m_iv[j] = this.#m_idum;
            }
            this.#m_iy = this.#m_iv[0];
        }
        k = Math.trunc((this.#m_idum) / IQ);
        this.#m_idum = Math.trunc(IA * (this.#m_idum - k * IQ) - IR * k);
        if (this.#m_idum < 0)
            this.#m_idum += IM;
        j = Math.trunc(this.#m_iy / NDIV);
        // We're seeing some strange memory corruption in the contents of s_pUniformStream.
        // Perhaps it's being caused by something writing past the end of this array?
        // Bounds-check in release to see if that's the case.
        if (j >= NTAB || j < 0) {
            //DebuggerBreakIfDebugging();
            //Warning("CUniformRandomStream had an array overrun: tried to write to element %d of 0..31. Contact Tom or Elan.\n", j);
            // Ensure that NTAB is a power of two.
            //COMPILE_TIME_ASSERT( ( NTAB & ( NTAB - 1 ) ) == 0 );
            // Clamp j.
            j &= NTAB - 1;
        }
        this.#m_iy = this.#m_iv[j];
        this.#m_iv[j] = this.#m_idum;
        return this.#m_iy;
    }
    randomFloat(low = 0.0, high = 1.0) {
        let fl = AM * this.#generateRandomNumber();
        if (fl > RNMX) {
            fl = RNMX;
        }
        return fl * (high - low) + low;
    }
    randomFloatExp(low = 0.0, high = 1.0) {
        return Math.random() * (high - low) + low;
    }
    randomInt(low, high) {
        let x = (high - low) + 1;
        let n;
        if (x <= 1 || MAX_RANDOM_RANGE < x - 1) {
            return low;
        }
        let maxAcceptable = MAX_RANDOM_RANGE - ((MAX_RANDOM_RANGE + 1) % x);
        do {
            n = this.#generateRandomNumber();
        } while (n > maxAcceptable);
        return low + (n % x);
    }
}

const TYPE_STRING_TO_INT = {
    'DEF_TYPE_PAINTKIT_VARIABLES': 6,
    'DEF_TYPE_PAINTKIT_OPERATION': 7,
    'DEF_TYPE_PAINTKIT_ITEM_DEFINITION': 8,
    'DEF_TYPE_PAINTKIT_DEFINITION': 9,
    'DEF_TYPE_HEADER_ONLY': 10,
};
class WarpaintDefinitions {
    static warpaintDefinitionsPromise;
    static warpaintDefinitions;
    static #warpaintDefinitionsURL = '';
    static setWarpaintDefinitionsURL(url) {
        this.#warpaintDefinitionsURL = url;
    }
    static getWarpaintDefinitions() {
        if (!this.warpaintDefinitionsPromise) {
            this.warpaintDefinitionsPromise = new Promise(async (resolve, reject) => {
                let reponse = await fetch(this.#warpaintDefinitionsURL);
                this.warpaintDefinitions = await reponse.json();
                resolve(this.warpaintDefinitions);
            });
        }
        return this.warpaintDefinitionsPromise;
    }
    static setWarpaintDefinitions(warpaintDefinitions) {
        if (warpaintDefinitions) {
            this.warpaintDefinitionsPromise = new Promise(async (resolve) => {
                resolve(warpaintDefinitions);
            });
        }
        else {
            this.warpaintDefinitionsPromise = null;
        }
    }
    static async getDefinition(cMsgProtoDefID) {
        let warpaintDefinitions = await this.getWarpaintDefinitions();
        if (warpaintDefinitions) {
            let type = warpaintDefinitions[String(TYPE_STRING_TO_INT[String(cMsgProtoDefID.type)] ?? cMsgProtoDefID.type)];
            if (type) {
                return type[String(cMsgProtoDefID.defindex)];
            }
        }
        return null;
    }
}

new Promise((resolve) => resolve);

let blackTexture;
class Stage {
    static #textures = new Map();
    texturePath = '';
    specularTexturePath = '';
    node;
    #firstChild = null;
    #nextSibling = null;
    constructor(node) {
        this.node = node;
        if (!blackTexture) {
            Graphics.ready.then(() => {
                blackTexture = TextureManager.createFlatTexture({
                    webgpuDescriptor: {
                        size: {
                            width: 1,
                            height: 1,
                        },
                        format: 'rgba8unorm',
                        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
                    },
                    color: new Color$1(0, 0, 0)
                });
                blackTexture.addUser(1);
            });
        }
    }
    computeRandomValues(currentIndexObject, pRNGs, nRNGCount) {
        if (this.computeRandomValuesThis(pRNGs[currentIndexObject.currentIndex])) {
            currentIndexObject.currentIndex = (currentIndexObject.currentIndex + 1) % nRNGCount;
        }
        if (this.#firstChild) {
            this.#firstChild.computeRandomValues(currentIndexObject, pRNGs, nRNGCount);
        }
        if (this.#nextSibling) {
            this.#nextSibling.computeRandomValues(currentIndexObject, pRNGs, nRNGCount);
        }
    }
    computeRandomValuesThis(s) {
        throw new Error('subclass me' + s.seed);
    }
    set firstChild(stage) {
        this.#firstChild = stage;
    }
    get firstChild() {
        return this.#firstChild;
    }
    set nextSibling(stage) {
        this.#nextSibling = stage;
    }
    get nextSibling() {
        return this.#nextSibling;
    }
    appendChildren(children) {
        for (let i = children.length - 1; i >= 0; --i) {
            const childStage = children[i];
            //console.error(childStage);
            childStage.nextSibling = this.firstChild;
            this.firstChild = childStage;
        }
    }
    get displayName() {
        return this.constructor.name;
    }
    toString(tabs = '') {
        const ret = [];
        const tabs1 = tabs + '\t';
        ret.push(tabs + this.displayName);
        if (this.#firstChild) {
            ret.push(this.#firstChild.toString(tabs1));
        }
        if (this.#nextSibling) {
            ret.push(this.#nextSibling.toString(tabs));
        }
        return ret.join('\n');
    }
    linkNodes() {
        const node = this.node;
        const inputs = node.inputs.keys();
        let childStage = this.firstChild;
        while (childStage) {
            childStage.linkNodes();
            const input = inputs.next().value;
            const subNode = childStage.node;
            if (input) {
                node.setPredecessor(input, subNode, 'output');
            }
            childStage = childStage.nextSibling;
        }
    }
    async _setupTextures() {
        const texturePath = this.texturePath;
        if (texturePath) {
            this.node.setInputTexture(await Stage.getTexture(texturePath));
            this.node.setInitialParamValue(NodeParamOrigin.Code, 'path', texturePath);
            this.node.invalidate();
        }
        const specularTexturePath = this.specularTexturePath;
        if (specularTexturePath) {
            try {
                const specular = this.node.getInput('specular');
                if (specular) {
                    specular.setValue(await Stage.getSpecularTexture(texturePath));
                }
            }
            catch (e) {
                console.log(e);
            }
        }
    }
    async setupTextures() {
        const promises = new Set();
        promises.add(this._setupTextures());
        let childStage = this.firstChild;
        while (childStage) {
            promises.add(childStage.setupTextures());
            childStage = childStage.nextSibling;
        }
        await Promise.all(promises);
    }
    static async getTexture(texturePath, def) {
        if (!Stage.#textures.has(texturePath)) {
            const promise = Source1TextureManager.getTextureAsync('tf2', texturePath, 0, false, def, false);
            promise.then(texture => {
                if (!texture) {
                    Stage.#textures.delete(texturePath);
                }
            });
            Stage.#textures.set(texturePath, promise);
        }
        return await Stage.#textures.get(texturePath) ?? null;
    }
    static getSpecularTexture(specularTexturePath) {
        return this.getTexture(specularTexturePath, blackTexture);
    }
}

class Range {
    low;
    high;
    constructor(low = 0, high = 0) {
        this.low = low;
        this.high = high;
    }
}

class ApplyStickerStageParameters {
    possibleStickers = [];
    adjustBlack = new Range();
    adjustOffset = new Range(1, 1);
    adjustGamma = new Range(1, 1);
    bl = vec2.create();
    tl = vec2.create();
    tr = vec2.create();
}
class Sticker {
    fileName = '';
    weight = 1.0;
}
class ApplyStickerStage extends Stage {
    parameters = new ApplyStickerStageParameters();
    choice;
    computeRandomValuesThis(randomStream) {
        const parameters = this.parameters;
        const computeWeight = (accumulator, currentValue) => accumulator + currentValue.weight;
        const totalWeight = parameters.possibleStickers.reduce(computeWeight, 0);
        //console.error(totalWeight);
        let weight = randomStream.randomFloat(0.0, totalWeight);
        for (const [i, possibleSticker] of parameters.possibleStickers.entries()) {
            const thisWeight = possibleSticker.weight;
            if (weight < thisWeight) {
                this.choice = i;
                this.texturePath = parameters.possibleStickers[i].fileName;
                this.specularTexturePath = parameters.possibleStickers[i].fileName.replace(/\.vtf$/, '') + '_s';
                break;
            }
            else {
                weight -= thisWeight;
            }
        }
        if (this.choice == undefined) {
            throw new Error('error');
        }
        const adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        const adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        const adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        const adjustWhite = adjustBlack + adjustOffset;
        const node = this.node;
        /*node.params.adjustBlack = adjustBlack;
        node.params.adjustWhite = adjustWhite;
        node.params.adjustGamma = adjustGamma;*/
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust black', adjustBlack);
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust white', adjustWhite);
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust gamma', adjustGamma);
        node.setInitialParamValue(NodeParamOrigin.Code, 'bottom left', parameters.bl);
        node.setInitialParamValue(NodeParamOrigin.Code, 'top left', parameters.tl);
        node.setInitialParamValue(NodeParamOrigin.Code, 'top right', parameters.tr);
        //vec2.copy(node.params.bl, parameters.bl);
        //vec2.copy(node.params.tl, parameters.tl);
        //vec2.copy(node.params.tr, parameters.tr);
        node.invalidate();
        return true;
    }
}

class CombineStageParameters {
    adjustBlack = new Range();
    adjustOffset = new Range(1, 1);
    adjustGamma = new Range(1, 1);
}
class CombineStage extends Stage {
    combineMode;
    parameters = new CombineStageParameters();
    constructor(node, combineMode) {
        super(node);
        this.combineMode = combineMode;
    }
    computeRandomValuesThis(randomStream) {
        const parameters = this.parameters;
        const adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        const adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        const adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        const adjustWhite = adjustBlack + adjustOffset;
        const node = this.node;
        /*node.params.adjustBlack = adjustBlack;
        node.params.adjustWhite = adjustWhite;
        node.params.adjustGamma = adjustGamma;*/
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust black', adjustBlack);
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust white', adjustWhite);
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust gamma', adjustGamma);
        return true;
    }
    get displayName() {
        return this.combineMode;
    }
}

const TEXTURE_LOOKUP_NODE = 'texture lookup';
class SelectStageParameters {
}
class SelectStage extends Stage {
    nodeImageEditor;
    parameters = new SelectStageParameters();
    #textureSize;
    constructor(node, nodeImageEditor, textureSize) {
        super(node);
        this.nodeImageEditor = nodeImageEditor;
        this.#textureSize = textureSize;
    }
    computeRandomValuesThis() {
        return false;
    }
    async _setupTextures() {
        const texturePath = this.texturePath;
        if (texturePath) {
            const lookupNode = this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE, { textureSize: this.#textureSize });
            this.node.setPredecessor('input', lookupNode, 'output');
            const texture = await Stage.getTexture(texturePath);
            if (texture) {
                lookupNode.setInputTexture(texture);
            }
            //(lookupNode as any).texturePath = texturePath;
            lookupNode.invalidate();
            lookupNode.addEventListener(NodeEventType.ParamChanged, (event) => {
                (async () => {
                    const detail = event.detail;
                    if (detail.paramName === 'path' && detail.origin === NodeParamOrigin.Gui) {
                        const texture = await Stage.getTexture(detail.newValue);
                        if (texture) {
                            lookupNode.setInputTexture(texture);
                            lookupNode.revalidate({ updatePreview: true });
                        }
                    }
                })();
            });
        }
    }
}

class TextureStageParameters {
    adjustBlack = new Range();
    adjustOffset = new Range(1, 1);
    adjustGamma = new Range(1, 1);
    rotation = new Range();
    translateU = new Range();
    translateV = new Range();
    scaleUV = new Range(1, 1);
    allowFlipU = false;
    allowFlipV = false;
    texturePath = '';
}
class TextureStage extends Stage {
    texturePath = '';
    parameters = new TextureStageParameters();
    computeRandomValuesThis(randomStream) {
        const parameters = this.parameters;
        const shouldFlipU = parameters.allowFlipU ? randomStream.randomInt(0, 1) != 0 : false;
        const shouldFlipV = parameters.allowFlipV ? randomStream.randomInt(0, 1) != 0 : false;
        const translateU = randomStream.randomFloat(parameters.translateU.low, parameters.translateU.high);
        const translateV = randomStream.randomFloat(parameters.translateV.low, parameters.translateV.high);
        const rotation = randomStream.randomFloat(parameters.rotation.low, parameters.rotation.high);
        const scaleUV = randomStream.randomFloat(parameters.scaleUV.low, parameters.scaleUV.high);
        const adjustBlack = randomStream.randomFloat(parameters.adjustBlack.low, parameters.adjustBlack.high);
        const adjustOffset = randomStream.randomFloat(parameters.adjustOffset.low, parameters.adjustOffset.high);
        const adjustGamma = randomStream.randomFloat(parameters.adjustGamma.low, parameters.adjustGamma.high);
        const adjustWhite = adjustBlack + adjustOffset;
        const node = this.node;
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust black', adjustBlack);
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust white', adjustWhite);
        node.setInitialParamValue(NodeParamOrigin.Code, 'adjust gamma', adjustGamma);
        node.setInitialParamValue(NodeParamOrigin.Code, 'rotation', rotation * DEG_TO_RAD);
        node.setInitialParamValue(NodeParamOrigin.Code, 'translate u', translateU);
        node.setInitialParamValue(NodeParamOrigin.Code, 'translate v', translateV);
        node.setInitialParamValue(NodeParamOrigin.Code, 'scale u', scaleUV * (shouldFlipU ? -1 : 1));
        node.setInitialParamValue(NodeParamOrigin.Code, 'scale v', scaleUV * (shouldFlipV ? -1 : 1));
        node.setInitialParamValue(NodeParamOrigin.Code, 'path', parameters.texturePath);
        node.invalidate();
        return true;
    }
}

//const texturePathPrefixRemoveMe = '../gamecontent/tf2/materials/';//TODOv3 : put in constants
const TextureCombinerEventTarget = new EventTarget();
class TextureCombiner {
    static #textureSize = DEFAULT_TEXTURE_SIZE;
    static paintIds = {}; // TODO: turn to map ?
    static #imageExtension = '.vtf';
    static #textureApplyStickerNode = 'apply_sticker';
    static #lookupNodes = new Map();
    static nodeImageEditor = new NodeImageEditor();
    static variables = {};
    static setTextureSize(textureSize) {
        this.#textureSize = textureSize;
        this.nodeImageEditor.textureSize = textureSize;
    }
    static async _getDefindex(CMsgProtoDefID) {
        return WarpaintDefinitions.getDefinition(CMsgProtoDefID);
    }
    static async combinePaint(warpaintDefId, wearLevel, weaponDefIndex /*, outputTextureName: string, outputTexture: Texture*/, team, seed = 0n, updatePreview, textureSize = this.#textureSize) {
        this.#lookupNodes = new Map();
        const combinePaintFunction = async (resolve) => {
            //let finalPromise;
            if (warpaintDefId != undefined && wearLevel != undefined && weaponDefIndex != undefined) {
                this.nodeImageEditor.removeAllNodes();
                this.nodeImageEditor.clearVariables();
                const warpaintDefinition = await this._getDefindex({ type: 9, defindex: warpaintDefId });
                if (warpaintDefinition) {
                    let item = null;
                    for (const itemDefinitionKey in warpaintDefinition) {
                        const itemDefinitionPerItem = warpaintDefinition[itemDefinitionKey];
                        const itemDefinitionTemplate = itemDefinitionPerItem.itemDefinitionTemplate ?? itemDefinitionPerItem.item_definition_template;
                        if (itemDefinitionTemplate) {
                            const itemDefinition = await this._getDefindex(itemDefinitionTemplate);
                            if ((itemDefinition?.itemDefinitionIndex ?? itemDefinition?.item_definition_index) == weaponDefIndex) {
                                item = itemDefinitionPerItem;
                                break;
                            }
                        }
                    }
                    if (!item) {
                        //For legacy warpaints
                        const items = warpaintDefinition['item'];
                        if (items) {
                            for (const it of items) {
                                const itemDefinition = await this._getDefindex(it.itemDefinitionTemplate ?? it.item_definition_template);
                                if (getLegacyWarpaint(itemDefinition?.itemDefinitionIndex ?? itemDefinition?.item_definition_index) == weaponDefIndex) {
                                    item = it;
                                    break;
                                }
                            }
                        }
                    }
                    if (item) {
                        let template = warpaintDefinition.operationTemplate ?? warpaintDefinition.operation_template; // || item.itemDefinitionTemplate;
                        if (!template) {
                            const itemDefinitionTemplate = await this._getDefindex(item.itemDefinitionTemplate ?? item.item_definition_template);
                            if (itemDefinitionTemplate && itemDefinitionTemplate.definition && itemDefinitionTemplate.definition[wearLevel]) {
                                template = itemDefinitionTemplate.definition[wearLevel].operationTemplate ?? itemDefinitionTemplate.definition[wearLevel].operation_template;
                            }
                        }
                        if (template) {
                            const operationTemplate = await this._getDefindex(template);
                            //console.error(operationTemplate);//removeme
                            if (operationTemplate && (operationTemplate.operationNode ?? operationTemplate.operation_node)) {
                                const materialOverride = await this.#setupVariables(warpaintDefinition, wearLevel, item);
                                const stage = await this.#processOperationNode((operationTemplate.operationNode ?? operationTemplate.operation_node)[0], { team, textureSize }); //top level node has 1 operation
                                //console.error(stage.toString());
                                stage.linkNodes();
                                function GetSeed(seed) {
                                    const hilo = [BigInt(0), BigInt(0)];
                                    for (let i = 0n; i < 32n; ++i) {
                                        const i2 = 2n * i;
                                        for (let j = 0n; j < 2n; ++j) {
                                            hilo[Number(j)] |= (seed & (1n << (i2 + j))) >> (i + j);
                                        }
                                    }
                                    return hilo;
                                }
                                const [hi, lo] = GetSeed(seed);
                                const randomStreams = [new UniformRandomStream(Number(hi) << 0), new UniformRandomStream(Number(lo) << 0)];
                                stage.computeRandomValues({ currentIndex: 0 }, randomStreams, randomStreams.length);
                                await stage.setupTextures();
                                const finalNode = stage.node;
                                finalNode.autoRedraw = true;
                                //finalNode.getOutput('output')!._value = outputTexture;
                                /*
                                                                let processPixelArray = (pixelArray) => {
                                                                    this.pixelArray = pixelArray;
                                                                    if (outputTextureName) {
                                                                        //Source1TextureManager.addInternalTexture(this.#textureSize, this.#textureSize, pixelArray, outputTextureName);
                                                                        resolve(true);
                                                                        return;
                                                                    }
                                                                    resolve(false);
                                                                }*/
                                //let pixelArray = await node.getOutput('output').pixelArray;
                                //console.error(await node.toString());
                                //processPixelArray(pixelArray);
                                await finalNode.redraw({ updatePreview });
                                const texture = new AnimatedTexture(); // TODO: create a Texture instead ?
                                texture.addFrame(0, finalNode.getOutput('output')._value);
                                TextureCombinerEventTarget.dispatchEvent(new CustomEvent('paintdone', {
                                    detail: {
                                        warpaintDefId: warpaintDefId,
                                        wearLevel: wearLevel,
                                        weaponDefIndex: weaponDefIndex,
                                        //outputTextureName: outputTextureName,
                                        //outputTexture: outputTexture,
                                        seed: seed,
                                        node: finalNode,
                                    }
                                }));
                                resolve({ texture, materialOverride });
                                return;
                            }
                        }
                    }
                    resolve(null);
                }
            }
            else {
                resolve(null);
            }
            /*if (!finalPromise) {
                resolve(false);
            }*/
        };
        const combinePaintPromise = new Promise(resolve => { combinePaintFunction(resolve); });
        return combinePaintPromise;
    }
    static async #setupVariables(warpaintDefinition, wearLevel, item) {
        this.variables = {};
        let materialOverride = '';
        if (item) {
            if (item.data) {
                this.#addVariables(item.data.variable);
                materialOverride = item.data.materialOverride ?? '';
            }
            if (item.itemDefinitionTemplate ?? item.item_definition_template) {
                const itemDefinition = await this._getDefindex(item.itemDefinitionTemplate ?? item.item_definition_template);
                if (itemDefinition) {
                    if (itemDefinition.definition && itemDefinition.definition[wearLevel]) {
                        this.#addVariables(itemDefinition.definition[wearLevel].variable);
                    }
                    if (itemDefinition.header) {
                        this.#addVariables2(itemDefinition.header.variables);
                    }
                }
            }
        }
        if (warpaintDefinition.header) {
            this.#addVariables2(warpaintDefinition.header.variables);
        }
        return materialOverride;
    }
    static #addVariables(variableArray) {
        if (variableArray) {
            for (const v of variableArray) {
                //const v = variableArray[i];
                this.variables[v.variable] = v.string;
            }
        }
    }
    static #addVariables2(variableArray) {
        if (variableArray) {
            for (const v of variableArray) {
                //const v = variableArray[i];
                if ((v.inherit == false) || (this.variables[v.name] === undefined)) {
                    this.variables[v.name] = v.value;
                }
            }
        }
    }
    static async #processOperationNodeArray(operationNodeArray, context /*, parentStage: Stage*/) {
        const chidren = [];
        for (const operationNode of operationNodeArray) {
            const child = await this.#processOperationNode(operationNode, context /*, parentStage*/);
            if (child instanceof Array) {
                chidren.push(...child);
            }
            else {
                if (child) {
                    chidren.push(child);
                }
            }
        }
        return chidren;
    }
    static #getStageName(stage) {
        switch (true) {
            case stage.textureLookup != undefined:
            case stage.texture_lookup != undefined:
                return 'textureLookup';
            case stage.combineAdd != undefined:
            case stage.combine_add != undefined:
                return 'combine_add';
            case stage.combineLerp != undefined:
            case stage.combine_lerp != undefined:
                return 'combine_lerp';
            case stage.combineMultiply != undefined:
            case stage.combine_multiply != undefined:
                return 'multiply';
            case stage.select != undefined:
                return 'select';
            case stage.applySticker != undefined:
            case stage.apply_sticker != undefined:
                return 'applySticker';
            default:
                throw new Error('Unsuported stage');
        }
    }
    static async #processOperationNode(operationNode, context /*, parentStage: Stage/*, parentStage*/ /*, inputs*/) {
        let subStage = null;
        if (operationNode.stage) {
            const stage = operationNode.stage;
            let stage2 = null;
            let s;
            switch (true) {
                case stage.textureLookup != undefined:
                case stage.texture_lookup != undefined:
                    s = stage.textureLookup ?? stage.texture_lookup;
                    subStage = this.#processTextureStage(s, context);
                    stage2 = s;
                    break;
                case stage.combineAdd != undefined:
                case stage.combine_add != undefined:
                case stage.combineLerp != undefined:
                case stage.combine_lerp != undefined:
                case stage.combineMultiply != undefined:
                case stage.combine_multiply != undefined:
                    s = stage.combineAdd || stage.combine_add || stage.combineLerp || stage.combine_lerp || stage.combineMultiply || stage.combine_multiply;
                    subStage = this.#processCombineStage(s, this.#getStageName(stage), context);
                    stage2 = s;
                    break;
                case stage.select != undefined:
                    s = stage.select;
                    subStage = this.#processSelectStage(s, context);
                    stage2 = s;
                    break;
                case stage.applySticker != undefined:
                case stage.apply_sticker != undefined:
                    s = stage.applySticker ?? stage.apply_sticker;
                    subStage = this.#processApplyStickerStage(s, context);
                    stage2 = s;
                    break;
                default:
                    throw new Error('Unsuported stage');
            }
            if (stage2.operationNode ?? stage2.operation_node) {
                const chidren = await this.#processOperationNodeArray(stage2.operationNode ?? stage2.operation_node, context /*, subStage/*, node*/);
                if (subStage) {
                    subStage.appendChildren(chidren);
                }
            }
        }
        else if (operationNode.operationTemplate ?? operationNode.operation_template) {
            const template = await this._getDefindex(operationNode.operationTemplate ?? operationNode.operation_template);
            if (template && (template.operationNode ?? template.operation_node)) {
                //console.error('template.operationNode', template.operationNode.length, template.operationNode);
                const chidren = await this.#processOperationNodeArray(template.operationNode ?? template.operation_node, context /*, parentStage/*, node, inputs*/);
                return chidren;
            }
            else {
                throw new Error('Invalid template');
            }
        }
        else {
            throw new Error('Unsuported operationNode.operation_template');
        }
        /*
                if (false && subStage && node) {
                    let input = inputs.next().value;
                    console.error(input);
                    node.setPredecessor(input, subNode, 'output');
                }*/ /* else {
console.error('node or subnode is null', node, subNode);
}*/
        return subStage;
    }
    static #processCombineStage(stage, combineMode, context) {
        const node = this.nodeImageEditor.addNode(combineMode, { textureSize: context.textureSize });
        if (node) {
            return new CombineStage(node, combineMode);
        }
        return null;
    }
    /*
        async processCombineMultiplyStage(stage) {
            let node = this.nodeImageEditor.addNode('multiply');
            console.error('multiply');
            node.predecessorIndex = 0;
            /*if (stage.operationNode) {
                await this.#processOperationNodeArray(stage.operationNode, node);
            } else {
                throw 'Invalid stage';
            }* /
            return node;
        }

        async processCombineAddStage(stage) {
            let node = this.nodeImageEditor.addNode('combine_add');
            console.error('combine_add');
            node.predecessorIndex = 0;
            /*if (stage.operationNode) {
                await this.#processOperationNodeArray(stage.operationNode, node);
            } else {
                throw 'Invalid stage';
            }* /
            return node;
        }

        async processCombineLerpStage(stage) {
            let node = this.nodeImageEditor.addNode('combine_lerp');
            console.error('combine_lerp');
            node.predecessorIndex = 0;
            /*if (stage.operationNode) {
                await this.#processOperationNodeArray(stage.operationNode, node);
            } else {
                throw 'Invalid stage';
            }* /
            return node;
        }*/
    static #processTextureStage(stage, context) {
        let node = null;
        let texture;
        if (context.team == 0) {
            texture = (stage.textureRed ?? stage.texture_red) || stage.texture;
        }
        else {
            texture = (stage.textureBlue ?? stage.texture_blue) || stage.texture;
        }
        let texturePath = this.#getVarField(texture) ?? '';
        texturePath = texturePath.replace(/\.tga$/, '');
        if (texturePath) {
            //texturePathPrefixRemoveMe + texturePath + this.#imageExtension;
            if (!node) {
                node = this.nodeImageEditor.addNode(TEXTURE_LOOKUP_NODE, { textureSize: context.textureSize });
                node?.setInitialParamValue(NodeParamOrigin.Code, 'path', texturePath);
            }
        }
        if (!node) {
            return null;
        }
        node.addEventListener(NodeEventType.ParamChanged, (event) => {
            (async () => {
                const detail = event.detail;
                if (detail.paramName === 'path' && detail.origin === NodeParamOrigin.Gui) {
                    const texture = await Stage.getTexture(detail.newValue);
                    if (texture) {
                        node.setInputTexture(texture);
                        node.revalidate({ updatePreview: true });
                    }
                }
            })();
        });
        const textureStage = new TextureStage(node);
        textureStage.texturePath = texturePath;
        if (stage.adjustBlack ?? stage.adjust_black) {
            ParseRangeThenDivideBy(textureStage.parameters.adjustBlack, this.#getVarField(stage.adjustBlack ?? stage.adjust_black));
        }
        if (stage.adjustOffset ?? stage.adjust_offset) {
            ParseRangeThenDivideBy(textureStage.parameters.adjustOffset, this.#getVarField(stage.adjustOffset ?? stage.adjust_offset));
        }
        if (stage.adjustGamma ?? stage.adjust_gamma) {
            ParseInverseRange(textureStage.parameters.adjustGamma, this.#getVarField(stage.adjustGamma ?? stage.adjust_gamma));
        }
        if (stage.scaleUv ?? stage.scale_uv) {
            ParseRange(textureStage.parameters.scaleUV, this.#getVarField(stage.scaleUv ?? stage.scale_uv));
        }
        if (stage.rotation) {
            ParseRange(textureStage.parameters.rotation, this.#getVarField(stage.rotation));
        }
        if (stage.translateU ?? stage.translate_u) {
            ParseRange(textureStage.parameters.translateU, this.#getVarField(stage.translateU ?? stage.translate_u));
        }
        if (stage.translateV ?? stage.translate_v) {
            ParseRange(textureStage.parameters.translateV, this.#getVarField(stage.translateV ?? stage.translate_v));
        }
        if (stage.flipU ?? stage.flip_u) {
            textureStage.parameters.allowFlipU = Number(this.#getVarField(stage.flipU ?? stage.flip_u) ?? 0) != 0;
        }
        if (stage.flipV ?? stage.flip_v) {
            textureStage.parameters.allowFlipV = Number(this.#getVarField(stage.flipV ?? stage.flip_v) ?? 0) != 0;
        }
        return textureStage;
    }
    static #processSelectStage(stage, context) {
        const selectParametersNode = this.nodeImageEditor.addNode('int array', { length: 16, textureSize: context.textureSize });
        if (!selectParametersNode) {
            return null;
        }
        const selectNode = this.nodeImageEditor.addNode('select', { textureSize: context.textureSize });
        if (!selectNode) {
            return null;
        }
        const selectStage = new SelectStage(selectNode, this.nodeImageEditor, context.textureSize);
        selectNode.setPredecessor('selectvalues', selectParametersNode, 'output');
        if (stage.groups) {
            selectStage.texturePath = this.#getVarField(stage.groups) ?? '';
        }
        if (stage.select) {
            //selectNode.params.threshold = [];
            const arr = stage.select;
            for (let i = 0; i < arr.length; i++) {
                const varField = arr[i];
                const level = this.#getVarField(varField) ?? '0';
                selectParametersNode.setValue(i, parseInt(level));
            }
        }
        selectNode.invalidate();
        return selectStage;
    }
    static #processApplyStickerStage(stage, context) {
        const applyStickerNode = this.nodeImageEditor.addNode(this.#textureApplyStickerNode, { textureSize: context.textureSize });
        if (!applyStickerNode) {
            return null;
        }
        applyStickerNode.addEventListener(NodeEventType.ParamChanged, (event) => {
            (async () => {
                const detail = event.detail;
                if (detail.paramName === 'path' && detail.origin === NodeParamOrigin.Gui) {
                    const texture = await Stage.getTexture(detail.newValue);
                    if (texture) {
                        applyStickerNode.setInputTexture(texture);
                        applyStickerNode.revalidate({ updatePreview: true });
                    }
                }
            })();
        });
        const applyStickerStage = new ApplyStickerStage(applyStickerNode);
        if (stage.adjustBlack ?? stage.adjust_black) {
            ParseRangeThenDivideBy(applyStickerStage.parameters.adjustBlack, this.#getVarField(stage.adjustBlack ?? stage.adjust_black));
        }
        if (stage.adjustOffset ?? stage.adjust_offset) {
            ParseRangeThenDivideBy(applyStickerStage.parameters.adjustOffset, this.#getVarField(stage.adjustOffset ?? stage.adjust_offset));
        }
        if (stage.adjustGamma ?? stage.adjust_gamma) {
            ParseInverseRange(applyStickerStage.parameters.adjustGamma, this.#getVarField(stage.adjustGamma ?? stage.adjust_gamma));
        }
        if (stage.destBl ?? stage.dest_bl) {
            ParseVec2(applyStickerStage.parameters.bl, this.#getVarField(stage.destBl ?? stage.dest_bl));
        }
        if (stage.destTl ?? stage.dest_tl) {
            ParseVec2(applyStickerStage.parameters.tl, this.#getVarField(stage.destTl ?? stage.dest_tl));
        }
        if (stage.destTr ?? stage.dest_tr) {
            ParseVec2(applyStickerStage.parameters.tr, this.#getVarField(stage.destTr ?? stage.dest_tr));
        }
        if (stage.sticker) {
            const arr = stage.sticker;
            for (const operationSticker of arr) {
                //const operationSticker = arr[i];
                const sticker = new Sticker();
                sticker.fileName = this.#getVarField(operationSticker.base) ?? '';
                if (operationSticker.weight) {
                    sticker.weight = Number(this.#getVarField(operationSticker.weight) ?? 1);
                }
                applyStickerStage.parameters.possibleStickers.push(sticker);
            }
        }
        else {
            throw new Error('No sticker defined');
        }
        applyStickerNode.invalidate();
        return applyStickerStage;
    }
    static #getVarField(field) {
        if (!field) {
            return null;
        }
        if (field.variable) {
            const v = this.variables[field.variable];
            if (v) {
                return v;
            }
        }
        return field.string;
    }
}
function ParseRange(output, input) {
    if (!input) {
        output.low = 0;
        output.high = 0;
        return;
    }
    input = input.trim();
    const range = input.split(/\s+/);
    switch (range.length) {
        case 1:
            output.low = Number(range[0]);
            output.high = output.low;
            break;
        case 2:
            output.low = Number(range[0]);
            output.high = Number(range[1]);
            break;
        default:
            console.error('Wrong range expression : ', input);
            break;
    }
}
function ParseVec2(output, input) {
    if (!input) {
        output[0] = 0;
        output[1] = 0;
        return;
    }
    input = input.trim();
    const range = input.split(' ');
    if (range.length == 2) {
        output[0] = Number(range[0]);
        output[1] = Number(range[1]);
    }
}
function ParseInverseRange(output, input) {
    ParseRange(output, input);
    if (output.low) {
        output.low = 1.0 / output.low;
    }
    if (output.high) {
        output.high = 1.0 / output.high;
    }
}
function ParseRangeThenDivideBy(output, input, div = 255) {
    ParseRange(output, input);
    output.low /= div;
    output.high /= div;
}

var WeaponManagerEvents;
(function (WeaponManagerEvents) {
    WeaponManagerEvents["AddWarpaint"] = "addwarpaint";
    WeaponManagerEvents["Started"] = "started";
    WeaponManagerEvents["Success"] = "success";
    WeaponManagerEvents["Failure"] = "failure";
})(WeaponManagerEvents || (WeaponManagerEvents = {}));
class WeaponManager extends StaticEventTarget {
    static #htmlWeaponsDiv;
    static #htmlPaintsDiv;
    static weapons = {};
    static collections = {};
    static weaponName = '';
    static warpaintName = '';
    static asyncRequestId = 0;
    static #protoElements = {};
    static protoDefs = null;
    static shouldRequestItems = true;
    static itemsDef = null;
    static itemsReady = false;
    static containerPerWeapon = {};
    static #itemQueue = [];
    static currentItem;
    static weaponId = 0;
    static #materialOverride = new Map();
    static async initWarpaintDefinitions(url) {
        const response = await fetch(url);
        this.protoDefs = await response.json();
        await this.refreshWarpaintDefinitions();
    }
    static async refreshWarpaintDefinitions() {
        const definitions = await WarpaintDefinitions.getWarpaintDefinitions();
        if (definitions) {
            this.#protoElements = definitions;
            const warpaintDefinitions = definitions[9];
            for (const warpaintDefId in warpaintDefinitions) {
                const definition = warpaintDefinitions[warpaintDefId];
                const token = this.protoDefs ? this.protoDefs[(definition.locDesctoken ?? definition.loc_desctoken)] || (definition.locDesctoken ?? definition.loc_desctoken) : (definition.locDesctoken ?? definition.loc_desctoken);
                this.#addWarpaint(definition, token);
            }
        }
    }
    static initView(container) {
        this.#htmlWeaponsDiv = document.createElement('div');
        this.#htmlWeaponsDiv.className = 'weaponsDiv';
        this.#htmlPaintsDiv = document.createElement('div');
        this.#htmlPaintsDiv.className = 'paintsDiv';
        if (container) {
            container.appendChild(this.#htmlWeaponsDiv);
            container.appendChild(this.#htmlPaintsDiv);
        }
    }
    static #addWarpaint(warpaint, descToken) {
        const cMsgWarpaintDefinition = this.#protoElements[9][warpaint.header.defindex];
        const warpaintItemDefinitions = this.#protoElements[8];
        if (cMsgWarpaintDefinition) {
            const itemList = this.getItemList(cMsgWarpaintDefinition);
            for (const weaponName in itemList) {
                const itemDefinition = warpaintItemDefinitions[itemList[weaponName]];
                if (itemDefinition) {
                    this.#addWeapon(warpaint, warpaint.header.defindex, weaponName, itemList[weaponName], itemDefinition.itemDefinitionIndex ?? itemDefinition.item_definition_index, descToken);
                }
            }
        }
        return;
    }
    static #addWeapon(warpaint, weaponPaint, weapon, defindex, itemDefinitionIndex, descToken) {
        //let wep = this.itemsDef?.[itemDefinitionIndex] || this.itemsDef?.[itemDefinitionIndex + '~0'] ;
        const wep = { name: weapon };
        if (wep) {
            let weaponDiv = this.containerPerWeapon[wep.name];
            if (!weaponDiv) {
                weaponDiv = createElement('div');
                weaponDiv.className = 'weaponDiv';
                this.#htmlPaintsDiv?.appendChild(weaponDiv);
                this.containerPerWeapon[wep.name] = weaponDiv;
                //weaponDiv.innerHTML = wep.name;
                const input = document.createElement('input');
                input.className = 'displayNone';
                input.id = 'weapon-' + this.weaponId;
                input.name = 'accordion';
                input.type = 'radio';
                const label = document.createElement('label');
                label.htmlFor = 'weapon-' + this.weaponId;
                label.innerText = wep.name;
                const subContainer = document.createElement('div');
                subContainer.className = 'paintsDiv';
                weaponDiv /*TODO: create a map*/.subContainer = subContainer;
                weaponDiv.appendChild(input);
                weaponDiv.appendChild(label);
                weaponDiv.appendChild(subContainer);
                ++this.weaponId;
            }
            //const subContainer = weaponDiv.subContainer;
            //weaponDiv.weaponPaint = weaponPaint;
            weaponDiv /*TODO: create a map*/.weapon = weapon;
            weaponDiv /*TODO: create a map*/.itemDefinitionIndex = itemDefinitionIndex;
            this.#htmlWeaponsDiv?.appendChild(weaponDiv);
            this.dispatchEvent(new CustomEvent(WeaponManagerEvents.AddWarpaint, {
                detail: {
                    p1: itemDefinitionIndex,
                    p2: weaponPaint,
                    p3: weapon,
                    p4: descToken
                }
            }));
        }
    }
    static getItemList(cMsgWarpaintDefinition) {
        const itemList = {};
        for (const propertyName in cMsgWarpaintDefinition) {
            const warpaintDefinitionItem = cMsgWarpaintDefinition[propertyName];
            if (warpaintDefinitionItem) {
                if (propertyName == 'item') {
                    for (let i = 0; i < warpaintDefinitionItem.length; i++) {
                        const warpaintDefinitionItem2 = warpaintDefinitionItem[i];
                        if (warpaintDefinitionItem2.itemDefinitionTemplate ?? warpaintDefinitionItem2.item_definition_template) {
                            itemList['item' + i] = (warpaintDefinitionItem2.itemDefinitionTemplate ?? warpaintDefinitionItem2.item_definition_template).defindex;
                        }
                    }
                }
                else {
                    if (warpaintDefinitionItem.itemDefinitionTemplate ?? warpaintDefinitionItem.item_definition_template) {
                        itemList[propertyName] = (warpaintDefinitionItem.itemDefinitionTemplate ?? warpaintDefinitionItem.item_definition_template).defindex;
                    }
                }
            }
        }
        return itemList;
    }
    static refreshWarpaint(item, clearQueue = false) {
        if (clearQueue) {
            this.#itemQueue = [];
        }
        this.#itemQueue.push(item);
        this.#processNextItemInQueue();
    }
    static #processNextItemInQueue() {
        const mc = new MessageChannel();
        mc.port1.onmessage = () => { this.#processNextItemInQueue2(); };
        mc.port2.postMessage(null);
    }
    static async #processNextItemInQueue2() {
        if (!this.currentItem && this.#itemQueue.length) {
            this.currentItem = this.#itemQueue.shift();
            const ci = this.currentItem;
            const textureName = `#warpaint_${ci.id.replace(/\~\d+/, '')}_${ci.warpaintId}_${ci.warpaintWear}_${ci.warpaintSeed}_${ci.team}_${ci.textureSize ?? ''}`;
            const existingTexture = Source1TextureManager.getInternalTexture(ci.model?.sourceModel.repository ?? '', textureName, 0 /*, false*/);
            if (existingTexture) {
                ci.model?.setMaterialParam('WeaponSkin', textureName);
                const materialOverride = this.#materialOverride.get(textureName) ?? null;
                ci.model?.setMaterialOverride(materialOverride);
                this.currentItem = undefined;
                this.#processNextItemInQueue();
                return;
            }
            //const { /*name: textureName,*/ texture } = Source1TextureManager.addInternalTexture(ci.model?.sourceModel.repository ?? '', textureName);
            if (ci.warpaintId !== undefined) {
                this.dispatchEvent(new CustomEvent(WeaponManagerEvents.Started, { detail: ci }));
                const promise = TextureCombiner.combinePaint(ci.warpaintId, ci.warpaintWear, ci.id.replace(/\~\d+/, ''), /*textureName, texture.getFrame(0)!, */ ci.team, ci.warpaintSeed, ci.updatePreview, ci.textureSize);
                //this._textureCombiner.nodeImageEditor.setOutputTextureName(textureName);
                promise.then(async (result) => {
                    const texture = result?.texture;
                    const materialOverride = result?.materialOverride;
                    if (texture) {
                        Source1TextureManager.setTexture(ci.model?.sourceModel.repository ?? '', textureName, texture);
                        texture.setAlphaBits(8);
                        if (materialOverride) {
                            const material = await Source1MaterialManager.getMaterial(ci.model?.sourceModel.repository ?? '', materialOverride);
                            ci.model?.setMaterialOverride(material);
                            this.#materialOverride.set(textureName, material);
                        }
                        else {
                            ci.model?.setMaterialOverride(null);
                            this.#materialOverride.set(textureName, null);
                        }
                        ci.model?.setMaterialParam('WeaponSkin', textureName);
                        this.dispatchEvent(new CustomEvent(WeaponManagerEvents.Success, { detail: ci }));
                    }
                    else {
                        this.dispatchEvent(new CustomEvent(WeaponManagerEvents.Failure, { detail: ci }));
                    }
                    this.currentItem = undefined;
                    this.#processNextItemInQueue();
                });
                promise.catch((e) => {
                    this.dispatchEvent(new CustomEvent(WeaponManagerEvents.Failure, { detail: ci }));
                    console.error('Promise processNextItemInQueue KO', e);
                    this.currentItem = undefined;
                    this.#processNextItemInQueue();
                });
            }
            else {
                this.currentItem = undefined;
                this.#processNextItemInQueue();
            }
        }
    }
}

var RepositoryDisplayMode;
(function (RepositoryDisplayMode) {
    RepositoryDisplayMode["Flat"] = "flat";
    RepositoryDisplayMode["Tree"] = "tree";
})(RepositoryDisplayMode || (RepositoryDisplayMode = {}));

var killstreaks = [{id:0,name:"No sheen",sheen_red:"000000",color1_red:"000000",color2_red:"000000"},{id:1,name:"Team shine",sheen_red:"C8140F",sheen_blu:"2862C8",color1_red:"FF7676",color2_red:"FF231C",color1_blu:"005CFF",color2_blu:"86CBF3",team:true},{id:2,name:"Deadly Daffodil",sheen_red:"F2AC0A",color1_red:"FFED8A",color2_red:"FFD541"},{id:3,name:"Manndarin",sheen_red:"FF4B05",color1_red:"FF6F05",color2_red:"FF891F"},{id:4,name:"Mean green",sheen_red:"64FF0A",color1_red:"E6FF3C",color2_red:"C1FF3D"},{id:5,name:"Agonizing Emerald",sheen_red:"28FF46",color1_red:"67FF79",color2_red:"A5FFC1"},{id:6,name:"Villainous Violet",sheen_red:"6914FF",color1_red:"6914FF",color2_red:"B991FF"},{id:7,name:"Hotrod",sheen_red:"FF1EFF",color1_red:"FF78FF",color2_red:"FFB0D9"}];

var KillstreakColor;
(function (KillstreakColor) {
    KillstreakColor[KillstreakColor["None"] = 0] = "None";
    KillstreakColor[KillstreakColor["TeamShine"] = 1] = "TeamShine";
    KillstreakColor[KillstreakColor["DeadlyDaffodil"] = 2] = "DeadlyDaffodil";
    KillstreakColor[KillstreakColor["Manndarin"] = 3] = "Manndarin";
    KillstreakColor[KillstreakColor["MeanGreen"] = 4] = "MeanGreen";
    KillstreakColor[KillstreakColor["AgonizingEmerald"] = 5] = "AgonizingEmerald";
    KillstreakColor[KillstreakColor["VillainousViolet"] = 6] = "VillainousViolet";
    KillstreakColor[KillstreakColor["Hotrod"] = 7] = "Hotrod";
    KillstreakColor[KillstreakColor["Custom"] = 1000] = "Custom";
})(KillstreakColor || (KillstreakColor = {}));
const killstreakList = new Map();
for (const killstreakJSON of killstreaks) {
    killstreakList.set(killstreakJSON.id, {
        id: killstreakJSON.id,
        name: killstreakJSON.name,
        sheen: killstreakJSON.id,
        teamColored: killstreakJSON.team ?? false,
        sheenRed: parseInt(killstreakJSON.sheen_red, 16),
        sheenBlu: parseInt(killstreakJSON.sheen_blu ?? killstreakJSON.sheen_red, 16),
        color1Red: parseInt(killstreakJSON.color1_red, 16),
        color1Blu: parseInt(killstreakJSON.color1_blu ?? killstreakJSON.color1_red, 16),
        color2Red: parseInt(killstreakJSON.color2_red, 16),
        color2Blu: parseInt(killstreakJSON.color2_blu ?? killstreakJSON.color2_red, 16),
    });
}
function getKillstreak(killstreak) {
    const killstreakDefinition = killstreakList.get(killstreak);
    if (killstreakDefinition) {
        return new Killstreak(killstreakDefinition);
    }
    return null;
}
function colorToTint$1(color, tint) {
    tint[0] = ((color & 0xFF0000) >> 16) / 255.0;
    tint[1] = ((color & 0x00FF00) >> 8) / 255.0;
    tint[2] = ((color & 0x0000FF) >> 0) / 255.0;
}
/**
 * A TF2 Sheen
 */
class Killstreak {
    id;
    #name;
    killstreak;
    #sheenRed = vec3.create();
    #sheenBlu = vec3.create();
    #color1Red = vec3.create();
    #color1Blu = vec3.create();
    #color2Red = vec3.create();
    #color2Blu = vec3.create();
    teamColored;
    constructor(definition) {
        this.id = definition.id;
        this.#name = definition.name;
        this.killstreak = definition.sheen;
        colorToTint$1(definition.sheenRed, this.#sheenRed);
        colorToTint$1(definition.sheenBlu, this.#sheenBlu);
        colorToTint$1(definition.color1Red, this.#color1Red);
        colorToTint$1(definition.color1Blu, this.#color1Blu);
        colorToTint$1(definition.color2Red, this.#color2Red);
        colorToTint$1(definition.color2Blu, this.#color2Blu);
        this.teamColored = definition.teamColored;
    }
    /**
     * Compute the sheen color for the given team
     * @param team The team to compute the color for
     * @returns vec3
     */
    getSheenColor(team) {
        return vec3.clone(team == Team.Red ? this.#sheenRed : this.#sheenBlu);
    }
    getKillstreakColor1(team) {
        return vec3.clone(team == Team.Red ? this.#color1Red : this.#color1Blu);
    }
}

var paints = [{id:0,name:"No paint",tint_red:0},{id:1,name:"Indubitably Green",tint_red:7511618},{id:2,name:"Zepheniah's Greed",tint_red:4345659},{id:3,name:"Noble Hatter's Violet",tint_red:5322826},{id:4,name:"Color No. 216-190-216",tint_red:14204632},{id:5,name:"A Deep Commitment to Purple",tint_red:8208497},{id:6,name:"Mann Co. Orange",tint_red:13595446},{id:7,name:"Muskelmannbraun",tint_red:10843461},{id:8,name:"Peculiarly Drab Tincture",tint_red:12955537},{id:9,name:"Radigan Conagher Brown",tint_red:6901050},{id:10,name:"Ye Olde Rustic Colour",tint_red:8154199},{id:11,name:"Australium Gold",tint_red:15185211},{id:12,name:"Aged Moustache Grey",tint_red:8289918},{id:13,name:"An Extraordinary Abundance of Tinge",tint_red:15132390},{id:14,name:"A Distinctive Lack of Hue",tint_red:1315860},{id:15,name:"Pink as Hell",tint_red:16738740},{id:16,name:"A Color Similar to Slate",tint_red:3100495},{id:17,name:"Drably Olive",tint_red:8421376},{id:18,name:"The Bitter Taste of Defeat and Lime",tint_red:3329330},{id:19,name:"The Color of a Gentlemann's Business Pants",tint_red:15787660},{id:20,name:"Dark Salmon Injustice",tint_red:15308410},{id:21,name:"A Mann's Mint",tint_red:12377523},{id:22,name:"After Eight",tint_red:2960676},{id:101,name:"Team Spirit",tint_red:12073019,tint_blu:5801378,team:true},{id:102,name:"Operator's Overalls",tint_red:4732984,tint_blu:3686984,team:true},{id:103,name:"Waterlogged Lab Coat",tint_red:11049612,tint_blu:8626083,team:true},{id:104,name:"Balaclavas Are Forever",tint_red:3874595,tint_blu:1581885,team:true},{id:105,name:"An Air of Debonair",tint_red:6637376,tint_blu:2636109,team:true},{id:106,name:"The Value of Teamwork",tint_red:8400928,tint_blu:2452877,team:true},{id:107,name:"Cream Spirit",tint_red:12807213,tint_blu:12091445,team:true},{id:201,name:"Putrescent Pigmentation",tint_red:13158400,spell:true},{id:202,name:"Die Job",tint_red:16776960,spell:true},{id:203,name:"Chromatic Corruption",tint_red:8208497,spell:true},{id:204,name:"Spectral Spectrum",tint_red:12073019,tint_blu:5801378,team:true,spell:true},{id:205,name:"Sinister Staining",tint_red:8421376,spell:true}];

var Paints;
(function (Paints) {
    Paints[Paints["None"] = 0] = "None";
    // Regular paints
    Paints[Paints["IndubitablyGreen"] = 1] = "IndubitablyGreen";
    Paints[Paints["ZepheniahsGreed"] = 2] = "ZepheniahsGreed";
    Paints[Paints["NobleHattersViolet"] = 3] = "NobleHattersViolet";
    Paints[Paints["ColorNo216_190_216"] = 4] = "ColorNo216_190_216";
    Paints[Paints["ADeepCommitmentToPurple"] = 5] = "ADeepCommitmentToPurple";
    Paints[Paints["MannCoOrange"] = 6] = "MannCoOrange";
    Paints[Paints["Muskelmannbraun"] = 7] = "Muskelmannbraun";
    Paints[Paints["PeculiarlyDrabTincture"] = 8] = "PeculiarlyDrabTincture";
    Paints[Paints["RadiganConagherBrown"] = 9] = "RadiganConagherBrown";
    Paints[Paints["YeOldeRusticColour"] = 10] = "YeOldeRusticColour";
    Paints[Paints["AustraliumGold"] = 11] = "AustraliumGold";
    Paints[Paints["AgedMoustacheGrey"] = 12] = "AgedMoustacheGrey";
    Paints[Paints["AnExtraordinaryAbundanceOfTinge"] = 13] = "AnExtraordinaryAbundanceOfTinge";
    Paints[Paints["ADistinctiveLackOfHue"] = 14] = "ADistinctiveLackOfHue";
    Paints[Paints["PinkAsHell"] = 15] = "PinkAsHell";
    Paints[Paints["AColorSimilarToSlate"] = 16] = "AColorSimilarToSlate";
    Paints[Paints["DrablyOlive"] = 17] = "DrablyOlive";
    Paints[Paints["TheBitterTasteOfDefeatAndLime"] = 18] = "TheBitterTasteOfDefeatAndLime";
    Paints[Paints["TheColorOfAGentlemannsBusinessPants"] = 19] = "TheColorOfAGentlemannsBusinessPants";
    Paints[Paints["DarkSalmonInjustice"] = 20] = "DarkSalmonInjustice";
    Paints[Paints["AMannsMint"] = 21] = "AMannsMint";
    Paints[Paints["AfterEight"] = 22] = "AfterEight";
    // Team colored paints
    Paints[Paints["TeamSpirit"] = 101] = "TeamSpirit";
    Paints[Paints["OperatorsOveralls"] = 102] = "OperatorsOveralls";
    Paints[Paints["WaterloggedLabCoat"] = 103] = "WaterloggedLabCoat";
    Paints[Paints["BalaclavasAreForever"] = 104] = "BalaclavasAreForever";
    Paints[Paints["AnAirOfDebonair"] = 105] = "AnAirOfDebonair";
    Paints[Paints["TheValueOfTeamwork"] = 106] = "TheValueOfTeamwork";
    // Halloween Spells
    Paints[Paints["PutrescentPigmentation"] = 201] = "PutrescentPigmentation";
    Paints[Paints["DieJob"] = 202] = "DieJob";
    Paints[Paints["ChromaticCorruption"] = 203] = "ChromaticCorruption";
    Paints[Paints["SpectralSpectrum"] = 204] = "SpectralSpectrum";
    Paints[Paints["SinisterStaining"] = 205] = "SinisterStaining";
    Paints[Paints["Custom"] = 1000] = "Custom";
})(Paints || (Paints = {}));
const paintList = new Map();
for (const paintJSON of paints) {
    paintList.set(paintJSON.id, {
        id: paintJSON.id,
        name: paintJSON.name,
        paint: paintJSON.id,
        teamColored: paintJSON.team ?? false,
        tintRed: paintJSON.tint_red,
        tintBlu: paintJSON.tint_blu ?? paintJSON.tint_red,
        spell: paintJSON.spell ?? false,
    });
}
function getPaint(paint) {
    const paintDefinition = paintList.get(paint);
    if (paintDefinition) {
        return new Paint(paintDefinition);
    }
    return null;
}
function colorToTint(color, tint) {
    tint[0] = ((color & 0xFF0000) >> 16) / 255.0;
    tint[1] = ((color & 0x00FF00) >> 8) / 255.0;
    tint[2] = ((color & 0x0000FF) >> 0) / 255.0;
}
const kSamplePoints = 256;
/**
 * A TF2 paint
 */
class Paint {
    id;
    #name;
    paint;
    #tintRed = vec3.create();
    #tintBlu = vec3.create();
    #tint = vec3.create();
    spell;
    teamColored;
    time;
    constructor(definition) {
        this.id = definition.id;
        this.#name = definition.name;
        this.paint = definition.paint;
        colorToTint(definition.tintRed, this.#tintRed);
        colorToTint(definition.tintBlu, this.#tintBlu);
        this.spell = definition.spell;
        this.teamColored = definition.teamColored;
    }
    /**
     * Compute the paint tint for the given team
     * @param team The team to compute the tint for
     * @returns vec3
     */
    getTint(team) {
        if (this.spell) {
            //if (!this.computed) {
            this.#computeTint(team, this.time ?? performance.now() * 0.001);
            //}
            return this.#tint;
        }
        return team == Team.Red ? this.#tintRed : this.#tintBlu;
    }
    #computeTint(team, time) {
        if (team == Team.Red) {
            vec3.copy(this.#tint, this.#tintRed);
        }
        else {
            vec3.copy(this.#tint, this.#tintBlu);
        }
        if (this.spell) {
            //if (!this.computed)
            {
                const paintSamples = team == Team.Red ? pointSampleContentTeamRed.get(this.paint) : pointSampleContentTeamBlu.get(this.paint);
                if (paintSamples) {
                    const fScaledTime = time * 22.0;
                    const unSamplePoint0 = Math.floor(fScaledTime) % kSamplePoints;
                    // TODO: lerp between two samples
                    //const unSamplePoint1 = (unSamplePoint0 + 1) % kSamplePoints;
                    const color = paintSamples[unSamplePoint0];
                    const b = (color & 0x000000FF);
                    const g = (color & 0x0000FF00) >> 8;
                    const r = (color & 0x00FF0000) >> 16;
                    this.#tint[0] = r / 255.0;
                    this.#tint[1] = g / 255.0;
                    this.#tint[2] = b / 255.0;
                }
            }
        }
    }
}
const k_unWitchYellow = [
    5328971, 5328971, 5328971, 5328971, 5328971, 5328971, 5328971, 5328971,
    5328971, 5328971, 5395018, 5591625, 5723465, 5855050, 5921095, 6052679,
    6315591, 6447429, 6513222, 6710852, 7039299, 7170884, 7433793, 7631425,
    7894336, 8222784, 8354622, 8618045, 8815420, 9078333, 9406779, 9604411,
    9802040, 10064952, 10328376, 10459959, 10722870, 11051318, 11314483, 11511859,
    11709490, 11841074, 12103729, 12301360, 12498479, 12630063, 12761901, 12959022,
    13090604, 13156651, 13288236, 13485099, 13616683, 13682474, 13748010, 13813801,
    13945386, 13945386, 14011433, 14011433, 14011433, 13945386, 13945386, 13879594,
    13814314, 13813801, 13748010, 13682474, 13616681, 13616683, 13550890, 13550890,
    13354027, 13288234, 13288236, 13222443, 13222443, 13156651, 13156651, 13025322,
    13025324, 12959531, 12893740, 12893740, 12893740, 12762413, 12696621, 12696621,
    12630828, 12630574, 12630574, 12499760, 12433713, 12433713, 12367922, 12302642,
    12302387, 12236596, 12236598, 12171575, 12105528, 12039736, 11908409, 11974204,
    11908413, 11842880, 11842880, 11842880, 11908421, 11776837, 11645765, 11579973,
    11579975, 11514182, 11448137, 11382344, 11316298, 11184712, 11053387, 11053387,
    10921802, 10855755, 10724941, 10659150, 10658896, 10527311, 10527057, 10395986,
    10330195, 10264147, 10264147, 10264149, 10263895, 10198104, 10132313, 10198106,
    10132058, 10263133, 10263133, 10328928, 10394721, 10394723, 10328675, 10394981,
    10460263, 10526056, 10329190, 10394983, 10329188, 10394723, 10328928, 10328926,
    10526042, 10526040, 10394452, 10459985, 10394446, 10460235, 10525511, 10525763,
    10657089, 10657341, 10723131, 10854456, 10920502, 11183156, 11380273, 11512111,
    11906350, 12038190, 12301100, 12629804, 12827436, 13221676, 13419306, 13616170,
    13813803, 13945386, 14077226, 13879593, 13813801, 13616170, 13485099, 13221674,
    12893227, 12630057, 12301098, 12103723, 11775018, 11511594, 11117353, 10853929,
    10459431, 10130984, 9868327, 9670182, 9472807, 9275686, 9013027, 8815396,
    8618019, 8420385, 8289569, 8223006, 8026399, 7894813, 7763484, 7829020,
    7763738, 7894810, 7960857, 8158234, 8552475, 8684059, 8881690, 9079324,
    9210908, 9407772, 9605405, 9671198, 9736989, 9736989, 9736991, 9605918,
    9473565, 9341979, 9078809, 8684059, 8355096, 7763224, 7434010, 6973206,
    6447895, 6118679, 5723416, 5394715, 5131549, 5000483, 5000234, 4999981,
    5000242, 4999990, 4868407, 4671291, 4539707, 4539709, 4605502, 4671041,
    4868420, 5000006, 5065799, 5131592, 5197385, 5263178, 5328971, 5263178,
];
const k_unDistinctiveLackOfSanity = [
    5720667, 5720667, 5786460, 5720667, 5786460, 5786460, 5851996, 5851741,
    6048606, 6048606, 6114145, 6114145, 6245474, 6311013, 6311013, 6441829,
    6507624, 6573417, 6704491, 6704491, 6704493, 6901359, 6901359, 7097970,
    7097970, 7163252, 7229045, 7294840, 7425656, 7491449, 7622523, 7688062,
    7819137, 7950209, 8147077, 8277894, 8409226, 8540301, 8540303, 8671376,
    8737171, 8737171, 8867985, 8671376, 8671374, 8540301, 8475019, 8475273,
    8278408, 8147334, 8082309, 7885441, 7819902, 7754366, 7754621, 7558012,
    7492217, 7426937, 7361142, 7164533, 7164531, 7164529, 7033456, 6967663,
    6902382, 6836587, 6771564, 6771564, 6639978, 6574185, 6640232, 6508903,
    6443110, 6574439, 6443110, 6442599, 6442599, 6573415, 6508392, 6573417,
    6507624, 6572905, 6572905, 6572907, 6638187, 6703212, 6768494, 6834289,
    6965105, 6964850, 7030132, 7029621, 7226486, 7160439, 7225720, 7356538,
    7421820, 7421820, 7487102, 7617920, 7617921, 7748226, 7814021, 7879303,
    7944328, 7944330, 8074635, 8271500, 8271246, 8336527, 8336529, 8598420,
    8532629, 8597911, 8794521, 8859803, 8859803, 8990878, 9121440, 9120928,
    9317793, 9317539, 9382823, 9448103, 9513898, 9644714, 9709995, 9840813,
    9840815, 9906095, 9971890, 9971378, 10102194, 10167989, 10233269, 10364085,
    10364087, 10363833, 10429369, 10429114, 10560186, 10625725, 10625468, 10691007,
    10691007, 10756543, 10756289, 10756289, 10756289, 10756289, 10691007, 10625214,
    10625468, 10559932, 10560186, 10429114, 10363576, 10298040, 10232501, 10101429,
    10101683, 9970608, 9970608, 9773998, 9773998, 9642923, 9511848, 9511848,
    9381030, 9381030, 9249956, 9053345, 8987806, 8922270, 8856731, 8725656,
    8594839, 8463510, 8397971, 8201360, 8070287, 8070285, 7939211, 7807625,
    7676805, 7545732, 7479937, 7283582, 7152508, 7086972, 6890361, 6759029,
    6627700, 6496882, 6366064, 6300269, 6169194, 6103399, 5840997, 5775716,
    5513312, 5448030, 5251162, 5054551, 5054806, 4857684, 4661073, 4595534,
    4398666, 4267337, 4136776, 4070981, 4005186, 3874111, 3677502, 3480634,
    3414840, 3283767, 3152951, 3152949, 3153203, 3153203, 3153460, 3153460,
    3219253, 3285046, 3350839, 3416632, 3482425, 3614011, 3811133, 3942465,
    4008260, 4336455, 4533321, 4664908, 4730701, 4993362, 5124948, 5256536,
    5650013, 5781599, 6044003, 6175589, 6306920, 6504042, 6701167, 6898035,
    7029621, 7292279, 7489404, 7686526, 7752064, 8014722, 8080261, 8277127,
];
const k_unOverabundanceOfRottingFlesh = [
    12703514, 12703514, 12703514, 12703516, 12703516, 12703514, 12572700, 12506907,
    12506907, 12506652, 12506907, 12506907, 12506652, 12506652, 12506907, 12506652,
    12506652, 12506652, 12506654, 12506654, 12440861, 12441374, 12441374, 12375581,
    12375581, 12375583, 12375583, 12375583, 12375583, 12309536, 12309536, 12309536,
    12309536, 12309537, 12112928, 12243744, 12243744, 12177697, 12046881, 12046881,
    11981090, 11915299, 11915299, 11915044, 11915044, 11849253, 11783206, 11783206,
    11717415, 11717417, 11651624, 11585576, 11519785, 11519787, 11453994, 11388460,
    11387948, 11256621, 11190830, 11190832, 11124785, 11058993, 11058995, 10992948,
    10992950, 10861364, 10795572, 10729527, 10729527, 10663736, 10597690, 10466106,
    10466106, 10465852, 10400062, 10334015, 10202431, 10202433, 10136640, 10136385,
    10004801, 10004803, 10004549, 9938243, 10004037, 9938244, 9938246, 9872199,
    9937478, 9937224, 9871431, 9871433, 9871433, 9805640, 9870921, 9805128,
    9805128, 9805128, 9805128, 9805128, 9739337, 9804360, 9804360, 9804360,
    9804360, 9804360, 9869640, 9869640, 9803847, 9803847, 9803847, 9803847,
    9738054, 9803334, 9737541, 9672261, 9672261, 9672261, 9606468, 9606470,
    9606470, 9540677, 9475397, 9475397, 9409604, 9409604, 9212739, 9212741,
    9212741, 9146948, 9081668, 9081668, 8950596, 8950596, 9015875, 9015875,
    9081668, 9081668, 9081664, 8950850, 8950848, 8885568, 8819775, 8951359,
    8950846, 9016894, 9016892, 9016892, 9016890, 9147962, 9016376, 9147958,
    9082165, 9213494, 9081907, 9147698, 9147698, 9278768, 9212975, 9212973,
    9212716, 9278508, 9212713, 9212456, 9343272, 9212454, 9343524, 9343011,
    9277218, 9408034, 9342241, 9407523, 9341730, 9341730, 9341219, 9275426,
    9406242, 9339938, 9339938, 9339171, 9273380, 9272613, 9272613, 9141030,
    9206310, 9140519, 9140265, 9205290, 9138985, 9138985, 9138987, 9073453,
    9007662, 9007150, 9007150, 9137968, 9072945, 8941618, 9138484, 9007413,
    9138999, 9204788, 9270581, 9205556, 9271604, 9272115, 9469490, 9404210,
    9536049, 9536817, 9603119, 9734960, 9866542, 9801772, 9999147, 9999913,
    10197288, 10263848, 10264613, 10462244, 10462754, 10463776, 10661152, 10792988,
    10859547, 10991642, 11057688, 11190040, 11256086, 11388435, 11520274, 11521042,
    11652625, 11784463, 11784974, 11916813, 11916813, 11982604, 12048397, 12114188,
    12179981, 12246028, 12246028, 12311308, 12311308, 12311308, 12311308, 12377101,
    12377101, 12377101, 12377101, 12377101, 12377101, 12377101, 12377101, 12377101,
];
const k_unTheFlamesBelow = [
    11548953, 11614745, 11746074, 11877659, 12008987, 12140572, 12337693, 12469278,
    12666655, 12863776, 13060897, 13258274, 13455395, 13652772, 13849893, 14047014,
    14244391, 14375976, 14573097, 14704681, 14836010, 14967595, 15033387, 15164716,
    15164972, 15230508, 15230508, 15230508, 15164716, 15033387, 14967595, 14836010,
    14638889, 14507304, 14310183, 14112806, 13915685, 13718308, 13455651, 13258274,
    13060897, 12863776, 12666399, 12469278, 12272157, 12075036, 11943451, 11811866,
    11680538, 11614745, 11548953, 11548953, 11548953, 11614745, 11680538, 11746330,
    11877659, 12009244, 12206364, 12403485, 12600862, 12797983, 12995360, 13192482,
    13389859, 13652772, 13849893, 14047270, 14244391, 14441512, 14638889, 14770474,
    14901802, 15033387, 15099179, 15164972, 15230508, 15230508, 15098924, 14835755,
    14572586, 14177832, 13783078, 13322789, 12862755, 12468001, 12139295, 11811101,
    11614491, 11548954, 11549209, 11747351, 12011542, 12407317, 12869139, 13396754,
    13924369, 14451983, 14979598, 15506957, 15902989, 16298508, 16562443, 16759819,
    16760075, 16562188, 16166669, 15704590, 15110927, 14451217, 13791507, 13132053,
    12538390, 12011032, 11681049, 11548953, 11614745, 11812888, 12142615, 12538646,
    13066005, 13593875, 14187538, 14780944, 15308815, 15836430, 16232204, 16561932,
    16694283, 16760075, 16561932, 16100621, 15506958, 14846992, 14121490, 13395732,
    12670486, 12142359, 11746585, 11548953, 11614745, 11812632, 12076824, 12472343,
    12934165, 13395988, 13923859, 14517265, 15044880, 15506702, 15968269, 16298508,
    16562187, 16759819, 16760075, 16627979, 16298508, 15902733, 15375374, 14781967,
    14188560, 13594897, 13066771, 12539156, 12077334, 11747351, 11549209, 11548954,
    11680028, 11876637, 12139295, 12533793, 12928291, 13323045, 13783335, 14178088,
    14572586, 14836011, 15098924, 15230508, 15230508, 15164972, 15099179, 15033387,
    14901802, 14770474, 14638889, 14441768, 14244391, 14047270, 13849893, 13652772,
    13455395, 13192482, 12995360, 12797983, 12600862, 12403485, 12206364, 12074780,
    11877659, 11746330, 11680538, 11614745, 11548953, 11548953, 11548953, 11614745,
    11680538, 11811866, 11943451, 12075036, 12272157, 12403742, 12600863, 12863776,
    13060897, 13258274, 13455395, 13718308, 13915685, 14112806, 14310183, 14507304,
    14638889, 14836010, 14967339, 15033387, 15164716, 15230508, 15230508, 15230508,
    15164972, 15164716, 15033387, 14967595, 14836010, 14704681, 14573097, 14375976,
    14244391, 14047014, 13849893, 13652772, 13455395, 13258274, 13060897, 12863776,
    12666655, 12469278, 12337693, 12140572, 12008987, 11877659, 11746074, 11614745,
];
const k_unThatQueesyFeeling = [
    7439904, 7571489, 7703329, 7900706, 8032547, 8295716, 8493349, 8756518,
    9019943, 9283369, 9546794, 9810219, 10073644, 10402606, 10666031, 10929200,
    11192625, 11390259, 11653428, 11851061, 12048437, 12180278, 12312119, 12443703,
    12509496, 12575288, 12575288, 12509496, 12443703, 12312119, 12180278, 11982901,
    11785268, 11522099, 11258674, 10995249, 10731823, 10468398, 10139181, 9810219,
    9546794, 9217576, 8954151, 8690726, 8427557, 8229924, 7966755, 7834914,
    7637537, 7571488, 7440160, 7439904, 7439904, 7505696, 7637281, 7769121,
    7900962, 8098339, 8361508, 8624933, 8888359, 9151784, 9415209, 9744171,
    10073388, 10336814, 10666031, 10929456, 11192882, 11456051, 11719476, 11982645,
    12114486, 12311863, 12443447, 12509496, 12575288, 12575288, 12509496, 12443703,
    12311863, 12180278, 11982645, 11785012, 11521843, 11258674, 10995249, 10731823,
    10402862, 10139181, 9810219, 9546794, 9283368, 8954151, 8690982, 8427557,
    8229924, 8032291, 7834914, 7703073, 7571489, 7505696, 7439904, 7439904,
    7505696, 7571745, 7703329, 7900706, 8098083, 8295716, 8559141, 8822310,
    9085736, 9349161, 9678378, 9941804, 10270765, 10534447, 10863408, 11126833,
    11390258, 11653428, 11851061, 12048694, 12246070, 12377911, 12509240, 12575288,
    12575288, 12575288, 12509240, 12377911, 12246070, 12048694, 11851061, 11653428,
    11390258, 11126833, 10863408, 10534447, 10270765, 9941804, 9678378, 9349161,
    9085736, 8822310, 8559141, 8295716, 8098083, 7900706, 7703329, 7571745,
    7505696, 7439904, 7439904, 7505696, 7571489, 7703073, 7834914, 8032291,
    8229924, 8427557, 8690982, 8954151, 9283368, 9546794, 9810219, 10139181,
    10402862, 10731823, 10995249, 11258674, 11521843, 11785012, 11982645, 12180278,
    12311863, 12443703, 12509496, 12575288, 12575288, 12509496, 12443447, 12311863,
    12180022, 11982645, 11719476, 11521843, 11258418, 10929456, 10666031, 10336814,
    10073388, 9744427, 9480745, 9151784, 8888359, 8624933, 8361508, 8163875,
    7900962, 7769121, 7637281, 7505696, 7439904, 7439904, 7440160, 7571488,
    7637537, 7834914, 7966755, 8164132, 8427557, 8690726, 8954151, 9217576,
    9546538, 9810219, 10139181, 10402606, 10731823, 10995249, 11258674, 11521843,
    11785268, 11982645, 12180278, 12312119, 12443703, 12509496, 12575288, 12575288,
    12509496, 12443703, 12312119, 12180278, 12048437, 11851061, 11653428, 11390259,
    11192625, 10929200, 10666031, 10402606, 10073644, 9810219, 9546794, 9283369,
    9019943, 8756518, 8493349, 8295716, 8032547, 7900706, 7703329, 7571489,
];
const k_unBubbleBubble = [
    9094364, 9160156, 9291485, 9357278, 9488607, 9685472, 9816801, 10013922,
    10145251, 10342372, 10539237, 10736358, 10933479, 11130345, 11327466, 11458795,
    11655916, 11852781, 11984366, 12115695, 12247024, 12378352, 12444145, 12509681,
    12575474, 12641010, 12641010, 12575474, 12509681, 12444145, 12312816, 12181487,
    12049902, 11853037, 11655916, 11458795, 11261930, 11064808, 10802151, 10605030,
    10407908, 10211043, 10013922, 9816801, 9619936, 9488607, 9357022, 9225693,
    9160156, 9094364, 9094364, 9094364, 9159900, 9225693, 9357022, 9553886,
    9751008, 9948129, 10210786, 10473444, 10736102, 11064551, 11392745, 11655659,
    11983853, 12312303, 12640496, 12903410, 13166068, 13494262, 13691383, 13954040,
    14150905, 14282490, 14413819, 14545148, 14545148, 14545148, 14545148, 14413819,
    14282490, 14151162, 13954040, 13756919, 13494262, 13231604, 12968947, 12706289,
    12377839, 12115181, 11786732, 11458538, 11195880, 10867430, 10604773, 10342115,
    10079458, 9816800, 9619679, 9422814, 9291485, 9160156, 9094364, 9094364,
    9094364, 9094364, 9160157, 9291485, 9422814, 9554143, 9685472, 9882593,
    10079458, 10276579, 10473701, 10736358, 10933479, 11130345, 11327466, 11590123,
    11787245, 11918574, 12115695, 12247024, 12378352, 12509681, 12575218, 12641010,
    12641010, 12641010, 12575218, 12509681, 12378352, 12247024, 12115695, 11918574,
    11787245, 11590123, 11327466, 11130345, 10933479, 10736358, 10473701, 10276579,
    10079458, 9882593, 9685472, 9554143, 9422814, 9291485, 9160157, 9094364,
    9094364, 9094364, 9094364, 9160156, 9291485, 9422814, 9619679, 9816800,
    10079458, 10342115, 10604773, 10867430, 11195880, 11458538, 11786732, 12115181,
    12377839, 12706289, 12968947, 13231604, 13494262, 13756919, 13954040, 14151162,
    14282490, 14413819, 14545148, 14545148, 14545148, 14545148, 14413819, 14282490,
    14150905, 13954040, 13691383, 13494262, 13231604, 12903410, 12640497, 12312303,
    11983853, 11721195, 11392745, 11064551, 10801638, 10473444, 10210786, 9948129,
    9751008, 9553887, 9357022, 9225693, 9159900, 9094364, 9094364, 9094364,
    9160156, 9225693, 9357022, 9488351, 9619935, 9816801, 10013922, 10210787,
    10407908, 10605030, 10802151, 11064808, 11261674, 11458795, 11655916, 11853037,
    12049902, 12181231, 12312560, 12443889, 12575217, 12641010, 12641010, 12641010,
    12575474, 12575217, 12509681, 12378352, 12247024, 12115695, 11984366, 11852781,
    11655916, 11524331, 11327466, 11130345, 10933479, 10736358, 10539237, 10342372,
    10145251, 10013922, 9816801, 9685472, 9554143, 9422814, 9291485, 9160156,
];
// TODO: what is this paint ?
/*
const k_unAfraidOfShadowsDark = [
    4536928, 4536928, 4602721, 4602721, 4668515, 4668515, 4734308, 4734308,
    4734308, 4734309, 4734309, 4734309, 4865896, 4865896, 4931689, 4931689,
    4997226, 4997226, 5063019, 5063019, 5128813, 5194606, 5194607, 5260400,
    5260400, 5391730, 5457523, 5457524, 5457524, 5523317, 5589111, 5654904,
    5654905, 5654905, 5720698, 5852028, 5917821, 5917822, 5983615, 5983615,
    6115202, 6115202, 6115203, 6180996, 6312326, 6378119, 6378120, 6443913,
    6444683, 6576785, 6577556, 6709913, 6710941, 6843555, 6844583, 6845868,
    6912945, 6914230, 6915515, 6982592, 6983877, 6985161, 6986446, 6987986,
    6989014, 6924762, 6926046, 6926817, 6862308, 6863079, 6863593, 6798827,
    6799597, 6799083, 6929385, 6863079, 6927845, 6992866, 7057632, 7187677,
    7252442, 7382487, 7447251, 7577296, 7641805, 7772362, 7836871, 7967172,
    8097473, 8227774, 8292283, 8422841, 8487607, 8749750, 8814516, 8879794,
    8945072, 9075888, 8946614, 8752575, 8427464, 8102353, 7842008, 7647197,
    7582176, 7842777, 8233938, 8559562, 8950979, 9277117, 9537977, 9733814,
    9734070, 9734070, 9734070, 9734070, 9734071, 9799863, 9799863, 9799863,
    9799863, 9799863, 9799863, 9799863, 9799863, 9799604, 9799863, 9799604,
    9799344, 9733548, 9733032, 9732771, 9732509, 9731992, 9731473, 9731211,
    9796485, 9861502, 9861239, 9926256, 10057321, 10122338, 10253403, 10450004,
    10580557, 10777414, 10974016, 11235897, 11432754, 11629612, 11825958, 12088353,
    12350747, 12547606, 12875538, 13072654, 13203723, 13531656, 13729032, 13729032,
    13794568, 13991688, 14188808, 14254344, 14385672, 14451464, 14648328, 14845704,
    14977032, 15108360, 15239689, 15436809, 15568393, 15831050, 15962892, 16160781,
    16226832, 16293140, 16294170, 16294943, 16295713, 16296229, 16297257, 16363566,
    16364595, 16365365, 16431930, 16432957, 16433729, 16500037, 16501065, 16501836,
    16502864, 16503634, 16569685, 16570712, 16571482, 16637789, 16638303, 16639072,
    16639586, 16640355, 16640869, 16707173, 16707430, 16707943, 16708456, 16708712,
    16709224, 16775016, 16775272, 16775784, 16776040, 16776552, 16776295, 16776551,
    16776551, 16776039, 16709991, 16709736, 16709224, 16511336, 16247913, 16116074,
    15786858, 15457899, 15193963, 14865004, 14601837, 14206573, 13811822, 13351022,
    12890479, 12429935, 11969392, 11508591, 11048049, 10587504, 10192752, 9732208,
    9337455, 8877166, 8482670, 8153453, 7758957, 7430252, 7101291, 6772586,
    6509418, 6246505, 5983337, 5786216, 5588840, 5391719, 5194599, 5063014,
];
*/
const pointSampleContentTeamRed = new Map([
    [Paints.DieJob, k_unWitchYellow],
    [Paints.ChromaticCorruption, k_unDistinctiveLackOfSanity],
    [Paints.PutrescentPigmentation, k_unOverabundanceOfRottingFlesh],
    [Paints.SpectralSpectrum, k_unTheFlamesBelow],
    [Paints.SinisterStaining, k_unThatQueesyFeeling],
]);
const pointSampleContentTeamBlu = new Map([
    [Paints.DieJob, k_unWitchYellow],
    [Paints.ChromaticCorruption, k_unDistinctiveLackOfSanity],
    [Paints.PutrescentPigmentation, k_unOverabundanceOfRottingFlesh],
    [Paints.SpectralSpectrum, k_unBubbleBubble],
    [Paints.SinisterStaining, k_unThatQueesyFeeling],
]);

/**
 * Return a css value of a color
 * @param {Number} color The color, in integer format (ie: Indubitably Green: 7511618)
 */
function colorToCss(color = 0) {
    const red = ((color & 0xFF0000) >> 16);
    const green = ((color & 0x00FF00) >> 8);
    const blue = ((color & 0x0000FF) >> 0);
    return `rgb(${red},${green},${blue})`;
}
function colorToVec3(color, tint = vec3.create()) {
    tint[0] = ((color & 0xFF0000) >> 16) / 255.0;
    tint[1] = ((color & 0x00FF00) >> 8) / 255.0;
    tint[2] = ((color & 0x0000FF) >> 0) / 255.0;
    return tint;
}
function colorToVec4(color, tint = vec4.create()) {
    tint[0] = ((color & 0xFF0000) >> 16) / 255.0;
    tint[1] = ((color & 0x00FF00) >> 8) / 255.0;
    tint[2] = ((color & 0x0000FF) >> 0) / 255.0;
    tint[3] = 1.0;
    return tint;
}

function randomProperty(obj) {
    const keys = Object.keys(obj);
    return obj[keys[keys.length * Math.random() << 0]];
}

const equipConflicts = {
    'glasses': ['face', 'lenses'],
    'whole_head': ['hat', 'face', 'glasses'],
};
function hasConflict(equipRegions1, equipRegions2) {
    if (!equipRegions1 || !equipRegions2) {
        return false;
    }
    for (let region1 of equipRegions1) {
        for (let region2 of equipRegions2) {
            region1 = region1.toLowerCase();
            region2 = region2.toLowerCase();
            if (region1 == region2) {
                return true;
            }
            const eq1 = equipConflicts[region1];
            const eq2 = equipConflicts[region2];
            if (eq1) {
                for (const k of eq1) {
                    if (k == region2) {
                        return true;
                    }
                }
            }
            if (eq2) {
                for (const l of eq2) {
                    if (l == region1) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

var img$a = "data:image/png;base64,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";

var img$9 = "data:image/png;base64,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";

var img$8 = "data:image/png;base64,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";

var img$7 = "data:image/png;base64,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";

var img$6 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAgzHpUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjarZtpciRJspz/+yl4BN+X4/gqwhvw+PzUAqjqGY7wPYqw0F0oZEZGuNuipmrmcPd//c/n/gd/Wk/e5dJ6HbV6/uSRR5z8o/u/f+7P9++14LP9/fsn/Pwd3H98I/I98T19L7b88276ef33+vrnOzf6D2+E8m8fSH8eE//54DZ/Xo8+/suKQg3X//NP//v/e6e/d7/dzVwxQ/029X3U/d6GCxdWSvaxylfj/8K/m30Nvrqffofsj99+8bXDCDEk/0IOx4UZXrjh8H2HzRpzvLHxPcYdk73WU4sj7uRTSFlf4cWWRjqpp5h2vCml7FL8s5Zgzx32vB06Tz6BS2PgZoGP/F+/3H91wX/n673tsVEI7D782Ip1xSg/BJkx6W8uwyHh/fitmIF/v/78cf9wbMKDxczc2eD067vFKuFvbCULgMR1he9ffIV25LVoUZJ5dmExIeECX0MqxIJvMbYQcoodB01WHlOOCw+EUuJhkTGnVPFNJ454Np9pwa6NJX6vkyr4p6SaGr4ZaeKsnAvx03InhmZJJZdSammll1Gmq6nmWmqtrSrnZkstt9Jqa6230WZPPffSa2+999HniCORkmXU0UYfY8zJM2d2s0w+PblizhVXWnmVVVdbfY01N+Gz8y677rb7HnueeNLJp5x62ulnnHnDJZTczbfcetvtd9z5iLWXXn7l1ddef+PNP1778er/8fX/4LXw47VontJ17Y/XeLU13chuEYQzRT7DYzEHPN7kAQI6yme+h5yjPCef+RHJihJZZJFvTvDThYoL8w2xvPDHd38999/2m8PW/5Xf4n/Hc06u+//guehu+je//QevHSHhNo99WSib+kT28f7tM678HLevd7N1TIFZ50lpE/75pVF2r+WEMlee/tZ+m3+13VqzXtx66Zy8xk5nDDdSLnWWkB8vgEWL+xdsEMZM3ytbT9wdG5Swb+DutXCjnA/PTaN/1zg+Br79XqIF3P1C22E9XPxYfkh31/Tu2PrprTRX0L/8xCOE2t78OFxsevGsOM55Nda91rgxUO5WbW/H0XidK1J4/3a7HqgF957NZdgI8H1vtqy37759rbsDK2NZOHXNc+oDpFnUi+md2PZ9ich4e6WzOjfn0nmqS9hstORPju9kMxFlZvqAyW8LPJotBlxzhteF3Ux3xhujL8x77p3Fn+tObjgv/viDalLWLCucufycM8U18OXpsjdBW+o4cXTKWxuE+sZJvawzgZHjGx5vDZvnddMiEAqLnorlFut59/Cvx51xmx+TFDx7pL1fnak9rueWzSfXJ0l8yKG2CLzR9F6kPN20KUZbUcZHCH0f2FXIlSwa3pc25YqUMTURn557aZvfuJhkB3V5/FkEdtereVAL9zjrEQ8L67zVX56PIJ2nJCyYMMltezuLll0Wif8w4iUjL8E2Hsn+Sn/gyRncy25bzlnLPJZx18QeLe5349547R0hWKTKcSlPGmtNHqtH7YF72zqVZJG/JmW8EWn2yfZ9kOSL+tuxyonnqN9n8djs9xegxCyxs/bLBTiSF3xa4Y54LrSBkL+Fm16FqCL3AbW1zMtqAUWzFck+iATCb/eDubiaDTWQgSzebegB7xIyHdvMx6bn8XG50rcfVfwiPHaT7iG8wLVWJsaok0+d+0YBaoCVBt6l12Vw0GelOnc9oTVoTVZJHJtvoRf8zUa8cMRoGjEYT72F2Cnb71vJ+lLGIvf95VO9cFkGMymQBGweFdPyRgKNMHNWyFSu4EbYJZMJKiFhApKVD/nY9UM7d6T61iGJ8nBcTejs1riAeFtcuPWcaXG3SyPedS/itJ35blMAAO8bSH3Fj3I6fo7JTeCOsvBez1jcPCZsTZjGopClkt44lODG+Xy8Dd0LcFipDf4jUPEgtZ8oJMgItkSAyrFN6ECSBfB6nTLYAPSkji8ouT+Zh+/Wwe4N1rLBguTwwsBTd41JdXp4vjwQR9lQH4bghangK4QacNQ9hc0r52WipmRX7pzJ1lbuPfSWJ+4CIQ5Qsflp35FvCiX3QJ2sOI/MYCWRR3fMs8JUaGEBdtaue4uQopaRaJaVbX1Bcirp1Pq8/JgHe7eNkQ1NMAEs9U5uU4EpG8TjwUYlEGiK4cCuuHjnk35uro/e9z3grZxOpGYeEgekP31d/DPrG4ey6C4VoFrysxj5hlJaBgGbx6CyqCqFDLwSc3DtzMP5byouEhdTgQgUS5FcVV/yqyeNIE7bpye+AwHfFfO+cCX38n5QC3XXkbfHOTnMvG8E+yi+dToq+aTUEkLgUVxwlJbBcPLsoTiwKzXHKsw6kYR7oNMSlr2mTz3IDO4Geh17nSCmWWc2AlO4qX8/yAbVs9cF5D3lNa92Qy1BzwXXXr2VahZlUvd6UEJDX3AB8D3bIfpBUv/8BguUGgFrbcELsAdo7Oex7F6WB9tjcGqZO3sN0BsaA28m3OEElei57LhQi4nFBDoJYoP8uiAuhy3U9FXczr7BswEeJUW64gj+gjspTQKeF6yILkD8cePzMsbrvRXyLshOj+eSttTz3XSpCxfc4jEtnaMyP+RVghPC0moldY+SCIB/wvrSIWCJGGvty6MGtM2GVVw+oMS85ZQlO+wvDHcjOlKB2T0SnQwX7yAuZ0V44dEA9IJw9SgvKIG3OWpzhFKWDZMLdclReydsQ5YLQg4p3SeGzMqcFT0fZGeLRw+S9Sm7rYrAGmGWeIa0ghYkXyPFfMHpuLgKeTByKrc3jwMIFlLytYAdh8o5YAXZ8ek6FiBQB4wAwCSXVfmBpBUYkk0buxJ/T4GRoWJ9oQ+S0E0lUU6RQYr7olZbS0tVr1aMyBVJkauaSmxM2aeAN7Mv7qt4wCqslA/WCNciFpzQTYULUwzVt4p5oNxwCr9UdjFlLaIkb1EXryFdFdMgSA+eFPY9P9maMmxOKterbIInJdZMKhyxkFunuZv9iqjJBeKhD1LS/JlgAA+/i+rkWMpjX6eUBHk4+fY/tavkm8FWyNQHBvqej68UI6yVyXzfkozJW96B/FnkTTfM1y9QFEwmNvEv2wBHs1bJZUiTBfdrYvcKXJm5Qb/KEktx6A/EALEff4kbrKuwixyJGwKKQlIpfUQCJoVriCwBkuKpcHgYD+GK28VGLgg50B8wHlITzI6QZ/BAGWCpXSiMM4h7Ya97l+KUHKPoAIhzv8KTHPg+4RpEHryH7OSThcrR2SJ3KqDkpn6MpgcCJlNooKhQotrSiGJkU3XE2qB8E0mLsiCQAX2OSgI672Dc1cfBPPAtf7yAYT3VKip+QbCopuLqFFy3xBZ85RVg1nDQFvKlmG7ccFJukTRB9igfiOEUPpREY1Uu4L2N2iH72SxFBpoHWTflcfVNRIzcv/Bv/t4mIihqvAgyhQNzodZI7hMO56CcNwG5smEpKUi4ck0Y5EgVq1t6iOj7UMal1C0xdB04UdAhRCrZQqjc49gwaos6wNNAqyJn/lRlI6d3g07slogimCjSk0LS5T1MijZ87F7gDPhjxhYzsDsS1lxd9L1O2BdF6ahYBzEieAI6BUTDUir3Kr3L3jaDVKkjajil5AI/FX4p+gc1QD7IJ4hRXlHYsOJF8iHnofpUQ6olvHLN4YV9xQElpcS/aSYqgangFzAJampDxGDb6Q+5SABUCQvY36DcYv9KwonoZQc99GJ7cU5x8zYzAbujAqJ+BWccVSMVSdUQkWPFmOKx4++B0gVVO3hE9mNxnvi26Y9Rl+mEpXLNrilXM4rhwUCipeqjKFJ5lu/U24E2xFTufIaFOsNlu+p5hedC4YD+Z2tCToLxePjAwsiMCHv5BA8G94TNruMd1yLUGB5XImCj7u08AY9SSbkikbItI+Sv1wqvBWaH1qm6fKsPtosznKmYQAkkCr22ckKoZJ8U6sZ2QCRcBht6MBPBjFpWqQ/LKHIlmolXUMKhVxF5hGIoKQScpUWQieRD26K8C79nBCo426UENsF/EQP4UhplKPh5gAM3LhJdtXz9Fg4L1ddBky1XjBU3sFitWKEyrZmSIMyYekKd0eHrOeCMW91nrDFIAlKZxV/ZQ3kmXskHUYqrmJzoEmyNhaglOGRjSvOBCDsAWqjomfeqoAU2VwcUD3QN0DNSshQAiqV0pSzlRgWQW/KiPXdxO/cxVz7NHrBhjU8lfSJFJtH2TB0GrUWNBmgPRcsMSv0QuPEubHerQApHlxoWmACEYgOohiadfyK5vtgJy6rCkIpelxIUHsG3ycZjtEyGdIo21IEFWjqh9AxYtoAejw950i/r6iQ+hX8YEaaWQm8maRmTuGDA2dzXYY5JrsCwPfyA0EnwXpTQQQiiuShcBBQCEqAlKL2BBnr/fVFPKUQGkTTxIxGl30+Ii9+3Y9Sb6ppKq6ip0w9kOm1VjRF+OwJTKHOklVDsMH92SN0hokXsRTmfTC/Lv9KoUUgyAA7pxV2iiQV7dFBIXd6edxJXEXWkvhYoobCF2rdJttcraAfbiZ8bZ8ZNQy2Ws7Nq1lPZ4Q6JUqwW3x6Y1P3LexCTvdAh1FnIrkQfmWgqcDT9DJxG0uD9WTaUtYKZUAxXRwaHZR7Cm8Cg8KYjNFFZyRa8gua1qpVwEqfEP3ADjwxrI4fCciJDsBzQkmjQJALyhkSvDSq5SKynfIUUpo+PiY7BaRaQRbganeKRXycCM1OMIKBqY5CEaZqLUUxCldYKCn6qSUVu4jNExUJd1DirONgCusSfHQSauJ0oDJSP4paQVWuFPS5CaothQR3Rxk0as1kNBr/9+5E+VAOK03CAt6yjmo4PcqS85k0oorfhCl3kmSiCeE0eucXcgTeShWAH6QnsnKyt6uqHMdD8Xj+maGl6ZgDDczVdjPkSwYlZqtFLhWO/2XDrqiQQAa4GD+fGaVR3OBjq58C6RzK0Ya2qGQYtJbZeBPWI3PK2yoARBkKXRQP+eORf1hzJ/LoTm2KT0xBmdp6BsrgHsUi1ClRZVLYoJaqiR6B7uMAywMJfjQtJQhmfSc4SMLF6qOWCbqlTm013In5Vpn2KGCO8RAhqeU59sgN7mOKF5aqW8CnrjzTBJfzEiiv/exM52zg6Hx1q0mQv+ICaujHhvhOUgAAB5iKXUZoS9CLCRRvAeOoCCFvEyOfBypDB36RKIaLQRnFhXVVr9h72ilUlrOay8/mbgTPGQtnDZUqvgLGWgs1urLnAhkQ1B7XOl4/6ZUSBjdinhe3FMgrG1kcTvorzwltjRNqgkJNaDiDWjiBhd+Af4ApWsLOtRRhul0gqN0HdHl3FfflpBjJuLxYggffyiJgHO5bjuLYWUjgsyaJN/oSbiUGBNSoD8rlUqBc0lp/VjOwdKAwoN9DWLI1tX3di4oCZmhilqiP2FoC4tLcc1UJXqCSeYw0EU4Ptp2dgpQqJRJK149SBieq9krzowvARGOFPEqOdC1aGAbVIJId0ZJ1BqYusyLK3JcyMjk9B1kAua6lJeQAEVLQ0rroWljiQ9rLJlmbdS5jINoqA0KyCCNVvWC0/7PFhkKcutzFUaQA0iRu2KMDNSwymtB3UkEKtrvbTZ9E1xsgpkHCF1rsgSoL15SJ1tEzymlTrkqck2a5vdg2HkFtene6QJdiKR3LM4lToqYvIcCKNu4I0MKmG6ZfIbkW7TQ8b6rhbrDjyOQq/shDLghIAUCazxGqpvL3CIrNfyEceCmdFfVV19W3PkSA4w5pjN59Pkb0u6UBKdQXbve7KbVvbz+oRH4FTUrON8CwXUhJI2ibLqU6JbBQNliYlMu/4YobpViibS0vqouGm2lBG0q5LOYEtvx/ZIOL6/E1b0uPOn6aH5iZLrZ4ivYZOFKM8mpjBaIMmGRIgMVcSB68AHeJixHNV+/BW7ogvyTzi91iMHLete6C+vfV1CL6h7pP/Uu5QeGKOSldV2QZfSRRB1QL056vJCPOlTDqCgUwRKPNUfdRT6rGkeOUnBCny1Q8tsUvDFk04hDCSd1n9AcClBofsAi0TpClaBKkXlLJXa/ia4IY5afcohiVeONAjY6vhCFuDVegkAjFfHcWsqkOoIBR9/G32UpaxdGxUemvGWi0W5e5bzX0eV61BAEV5mi876lYE3gmWOz8xIHigqlOGcRfRA3yZZOO5yq0ikfxj4fO1Z1h1dmJ2VPRLBKJzxZnz6DFCjlX+ZJXZ1WPZzxQh4Uf+XUliyp7R2GPbMOqn+pvtCnahPoBJgKqaCE1pMPqqdpWxZC8uKolPHBP8S/qTZYPZ3DmTOaDCRduIvRP++ExitWFzcpPkRh9T3GDKOB7ERuCYGoTlkHHxSEFCRu4HT13tN3JA4l3Pp+oqs7LvZz64D7A9Yd/J0p3imjFkT2Wj0mpWjw1VcjJBKh//7R5RcU+UqgWsClgLVgeAgTq8gXU+EDRJSyqi5FtzQfMRD+5zuZmdUGLL6B01+S1Sq9rm4r0kefpY7aCqJiCPjIJ5sdXk1HhTD1WNNwJTjUOsbt04kyR6ojrWncVoDN41hwMUnqWsFJ3wgFwT0MKlydK8hbJESZJEAAGh9eq3YregjKQUdQ8nBQ/4tGaM+2RPimvO05y1nM7XCpooHnAC2hEVIst6IRp9ry2RTVheKDu+Wmo3a5aHTkYSKjodK7x+gKueQiwFOv4I0GGltkIbahBhh5HxADLTZFRR3ZsNNB0wfpK2gH25SJHqABI+R2R0AZkgTS1EwoLYpfA2sqGMvQXfpAo7w5sHjB53BvexPfj8NYFChqFScVdLP8NmPqPMFDtE71EdiG64oVz1JwUoF049NEhsBH6ppNKzYqyEWWO/wCu7AOMF1FtKVhBh3dfXxLhyRbDyOtSPzNXoCasI2yzz7iSYi816iw1MRcUBqb4uauN9E5uhq0+KPxOK4nRegRtR+gX3X48yHw1bASkb7dRWYI78S2rtikE3RWCTerXBjA3NgBHstoWFy5pFafw0iy5cVJ2Frz+Be+7UdA29oI+zWlPaOiSlB01nAyk8rB7E2vM/zKNKUya0u5NNzNTtNzd89Jt8W2DWcfO8n64eBVRzeYknCkB6JomiSaKHLkaOQTDVd+iNi7fGJVRQdWACbMxZCyb/1DmZEShUlCMAp9osSFrCGMS8W8J6Wo/jFKRFA6lyG1nzyzgcWH01zwAjKFtNvfT2jQMkf9Wy+OTvXxRQYYNDx5vv7td6xyE9J13xCW+z9/z3QTrIQWhz5bJTDAaAv/qaC//htRViueRoV1Gw8iqpRCoTtzd/Yhpr5Gvz4n49imRTDKEMwgo+RXalrzci0kYxUdHVqJs6D2vUAQI7NEBIopZtHhlE5jPhJ2Wk/gBFT7hCpCPX+aD4L7mhlaJ34V8NCkzC4bgL9ajDqg60KmWM5rM8F/2NIE85evhDQZIy1v5uOrxyiqisNc01LNLrlRKauLEkO+CDaqwfK/D5Co64MGjkA3rirSfvCFXV5Jw53zvlxHkztQ0GKpwvaj5OHF4LeRnV29xKFsI71ucOAKiAAyjyrzTY6WSkziKo9/mp+eJNG8pMiPBBCISoI6xEMQJTUm+ESK4EimlTRB3wYZ1uHXlRu5wNJg1/RVXR9RNht3UgIGhqh2AYGtnI/WdBeEzpCwQeMt8G2V/bHa0O58ehGhbBKf7R66fIIbQ1ppCOBWrZFoo+2WDhY09VvQ2KHeSlC5REcC0RAsSifUpm2yVU0SCxQVg40kTDQnW0VrLGFxdAELKqtfgKKKfhNpowEWIa4FSNoaXLNRKmTCLz63S56NCSGs2R3LlhHetZqB2hUROwpKaWsGYMVIyw5mhQCU4JyRGVFpnT7S6OeEV+bf7Ce3aoQjPLT8Tz4aFZ5KToNU+daFHTwauJbFN/i6Bb133C46OxSlStoiLGczPIXur8PAM8eYRcUD4ayz8qhz8d2zgdBY94L+zJXx1zSKe3HLwkgwS9SqRZM8jny3wkWKRYfy7pYSypGTdxMfwzjhPV0+0gkKI7DC7iBtOHQx1EDgC4duCAaj+T18m5DLpAhavNWKkiy+abXxnm1vhUB2SEzzq7sIA/DY2II5YSMUH92tqbEkl2yqfYursXPAENtRKdeR9t0DkytSQj2gUUORp8w6dF9MTh5OMVP+ZKLLVKhSHXdBjMOrUVKFOXj7ILCKKYyaWc1SAP0v3CGqyrto0OBsK2qTUaAoD1OMaZkhW4aZqoowhX+WBDoitWvc/4Gjr3fUdI4A5VrRRCkcztsPetQaWj1K0XlJaapCBVWNJMUIq0PkUOB9l2PueqgPQiiaTOgFEIUTywcHm8piE93JSCqnaEjvkVHcSgpFkvJE85q1HtJkF48EJTlRHpF5tr6j/ccnUC4X7j80DkVqIqFL9hbgXj5JpIygrzl9/Lht6Mz5ez5mUNRENkrp2OKkfcl/By7Jn4uKYNNCgKCBAbvhaIBEqf8MzAwTG5e9Thgng2r963N2DL0dhZ1rk27sQOxoBNzRXZcNUJwPY7a1sin5t8/+k5o3goNyh2X91qPfYrOLLex1csqwIoaMKMhqfkZbVGvve6b6abj44OQ3/Ixw4uXCdxeNX/KidnbtD3AHGURKOfCmVBfVr4YsI4WFAugSpvWkJzY6oT1hsAm19dx9N0oAjCQUSoh9DTIkwG9Q2RIGGuc3ZkY5NgAGUluxKx2XSyKytT4JATetT1zlVbyDbYftunoWE6eLwMld79Ng7jgLRgRukJQq6I7DmrgaySBJb2s0mtVKvma900x9KsV/0fTSEP5EbytMB6YvbkedAit4eMonQ0nEJKUs5Ad0Bt2gFEtI5YHpAydByRCCM74gmCHUrnxKVkgM4I8VhnDVGYD4kRP466NAyrQaiyMIyO0UlWUSXkEd6mKumsKARCVBnUsKkooYqC6+PP9FnjncXTKWezIsXUEe6+JNaMIJPgocaH7MvO6gUg0+Ae5ToSLItYFcnBIh767KSCmbvY8TysXIbFpDq8VwCjIydqtEACBwlXUneNGypqsvrMb1KJnk4UU8N07kttK6OomhahMzAMzE2tGx3f0fRLMx4y+bmieo9SAY1EuKAqGf9FrWv/nFjpOmWhwcTfibax2fRXZcDY0F48tESdN9k2UlrvG2HO43fGkkErAn/e3+wIuHhtHbn/kzjuH5lTBNfQNDLnOwXVQ9Ap5ZrjQQ02HTfQ+WvSRpkR+9Sxtp11ADm7EyOUxYNhUUe8BBFEfO0QLGR4VO+B8nijOCOyKVNlRLDutZO9rNyG+zB/3c8G7u/rNOiQ9BKnrfeiv6oOQb1R03ewSoPeqd47kbSN5KhW8mQwO5wpcbGfNYPT6lBfCOazs8HpG24YI5pbIx0ti61R8dM3hbT5jdd8bebh1fbUkSSoUiS6oH3YA8i6JBUiPWr+WJoNAVYnSlK/QAJorDZvFmi785EHPib0IoyLavnAQlWYlmLy+9jAxdrDOkbTWkHRVTsXidgV9/HLdTsntRUoC5qQbQqinhKw15PiussNquXVG2KZvJwgA4qpn6IzBVzgQlI3IzwNAaTcjBud98U1GAWHUF0DsbGxfyEYJKtbVT/NoaYytNfpPEVI6ifqtA/sTQrxqdULr/dJ98rfYYWrWqYzsflS2TQw+E5NhBMge45qBE1W25WYm5r52oR0af5x2jYabdmmFaPz1QgD9DUmkjuqKJiebXhkMh1eyepBkaBTNuIBCXyhmMypKclSM1uNNk3tfj+gs0sDBJCE+I4n99AkI2MoQ7AAG4RZfC9SKCeETkNPO9XuNVqt4qd2YMqrnbe40fcOoc573Zo8lGYdEEU+jU6qe52e1AHpo9qTCNd8LN9GFsvTTBcBHh1KnrqaRPSGkThPidmqYd2CPWhEsc7X/5t//qmziwGv52qrH8+hO8TlxHps+m595gnedlT/Fuv+mZRkDfyPeCJ6EsgPdjghoJJ0Xuy5vYiVrwECIk01L6VR7ZgeYSBWqN8kwQl7Z/WNwlfcgUsVwfpdU6s71vtQ/ysuUdR+CVeRNhSsKRON9HV+UAg+DRN2PBGDgBOIYlLuTd/JfjIngppmFQwarQkPRckJwNVJJDbPsrcdlQpig+p6WInn36yRwIMvuRXD0WHqZc5Q9mZYVNcRGcQCPhgklY4axBhJxNYp0w1QftXC6ikbl52IIkxJLLVO1WC1Y4LJjglm9rB0O/AcYDZsWnbaXP1kaGroin94M2W0uF5w5IR4he1hNhqfbzvhYw2gDgiShqeCtRQuA3p13oTxpAGycH0d7gsZDTejF0bwqYz3J6z/RLuHSoNRCIKtc3xdnRTR9fInqC2mnYU7FF2Mf1dCU7cipJDny3oXao58LW0dFxWTxfgQC53++U5zwgGsoQllGfnypSFm2fFGlGccUadPJkqJ14Ub0AM+F+93piakZ9Mp0jZbHXFZ79jrKiqwHTVl+kVDXIjIrWomr5dX+UjW97n8r7fTD2584zad20V5/ByzjGwOTGMjB/DUYRVFGnVLuae40mkndSa+rY1va1Uzyp8j1Ocfq8uAJOESy02iQhAUbqczCWhcnUTWb7CQN5p6LZv3X/ugkrvq0Oy3aPXX1U38Nqzk1Ngm6JByUf8jd6qkDmfquDeigzj6ThJUtVh1Kq1KHUzN6/p3iO87YFBUFjfEgpfYmM5VkghkyCGfIc3dVaNR1kuy22RN+cxq+q3Etn7X1KJ+EQmEYN36pRSu/yiiP5mnaWtRcz50kHJdRZdAKWpG/D3vYMcdMihErSY0SBs1/1G+bVmIQxKa68iEz9BNhm4/hlaAwHFwdPkc3Qx3dr1dA3+xU+RDDlHHGsWbHLQH8g3AVlERnUJ8P+bGBxa01joT7vZf365/+vYdhbx3kMXCHet330xFV/tY3YqIkNCRNvLi9vOv58VjUqY8E0if1228egJgBUCN27pOBuJCqlLKtSld1YG1tuFO4lC6lWIW6Eg/LVC2rbaPXoabZc3UgDcQexaRaWJK80veH6ZQfv2a7EWN5/Sbut+o7qCOUJuQgO8OiESdEWN7S6M0ZK2dpwM7CrQQFxIS8ztX98ve9plmDle+4V+3XwPRYY4gyQqtnIlvUAT9QtVdaieaotYk0rd/zk6WOEJ23+GUrt/hWHX8+CjWh2PtXMsJdtx0/nkPhCAy9Dsj3CKVbmQ1Nmf3RXNrLI9WnV/U/B6Q+4mxk2ydgsXytYN0tinY2Wgbujed0OwPKTSK10H9EVHnlK9sOv0V3EL5df8bPPqTwTPFfvwAAAGFaUNDUElDQyBwcm9maWxlAAB4nH2RPUjDQBzFX1NFkWoHOxRxyFAdxIKoiKNUsQgWSluhVQeTS7+gSUOS4uIouBYc/FisOrg46+rgKgiCHyDODk6KLlLi/5JCixgPjvvx7t7j7h0gNCpMNbsmAFWzjFQ8JmZzq2LPKwSEMYAgxiRm6on0Ygae4+sePr7eRXmW97k/R7+SNxngE4nnmG5YxBvEM5uWznmfOMRKkkJ8Tjxu0AWJH7kuu/zGueiwwDNDRiY1TxwiFosdLHcwKxkq8TRxRFE1yheyLiuctzirlRpr3ZO/MJDXVtJcpzmMOJaQQBIiZNRQRgUWorRqpJhI0X7Mwz/k+JPkkslVBiPHAqpQITl+8D/43a1ZmJp0kwIxoPvFtj9GgJ5doFm37e9j226eAP5n4Epr+6sNYPaT9HpbixwBwW3g4rqtyXvA5Q4QftIlQ3IkP02hUADez+ibcsDgLdC35vbW2sfpA5ChrpZvgINDYLRI2ese7+7t7O3fM63+fgCGn3Kvp8R02gAAAAZiS0dEABMAOABd4aHPTAAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+gCGA4UC2pMPIgAACAASURBVHja5Zv7s2XHVd8/3b33Pq/7njtvjWYkjTQjy7Ityy/kBzbBNhhim0fA4EoAY4gLKqmU4+D84oQiAVIhCYGkQpFQLmJeCYZAYUOgYowt2UKxjW15NLZGj5FGM3Nn7vt1Hnvv7l4rP/Q+9547Vv4CdtW599xT++7TvXr1Wt/1Xd82QIe/xVfW/Jbm9bfpsoDdM8DpubYXBdN8YJo3mZm4feJSA0YhxP17AVTTC0BJz0t/C9ZaUIgKzoCx7H+hTLwHcJjMdDNDoPa1n/yOySu3gHEokcxmKOAQBIcz0szF7M1h/P7C9d180gAoYJv7RMdjSFdsBuhsM1ALJjaf33KNv0s1Pc8YEEnfLrpvIDXpS03z5WNj/crHfveh2bn5H5rK89eOVF/tvR8Utrg4Gg78oBz86ec/+8gnPv7bH30yVlXITLKiNYaoEDU0tnRYo9QC1hiMgpoI4nDGILrv7KaJAeHUbNsfMICCMbpvvWbQDggGrKRBTz4I0qqOJ2mb91GSMVT3b7Ts/78x6f1//OjvLMwemru0dnN5cXVzA/UeHwOdPKPoztDtFrTbLba3B0+OyuHHfvnnfvaXtRyWzhqiKmhsnueaZ1uwoKppAZ0SFHIDTy4PciDLDrj12G1NGnCQ5KoAXiIirvGKiJAmduuuaucOYyY8YWyUxsNM41HGHPT4opW7zMXfvfzM5cXHHnmYtc0Nau9BIcOROQfOkBVteh13fqo3+wuvf/t3v+OJRz/3tq21pVGasYPGmBgHqhhimk9mEXHkRg+Eu+yblrBxRzHpwyj7bhwl7rm9m9zk44cZJWqKDeMVtybdE3XCi15kP//UP/uXP7Wx0X/7Xz/yV9y4sUZ/sIkvfdrnBpzLwBmcLdiwYNxN8qJ4w2333vsH259beVfUEFQixjiMiWRAxCJqKVwKYM4povZAQHNADshsO5NJt4wCUQRRwQclRkmupCmQJDsqFhC1yUgYRJUooCKIWCLJeKbxEJ2MN40Bf/DHfvrs9NzM733u8w+319c2qcsh0UdEBIOixiAiaBQqX+Nrz7CqiL7GYu++5+WvvPvq0xf/lzHgnEHVYZ1FDRQurYBqcjlj0iKs9SsH2H0DtLIU+yaisjGatgHpwWAwxuBsmoC1BpzDZckoFvaMlOKAEpqAIqoINkX/yYDpsK9+3ev/5IlvXLh71B/RLnKKdoFEIcYKo4I1zYqpR0Mk+EAIntJHYoxkztz/ste8sfPcN772l8ZYjLM4o2Q2jXW8rw2KNYqzhpXdWwww3c4kre7kljAYa/cMYm2KqmNTWmOaFGeafe+w1mKNYqzBWINzyWhp/yuumcz4se95/z/+0Mbm+vt2dvscOjTP4eMnmJmZpSwrqtEIleRlmQWnmjxPBV9FvPdEiZRVyfT03Ovve8WDz12+9PXHnVWcMVgLphmbNZrGaA0Yx8pO6SaGkXaFcaAykcvNxG6x4IzDmWTd8d62NnnK+E5rwFiHQVMWIb3GO04mvvW+1735NOL/xdbuNlPdDidPneG+8y/h+MlTzEz1yJwlM+M4YnAma76v8S4fqauS0aDk8uVnGPrqV9/0d7/3FGpTVjiQpdLELe4ApNkLgjJ2e5uC2PiKjfvYSQC0hxBkzzrNGPcwxH66c/v/Zxos0Vxnz9790PrGxpSIsnj0GGfvuYuFhQUqXxIwSFSixD0wEh2oyclQnCqEQCBDYoki+DLOvOW73/bRd7/7+371ynPP3/jD3/roE2vXny2xKS1aDoK2g1mgATjjlTcNHkjpymDGQaSZYFpFuwd6jNlHgPYAjGqA0y1AD2Bj9cY9gUg7b3HHHWe4/cwd+Lqi3evh1HPk0CGsnUaNUpcjlm/sEGONqCVqAjShKhEDr3zwFTz0xm/hsc88/O1L15a+vTs3zVvf/b2PHD129L2//JEPX5Ums5lbjHAAB0waYS9Sm4Pwdg8zTGAAcwtMFmB6di5vt9uHp48eP5UbOk9f+Mpn7C0WGI1Gd5giZ/HIHMdP3E70FSvLK3zmzz/J9saQYX+bWG2T5TlHDy+wcOcJVvsjrl5ZQrVsAq5w24mjLB6a4fd/67e5fuUKWm0gkvPlzz/6xh/8Bz/823ffd+9bn754oTbj6erBgmA/IjcrnFY5Hpy42c/jt16T9xkDR06fmbvt3H1/MHf8xPWIe0xM+y8f/Na3/TruoBNUkcKKcvTwUcpql2vXbvB7/+2/cPWpb3Dj4l8zW17ldNZnPmxw/dIFrt1c4dD0DGfuOrW3AKrKocNHubp0k5Uby0yzw1vvP8G337/IQjbg03/xqTe99i1v/QlRTRjENvXDrR6QuX0gFBUUh5pbaiCzZ4c9K6qBILIHmR9405tP5EXx6Y2VjXOXn36OIBbF2N5M5ydf8ca3Dh7/7P/54IQJFiMZlQhbWwP+5tN/xuryCsvXrvDQuSO0nKOVZfSMMt8pGI3Wefa5irN33InN25h6hDGGbjdjq1+xtbvL/Ud6ZDjyXHnZbdN86tmrfP1rF3/0ntOnfu3G6k2JEaxz3+wBocHse0FMkidMruz4ZW1ye+sgSETRvT3ezlqv390dnLt06Qq1WARQlP5Oyec+/8V3GGtwNiPPcqzameArNtdXWVleYvmFK3zj6ctkzmIFuoWj282Y6rWYncqZn2szFTbZHQw5ffxwAkeqFOTgI8PdHa5t9qklMDPV4/D8ND1b8cL1pVe9/t0/8kBCgy5tnVsN0NQLCblNpKrx1sAcdHdjEjRO5afZSzWjUZmv3lhHNewVJ8lhDKArRWaxWaqmylHpfOVZX9vg6a9fYHtYU1aB7X7NlfWKqIY8c2SFodXOmJ1qc9fRKZbXNig6PRTFWsfGYMCoHuJDpD8KPH1zAKo4Z5lvO1Zv3uDSxS/erWoxRhp0+KJV/v52l8loqSDxYCBUBS+TsV5xFrY2bv7Nzs7OPsUyxr4asPBUSpkGZwxlrCjryMb6Ojub65S1p1tYDs912RoOeXJph/6opnA5vXaLuYUWtx2bYWdzPU3CZmBgd3cHXwecUY7N9tge1nz5mVU2+yVopNNpo5rfhzE41wKbv3gQtLfURQciu4JKRJu8HASscTjnKDJLnlmsg+1rTz2lw82PjKNElEiUiCP82ZRW/1QRrDEJ3gZiFE+oa+rKo1Y4NNWhW2TkWcbGoOaxJ1e5tryFcYYizxLWz4AsR0KNATZ3+rRalrnpLpnN6LZynl3d5r9++hIhGIreLOvr24hY6hARqQ4YwIwNILJvBDcZ9HQf4Y0DSO6gnaXfxqXo6gyUNdoy4V/nNn7YOLOJRtpW/91CXr0rc3E7IWdBkn120UgMkRgN070FnKbNYk2Cv3WM/OmXr/HJx57j4rNrXLiyAVkLS41IopG2N9fIXU6vO01NIkXmp9u0nGV+bhrUs7l27fksA4tttuMtvETw4QC2U3uQqTEODIJpaCg7UfMb3UdZWQN6ptzol9qFPkss+3PZ6MNGYjBq9mGSdajK16yBGD1lNaLXEirXQhL0whrIM8d0r8PFK5t87NPP8Tufu8aJQzPsbA+wzfBNMIRRxLY6+CDJG8louwzjMurhEClHn02pXQ+AtH1KzNh9Ds9MlK9xf6O4Bsfu0QATGCFlhzz/uZ/78fcu9Ba/5fLVzVesLr1wz9GObZ09feLzsdXp31ha/+gv/cb//H1VojFQhepE5roY46jFE0Lk7jO3cfX5y8x12ygJlHQLx8JUl+V+yfFDh5hfWOSpK0u4zDUMlWN1bZm56Xluru4yVcPIV5yYzTG9eeLNzYumHa7E6DDUpD10CyV2fCrzaiy2wfU2m6C2mvhgJggDO5Etihz7oY/82Hc9cOfivz1p+ufZ3CCMSrQqGZaRUZWz6wVah1kdFv/3ievrH/7dT/7Zw7Mn7vg3rXb3Z6yBuq4xvmJuocPO1pCdGy/Qa7dwziIirO6WjGyb17/65VR14NIzN6jKIRIjQaGsPadOLhC9ZXNzjXYOr3/dQ3z9ys1B3Lr6nUb9I2nCKWl/8dn1fMz5doBwYqbtRaWZmCVvDOAsGDJEQmJ5ZD9oOgNveMdbjv34+17767d36ne2V2/CcABVBD8ilpH+ILA5DGyPAjc2YTdO0V5YBJf90W9+5mvBOvf3AGKMVFWFscLxhVliFdlYX2F7a5uiXbB4+AjHTxyjrD3PPbcECFVdMRwEvIL3Na1OTifPKYoe6kBFl9vGf8CE/h+zt5gpCD/2zFo+xn85IL3CyB5Z3lQvmQGxoCp78UCbsGksaNHK//0vfv9HT7VG32PWlnDlAHwNfgheKYee4ahmczBiYyewtDagP9iiGg1ot7J7F+Zm73tmZQNRwarl2KlTGNdi+eYKc9NTLB4/wdk77+bkbacoelNsbA+4dvVqwzlYRDPqusYBXoU6CFXlMcbyigfv+1fV2pUfKGy8EKIAfiJuZVzfGLgDtLg1Dd2pca9kjdzSLpng9XDYX/uND/zCYjd837Nf73N6PsfKABcDEsBXkX5Vs115dkewsuXplx41IKM+22sr9Dpz3HXneboz07RaLba2tgiqtLozXHrhOrkRVAuMFawViqJDkbcTRlFQjXsMbqYGohA0cP7+c33b3/j5dm6qqIaZqQ5V5VABa2Oix24NggEhNzaFe7652bHHFjWf/+Kv/MQPnF7IPlStjfjy9lla5hq32W1CHVDvGdSRrZFna+hZ61es71aUMbmOmVkkzB3nyk7g+etXad80jAZDBlUk+hrE73ERWSYYB4XNsbbAGTg036No5Qx2Kza2HD4qzjmG5ZDN7V1OHDv+zDe+8OkqswZnlBCEzCU6X3FkWf7NBsibLDDuBJmm6rGm8YRb0NHxXvbDttxFD5/jVa7HoeFVwkYklIFYRXYGgUEZ2R1G1rcDgyoSENaYZmnZ091YpdN2LOQZz68s46tACAEk4REVwRbQa7UwpilkjcdoRstltDttttb6WJfjpCLLXOO5hl679Uzu0uTFOJwGRB3GRnKXY4y8OB9gDxAFFjFycN7NH4eOHF2YKurvIBYwdzuHW6uYpyO+ikQfKEeB3TKwPfRs9AMbfU8VBWtgmS7r21tsmwGLMx0sMJMXrNSRqopo9GhUogTMUDlz+g5AKAdDYu0RBF/XhC3P1k6fMgTqugYG+Ojp9NocO3nbC1+N3mqrLUY9ZIYMQ645avSAe9sDLMbEVq9ViJog74E7DfzD973q+zP1uc96RLEwHBGGA3b7FV+4Bl+9qfRHKfJvDkqGdaSMMAyWoQ8szs1z6tgiGIOYAlTRqibPcobDkrKs8HWk9kKnN8u5+17OsePHmiIKbm5tcnNlk3beptPpMDs7i7WO3JiGOLUf/Ec/+59+6zVv+Y4ZVU2p3VoEQdWRmexFDDBmnsf83i2Nj0lKa7bnzlOOiKaNDJZh9Sayu83QV6zupKAxrAPD0rA1UKooqArTs8cwNqfb7hBVKdodRGqKbossGkb1COsyosam9wQXHr/AQ9/yEKfuuAtRkChoVDZ3+ixtrLC6vsHKygaDQZ9BWRGicunpZ/n4x//whzdX1u82YhLFXgc0KkggTlSpB7eATTBQmvw/NoC1FiMCOKJGRkPvQizIhiOiXyNublL2d6nLyL2HPOvbgbV+xdYosDusuPP8a3nzHee5zcCPfuozyeFCiTE5nelpBrtDihZIKbRbbfo+AKkLtb21zfbmNlevvUA9SsGxLCvKKr330WNtjtdE0cdRSV3XPPxXDzPdyY4emYo4k3iAPQ+P+s0G2KP/NfXSMpM1kxesyYhEpMH8X32qPTh/LEArkvkBcbDDqKoZVp5RDeWR13Cjozj7At9zzx0c297GPvMs3liOZRm7oULIcQTwliI3zB2ZZ2MQmgJn7HMRcHzik3/CzesvoCEQJVCOIqPRiHa3w8KhWYiO3dKT2cj6xg6+HNDJ+cteXn1WY0Rc1mD6DAi4F6sFRPaN0HIZximuSfiiAVWLqmBwHJsbtWXUIXQqUEPwSqgCg/adXGSRC09cZWtri3Yn5+TVL2CKLvNTU5BZzheGR0uPKwpUDIKS5W2yvKbllK26whWOWO/vua9++XGmptpkBkId2O7vcPr0CU6eOkooA4P+CLuzg826HDl6jK2NTY4dnX3MDFcH2CwBJxUCNU7drYT1RM3fGD9IQGJMzQUDIrZpbaUuTz3g0S88q2xvCWvbynZt+bI/xycuK196/CLbW5t4P2JnY53rWY/d0YjhaEQ5qrgt+tQ40aaNrYpByPM27V6bzCo2TylZm0ZuNSoJoWRYD9nc2uUl997L7adOYCQhe5tBllm8r7HOctf5e5hdPPGOV731PcdSkzbR3Vbdfrv/RWnxAwIHh1pDUEVVEYk46wgazIVlY7Nt4aqPtFoVq6vK2uoN6npEXUdqH5CYDPfkoOZuCYiPeIVjIoSmXRKix5gCJKKiTE1Ps76+1VDx0iQnRaMiQajLmgcefBnTnYIQUozwGtgZDdndHVJHwddrOGt517vf/cCTz1x58qHvff8HHvuj3/j9KFFEBesc1ub/fwNgm24QCTJm1jJummazC9MPvOrVf97p9h7a3tpmY2uH0c4Ow6ok+oj3ER8iEof4YFCNvKCRm8ARY8iNkIvyoDV8sQ7kDjRWqcASpZM5MmPTdmvKTlXFWEW88NIHXsrizBzDuqKWwNraJu1eh9NnzjJ1X49eq4Mp2uzsjgghsLp8ffbYyZO/98Z3/tj3r62vf+DSo3+yZuxBUnTPAGMVh4SG8DSp3y8CahNjWu2sVisraw8dWlROLR7C1RVro5raBzTU1FGR4FOqagQbIdY8k+ecqyKFK4jqeHkMfMlaYlQkCsYEfHTk7eSisgdK0nO6rYJ2p8P89FyiohWWrt/gnvN34L1y/YVlNERUAxnggbIsWV9dYVhVHD169PsWDy9+6/Tb3vMjX/n0H/75JOqZqAadjDv+ZiIzGJPyqDOgFnfiyPGPvOnQHA+5jO72Nk/VJTuDET6kbm2IMWkJBERrIDIS5V4Veq2CSKQtwiDPuDocgXqCCiHUFK7F6tomaix1VTcdqsh0u8OZ08dpt3uYzHL5uRd4+SvuZfnmBms3VolVYDAc0C+HDKuIxsDW2hqjaoQxjtFwRIzSnZqefe9t5+8/I535h7/2+IX6QDUoKjjjDvTu47gcNNCaO3L4p7/tzR9czFpM7WxSXb1Kr6o4ZWFNhLquURGUsM+xN2Bqlcj1MORwPYW6hDNePap5oTvNtd0tIJDZjHpUo2ZfjGGs0G23k/Kl1aLyFf3+JnfdeYYXrt1k4+YqIQrDsgIV1IJKSVlmzE6BkcBot49EIYRAXdYsHln8kaOLx3aBDx7wgPluIZmDvJXteYhJHeX8/e98z/vffv6uPz5U+7fK0hKDm0v40RDxnlYUnrEZg1GJamgAU9NhUU2xRJRpU3Aqtyz05tmt+rhYc1wiV3sFxjhaRZutnQGD0YAYAtZmdIqCdpajKIfmD5HnlqUb6xw5PMPTl57Ba8QHQ1EUZC7DqoBAqCpijLRaLciE2KBBX3nqqgajLz27GH/z4uXl4cQWyCQFnfQPgPmht3/XO9/xwIMfvy3W77Nr653+9WvUOxsEH9L+lZoOsJE5lqsRSEARVBNdGZuukBqlAs7ljplWi8wYyrqiK8K5sqKwllhWyPVVlkKkyBPmqKMSY0RiRBBmp2fZ7Q+pfWBnq09Ve4rM4pxDYo2KUoca7z2uaNPudXAuQ6NFgiQxRV3iq5AfPXl2+KWvfPWRF6sKyFt5+8e/8x2/ctJlP5ndXGZ3e4s4rCBWRIkYAYskekiUu23k61mHUPb3lIVxv9mMwbCOsloJR6Oni8WYHI1DCoVXViPurT2fch5i5IlqTDpGajEEH9i9vMR0Z4ZRNYTtQF2nSF+SkYUSA/hQ4auyyV6BTjvHCygVEnO09PiYE31kd7B7CxRuUt3fecWrX3b/0ZP/Y244urdeX6UalHgihIiLMbWIANGk/FCJLJrIjO2y3qQXs9cqS9ogYwy1RtZCYBQigqHdajEY9Jv+uzCTO77t8AKPrGxTxoqVOnBDIfhIEEFRnrh4iSNHDyHeN10nS1WNEsVsItFHYoRWyzE1PUdmDKKRSgzawGobIqWWuOgOZoG5bsYPvO4N73vJ/PTHO9vbJ6v1FcJohHhPCIFgMohlUm6JQTQAQlSLqDDK2izVdeP0Y1FMo8swijWGrgRO5S1MZhuSNcf7aq/j3HGWe2Y6zGQtNivPtMIgRvweHSVs9we0JKkwi6JogmaNUYNtOlRTM3N0ugUYh8EQfExBctxvUMGG8Mj15eW0BQ5NFb2//9C3/ufjzr2X1Q3qaoQEDyGJkDQIkmdELCoePUAeKIhhUQI4IcaxKEYma2wU5SmJvKoe4IopCsCopLwucX+7GHjJTMGZ3iKPru8yu2O4WUeeDPtl7L0Lc2SjiktAZg1Z3sIQOGEMLm+xmTu8RIx1SCOjRcFpIlvE2T0vzQB+5g1v+lC3rt5rfCDUI2LwaONmoikAUZfgClT9npo01Q4RxTEThmQuS20uA1nTWtIJ3cyucSyVNbPdmFYnRlo29esyAwFwzWJPZY63H5nj3FSbz67scDhaHhnU3NbpcL6bcawomN/cxEskGsNU3sahjARWgmCsIZqIdY18R8a1ZUBitlceW4Dce4wPeF8T6hr1HtFIkIAXAwIqnuBHWJtjcImcYNxSj3RDZH7cTREhSCBMQM4oihHlmhfq2HSfbAZqyPM8SXF1v9mk6ogCZ9pt3nN6kdunF5h3jjsPTdMTS9sZ0KQIbTUbL8aIkUg3CDGaJNBUh9GUAZAk4gwSKEM5EftDSfAjpB4l0KARkUaALKnzImowGhAJBIlEjem+hqIWVY6JJqp6LCCQSNSkNqV5PecDA1+nLGGh1oBq6vNLI9QIkpqiIlCKIDGl1VcemScHjBhWS98gxcTcqsZmkpGjUYgxEKNPtYmmgipIZHZ2lqmpKZoeapMFypKgJuVbkZS/VZoiZUI607SKxy417h9mJg3kmESsc8QQsePVFyU27c5OZwrT6rAy6tNudSgAK4KjpmUzJEApEadKbDoxhjRWH2soLE4tNig3hgNis34GByGimv6ekUAIhn/+hnvoOOE/PHoVme9x/r7zzM/NU0rJzcs3ufTspWSAMkCORxtCIHFnTZOk6fGztz9D0x9JQcRKJDQ6vEI8zhT4WIG1TE3N0W236Ha6FJ1W4xiWyzLP1OYaMwayEGgDo6YTlRvDTpC0BZvgFTRSqYBxdID1csgohiTksBaXZeAjMQascUxb+Cevu5M333WS//4Xj/DgYoG87EGcTVlhY3WDQTnY94B2BjGkwYXoUVWipHZYJKLGYTSiGEQsxiiqBmMUPxZMA60oHJvukJ84QVEUBI3UFXhfsrG8QX/Q5+iRBYrZeb7RanFuZ4vpmLyjsBAstJ1lNjNc6wfKEPECtUDwNXTbtGNg21cNVLcUeQEieLVI08Q9vNDlnfffzecev8iVyrDU34HLz3Ln2bspRyWXHr9ENPnEFgj7zLiacSGjex8q+/2B0OxlZ7Ikp2vUoQGoEWYWj7AdAteXlhj2h1TNYMfttivP9ynuKRhmbYZlSTdPJzyiBoxm1AoFhts7bZ4cjLjRr5tga8iKFvX2CKtJRZ4VRdOkTMWTqAEjvOttL2V1d5Unrq5wUabRXodT0zPUdc2Fr1xI98VyEgmWqGmlczDSBJZm/sE4Eh0wWaMbBA8mT9ogTRG8No4hwvKN6+zubGFshrM28QwT2ro6Cj2XEXwkZi4dZyFDtenbaeronOm26fvItYHHWyXvFMSVAEYosjZGBcGkfqMRPIb7z81z3Fa8sHSV8vZznIotpmanyLKMC1+6wG6//81K0bJ5MwYacqAjahCjmD0NrSVRmfvMYmzgb2gXBO+bydj0P5pgU2+qy3SvR7fbptft4rd3cA4cOYak0I44EGGkSmYDEpWFzHIVJdaCfe4q+Vjzrx7RHKMJKgeBqMryyi7l7jInprvUyyvMnnopw3LI419+nNHuCOwkJzyxBcQ1q696QEpqVIk2BcCGWky/JxQl4yzRK0sOzc1SByFv5RRAt9Mha3VT8IxQR2V1fYuTa9fInCGRX8lIViIYJeAQScHPNlL3qSzDS0BtltTpCkYScatqsGoRDTy/WnNts+L2eXjNNHzs+SssXVsi+iSPMaqIy/bGne39lD2xW8OhxwPEkRiXBkgaEMQ91XhQJaoyrAIzO1uEQ4fJjSWIUtYV1eYaw2FJVQ0gJjndNAHj8iYAJdAjDboUkwJwHSNeFJtoFixQGJPiEPtqjYg2PKYQjOWzl7d5zwNHeOmCYeupdQyGLM8IPmEOlbh3DiI70BFs0FhiZR2mOSFkVfHWUqhpaGzX4L9EQNQRhiHQjx7zxEXimbPc3NikP9hqQI7dOyTYUHpsqiV3+xO3dowZYjpyo0loMoyhEQOY1OGx4GM6mqON1kybgwtZtASNPHxpl2+7Z57D7Zx3HoWPXwuIsWR5hq89IoIVewsLoAlKOh1rtOLENkhsrmv2eiRSCZRR2PWeTR/Y8sKWN2xHQ3VjCR/r5tSIO3BCctx72BKl1IKQFagTMBFjkvI0KowiDGLNMIIj29uWZfR79YnuKVfthNYxlTl/fWWXFd9CpmfIi17T6xdc4ZqwX36zB4iafXmr7LOmEcg0kk5iBEQNVQjUpNUvJVKqEkURo3Ql4GwbdJSeKwZjUjlqk5CDgKNvlTaODukkkyd1pLUBYUmElTGVBYIIfrJbPR6bAhr3VOzWJBnf//76gEe7bUzR4dCxgrUbSu2HWGvQzO6l/gmtcNprNA8MJlEIcS/5pRrfaKoRFAiiqAasUVrGkNkEozMxFM1kUoEj6bhac5BKBEwM9GvBqUdIreux63sVojYHtlSaQw7N6dBGtKiaAFLUhnrTfaG3BYpYsXzxWxEuEAAAAI9JREFUScqyT57lzB+aJ7NtUKVTWF7WjvseEEQfCcH8/JjtIdgXERGXSTfQ9Cwljg9VODQ0zIoqQxOJGsi0wgbdD7Uh7G+pDIzAavCcpkOtJTakgZdAqQai35PkDiKIetSOlZ3p3G79IpLeauJ4yuGzZ9koazo42p02rfYUfuR5VS9wPq8f/sSETvBv7fX/AJWvXX5TTXU4AAAAAElFTkSuQmCC";

var img$5 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAfy3pUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjarZtZriy5kl3/OQoNgX0zHLaAZqDha23zuJmvXqVUJUB5kaeJ8HAnaWa7MfK4+7/+53P/g/9a6d3l0nodtXr+yyOPOPmh+7//u7/v32vBZ/v657/w+xrcP74R+Z74nr4XW/69m36v/7m+/vWdG/3DG6H82wfSX4+J//rgNn+vRx//w4hiDsf/63/97//fO/29+81u5soy1G9S3yPcn9tw4WKVkn2s8q/xf+HnZv8G/7qffofsj99+8W+HEWJI/gUG4MIML9xw+L7DZow53tj4HuOOyV7rqcURd/IppKx/4cWWRjqpp5h2vCml7FL8ayzBnjvseTt0nnwCl8bAzQIf+b/+c//VBf+df+9tzxqFwOzDb60YV4xa96BlTPrKZQQkvF/cii3wn39//ef+JbCJCBZb5s4Ep1/fLVYJf+dWsgRIXFf4/uVXaEdRi5YlmWcXBhMSIfA1pBJq8C3GFkJOsROgychjynERgVBKPAwy5pQqsenkEc/mMy3YtbHE73VKhfiUVFMjNiNNgpVzIX9a7uTQLKnkUkotFFoZZbqaaq6l1tqqam621HIrrbbWehtt9tRzL7321nsffY44EiVZRh1t9DHGnDxzZjfL5NOTK+ZccaWVV1l1tdXXWHOTPjvvsutuu++x54knnXzKqaedfsaZN1xSyd18y6233X7HnY9ce+nlV1597fU33vwrar+o/qd//w9RC7+oRYuUrmt/RY1XW9ON7BZBOFMUMyJG7RLxpgiQ0FEx8z3kHBU5xcyPSFWUyCCLYnOCny5UQphviOWFv2L3d+T+23FzrPV/Fbf434mcU+j+P0Quupv+LW7/ELUjJNwWsa8KtaY+UX28f/uMqzCishZr28/ei1fyPrFfhpxG2b2WE8pceXp7qbeVXkqx9nnazOfk7zW94ubJM47HCzGMlkudVAlA1eyVHGNfe2/e322VRt2858fa45AcxD6tfdu747j23krznrdDuYF59FzfPYc326v9rcyCvxf3q/Wctdbhk/eV0k6Nt23dLrab3Vn98LF0R753jxVTL2QxY9AlKXCTPap+vvv2pHfCP7yzbESB0euF0fqu6aOLdUiRQ+L1d/Teu2noO4sT726TVeXXae/dGY+zG0S79AzS7Tz/2u+ZWc9s3zPnqv51kovX1rmJSzJP57358snPUVFFv2Yb0+78wkPBtTLCPuW2npamzEDTa8xeNwoM3B7m47zV912am3fezmKx9kcko7dr+p5Uwtmvt3ZPWXp71XvsRokFT68rLYE/VqpPd88q43mba61vBIXr1jbGWu+WwSQU+bdOSxcG3JunkWy3BkqhnbzHl5DDB73MspBHQ3lEoftLVjZPxGthkvOM+Uut9ScfyUbKhyx9wytP3e+NGg8TGInPkdLcsZJXs1J4etzIe3ZP1VaeMHM8kEi/s4b6KhlO3mW3D3fIR1xtL7DaZ860j699QXIkSp0oJx4TqJOtwfpYPXi0yOB3qLlFCjticQeF+0ZiQbUoVyt5b2JxPdFWYdTXVYbv7vMWi/+UeCltVtECSL67dy5gk/na2uCt1SqpyyKAe6QCwPMYM0vBkMrm5ft2f5FHH/CDmgiXtZjJJdZ5lwI45QrYNMopvCW4bnOOdU4ljzdocsSJebOiBKCPrxZIq7tyj5RIoFq5KqF0eMQb3KZzXziTlAICdXln7epMLJsncYJK+Kv9azdbJe/l5q6WQ8M+yYcsY1+Zc25QcpEXDJqqmn0nmHr2lVMLbefQv/pkAXYfVmunTnLukOAARbr1UBGJn4YN/3FPn3ZJeewSF+DNxSwAi0DRjHHX26k4JjtA59NIjUXgqWDm2H9zDKtfVnr7A1X1ueAZZltZScbJY8mKDs7DNY6qI90HmUQY84LySmzQgYq/UJTQS6njKMVhAAqjzEZoyhw570aijUWllOBELnADBRxLIhjI2krKQYWgdMiX10PooD/smvLq+wQgnEfUcfuZERhdUAAw4u8It7ShAkd2ViFAU3IQ9jrfOEqEwvJeANp/OVnJyWQ5WYmD6vo46iLBFYheSIl8ZoWhz05V3Qr7AkhnLqKtSjpr3EcEMoSYT5qDREYIxMrQHTQGZ8ZdF1fwY99r+Ei+cwfWj/AXaN+mBB6hl4ssS7xhXaEKGLR3nWc74GXVSWJ7kfsgW6ixQGEnct3DzUQuNSHA7FA7ldUh+cDC8kyeUsqlanN1CYZidfjoZvbQ/eyZx7Ic80JTd/+Ato31WEAAE6CDF0CxDNYlXl/tlo30S+dO9MlYWdQIfqIkkAn+9FoXVUQSRhVUYBLx9xsaA8zEPqCkKPlah8vkkUzaCsLw6MkJVM3QBQsQHaQC1ZRnZaZAEcBIic2m/wa1Gdt8bZLJbvIL8P1uVM1WInJLalf8nNeNEy49A3K776v2VWqmSPw+SXCItGJtA2KUp18GC6pp+BpkJ6NlRwzIP2goU4hkP5em1KXkpCtUkdQ3umsLIcOYkAW1hZ4T9olsx5TJilHFQMmQnLCQ6ry1HymSMN5eFY226noI41akSyd/eYYUHLcEf4sMV1RMybACJHniSrKsAJ6SeokpsiLwHZUe3KsXyUKoUK/RbxtvJq1gIYbEenNnwoFk4dPATwGA5gGpYp3XU7gEknKYDnl1yApkV5VmXlWh527oJlAyBwWOGCo3UJ/cmPKdoCB5Il7ZxIw1jhRtqcbnGfwD8uZH1+gJfxBzCFHACouDtEIWUYtMAIRF5s2nIiFVSdB6n2O2aIleieOLC6p4JqVU1aiJc6lTahbF96zkjf0rYMMaeOzxlUWmaporecTLomVKpr0PXFf4KaE5az5LoIvsJTEQ3MyOz1FsvNWiZsOyjJwoEQFl7pTqlZo1SLqVWHQxLwxOSsLLAHERj66L3Aal9VzSoT9LB2yW2EJYzhswBan0BHFd4TtbBqECIVwLf4EDAMZV3pBC0kHrDx3V5HiZalC2GQqc8ZM+6mNY6rUhumm/yfZXB2tfMtqh7jI6YYJNUCMXC8ATj+leu/s91N2n3xbC7+bye6fWjBSv5PGDlklb5TupimIpy3lqFo7eKlkCE4oK/e5I6uKBMsyT39YkFsBllFglAwGTemewYO4DjjqYyepKmdUMrfEwOwHgMOUWYlNuyHzyqYLnUABMhX6fUksDWwd2k0iqtV0EwuAWq07yM7S581y8QHmR4Pg6QAU3QfyxTkHGjq/M7szUSoJUUQUO9dRnARpQhKhQXRc+I1WhuAaveiCZFLblrgKmhj4eMBhEBHeRJEoTBwOSFegNMXmHv5BhzfgLSCn2sffgB33sgDCMbgBBKCNs3dpQ+7MEdKi3KcmKkhiiUpZ3BaRXi4jI10CFDbe1xj1QBiSpdAHj4RHSu8owchfMXntKv12VVSnkLZVUGmyHioXrPcTcIvIzKXKCngbm3wP4PsrBUk+3Kwj24beEXaN8J7xZxLiMGOauksFoDZT+YQkS1Qw6Mydw4nwiKy1zCvs6SgmP0Krlxgckf7KYR2JGs9b6oBP+FH5L5x/EjZtNJTZDkJpucwDFrZO9PGm0n6sbxiBK4XsjQSSgDLmp9LUOBSuxndXozbZII5KwxIoxNV1okAKE3NFJ+IFYiHg21M+kOLzRLGnRlfEwLbfZYPzBfyTZtYU1nAEIfOIHL9vIkoERbxYRFL/9zSUo3ZHI+5Wd5wm4ICzKoOLPEJdRlAWdU9dJZpoWuq8w1MBvjbSTWSzmEb0gG01W5UXSix8Oo/1nqsiwXGNeXo9PimXWZ5uGhTXHLYQJdcjPsGZSUK80P5wcjMKFKGTmwPYHSGRMv1GdBLzykqDbmiRijreBCJQysSM5E0JgZ2RNaSKsye24cxzUWVWHAp2IjDoyZ+I1XvTCmCC/RJHkBXn5uamVTdXXcBiR7wQFrXUhPZxr5desNu6YasIpmMIbGSukFQIDq4t+kHRIpktRrD5259EBrNp4fCdWyqRn2pSVYziWvygUii3xKhYskPAoSmUZUlQzNf9KiUAx4g4SCtqCZ0jjDAtwEdqBoHtVhZAlBsiyqYtARWYZ3STxRh1SUI70QQs/Yp1j1hs1RUELQ0PsJu4ICwGFCzcIT6F5MyOndqBsiKYFNVrIRVdVwTIe+JWEgBis7KZqKVh0CrTJyOEJTGLkRvvJ0LWlNSdsACZfi4LneBepijj2S5k+Pj4a80TcLN6WbEskzPtKuco/En3k4dOrvwycebtl5BgodAHtl4HU11LqDsoKwd07ymf9IWCmg/ul9Knva3Jxrua7e2qCADksdxtK5QfvSqsH9A9rxQSh5YSemk+gQKgQmDZoGWDIp0o7d/e1hWpOrIyiur4+yx8yVkschqxpi76oMqn//sEKq0M2IhwQAhN3xAjQJo0V258nrNLgWtCZqHfKVdUgITQrAWH5zRAvbnHyzZTSi8e7LJ3bCRG2lQV8QPhoBoZNwFGr1EdEDEalQwnqm+HQFgUAJiMv+R3yOQ7YqxTZiWj17YVh4JcaIchSMgjgRdwuFAUlP8+jIECYWSXqKYBAATFVkMotOXVkXmUmCBJEOGpPHAzySpW/CpDyiUxRQiiIAgj5aRnnk69rMiMwoqladRK6mgYLJQmGkIznxT/Y+JS/TKv2Rc1xDwkd3ON3D/UYdQtHHiSig5LGTCTlBInmH7mTiSxMdI9aKdhCFCdXDPlKhAy4POUPEJ24qpTck21ipJC6pCg4Aw4gIVjfSb1dBBFSe5LnMmfSuPDbWROtVStaGYIVQwZXklcfgwHBQHgLYCSqLXrUSBoYUm4MU6ijECJyh/y71fh7IGARl90KtEKQJaSTdx5NAlmi6/wRXU9KJh4lRSEVWvXdDGsROW+ZZ1BkDrihJKAWDzBElgdu2IYzCQHKMqJRyORj9cUCUTsdpGJwvajnI3499m58fbigbEMv8ISIHqkiUXPsMJk3fOSxmM4My7ZrLWzwCJoEOoIaZSK7PKoDKyG8qIkStiz3L9JAE1lHlUqBMJfsObeg4pOml+cmrFUDq2rjljR+LPIp/740dMC5FvQeX0o9ynYyPYa+zoffGB71UZIEIMQul8E1bg8W5EzJrJKMbiG/TE3NWy8/yZDj2jvmCjXYBCu4E2LNDNDZEzbxGfakaKMYDUFARQ71LkZAZYJNQD91sj0E5cM0OS78jh2rvwpJhiNTZ6+Ad9xI7Yr4IPxkGGvCMp6R0QZkdR9ha0lFKkn52odYCpUMBS9Kg0nnhMtvTuqTAedXKSbBj/VGGs6ThFBPbKcc47zJl7SDsW5D1aHwk4dKJiihUhtuH0VKv0XonZXK+M9a1BzbISJ5CAS4/eQL4Weki88AGyoY0wYS8QN8G5tjPmokkdkwsxR7rZo4LBmfGujF+JLyxLG+WnET2zpDN/3AuOAURt1OXW3M3CBgXvnKLaRS+SzKHyVwhCQoe+POaB1aVQ+FLvhDvWoHhYg77D/XQWPhjG4aSGugtAxfWj41Qw3yzTH10yLF0JTmZnMQnQSsOzwsFYblqGA80luoh+oFq6EDsKuAAS8iSX0x7fYCkXioABwPYz+UD2Rf0Ee1VpI0z6IHRS9kuAO+ZF0JSsXCtAArAypF7Z6DZ8MvUW2gJnqqcK+Ws3eynPl2pFTpZDATQwp5Mi9au4roZjJCHcGjRCRNJI6GXINaIUFwvlG4Ll/Kio/mTmmwCLC6rFBLxnGlfRIZsIFxoZ4F4J0akYhNsEtGIl+o5uliyyjaJGW1QhVtUT4nEojPIhM9CZWqGJa9BwS0lzT3H6NODvYhVSvptW6RxqSQGbAkOvMY/aQ14rSSODKoQc1+FhMT5bfglrktAs4gx3KBEILGxAe1kQHXvmznNS+zSNbny7B/wGTxEG2rbNtIOkA4HKkEY9zgEWmpvkBRtjfKpykfyHDofip94fb0AS5FCk7g+ElveR41on/tgwXULrjHLOJeX7oiApHu6iTxr2u3TAi8DYFlobcfpBzZmwyRT8T2aheCG9wWvrJQ1whmLcOoEMZVzqFrGpmD9mNqZeoKeBneRKz/nfaOG3TxIoKI+36bBxbyApPOURHVL+w/9E05lg5ZAVAA5JyTVQEyECyO7FJLHE0OYIAX+2iLpjdLElaG6edjtgDKQiB023XDWy/tMuK3sdaFa52AD+jb+to1ZjV4JRa1vWh7FWRmmMRMelobU5iBAO7+NI0am9BrcUAwY2RKoQvwqYulsxCIukNdtX+pq6ktRVUp5uqp6yKFe7TXVG5u7p/2Vcivoe4A7s1cJMLN9OsblWwXXheQ8uBNgIOFQwGo3BK192ItDXUWGT+IsmJSJ76qU1cINKEK1iyvsqmEsqm7Jn+tUuvgCOGv/V7BD8P3EHNQ47zJRN5vMy7/9iLwdywV9YoL3OdXsMylWnm7g05VG+79oaXwFy1RuxkFqm5vF6Plxd0QIqCL7d2xIiL1wJzKctt2r1Yu2oNUfmg5tEkBHSv2KNCsJiCenHSdGf3bWhT1cS8P9QGC8PdxU41yFE+YhfzDGbVKMiy/EMgYfnIq36+e5nwoFvOxKFkNo1TrcOHMc3bV+GjlKTkCcGW1DhRmbRcoiW6UTM2YHu23B7QUK0Vi3UtNj/nbjYH7AamwZLaWWXNtllAKy9qKcGUGgjF4upZa3NiGaz03Lw5/2rFmKAhTB+gHEws1E7QZWYWtRkb5fIDS2zaeBSN9dhn3YawFlw11FoeO7LyGzdIlAwyVJlCzoltrUCQgdbMgvS4/Y+WC2fhUZPRlN9IhrQAu3zPcF3ttrW6yTAPmwgXQJTgVZssGlinqdBCoaMJqolw3jK6djJMES2+6Wn5NHkQvy7lKkIW41+tgwgrIoGRK7cB08mEfBCHujLXhWUNK1ihQTmeARF5lGI+aYZTI8a2ArXywoCQMOnGD6sMzrBYYBZShJcEZUAMju40ZyNU4BQlf85Dsx+i/oiMH5APcqZ1O6cJz/MUfhC3UR4mPRxnI5qtESMo2wxbJ72eblvjK1glVlY8UBE+1v2CelWGbJAQBzEuwPVYZB0h1JgeeCDZYc8T3TrZ5AVkoc5LEVg3JKp3X8YjPtkGLZL+kduv4kgCbnetelpNFNx0SD6YCSHeT2OClDABl6xk0dV2rWm1aZFiBAbFqkZIYOpkxA3mUYAXfsmq2dtsPE9Z18Eu9fcYze022w/aHy45akoOsCNbSFUubFUUABTWLxm3qfbcgm5j/7GpHbTZc67Lz48B/UGPb7JYfMsT60pojR/H8Qj8ukpsbUuEB3ONOmPWQUR7y+aB2HbIZVA3zBiUEfDCIDqvM7WJMwoNcf9w5hSIhCWjAMLVCYFCWOmLwhnbmwOwhRrf7PWDxmG900KWcI6IPX/HtTLI0kOCEp+vm2/JALzJqdmlfmXID0XVQ/1WhqOHO5ZKEsGSNum5mWlCnlLsfl3kwjAOlV0GFwgXzz/bhBkRaln9LTo4IIdhH/7q+8rXaVVPTqktV2N42zonnH1FR+s5z4I3XxKuR7trmqVlHgoIjcrAHgEXKd7X219cSFoaBpNoc+WKvYz9B9RZjDrK2aiK12TwpwFc0JNyiHRxtweucjVqOvEYWC2btgIgqVVvqc0L80MsTnoebtbepli1P6c6DoIwpr03qVe0fAXTyCr8NDTsiov0YtCUj6hmxofrTFvPHekuooT1IKHoFaCGM7/TUt4uvbZX25yDKUlOIwd6ZdF4GUKJ4pxpGZKF6Kbhska66qX2+5qklqOjG8GuLmB+LlsWdFVBWhOknMXtyLaRJA3H8XLM6IY03pJlrh87zqqWBtgueBDYQ/zElOCw+tnePMT/QImLBNbNGaKgtdOwhWPLnHpbaEawsWkhejwTBk4Wh5g8VqQQJqCvR8RY0aWNJ8hhxn2sa38Gl65PaDwgualeuSruwYFWOYDUzgqrE1cQnS1QtZLwUMK7FzYr8iTKd2qDGRGobHFiF+pMVPw64t4ZhA9dOxoxqo04nN3475DtbS9qJRdWS5m7jo3ac0SRe2mz1sWbkOsVctMXdQKZrjUE001DDxAp/d1yFM+U0fluGaOtTcbLUEXSbtD1A8cufkilN1n+UhHPPi7LIoJedRrLzVGofPu0sY8+BY5atoYVhH3E0w0ZrEmlx7PxWCVsPA7NOBIO4B7Te3czfqQ3UGID2NzoFgB1oyOel3qNIHbXZrEG57SQYNCamgiE2407W4qSo1nVy4Rd05De1QkF1eG/pcB/VrMN7+4Zv8N3roNIRiolfWtcJnGpUQ4o4nWPZCIyKp0DTSuB+nDLk2HDU60husWraX5c0ryAcKNWGbR6oFLXt5BrFWrVveua36mIu7ceTKFI54CnVQUHgQmGeZe3jplMQci/bmti22FHbwkQFwIbCQ9X+uXbByPihfpD1QJ+O3AAyk+VM1v+7/piwPXaoJCFrMos+ddItP3gQ7Mf26hQNZYJtFtld+XMDqL9NRVPHqxSPtsU7504e2aEFjwq2TgChljrfYOjLOmHC0ylrtQK0KXW+RW86z1IohQba/95x/+EtcUXVhgl8CHk8nTGxUtaWRZNP99oFQSxP7o2/Aj/ys/xxL8qFpMV0QTXKJ6IJWDEmKlZSs5gqoXYXQW4lB7TeHH7YXoJ6tfUDQqdzcw1c8VplxAK2QCKLoOhYGuPTObe67dwFpl0n0PgJmigxLW9+MGvzx2kuOpCBRitRWz7Pmnf1VPVRrrwbV/drKBZ11uWFahvocrYyhsH6w84cJh+FiREZfVNgTwf6WpTthqzWx0aylnbWR5tcl9LDlqjfhaO9AjOdQJhPh2BE2Pt9pieNo70QylPKuiNQs1cqasvAy7UTFjyzMe4mRjp+Vondd7AFBAIrWAU1jUeNlbFEJoypZD0zMKJ5VVnZm79tGZ0QLdqTKsFhBJsO9iHUdCBwqr+i41F/ldFQvycbM0pZa/9S9A41zYfhw4YdWW5HEvDc7ywbiCHoNsWG2DhN98A2anMLg13x552lIzTXtBuhBYPVKT9AbVvacnk6/7+OulJJyYcLkgnlmWoqaBcZLlMDhUSDmgAwz/j0fJytRogY3Va9YCkaiacS9qIqJmYVWmV9qPehRo4O58D6oVIXRcnZdPZIaaioTUQXMBaAL+RBMs8rX00MbC9aztpibj1TVkMufkpEJp3Nmjpg2XZYVmvxCeu+w63kr06gw9yP9ajNGub/8h4uAh2AR7bDeeKypy1JRnR293AN+IF+h9k8Jl0WnJLMOBstF6rPekRvR3DbFKiEpf5KgsxB0K0ynRbCFNlapoV0NvJrV1BlUtooPOpecJ8S9dx0aEi7Mr6okXL0OVlPR+YglmTSzIjUirgiJYD9EOUs1dQrdpjFzrvm05HaOk6ykVHWqoBHSD6nXbpSGB1SWMKUqpJffx3gYMhq77U/lUMiATKoBpAffEwZWCBSaiZ5JxeNQlNvP/2248lWPo8hR8w1NIAhjp2J8X+OO/+APtlZdsJWi/O4lYH1joB30B6z2ek8EFkbEFC/rNnJaKiYFK7VzhJCPCdNjB7GBy0akvYgjS5lZIG2hj/6+WAAWc6+qbuGpyPrm58wtZxMN6+vLa8EwnFl0fnsTY1lJqyDeRTTzT5JyCDRtOFF7drhOzJdG5i/LucSLKsJp2NhOvnaXP2qeUwUeFGgZ8kHnqU8dUwf50aq7G2nLZiU9Ib67EsleG3XZO4IfzpikIPAHXOTWc5KxUeddeLDQZ1QAhTVlCNiYybIH7Hkt84QLnDEOh4yDI4XdtWpBSmFGr69YR6TtFV+m3ZlU9D51G/rAbu/CwYP635tu1IgLzWBiABRj4y2gY63XoFAB4dGhHfNrasvTkmRLhIYIkCsHKmFtDu2jfg7M9rff9wF/G0CTssqP+RMsmHCi+nbiEbZAVpH5gZn87pOjXmjLmAaMTt1hAAa/m6gv1349xvkoN3aJu61xwzh1QrUs6stJnXcEFGA/Bgn6kCeNYu4Z0UIfkeJdXzj7f5rbxzsnEqNt3KwUypOI7f2+9beVe+4ZKwm8ufosEdtksWGAlt/ExPVii3+fSfwj/6E7KijB/jbEzQDAVz6boo+46p1Za5UMh7VkEQ/t3sQ22qvQ9RPp7TsbzR+CMkkS0JoSezuf18V7gooikWCNlJ7+h45YcpSY0Z4YWEu7shMyndiUMepj042UGI2/z4+W5a/3fal3TFKrNjJ/Z3+ZRbFFTAqoonTWNpn0NnT4/Mj13Fok9tT71ZCS12mb+H/KaKOwU9pdHViv/NzmAylnY6IUyLcBd4JOpY9F5lJXEevsxzrORcLgN2IGNz/FIP1C8H6jyFAKqrHJc1hi6w46OhdqwCbNpxZtzG0l7z+nDqBqUm99Q+pp71b/KFOt6g3852hOlYiDCNRWwOvk2vQefk4tPdZ/IBTvz8S6TxIO9GzgjR48CzPO1r+5sLPx9WZ9ecvyCB42dYoRh0FNJfZADgYpeivc9TNCdoW1FHFqRn9OWb4c0cx20pkPXuEj7CPupqR6kZ3ZlStdjyKWunQVU+CRh0BE+S8Vs2TVpd0gCKki/zjNW0M6nzieb+NE/1ZT+9JG6MPovsOf33bhiwY3L1tXzg3N9No9mdAs6oPdXT4RaLNk804cVSYVNDTQeiH6vxzC+uSaEPbHugnsmaP/h1ProTuaO9Yu34Vd5JlBPcXaCi8aEdBeaNTIbN/K5T3r5Qcou7/8JYSB6nOh601+eeu/3JPIha/syaz68zo91lDra6/xtIIALi/X2/Ls75eAmlHqcPrhU33eWwMacU9rzPcql/gq05mbUXjP60JSi+E1smSZb7lEVJ5kGD1y/o6beqHu7UdgmU3sp9qWYEnDBAqJItzxJ6ov9Nto8e6Ge5/A6NI2sRNoDicAAABhWlDQ1BJQ0MgcHJvZmlsZQAAeJx9kT1Iw0AcxV9TRZFqBzsUcchQHcSCqIijVLEIFkpboVUHk0u/oElDkuLiKLgWHPxYrDq4OOvq4CoIgh8gzg5Oii5S4v+SQosYD4778e7e4+4dIDQqTDW7JgBVs4xUPCZmc6tizysEhDGAIMYkZuqJ9GIGnuPrHj6+3kV5lve5P0e/kjcZ4BOJ55huWMQbxDObls55nzjESpJCfE48btAFiR+5Lrv8xrnosMAzQ0YmNU8cIhaLHSx3MCsZKvE0cURRNcoXsi4rnLc4q5Uaa92TvzCQ11bSXKc5jDiWkEASImTUUEYFFqK0aqSYSNF+zMM/5PiT5JLJVQYjxwKqUCE5fvA/+N2tWZiadJMCMaD7xbY/RoCeXaBZt+3vY9tungD+Z+BKa/urDWD2k/R6W4scAcFt4OK6rcl7wOUOEH7SJUNyJD9NoVAA3s/om3LA4C3Qt+b21trH6QOQoa6Wb4CDQ2C0SNnrHu/u7ezt3zOt/n4Ahp9yr6fEdNoAAAAGYktHRAATADgAXeGhz0wAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfoAhgOFBt3+yzsAAAgAElEQVR42uWbaYxt2VXff2vvfc69t+rW9IZ6c8/9erLb7fbQtN1t0mYIjWMm25gORknAwUowiZIoIIECSYDEiUCJgqIoiiCgkIQQWYSYYIRDDBhsDG233e7J3a/7vX5DvVdz1R3PsPde+bDPvXWr3Uh84RNXuqrp1jlnr72G//qv/xagw1/il2u+xub9F/I6udB2H/v5f/dDO2tby8Vg7+CuHgpfINEwriK1H+7URf2lF59/5pXf+/xT16qof5FrN4CRxgP8rcvtenK7ANjmeysHHzcKCqgAAij4kK6kzc8KaHMhBTKH/blf+JX/vrux8YEv/OnnuXZtnVhU1HhCWbI3HhPKiuBrMtdi+cgyi0tHMML1l1+58JHh9o1PF0UxiDPPNLk2mlZgBKKCmfmAUVADViGag2cSsaCBl7aKDHDu0AXl4IcIOJm5Y0wXmr5CMtShPZKZSzQP9yP/9F98s6/HH1i7tkatcMv5W+lkbQa9Pl4j7byDs5bCV7TyjLzdoSprjMip8/fe97+jZft3PvEb/76/1//lqr/9yuTaPoKz6R7S3Ffj9DEIzTNO3FpDYyjC1Bg0Rs2AuNB20QiIzsSCKhGZxkfQ9PcQwTcPIpPY0eQJzBjN5Jn55ve+75dGvf6562vXOXX6HFU5ZjgYUlc149GYQW+XUW+bwWDMaDSk7PcoqxEhRiRGMuPm7rrn/Nd3FxY+0h8WDxjT2q6r4SVtbmUleado8oLQPJNIek4EYoAgyUtjTF/3C28B414bGKExgjNQ+XQhC3ifFhymQdLc4DVR1cksxqabft9HPvKW4Mfv6A8rer0hu7u7FKOCWEdKP4ZQETQgMRJihaqyrw5VTXZUQUVBLC637dtvu/39e7u771/fdJ/s9Ud/U4u9Da/gYvLE0Oys15RmlLQWkWSoyeLldZJg2j09cOmoYESm4aAaCKpNsM/EzcyPThSvIB4UZHlh5R+XZcmNa9fo7e9SVzUxRogeoserT5YSxRoLCEFNMrzWoD4ZOXrqEgqGGCOcWD3x+PLi6LeLUfd9N65fvVjHg9wjMwsUSUbJTFqDMWlds2E7DYGjHRdVZgwQ09vHSAiBEAyxyYBRksGCgFElqkGEFC6qhAjv+IZvWr357Kn/LOJ4/ulnqaoKYg0hojEQENBIljvmuissrhyjs7JE3p4HUUII+OiweGITYzFGoqYHc86dsq3uhxcXumVvPHwm1qGSJiFOFq/N4rVZtMysr9eEwDStxSaGbJNBRUFSpIMIxinWgJr0FQPWgHGGLFeMlRSPmi701gfe8BNZe54b6zcoqxJiTC6oB/lcrJBlbdrtDu12TksyiB71nhjSzocm84YYiBrRqKgq0Ueo63lV97Mnj518+fTJm34+c/lcbLzASFq8mMNe4SSF9yHPn0b1xN0nGd04rLGINB8zQm5SaEzeyaUEkVSHrHV85/d+6ExR+R/QuuDl5y+kB44hpWKUoB60xhiDyTJsZjBiUI1oDdFHJKakoxqJGlAVtIlRjYEYAtHX+LpmPPbHh2X50aUTN79w+71v/OdikTizOplJznGmTB/KATT+oPFwSRTAasAj2MZhpEmCh3ACB1Xg1OqpH9np7bRbbp7ae0T9TNzFab00JiPPczKbEYHSR0pfEH3aZdDkUDES1aEaDiCbRoIPVPWYoioJAcqwe06YOzsp0Tb++ZFgcsomx2mzmOTNASS59wTwiNgUVxpmFm9RgQceefexYTn62y3bojfqI5oWgYb00E2AOuvIc4t1GRjQEAm+JEQ59IAp+TpQf4C+mhxVxUAdLCFMar2EnZ39fxuaD01KopE/hwG+JiaasBBp4rUxjjQJxQio2Cb9HvztDfee//D29nbn3JkzbKxvoxpmDGUOwIM4NCjj4Yh6XAM1lQ9oXTdJLMEZRb8GpYcJGiKgoUY0oGIxhC+FYv8rojMlvclvf24DHPpjA3lfW+9FD8cRM3B0e3v30cHOPnPnz7O3fwGN4dD/WnEE9fh6jK8FQ5EeViNBJ1UxEKJvLp28L+jhmhsIxBjxdY1rclSg/l8hopNsP0GGsQlVkcMw/5ABXmtnM1MvJyVl1gtmX7FBgQJsXVufi+rptOcY7g/RyQ3FzuDkZNlUeXyDP3QKK2S2UktTlcQg0VNPfy0EFbymTzsRTDS/PXWO6aZEhFTCZcYQX2OAzB3saojJUqYxitED7508/8QICSJrQmESJRSj5ehyymqYsrkJBGMPrC5grCXGugm3VLdiFAxKwGKsYXlhic7SEuor6piwtw8loQoUdUE9qih9j3YXQh2oqmq7Hu8/FTQgYg+aIQwKdJwlmkCMf4YBQpNdZzuq6eInXjBTT41ClATqJq/5ucW56MwDKsqg54nUWBxgpiht0jMYcXgJWM2T3zcu1J5vM7+4TKfVoaxLxlVBLAMubzM/P0/nSIe5xS55p0vwnhtXLrN+Y4Ot3a3/uzncVsGmXZ4pf5mAJ6RbyJ9RBn1MrlqFg6oQm902rwkLnbSYkcZxGyOGUG/sbn/m7IlTjw6LcQOkHMRANBajMbkykShK1rQiqkLucvJWC8Qy7vXoV5t47/EhYqMwGm+z3x8QSQ+UvKVGsJMd/eDKiXNfN6zGPxH6W78SfPooJE+YhIZFkAP8dwCFj825qDMdnczkBD0AeIdePkwa4mZ7YwhvePs7r77/2x//vvXLl6j3N9jc26X2HmfTZ0QtRgSxYI3F2AyxKWOVxZhyPMRXFRprQrRU9YitrW2qYR9iybIResMhw3GN90qsPL7yhOBRlWXR+J2VN+fbnc4favTDBLAEUcXYDJcZFMPWsDzcDRrjpgnJ6OFsGThIgpMcEGMEUZxxGIEn3vMtZ4/M52/zx05mp5bm2DB9jt50nHvPrLCxM+Dqbo/B2KI2o9uZR1FCLAkIRiM+JorImhatuRbluGR/b4tzHcNbzq/SNo4YG/AT4Mb+gIu7Y3pVAdKelktrcxa65onRuHirGPmgRH0KY4lRiBqpfdPkHaSkxAjdcaxbV94fAg0TT6nDQVs5y/ZMyIgPf8s33va3Hrnvy0fb7W5RDdgZRdQUfHFtj3HtUSMMxgXXtobcvOgY1cq1/YJL+2P2gqXjMmwmWJuBFdY3dnjgSIubV7qIUcQ46tITvCcCw8IzLj3WZVwfljy/uYdFUbWJDNEaMJR+VFTj4Q+ZGH5R0QS3m3zz0vrwMCNU1B5rm8yv4KzDB5/qcJO5JiyPHABaUPjWB277J8tGuju7W7TbjtMrHUJUHjy1wMVeBcYhy4s8cqul3++xX3nuPLmIGMcwQq8Ys7Y94qtr29SDEecEWtJiYaFFN3fECEUnELxSlGOMsQhKv6hZatkUmtYmpApYMlCYMwttI+7bw3DrFxNrEoniMBK+NglOEJMVgzWp8bDWEkJg0uS5Wc4tQlThxLmbj6+22n/9/332aW49u8rx+YxRWTN3fJGji5FKDTWw2HKcPNKl1iVeWttmY3tIFMO8ROZaGZ2u49TZRaKfZ2NYcWFzn2sbu5w90eX2k6ucWp6nDpGqZeiNK6wRRr6g1ekSwgZ50+JNM/yk+ZFwBkvTRRpU4hTdHkK+k7CIGgkxTGG3oWl7jcEYiyG9Male//C773/w6vW1/NbbTnPHrWdBDFvbe8Qq0LKGhbZhuZ1xbKmTSpLJuPfW09xyy1lMllOXNZdv7NDrnCR/8D383lrNwCzwwJkub77pCOW44NNPvcjm3iBRVCiintFoQF0MWNtY51h3Pm2wsRhrDzhOwHorVjKElHytMa9fBjNrqSYLb7C4GEGtYEVRH0AtUQ6QmIhyMnem9MobbzrN9tp19vp7zM23iQQc4CQnz8ARwQuIgzznlptWIHdcuizcNNeiLvcYX/wsbz23THHsPPu7mywNXuGeE4u88fRx2lJRFBVljDz76i7PXN6gP65BhPmlRdS41JAZxZgwhe8qEQhYSV4txh5Csm4WW9sGPZimOIgRjBiixtQqi2Cm5lMsUJbxrUc6ORo869tbrKx0ObK0guQWfKRloeWabjAA1oM34AO3rC6T1RUvvXoDMQ4xNatty/7a09zY2UOW27SynO5cm1ZmeP7qDrsjj108ybGlIScWoJs7Xq2EUCq2JWgdpx2gABo8RixqZrrC14XCxgJpsYniMMkLUqFqCEY9VD6wgi96g2NHT6IhopphZQG33MVmEXxNJ2v8sYYYaoyahnEtATiz2EGPLfPM5TXGlSdKpNW2nD2+QJZntDOhnTtsq0Vv5HnT1z9OaM9z6RMVrZUV9i49zUZliCHS6a5w+uyZ/Ytf+cITXs194B410FvqzlNWJUE9Es0UGB0CQkfm29EYQYzijGCNa7gkRVUO1UBLijdrYN92rz9+300/ONddyHxRUIdIdyXDZELdwMqo4ENF6T0xGEQyTEMd11VEQoUPgY39IaiQZRmtVptOnmFUyPKM+fk2O/2a0dUXaO1f4Uxesb2xx35Q9iqP+pquFcZVnVPtflTq8adFil9tt/j1GBVjIgaHMYbMGa5uDy0N8s+AuLrUitaANQ6DYpzBAWIMJk0UMJISYfpd8oP17c39x+69a371xNFH59sZ5XhIu9vBZg5qTx0a8qKq8R6QLCHC2ICpAEXRo+XAGUu/rMmzjLY15NbQMXDzsWXOn16hqiIXNgu2e33W9ms01rw6rqm8En3F/NwcZVVKf7/3iXabK27CBwoYDEggzyzGCpc3B4eR4GRXJz+1jKWWkACQznRFM9hfrCUz8M8+9YV/81Md823nTxx5w4mTR9CWg6jJ1Wrw0VP5RGeJKFQF3vuEDzTgfWKNzh1Z4fiRFa7s7uI8tAwczxZZXlig03JkQBWUnV5FjJFOq0PUEitx2svEWlns2LEYcC4jhgqxDofHM9esLn5tCBxfbEUzgX4SEU1gQybjJtHpTNBIMki7qb29/v7o0y++8ot3Hl20raz9aO4kWV0DhfcNdxcSkouB2kMdaupYUhQFPtREMWTOsrw0z9nji3QzQ15ErAXbbmOM4eX1Hte2R4zKgsJ70MiVQhGUsvQcn3f060Bm/U8aZShagziyBk2KptbVOuXi9f7hEDixNBeNIfHIEyOIJFrZJPdHTOP+hpY1U/wgArlz4XdfuPy7K53WUm6rh+dbGUaUykd88NQ+laYQIj7UVKHGR49GjwpY62i122StnLzdZv/GPp1ul8G4wGWCOMv+qObF7RFlOcbHgI+RG1WNUxgMC77r9i7Dwg/VZf+qqselSGq4QkOsKulhjWFqADeL+53NCMYgTfdmiCAJQCR21k9BhHOOoIrVgLEZRsBaaM9l1d6w5KivqNVSq6OKAVVHFZIHGEnQlahkDe+YZzlqDMbmIMJoVNDuzLO01KXlDLmznDvW5ujxVfb3thGBsU+ERwhwej7jniVL8Gb3N6/t9o3GpjIlFsg0OF81IjNT3qkBnDWpS4o1YiF3INLGNAMQX3vUWOoQEANWNI1NjdDOLWITPF5dnjuVqzAcBUJLMPgEQTU05ddOR9sSM6KtEZsTRMgsoB6JOd3ji1zb2GS5u5Cg+WiAKwNzwx3mOnP42rPpA5mx9KsB33rrAluFEkz+ycyIKsnAqqAmlXSNqSF6XVI0qgHxGDG0c3cI9ydskLCxs6njwhgMWWqgbAoDb1vZYubeYQ30x1X6TPSI5FQYogRCc39rLbm1uEwIKNY6XO5A0ihs4UgXby29nR6vrO2yMjdPfzTiyvoWHiFqoB8qHI6i8NxxtMPusGBzXP6mNYKqotY1nm1maHbFGPP6rLA2/q0KPkRck+TiDC3sjE29AunvTgQnKUd8z8P3v7WTZXfUsaD2nqoUMmuJsZhyVKl6Gpx1uCztjjUWk1tEhaAWq5BLTrej5Mci/arkqYubvLo9JojFh8D1woO3VCFw24JjzkTW8qNcMuWfGDPGoM2mHl60iGBnen5zQFenxYsTgh6mutIgImKMIRCaeUFyK2QyTlPOrXT+ro8ldVACws6goPJCbPpzYzKszWhnOVmeEQVCgNxmWA3N4DNQ1gWDcoBEwUXH0cUFbjl1EpxBxVJ4z3qpiET2+0M+eM8iV3bruLZ89tff+ODDP+acQ6xFjGCtxRiTkqAqInLIAw59Z6TZDUk0dojNIFEEsYJ1FhHBWSFz6XNhwsGbrLOUt95bNVNkg2F3MKQ/HuG1meqaZGCTO6TZBePcVPHhoxBjpKwD3nuKuqLyNVUVqWNBXafMvz4qCdGy1xvwV891dFTzG9fr8u2vvvinTxhjHjv/4DfellmhnWdkzmKtklkhy4TMGox5HT7Ah4DBJBJEBAs4Z4gqqYNqJrQiB0PD2oc018/hQ+96+/dap0salKBNXLuMG3sDztgl5tsgUuNMu9kZqMWi0VPWHmcy1CfSY1yVRFWMCKH2DEZ91nZ6EKEMvrqyP/hEfxj2bj6iH4/d5S//n/WN6+12pqpQR/7l8WNnf+rVrPUhCKoKEhy4yTSLQ6ORg/F4iPjG1WOaYxM1DS8k1tOFSwxYAqFZfKq1mZzqzj+hqngNSExj5sxB5QM3dnupBAJR6gZMCZnLEGMp68CVvZLrRYsXBo6XZZW1xVu4MLZcXNvm8o0eV9b7gKeO1cdPLYX333HGfbjVNp+83NtYy/KWTmj3p//w1/+Hye3Dt9//2L12glOaRG3t4dH44cmQRnIz6fPT6DuEgEZFxKAxHkxsVDESQUz2zvd86IfnqsF751qjv1LFiMZGQxQDRg2tHPYGBR3X59TqQprWSE0lKUMnosWxklmOdAxjZxkPdijsUdyJc9zIV3hm41kub13j+EIrjjT+ZJ65xPRKhjGCMWnoKjHiMhPqUPzc0vHV70f4R7aBOlZS/Hvvk97ntQZotVoYa2h32lNBgzUzkovJBBYhxMj5h//a7QtHF39t59VrD77plFLXlhA1TZMb5JWmNDmZi1zZ6GGccHJlAWMCDodzDoejlUWca5O3DTIc4NQS++vU6xdZGYy51Q3ZbLXoh+pzfb9/QYxgFPI8P8D0CsFZNAZeeOqzv/KWhx77YlT7o5kVj0akydbpq38dgURMD16XNb721FGIYhMlGpL1arL8nYu3vvO7zj/601kr+8K9X37xwe+WEatdQ+0TxNWgeB+pYkiqDiJYQxDl5as7XN3aw9fl9Jo2n8O1UvcYoyGi1CERtJ1Ohjphe7/HfBYRI/9NbKbOubR4SetBJvP8AD5Q7b6yH3Lz/Jl7Hr5LgqI+hWSCw3pIG+YAfvwHvu8x25o7+dzVVzcvv/jFz1pnS4stNfGIxqvp3nf8ztPvLPmvLSsP/uniEm8dDbjnu99Nef1ZYjXCR5JqQw+kdgFD1IAIZHnGfn/A81e36OSOE65F7nM081iXE6InVhVVneCrStIEbfVKtgdjKjGv7obiF/LMYNRglk/M33n/I/9z+ciRP+rvbvzq07/78Yvgo7UJZS505p88evTEmevRP2sweF+SWTBisdlrgNCDtvMum7V//MH7HqB+41sYBk/W7jxV1qWZK4rjWX94Wtaus712nSdvu43H3naG22+/lf7aNXw5IAZLHWuCBkxMQ7WgkRgORsyCMNeybPUKvnThOm+2jlUj2MxiTIQgVOUYHzylpDCt6sDG3hCvhhD8zxotSo0QiZy/7x0/ce3K+uPPv/DS43ffd89PP/Te7/+1z//WLzxBjNGJJWt3GRWlGq0QlaRvEoeIxbZahw1Q7O9jhiOyPCOzlqMoUsU3a1Uh4wE6KNje3+HSmVPcc8sSZ44us3/lEvuXXyGGiGpsJsq2ETMdCBiagoKYiLUtVhaE/rjgj5+7wsN3G0ys6C4sguTEOqnDCJ6gnt5ozEa/RonFFvprJsRmbGd4+bnnXpJWBwklf/zp32dzZ/+777/3wYWTJ058JmLvuvDsc6vXnv3UvxYsZBmZzROYIzZCrRkDlHt7mCwjGJcADwYXAniPqwrKomB39RhXBiO+5fgCw60b9NavN6Nr0KbPJibYOckn2ogrNICqAQKC0M1blFXNk89d4v67TnM6eBbmFokxCfp8VDR4tvqesvLUMXyO0O/d9tB7H3vkXe/6hsvX1t417A+Wt3f32dvb46WXr5AZfX64/tW//+zm9p1t9Z/AX33BKh6bJwTbJGcfPFV4jQGKoiCvA0ESBR6Mow41mU+JbFx7NuaXuCXfoaorRnvreF9T1xVR3bRSaDQIFRN9jkbwGohR8NE3TVUSM3iE/bLgU0++yENvOMvtJx2tvEXwTSIbR7b2hxiJfNP5hx5bPX1uLI+8hWcuXGBj7Ro4x3K3zdGVm7n5plNktn1P9PVvf+63/tMdxmYq2oB5XyHREE2GdVAhmCCvKYMefGikKuKwlFi12CaOx7Wnp577T84z2lunrmt8XVH7SJQJOnSAR9QQY2jkLjWhSY4THsFgqHxgr6xZ268ZVxWffPIK99085s7TR1ldXIBa6Y3HlEWfs50W5/OcneUuX3ruWb7y5FeagZ4Dk3gJ5xwIPP/8C6O7b33bA6+++oWn3ES/JKTcpJ66SkkwzAwGHID6IpGVhMSWSUw6HRFCDNQxMorKfJbIzSr6tPhGT2fVIdalxYcSYmhCofGAWf1NDIx9zWBUUdUlmIT/v3p5m3NlFxcCg7YyNJFTcZEzboFhWfAn5YjP/9HnDxVvMYI1FoewtbNLq67f8N677//i/r1v+vH/8ju//DFCiEmCmxM1NBtSv7YFmgw5GzV09NPEFjXB40qUohhTVxWlj/hap+Vuohr0Kqg1BJQqgg8yjX+aRKjqKXxNUQXqoLRdm8xmuKXjLB4/ze5dd1K2OpwZ5dzr53izXWK5rvjc8gKf/YPPMh4PGI8HFKMivYcjhv0hm9s7XL58mQ+urtJe3+QM9mc++l0f/Xi+cHol3TcJhKwzOCfkmXk9INS8GyGEKnhVfPSEVgtTVBhIJQmbmJ1G+BTVQIxUVYWvUy/hVQmT3QccHjwEnx6o23K0Wo6jN92BrN5Gu9Nm+/oaT3aS9EbKklCOuXjyJE9d36QYj5PqK6ZpT3onmdyNtXXes7jEXWpxO3vYK2scGw6/46Pf+QO///av+/a3RK3T/6pDoiPvzL3GAP7wUQydcVvBMZyfY77XY1yV+IYXwBgCENQ2woWKUAeCVM3CPXWcUZSpScSEQJ4Z8nabhSOLdG65m7j2MnE0YLi7hSn2CBoIURkax2eyjI1rV9BGLB1ibCR1qfT2BmOG4yHfcfQU7aqgNRpjd7bg6g3mNq6/8a23n/+Dv/GBf/gxMVhFQQJVUb0OH6ATwB8azX2cqkQ0MyyVFXuXh6lr9DUhxka/S8Pt18RQoj492ISMxNrUMpsMTIbLMrp5i7kcVu5+Gy898zSLYYwvxphQ0m0L3jjGdc3nT6zy8oUXmueLTM+oJL8mxMjW5i7vW1rkSCvJ8HMfyMYl2dYW5up1ulcuzZ1S/6N/70M/9vQHvuMHH7etthj3eoQIYYralOS+k+MBo6AcNTl2a8y4P8Q3kDepKXzSEOjkbEniDkxzaMGKYoxiTaCVwVzL0skt7dse4KX1Hc5U20QibWu45eg858w8oR5zeb7Lk71tqsofiJT0sOa1GBcMxz2+bukIPtjUHarBRcWOa1pbm2TXNsguXWJpfe3eu5aO/NYT7/s7H5TXVcaKTe9GtZUiI6DAtkDXRoxkjC/2ib5RbU/1MpHY8AdJVG4xxmJtM0tAMDbDtjLy+Tn6Z+7ji5c2uX14kVMLGce6OTcfb3FejnLsekHpI7/fNuxsbh5MYicanZmpztbWBnfmOTd15hoSR3B4MiDTgCtLOvt9WuvbcPUq5uJl7jh2+j986Hv/wSOHDeAmh8iYEdiZ5gyOYlSoxNC24EZK/8UtqqpRakYazYAcTElEpqIK15wpsJlFFk7zcn4TF55/kUcX+5xacCzMO24+tcrd2U0srifveqbb5vL+mDgpNaoze5U2aTQqGRU17zl+nFaW4WaYqrSWiBMhD5HWsCDf2sGtr2OuXVp+8PTpz3zql/7j9xwgQQe5uoOxeWxay0Y3MCeKOoMN0LLghzD4yjW6dxyHpRaEiSrbzIirzJRWNTYyWrqdp9cHnB6/yDffkhMjBG9ozS1wejxHfmOdQmEswmeynGJz70DyLlPZ5nT3d3Z3UJQ3LS03QGxW0zbhCLQhbSPUEHZ24aWLOBUeftMb7jpAgq4NImgzvJSQ1Nca0uGBDMDmYBTrwYhigiF8dYN4dpH26hwRMxUeTM/uCHjbYXv+FF995SoPLQaOnlwkEHDBMVe1aW+NYbjBOB274LncsjPYo9Y68ZAykfLLVJVV1YHxcMy7F7qcancRm5hZE7WZYvlkkCZkTCP6tTFiNrapxgWvbO7NQGEHSgYSm/MAgviAqiHEgA+TNGFQkyF1TaaWgEGuDil3RpjFeUzbQMeguSE4g5o2l90JBl+9wMMnhEWbEYaGbAD59oCO30sNCulaXmp+z1lGg1FDYTd7qsqBBgyGoxEAj584jZMEuOwUkmkjgjKNL+hBtMc6HdQaDrGvvPyawUgzGJ1w/aKKaEgBbhKwmZ4YzVogHhsDmTFoGWCznLJnphkVXXjTTfS//AJvV7B9i8WTxQGt5jLjRsoSmhMlL+WOURWJZZ2eV+10GckThKDK/u4Od7cz7ptbamRxFkOVuMtGMGnEJNfnIJwn1VQqPxV7uMM4gOk5PWmYFRMBcsZ+yKLtpF2RhvKNFgkVRtrN7N9jBSyBtbvPc/2li3xjVdCSDBvTtFmbOJ8ctUkDV4MTwx+qp6pmVaqhOb6XniWg+LKgLCu+7dwtRDxRM2yj+1Np0Js2Up/XnBRRlekRoHbTtTqAOmafwZifgeIAFTanOjCeUgtCDGhdoK49c6BIiC6xK20LeEvUgv7xE3xpMOKh/T7ioFKTPKxu7qizh/fqdE/XpgeUZYVGbaSz6fNtbeCqwqgoCLVZq00AAAAtSURBVKrcOd+lwmGCEhy0qNLAlfb03MHkcMpkf0uBFkrwFVXIPjMrlf1L+/r/ruJ9bjTHmuwAAAAASUVORK5CYII=";

var img$4 = "data:image/png;base64,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";

var img$3 = "data:image/png;base64,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";

var img$2 = "data:image/png;base64,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";

var img$1 = "data:image/png;base64,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";

var img = "data:image/png;base64,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";

var Tf2Class;
(function (Tf2Class) {
    Tf2Class[Tf2Class["Scout"] = 0] = "Scout";
    Tf2Class[Tf2Class["Sniper"] = 1] = "Sniper";
    Tf2Class[Tf2Class["Soldier"] = 2] = "Soldier";
    Tf2Class[Tf2Class["Demoman"] = 3] = "Demoman";
    Tf2Class[Tf2Class["Medic"] = 4] = "Medic";
    Tf2Class[Tf2Class["Heavy"] = 5] = "Heavy";
    Tf2Class[Tf2Class["Pyro"] = 6] = "Pyro";
    Tf2Class[Tf2Class["Spy"] = 7] = "Spy";
    Tf2Class[Tf2Class["Engineer"] = 8] = "Engineer";
    Tf2Class[Tf2Class["ScoutBot"] = 100] = "ScoutBot";
    Tf2Class[Tf2Class["SniperBot"] = 101] = "SniperBot";
    Tf2Class[Tf2Class["SoldierBot"] = 102] = "SoldierBot";
    Tf2Class[Tf2Class["DemomanBot"] = 103] = "DemomanBot";
    Tf2Class[Tf2Class["MedicBot"] = 104] = "MedicBot";
    Tf2Class[Tf2Class["HeavyBot"] = 105] = "HeavyBot";
    Tf2Class[Tf2Class["PyroBot"] = 106] = "PyroBot";
    Tf2Class[Tf2Class["SpyBot"] = 107] = "SpyBot";
    Tf2Class[Tf2Class["EngineerBot"] = 108] = "EngineerBot";
    Tf2Class[Tf2Class["ScoutInfected"] = 200] = "ScoutInfected";
    Tf2Class[Tf2Class["SniperInfected"] = 201] = "SniperInfected";
    Tf2Class[Tf2Class["SoldierInfected"] = 202] = "SoldierInfected";
    Tf2Class[Tf2Class["DemomanInfected"] = 203] = "DemomanInfected";
    Tf2Class[Tf2Class["MedicInfected"] = 204] = "MedicInfected";
    Tf2Class[Tf2Class["HeavyInfected"] = 205] = "HeavyInfected";
    Tf2Class[Tf2Class["PyroInfected"] = 206] = "PyroInfected";
    Tf2Class[Tf2Class["SpyInfected"] = 207] = "SpyInfected";
    Tf2Class[Tf2Class["EngineerInfected"] = 208] = "EngineerInfected";
    Tf2Class[Tf2Class["Random"] = 1000] = "Random";
    Tf2Class[Tf2Class["None"] = 1001] = "None";
    Tf2Class[Tf2Class["Empty"] = 1002] = "Empty";
    Tf2Class[Tf2Class["CompareWarpaints"] = 1003] = "CompareWarpaints";
})(Tf2Class || (Tf2Class = {}));
const CharactersList = new Map([
    [Tf2Class.Scout, { name: 'scout', type: 'human', path: 'models/player/scout', icon: img$5, npc: 'scout' }],
    [Tf2Class.Sniper, { name: 'sniper', type: 'human', path: 'models/player/sniper', icon: img$4, npc: 'sniper' }],
    [Tf2Class.Soldier, { name: 'soldier', type: 'human', path: 'models/player/soldier', icon: img$3, npc: 'soldier' }],
    [Tf2Class.Demoman, { name: 'demoman', type: 'human', path: 'models/player/demo', icon: img$a, npc: 'demoman' }],
    [Tf2Class.Medic, { name: 'medic', type: 'human', path: 'models/player/medic', icon: img$7, npc: 'medic' }],
    [Tf2Class.Heavy, { name: 'heavy', type: 'human', path: 'models/player/heavy', icon: img$8, npc: 'heavy' }],
    [Tf2Class.Pyro, { name: 'pyro', type: 'human', path: 'models/player/pyro', icon: img$6, npc: 'pyro' }],
    [Tf2Class.Spy, { name: 'spy', type: 'human', path: 'models/player/spy', icon: img$2, npc: 'spy' }],
    [Tf2Class.Engineer, { name: 'engineer', type: 'human', path: 'models/player/engineer', icon: img$9, npc: 'engineer' }],
    [Tf2Class.ScoutBot, { name: 'scout', type: 'bot', path: 'models/bots/scout/bot_scout', icon: img$5, npc: 'bot_scout' }],
    [Tf2Class.SniperBot, { name: 'sniper', type: 'bot', path: 'models/bots/sniper/bot_sniper', icon: img$4, npc: 'bot_sniper' }],
    [Tf2Class.SoldierBot, { name: 'soldier', type: 'bot', path: 'models/bots/soldier/bot_soldier', icon: img$3, npc: 'bot_soldier' }],
    [Tf2Class.DemomanBot, { name: 'demoman', type: 'bot', path: 'models/bots/demo/bot_demo', icon: img$a, npc: 'bot_demoman' }],
    [Tf2Class.MedicBot, { name: 'medic', type: 'bot', path: 'models/bots/medic/bot_medic', icon: img$7, npc: 'bot_medic' }],
    [Tf2Class.HeavyBot, { name: 'heavy', type: 'bot', path: 'models/bots/heavy/bot_heavy', icon: img$8, npc: 'bot_heavy' }],
    [Tf2Class.PyroBot, { name: 'pyro', type: 'bot', path: 'models/bots/pyro/bot_pyro', icon: img$6, npc: 'bot_pyro' }],
    [Tf2Class.SpyBot, { name: 'spy', type: 'bot', path: 'models/bots/spy/bot_spy', icon: img$2, npc: 'bot_spy' }],
    [Tf2Class.EngineerBot, { name: 'engineer', type: 'bot', path: 'models/bots/engineer/bot_engineer', icon: img$9, npc: 'bot_engineer' }],
    [Tf2Class.ScoutInfected, { name: 'scout', type: 'infected', path: 'models/player/scout_infected', icon: img$5, npc: 'scout_infected' }],
    [Tf2Class.SniperInfected, { name: 'sniper', type: 'infected', path: 'models/player/sniper_infected', icon: img$4, npc: 'sniper_infected' }],
    [Tf2Class.SoldierInfected, { name: 'soldier', type: 'infected', path: 'models/player/soldier_infected', icon: img$3, npc: 'soldier_infected' }],
    [Tf2Class.DemomanInfected, { name: 'demoman', type: 'infected', path: 'models/player/demo_infected', icon: img$a, npc: 'demoman_infected' }],
    [Tf2Class.MedicInfected, { name: 'medic', type: 'infected', path: 'models/player/medic_infected', icon: img$7, npc: 'medic_infected' }],
    [Tf2Class.HeavyInfected, { name: 'heavy', type: 'infected', path: 'models/player/heavy_infected', icon: img$8, npc: 'heavy_infected' }],
    [Tf2Class.PyroInfected, { name: 'pyro', type: 'infected', path: 'models/player/pyro_infected', icon: img$6, npc: 'pyro_infected' }],
    [Tf2Class.SpyInfected, { name: 'spy', type: 'infected', path: 'models/player/spy_infected', icon: img$2, npc: 'spy_infected' }],
    [Tf2Class.EngineerInfected, { name: 'engineer', type: 'infected', path: 'models/player/engineer_infected', icon: img$9, npc: 'engineer_infected' }],
    [Tf2Class.Empty, { name: 'dummy', type: 'human', path: 'models/empty', icon: img$1, hidden: true, npc: 'dummy' }],
    [Tf2Class.CompareWarpaints, { name: 'warpaints', type: 'human', path: 'models/empty', icon: img, hidden: true, npc: 'warpaints' }],
]);
const ClassRemovablePartsOff = ['heavy_hand_dex_bodygroup', 'robotarm_bodygroup', 'darts_bodygroup', 'spyMask', 'rocket', 'medal_bodygroup', 'demo_smiley'];
function npcToClass(npc) {
    for (const [tf2Class, character] of CharactersList) {
        if (character.npc == npc) {
            return tf2Class;
        }
    }
    return null;
}

var ItemFilterResult;
(function (ItemFilterResult) {
    ItemFilterResult[ItemFilterResult["Ok"] = 0] = "Ok";
    ItemFilterResult[ItemFilterResult["ExcludedClass"] = 1] = "ExcludedClass";
    ItemFilterResult[ItemFilterResult["ExcludedTag"] = 2] = "ExcludedTag";
    ItemFilterResult[ItemFilterResult["ExcludedFilter"] = 3] = "ExcludedFilter";
    ItemFilterResult[ItemFilterResult["Conflicting"] = 4] = "Conflicting";
})(ItemFilterResult || (ItemFilterResult = {}));
class ItemFilter {
    name;
    selected = false;
    workshop = false;
    sfmWorkshop = false;
    sfmUniverse = '';
    sfmModels = '';
    hideConflict;
    tournamentMedals = false;
    showMultiClass = true;
    showOneClass = true;
    showAllClass = true;
    doNotFilterPerClass = false;
    pinned = [];
    paintable;
    warpaintable;
    halloween;
    displayMedals = false;
    displayWeapons = false;
    displayCosmetics = false;
    displayTaunts = false;
    collection;
    matchFilter(item, excludedItems, characterClass, activeItems) {
        let ret = false;
        let highlightConflict = false;
        let isWeapon = false;
        let isTaunt = false;
        let name;
        if (characterClass !== null) {
            name = CharactersList.get(characterClass)?.name;
        }
        if (item.getHide()) {
            return ItemFilterResult.ExcludedFilter;
        }
        if (this.sfmWorkshop != item.isSfmWorkshop()) {
            return ItemFilterResult.ExcludedFilter;
        }
        if (item.isSfmWorkshop()) {
            if (this.pinned.indexOf(item.id) > -1) {
                return ItemFilterResult.Ok;
            }
        }
        switch (item.getItemSlotPerClass(name ?? 'scout' /*TODO: fix that*/)) {
            case 'primary':
            case 'secondary':
            case 'melee':
            case 'pda':
            case 'pda2':
            case 'building':
            case 'force_building':
                isWeapon = true;
                break;
            case 'taunt':
                isTaunt = true;
                break;
        }
        if (!item.isSfmWorkshop() && !this.doNotFilterPerClass && characterClass !== null && characterClass !== Tf2Class.None && characterClass !== Tf2Class.Empty && characterClass !== Tf2Class.CompareWarpaints && !item.isUsedByClass(characterClass)) {
            return ItemFilterResult.ExcludedClass;
        }
        const f = this.name;
        let positive = false;
        if (f && f != '') {
            const filterArray = f.split(';');
            for (let f of filterArray) {
                f = f.trim();
                if (f == '' || f == '-') {
                    continue;
                }
                let exclude = false;
                if (f.startsWith('-')) {
                    exclude = true;
                    f = f.slice(1);
                }
                //const keywords: string = item.keywords;
                const itemName = item.name;
                if (item.hasKeyword(f)) {
                    if (exclude) {
                        return ItemFilterResult.ExcludedClass;
                    }
                    ret = true;
                }
                else {
                    if (exclude) {
                        ret = true;
                    }
                }
                if (itemName.toLowerCase().includes(f)) {
                    if (exclude) {
                        return ItemFilterResult.ExcludedClass;
                    }
                    ret = true;
                }
                else {
                    if (exclude) {
                        ret = true;
                    }
                }
                if (!exclude && ret) {
                    positive = true;
                }
            }
        }
        else {
            ret = true;
            positive = true;
        }
        if (!ret || !positive) {
            return ItemFilterResult.ExcludedClass;
        }
        if (item.isSfmWorkshop()) {
            const tags = item.getTags();
            let foundUniverse = false;
            let foundModels = false;
            for (const tag of tags) {
                const lowerTag = tag.toLowerCase();
                if (this.sfmUniverse.toLowerCase() === lowerTag) {
                    foundUniverse = true;
                }
                if (this.sfmModels.toLowerCase() === lowerTag) {
                    foundModels = true;
                }
            }
            if (this.sfmUniverse && !foundUniverse) {
                ++excludedItems.e;
                return ItemFilterResult.ExcludedTag;
            }
            if (this.sfmModels && !foundModels) {
                ++excludedItems.e;
                return ItemFilterResult.ExcludedTag;
            }
            return ItemFilterResult.Ok;
        }
        if (!isWeapon && this.paintable !== undefined && this.paintable != item.isPaintable()) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        if (isWeapon && this.warpaintable !== undefined && this.warpaintable != item.isWarPaintable()) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        //if (this.halloween !== undefined && (this.halloween && item.holiday_restriction == 'halloween_or_fullmoon')) {
        if (!(isWeapon || isTaunt) && this.halloween !== undefined && this.halloween != item.isHalloweenRestricted()) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        let filterWeapon = true;
        let filterMedal = true;
        let filterCosmetic = true;
        let filterTaunt = true;
        let isMedal = false;
        const itemTypeName = item.getItemTypeName();
        if (itemTypeName == 'Community Medal' || itemTypeName == 'Tournament Medal' || itemTypeName == 'Badge' || itemTypeName == 'Medallion' || itemTypeName == 'Func_Medal') {
            isMedal = true;
        }
        if (this.displayMedals) {
            //console.log(item);
            if (isMedal) {
                filterMedal = false;
            }
        }
        if (this.displayWeapons || this.displayCosmetics || this.displayTaunts) {
            if (isWeapon) {
                if (this.displayWeapons) {
                    filterWeapon = false;
                }
            }
            else if (isTaunt) {
                if (this.displayTaunts) {
                    filterTaunt = false;
                }
            }
            else {
                if (this.displayCosmetics) {
                    if (!isMedal) {
                        filterCosmetic = false;
                    }
                }
            }
        }
        if (!item.isSfmWorkshop() && (filterWeapon && filterMedal && filterCosmetic && filterTaunt)) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        const useByClasses = item.classCount();
        if (!this.showOneClass && useByClasses == 1) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        if (!this.showMultiClass && useByClasses > 1 && useByClasses < 9) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        if (!this.showAllClass && useByClasses == 9) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        if (this.selected) {
            const itemId = item.id;
            if (this.pinned.indexOf(itemId) > -1) {
                return ItemFilterResult.Ok;
            }
        }
        if (this.selected) {
            for (const itemId of activeItems) {
                if (itemId.id == item.id) {
                    return ItemFilterResult.Ok;
                }
            }
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        if (this.collection) {
            if (this.collection != item.getCollection()) {
                ++excludedItems.e;
                return ItemFilterResult.ExcludedFilter;
            }
        }
        if (this.tournamentMedals != (item.isTournamentMedal() == true)) {
            ++excludedItems.e;
            return ItemFilterResult.ExcludedFilter;
        }
        if (this.hideConflict != undefined) {
            for (const characterItem of activeItems) {
                if (characterItem.id != item.id) {
                    const equipRegions = item.equipRegions;
                    //console.log(equipRegions);
                    if (hasConflict(characterItem.getEquipRegions(), equipRegions)) {
                        if (this.hideConflict) {
                            ++excludedItems.e;
                            return ItemFilterResult.ExcludedFilter;
                        }
                        else {
                            highlightConflict = true;
                        }
                    }
                }
                /*if (itemId == item.id) {
                    return true;
                }*/
            }
            const arr = [];
            for (const activeItem of activeItems) {
                arr.push(activeItem);
            }
            let equip1;
            let equip2;
            for (const it of arr) {
                equip1 = it.getEquipRegions();
                if (it.id != item.id) {
                    if (equip1) {
                        equip2 = item.equipRegions;
                        if (equip2) {
                            //for (const k of equip1) {
                            //for (const l of equip2) {
                            if (hasConflict(equip1, equip2)) {
                                if (this.hideConflict) {
                                    ++excludedItems.e;
                                    return ItemFilterResult.ExcludedFilter;
                                }
                                else {
                                    highlightConflict = true;
                                }
                            }
                            //}
                            //}
                        }
                    }
                }
            }
        }
        if (this.workshop != item.isWorkshop()) {
            return ItemFilterResult.ExcludedClass;
        }
        if (this.sfmWorkshop != item.isSfmWorkshop()) {
            return ItemFilterResult.ExcludedClass;
        }
        if (highlightConflict) {
            return ItemFilterResult.Conflicting;
        }
        return ItemFilterResult.Ok;
    }
    setAttribute(attribute, value) {
        switch (attribute) {
            case ItemFilterAttribute.Name:
                this.name = value;
                break;
            case ItemFilterAttribute.Selected:
                this.selected = value;
                break;
            case ItemFilterAttribute.Workshop:
                this.workshop = value;
                break;
            case ItemFilterAttribute.SfmWorkshop:
                this.sfmWorkshop = value;
                break;
            case ItemFilterAttribute.SfmUniverse:
                this.sfmUniverse = value;
                break;
            case ItemFilterAttribute.SfmModel:
                this.sfmModels = value;
                break;
            case ItemFilterAttribute.HideConflict:
                this.hideConflict = value;
                break;
            case ItemFilterAttribute.TournamentMedals:
                this.tournamentMedals = value;
                break;
            case ItemFilterAttribute.ShowMultiClass:
                this.showMultiClass = value;
                break;
            case ItemFilterAttribute.ShowOneClass:
                this.showOneClass = value;
                break;
            case ItemFilterAttribute.ShowAllClass:
                this.showAllClass = value;
                break;
            case ItemFilterAttribute.DoNotFilterPerClass:
                this.doNotFilterPerClass = value;
                break;
            case ItemFilterAttribute.Paintable:
                this.paintable = value;
                break;
            case ItemFilterAttribute.Warpaintable:
                this.warpaintable = value;
                break;
            case ItemFilterAttribute.Halloween:
                this.halloween = value;
                break;
            case ItemFilterAttribute.DisplayMedals:
                this.displayMedals = value;
                break;
            case ItemFilterAttribute.DisplayWeapons:
                this.displayWeapons = value;
                break;
            case ItemFilterAttribute.DisplayCosmetics:
                this.displayCosmetics = value;
                break;
            case ItemFilterAttribute.DisplayTaunts:
                this.displayTaunts = value;
                break;
            case ItemFilterAttribute.Collection:
                this.collection = value;
                break;
            default:
                throw new Error('unknown attribute ' + String(attribute));
        }
    }
}

class ItemTemplate {
    #definition;
    #keywords = new Set();
    id;
    creatorid64;
    warpaints = new Map();
    #initWorkshopPromise;
    constructor(id, definition /*TODO: improve type*/) {
        this.#definition = definition;
        this.id = id;
    }
    get name() {
        return this.#definition.name ?? '';
    }
    get realName() {
        return this.#definition.realname ?? '';
    }
    isUsedByClass(characterClass) {
        const usedByClasses = this.#definition.used_by_classes /*TODO: improve type*/;
        if (usedByClasses) {
            const className = CharactersList.get(characterClass)?.name;
            if (className === undefined || usedByClasses[className]) {
                return true;
            }
        }
        return false;
    }
    getUsedByClasses() {
        const usedByClasses = this.#definition.used_by_classes /*TODO: improve type*/;
        if (usedByClasses) {
            const used = new Set;
            for (const usedByClass in usedByClasses) {
                if (usedByClasses[usedByClass] == '1') {
                    used.add(usedByClass);
                }
            }
            return used;
        }
        return new Set();
    }
    classCount() {
        const usedByClasses = this.#definition.used_by_classes /*TODO: improve type*/;
        if (usedByClasses) {
            return Object.keys(usedByClasses).length;
        }
        return 0;
    }
    async getModel(npc) {
        function convertDemo(npc) {
            if (npc == 'demoman') {
                return 'demo';
            }
            else {
                return npc;
            }
        }
        if (this.isWorkshop()) {
            await this.#initWorkshopItemMetadatas();
        }
        npc = npc.replace(/bot_/, '');
        const modelPlayerPerClass = this.#definition.model_player_per_class /*TODO: improve type*/;
        if (modelPlayerPerClass) {
            if (modelPlayerPerClass[npc]) {
                return modelPlayerPerClass[npc] ?? null;
            }
            const basename = modelPlayerPerClass['basename'];
            if (basename) {
                const usedByClasses = this.#definition.used_by_classes /*TODO: improve type*/;
                if (usedByClasses) {
                    if (usedByClasses[npc] == '1') {
                        return basename.replace(/%s/g, convertDemo(npc));
                    }
                    else {
                        const arr = Object.keys(usedByClasses);
                        if (arr.length > 0) {
                            return basename.replace(/%s/g, convertDemo(arr[0]));
                        }
                    }
                }
            }
        }
        const modelPlayer = this.#definition.model_player /*TODO: improve type*/;
        if (modelPlayer) {
            return modelPlayer;
        }
        const customTauntPropPerClass = this.#definition.custom_taunt_prop_per_class /*TODO: improve type*/;
        if (customTauntPropPerClass?.[npc]) {
            return customTauntPropPerClass[npc] ?? null;
        }
        // Look for the first model_player_per_class
        if (modelPlayerPerClass) {
            const arr = Object.keys(modelPlayerPerClass);
            if (arr.length > 0) {
                return modelPlayerPerClass[arr[0]] ?? null;
            }
        }
        return null;
    }
    getModelBlue(npc) {
        const modelPlayerPerClassBlue = this.#definition.model_player_per_class_blue /*TODO: improve type*/;
        if (modelPlayerPerClassBlue) {
            return modelPlayerPerClassBlue[npc] ?? null;
        }
        return null;
    }
    get imageInventory() {
        return this.#definition.image_inventory ?? null;
    }
    get redSkin() {
        const skinRed = Number(this.#definition.skin_red);
        return isNaN(skinRed) ? 0 : skinRed;
    }
    get bluSkin() {
        const skinBlu = Number(this.#definition.skin_blu);
        return isNaN(skinBlu) ? 1 : skinBlu;
    }
    get playerBodygroups() {
        return this.#definition.player_bodygroups;
    }
    get wmBodygroupOverride() {
        return this.#definition.wm_bodygroup_override;
    }
    get usePerClassBodygroups() {
        return this.#definition.use_per_class_bodygroups == '1';
    }
    getExtraWearable() {
        return this.#definition.extra_wearable /*TODO: improve type*/;
    }
    getAttachedModels() {
        // TODO: turn into string[] for Festive Flamethrower 2011
        return this.#definition.attached_models /*TODO: improve type*/;
    }
    get animSlot() {
        return this.#definition.anim_slot /*TODO: fix type*/;
    }
    getItemSlot() {
        return this.#definition.item_slot ?? null;
    }
    getItemSlotPerClass(npc) {
        const usedByClasses = this.#definition.used_by_classes /*TODO: improve type*/;
        if (usedByClasses) {
            const usedByClass = usedByClasses[npc];
            if (usedByClass == 'primary' || usedByClass == 'secondary') {
                return usedByClass;
            }
        }
        return this.#definition.item_slot ?? null;
    }
    get attachedModelsFestive() {
        return this.#definition.attached_models_festive /*TODO: improve type*/;
    }
    get weaponUsesStattrakModule() {
        return this.#definition.weapon_uses_stattrak_module /*TODO: improve type*/;
    }
    get weaponStattrakModuleScale() {
        return this.#definition.weapon_stattrak_module_scale /*TODO: improve type*/;
    }
    get particleSuffix() {
        return this.#definition.particle_suffix ?? null;
    }
    get repository() {
        return this.#definition.repository;
    }
    get equipRegions() {
        return this.#definition.equip_regions ?? [];
    }
    get setItemTintRGB() {
        return this.#definition.set_item_tint_rgb /*TODO: improve type*/;
    }
    get setItemTintRGB2() {
        return this.#definition.set_item_tint_rgb_2 ?? this.#definition.set_item_tint_rgb ?? null;
    }
    get setAttachedParticleStatic() {
        if (this.#definition.use_smoke_particle_effect == '0' || this.#definition.use_coin_particle_effect == '0') {
            return null;
        }
        return this.#definition.set_attached_particle_static;
    }
    get attachedParticlesystems() {
        return this.#definition.attached_particlesystems;
    }
    get customTauntScenePerClass() {
        return this.#definition.custom_taunt_scene_per_class;
    }
    get customTauntOutroScenePerClass() {
        return this.#definition.custom_taunt_outro_scene_per_class;
    }
    get customTauntPropScenePerClass() {
        return this.#definition.custom_taunt_prop_scene_per_class;
    }
    get customTauntPropOutroScenePerClass() {
        return this.#definition.custom_taunt_prop_outro_scene_per_class;
    }
    getImportSessionClasses() {
        return this.#definition.import_session?.classes;
    }
    get tauntAttackName() {
        return this.#definition.taunt_attack_name /*TODO: improve type*/;
    }
    get tauntSuccessSoundLoop() {
        return this.#definition.taunt_success_sound_loop /*TODO: improve type*/;
    }
    get tauntSuccessSoundLoopOffset() {
        return Number(this.#definition.taunt_success_sound_loop_offset) /*TODO: improve type*/;
    }
    getMaterialOverride() {
        return this.#definition.material_override /*TODO: improve type*/;
    }
    getTags() {
        return this.#definition.tags ?? [];
    }
    getSubscriptions() {
        return this.#definition.subscriptions;
    }
    getUpdated() {
        return this.#definition.time_updated;
    }
    getCreated() {
        return this.#definition.time_created;
    }
    isWorkshop() {
        return this.#definition.is_workshop ?? false;
    }
    isSfmWorkshop() {
        return this.#definition.is_sfm_workshop ?? false;
    }
    isTournamentMedal() {
        return this.#definition.is_tournament_medal /*TODO: improve type*/;
    }
    isPaintable() {
        return this.#definition.paintable == '1';
    }
    isWarPaintable() {
        return this.#definition.paintkit_base == '1';
    }
    isHalloweenRestricted() {
        return this.#definition.holiday_restriction == 'halloween_or_fullmoon';
    }
    getItemTypeName() {
        return this.#definition.item_type_name;
    }
    getCollection() {
        return this.#definition.collection;
    }
    getGrade() {
        return this.#definition.grade;
    }
    getHide() {
        return this.#definition.hide == 1;
    }
    addKeyword(keyword) {
        this.#keywords.add(keyword.toLowerCase());
    }
    hasKeyword(search) {
        for (const keyword of this.#keywords) {
            if (keyword.includes(search)) {
                return true;
            }
        }
        return false;
    }
    canCustomizeTexture() {
        return this.#definition.can_customize_texture == '1';
    }
    isTaunt() {
        return this.#definition.is_taunt_item == '1';
    }
    getPaintkitProtoDefIndex() {
        return this.#definition.paintkit_proto_def_index ?? null;
    }
    addWarpaint(id, weapon, title) {
        this.warpaints.set(id, { weapon, title });
    }
    async #initWorkshopItemMetadatas() {
        if (!this.#initWorkshopPromise) {
            this.#initWorkshopPromise = new Promise((resolve) => {
                (async () => {
                    const itemId = this.#definition.id;
                    const url = WORKSHOP_UGC_URL + this.#definition.creatorid64 + '/' + itemId + '/' + itemId + '.json';
                    const itemRepository = WORKSHOP_UGC_URL + this.#definition.creatorid64 + '/' + itemId + '/';
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
                                }
                                else {
                                    for (const key2 in jsonValue) {
                                        await addVcd(repositoryName, jsonValue[key2]);
                                    }
                                }
                            }
                        }
                    }
                    resolve();
                })();
            });
        }
        await this.#initWorkshopPromise;
    }
    getWorkshopGameRepository() {
        return `tf2_workshop_${this.#definition.id}_game`;
    }
    getWorkshopRepository() {
        return `tf2_workshop_${this.#definition.id}`;
    }
}
async function addVcd(itemRepository, path) {
    const result = await Repositories.getFileAsText(itemRepository, path);
    if (result.error) {
        return;
    }
    const choreography = VcdParser.parse('tf2', result.text);
    if (choreography) {
        // TODO: we should probably use the workshop item repository for that, but the choreography manager doesn't have a great repository support
        ChoreographiesManager.addChoreography('tf2', path, choreography);
    }
}

var SfmSortField;
(function (SfmSortField) {
    SfmSortField["Index"] = "sfm-index";
    SfmSortField["Name"] = "sfm-name";
    SfmSortField["Subscriptions"] = "sfm-subscriptions";
    SfmSortField["Updated"] = "sfm-updated";
    SfmSortField["Created"] = "sfm-created";
    SfmSortField["Random"] = "sfm-random";
})(SfmSortField || (SfmSortField = {}));
class ItemManager {
    static #filters = new ItemFilter();
    static #currentCharacter = null;
    //static #characterClass: Tf2Class | null = null;
    static #lang = 'english';
    static #itemTemplates = new Map();
    static #effectTemplates = new Map2();
    static #loadItemsPromise;
    static #initMedalsPromise;
    static #initWorkshopPromise;
    static #initSfmWorkshopPromise;
    static #itemCollections = new Set();
    static #equipRegions = new Set();
    static #sortingDirection = 1;
    static #sortingDirectionSfm = 1;
    static #sfmRequest = 0;
    static #sortField = 'index';
    static #sortFieldSfm = 'updated';
    static #randomOrder = new Map2();
    static {
        this.#initListeners();
        this.#setSortingType('index');
    }
    static setCurrentCharacter(character) {
        this.#currentCharacter = character;
        Tf2LoadoutController.dispatchEvent('filtersupdated');
    }
    /*
    static setCharacterClass(characterClass: Tf2Class): void {
        this.#characterClass = characterClass;
        Tf2LoadoutController.dispatchEvent<void>('filtersupdated');
    }
    */
    static setLang(lang) {
        this.#lang = lang;
    }
    static #initListeners() {
        Tf2LoadoutController.addEventListener('setitemfilter', event => this.#setItemFilter(event.detail));
        Tf2LoadoutController.addEventListener('setitemsortascending', event => {
            this.#sortingDirection = event.detail ? 1 : -1;
            this.#updateSfmFilter();
        });
        Tf2LoadoutController.addEventListener('setsfmitemsortascending', event => {
            this.#sortingDirectionSfm = event.detail ? 1 : -1;
            this.#updateSfmFilter();
        });
        Tf2LoadoutController.addEventListener('setitemsorttype', event => {
            this.#sortField = event.detail;
            this.#setSortingType(this.#sortField);
        });
        Tf2LoadoutController.addEventListener('setsfmsortfield', event => {
            this.#sortFieldSfm = event.detail;
            this.#setSortingType(this.#sortFieldSfm);
        });
        Tf2LoadoutController.addEventListener('itempinned', event => this.#pinItem(event.detail.item, event.detail.pinned));
        Tf2LoadoutController.addEventListener('itemadded', () => Tf2LoadoutController.dispatchEvent('filtersupdated'));
        Tf2LoadoutController.addEventListener('itemremoved', () => Tf2LoadoutController.dispatchEvent('filtersupdated'));
        Tf2LoadoutController.addEventListener('togglepanel', event => {
            if (event.detail == Panel.Items || event.detail == Panel.Effects) {
                this.initItems();
            }
        });
        WeaponManager.addEventListener(WeaponManagerEvents.AddWarpaint, event => {
            const detail = event.detail;
            this.#addWarpaint(String(detail.p1), String(detail.p2), detail.p3, detail.p4);
        });
        OptionsManagerEvents.addEventListener('app.items.pinned', event => this.#setPinned(event.detail.value));
        OptionsManagerEvents.addEventListener('app.items.filter.sfm.*', event => {
            this.#updateSfmFilter();
            Tf2LoadoutController.dispatchEvent('filtersupdated');
        });
        OptionsManagerEvents.addEventListener('app.items.filter.text', event => {
            this.#updateSfmFilter();
        });
        OptionsManagerEvents.addEventListener('app.items.sfm.sort.field', () => {
            this.#updateSfmSortField();
            this.#updateSfmFilter();
        });
    }
    static #setItemFilter(filter) {
        this.#filters.setAttribute(filter.attribute, filter.value);
        Tf2LoadoutController.dispatchEvent('filtersupdated');
        if (filter.attribute == ItemFilterAttribute.Workshop) {
            this.initWorkshopItems();
        }
        if (filter.attribute == ItemFilterAttribute.SfmWorkshop) {
            this.#updateSfmFilter();
        }
        if (filter.attribute == ItemFilterAttribute.TournamentMedals) {
            this.initTournamentMedals();
        }
    }
    static getItems() {
        return new Map(this.#itemTemplates);
    }
    static getItemTemplate(id, style) {
        if (style !== undefined) {
            id += '~' + String(style);
        }
        return this.#itemTemplates.get(String(id)) ?? this.#itemTemplates.get(String(id) + '~0') ?? null;
    }
    static getEffectTemplate(type, id) {
        return this.#effectTemplates.get(type, id) ?? null;
    }
    static getEffectTemplateById(id) {
        for (const [effectType, effectId, template] of this.#effectTemplates) {
            if (id == effectId) {
                return [effectType, template];
            }
        }
        return null;
    }
    static getEffectTemplateBySystem(system) {
        for (const [effectType, effectId, template] of this.#effectTemplates) {
            if (system == template.getSystem()) {
                return [effectType, effectId, template];
            }
        }
        return null;
    }
    static getFilteredItems(excluded /*TODO: find a better way to do that*/) {
        const filteredItems = new Map();
        const conflictingItems = new Map();
        excluded.e = 0;
        const activeItems = new Set;
        if (this.#currentCharacter) {
            for (const [, item] of this.#currentCharacter.items) {
                activeItems.add(item);
            }
        }
        for (const [id, itemTemplate] of this.#itemTemplates) {
            const match = this.#filters.matchFilter(itemTemplate, excluded, this.#currentCharacter?.characterClass ?? null, activeItems);
            if (match == ItemFilterResult.Ok || match == ItemFilterResult.Conflicting) {
                filteredItems.set(id, itemTemplate);
            }
            if (match == ItemFilterResult.Conflicting) {
                conflictingItems.set(id, itemTemplate);
            }
        }
        return [filteredItems, conflictingItems];
    }
    static getSelectedItems() {
        if (this.#currentCharacter) {
            const selectedItems = new Set();
            for (const [id] of this.#currentCharacter.items) {
                selectedItems.add(id);
            }
            return selectedItems;
        }
        else {
            return new Set();
        }
    }
    static getSelectedEffects() {
        if (this.#currentCharacter) {
            const selectedEffects = new Set();
            for (const effect of this.#currentCharacter.effects) {
                selectedEffects.add(effect);
            }
            return selectedEffects;
        }
        else {
            return new Set();
        }
    }
    static getConflictingItems() {
        if (this.#currentCharacter) {
            const conflictingItems = new Set();
            for (const [id1, item1] of this.#currentCharacter.items) {
                for (const [id2, item2] of this.#currentCharacter.items) {
                    if (item1 != item2 && item1.isConflicting(item2)) {
                        conflictingItems.add(id1);
                        conflictingItems.add(id2);
                    }
                }
            }
            return conflictingItems;
        }
        else {
            return new Set();
        }
    }
    static initItems() {
        if (!this.#loadItemsPromise) {
            this.#loadItemsPromise = new Promise((resolve) => {
                const url = `${TF2_REPOSITORY}generated/items/items_${this.#lang}.json?t=${new Date().getTime()}`;
                fetch(new Request(url)).then((response) => {
                    response.json().then((json) => {
                        if (json) {
                            this.#initItems2(json.items);
                            this.#initEffects(json.systems);
                            Tf2LoadoutController.dispatchEvent('itemsloaded');
                            Tf2LoadoutController.dispatchEvent('systemsloaded');
                            resolve();
                        }
                    });
                });
            });
        }
        return this.#loadItemsPromise;
    }
    static #initItems2(itemList, tournamentMedals = false) {
        //this.#systemList = itemList.systems as JSONObject;
        /*
                let keysSorted = Object.keys(itemList).sort(function (a, b) {
                    let aa = a.split('~');
                    let bb = b.split('~');
                    let aaa = Number(aa[0]);
                    let bbb = Number(bb[0]);
                    if (aaa > bbb) {
                        return 1;
                    } else if (aaa < bbb) {
                        return -1;
                    } else {
                        aaa = Number(aa[1]);
                        bbb = Number(bb[1]);
                        if (aaa > bbb) {
                            return 1;
                        } else if (aaa < bbb) {
                            return -1;
                        }
                        return 0;
                    }
                }
                )
                */
        for (const itemIndex in itemList) {
            //let keywords = '';
            const itemDefinition = itemList[itemIndex];
            itemDefinition.is_tournament_medal = tournamentMedals;
            const itemTemplate = new ItemTemplate(itemIndex, itemDefinition);
            //item.id = itemIndex;
            this.#itemTemplates.set(itemIndex, itemTemplate);
            const collection = itemTemplate.getCollection();
            if (collection) {
                if (!itemTemplate.getHide()) {
                    this.#itemCollections.add(collection);
                }
                itemTemplate.addKeyword(collection);
            }
            /*
            if (item.hide) {
                it.hide = true;
            }
            */
            //this.#itemTemplates.set(itemIndex, it);
            //if (item.player_bodygroups) {
            //keywords = item.player_bodygroups.join(' ');//TODO
            //}
            for (const equipRegion of itemTemplate.equipRegions) {
                //let region = (itemTemplate.equip_regions as JSONArray)[i];
                //keywords += equipRegion;
                itemTemplate.addKeyword(equipRegion);
                //this.addFilterOption(equipRegion as string);
                this.#equipRegions.add(equipRegion);
            }
            const itemSlot = itemTemplate.getItemSlot();
            if (itemSlot) { // TODO: slots per class
                itemTemplate.addKeyword(itemSlot);
                //this.addFilterOption(itemTemplate.item_slot as string);
            }
            const grade = itemTemplate.getGrade();
            if (grade) {
                itemTemplate.addKeyword(grade);
            }
            //itemTemplate.keywords = keywords;
            //characters[c.npc].modelName = c.model;
        }
        //this.dispatchEvent(new CustomEvent('itemsInitialized'));
        //this.#applyFilter();
        //this.#sortItems();
        //this.#updateFilters();
    }
    static #initEffects(systemList) {
        for (const effectType in systemList) {
            const group = systemList[effectType];
            for (const effectIndex in group) {
                const effectIndexN = Number(effectIndex);
                this.#effectTemplates.set(effectType, effectIndexN, new EffectTemplate(effectType, effectIndexN, group[effectIndex]));
            }
        }
    }
    static getEffects(type) {
        return new Map(this.#effectTemplates.getSubMap(type));
    }
    static #pinItem(item, isPinned) {
        const pinned = OptionsManager.getItem('app.items.pinned') ?? [];
        const index = pinned.indexOf(item.id);
        if (isPinned) {
            if (index == -1) {
                pinned.push(item.id);
            }
        }
        else {
            pinned.splice(index, 1);
        }
        OptionsManager.setItem('app.items.pinned', pinned);
    }
    static #setPinned(pinned) {
        this.#filters.pinned = pinned;
        Tf2LoadoutController.dispatchEvent('filtersupdated');
    }
    /*
    static #handleItemClicked(template: ItemTemplate): void {
        const currentCharacter = CharacterManager.getCurrentCharacter();

        if (currentCharacter) {
            currentCharacter.toggleItem(template);
        } else {
            //const item = new Item(template);
            //item.loadModel();
            Loadout.addItem(template.id);
        }
    }
    */
    static #setSortingType(type /*TODO: create enum*/) {
        let sortingDirection = this.#sortingDirection;
        if (this.#filters.sfmWorkshop) {
            sortingDirection = this.#sortingDirectionSfm;
        }
        switch (type) {
            case 'name':
                this.#sortByName(sortingDirection);
                break;
            case 'index':
                this.#sortByIndex(sortingDirection);
                break;
            case 'slot':
                this.#sortBySlot(sortingDirection);
                break;
            case 'subscriptions':
                this.#sortBySubscriptions(sortingDirection);
                break;
            case 'updated':
                this.#sortByLastUpdate(sortingDirection);
                break;
            case 'created':
                this.#sortByCreationTime(sortingDirection);
                break;
            case 'random':
                this.#sortRandom();
                break;
            default:
                console.error(`unsupported field: ${type}`);
                break;
        }
    }
    static #sortByName(sortingDirection) {
        this.#itemTemplates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => {
                const aname = a[1].name.toLowerCase();
                const bname = b[1].name.toLowerCase();
                return aname < bname ? -sortingDirection : sortingDirection;
            });
        };
    }
    static #sortBySlot(sortingDirection) {
        this.#itemTemplates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => {
                const aSlot = a[1].getItemSlot() ?? '';
                const bSlot = b[1].getItemSlot() ?? '';
                if (aSlot < bSlot) {
                    return -sortingDirection;
                }
                if (aSlot > bSlot) {
                    return sortingDirection;
                }
                const aname = a[1].name;
                const bname = b[1].name;
                return aname < bname ? -sortingDirection : sortingDirection;
            });
        };
    }
    static #sortBySubscriptions(sortingDirection) {
        this.#itemTemplates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => {
                const aSubscription = a[1].getSubscriptions() ?? 0;
                const bSubscription = b[1].getSubscriptions() ?? 0;
                if (aSubscription < bSubscription) {
                    return -sortingDirection;
                }
                if (aSubscription > bSubscription) {
                    return sortingDirection;
                }
                const aname = a[1].name;
                const bname = b[1].name;
                return aname < bname ? -sortingDirection : sortingDirection;
            });
        };
    }
    static #sortByCreationTime(sortingDirection) {
        this.#itemTemplates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => {
                const aSubscription = a[1].getCreated() ?? 0;
                const bSubscription = b[1].getCreated() ?? 0;
                if (aSubscription < bSubscription) {
                    return -sortingDirection;
                }
                if (aSubscription > bSubscription) {
                    return sortingDirection;
                }
                const aname = a[1].name;
                const bname = b[1].name;
                return aname < bname ? -sortingDirection : sortingDirection;
            });
        };
    }
    static #sortByLastUpdate(sortingDirection) {
        this.#itemTemplates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => {
                const aSubscription = a[1].getUpdated() ?? 0;
                const bSubscription = b[1].getUpdated() ?? 0;
                if (aSubscription < bSubscription) {
                    return -sortingDirection;
                }
                if (aSubscription > bSubscription) {
                    return sortingDirection;
                }
                const aname = a[1].name;
                const bname = b[1].name;
                return aname < bname ? -sortingDirection : sortingDirection;
            });
        };
    }
    static #sortRandom() {
        const self = this;
        this.#itemTemplates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => {
                let order = self.#randomOrder.get(a[0], b[0]);
                if (order === undefined) {
                    order = Math.random() - 0.5;
                    self.#randomOrder.set(a[0], b[0], order);
                }
                return order;
            });
        };
    }
    static #sortByIndex(sortingDirection) {
        this.#itemTemplates[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => {
                if (a[1].name.toLowerCase().includes('romevision')) {
                    return 1;
                }
                if (b[1].name.toLowerCase().includes('romevision')) {
                    return -1;
                }
                const aname = a[1].id;
                const bname = b[1].id;
                const aId = parseInt(aname, 10);
                const bId = parseInt(bname, 10);
                if (aId == bId) {
                    return 0;
                }
                return aId < bId ? -sortingDirection : sortingDirection;
            });
        };
    }
    static getCollections() {
        return new Set(this.#itemCollections);
    }
    static async #addWarpaint(itemId, warpaintId, weaponName, descToken) {
        let template = this.getItemTemplate(itemId);
        if (!template) {
            itemId += '~0';
            template = this.getItemTemplate(itemId);
        }
        if (template) {
            if ((Number(itemId) >= FIRST_LEGACY_WARPAINT) && (Number(itemId) <= LAST_LEGACY_WARPAINT)) { //old warpaints
                const weaponId = await this.#getWeaponByModel(await template.getModel('' /*TODO: set this parameter optional*/) ?? '');
                if (weaponId !== null) {
                    await this.#addWarpaint(weaponId, warpaintId, weaponName, descToken);
                    setLegacyWarpaint(Number(itemId), weaponId);
                }
            }
            else {
                template.addWarpaint(warpaintId, weaponName, descToken);
            }
        }
        else {
            console.error('weapon not found %i', itemId);
        }
    }
    static async #getWeaponByModel(path) {
        for (const [i, template] of this.#itemTemplates) {
            if (template.isWarPaintable() && await template.getModel('') == path) {
                return i;
            }
        }
        return null;
    }
    static async initWorkshopItems() {
        if (!this.#initWorkshopPromise) {
            this.#initWorkshopPromise = new Promise((resolve) => {
                (async () => {
                    const response = await fetch(WORKSHOP_URL);
                    const json = await response.json();
                    if (json) {
                        this.#addWorkshopItems(json);
                    }
                    Tf2LoadoutController.dispatchEvent('itemsloaded');
                    resolve();
                })();
            });
        }
        await this.#initWorkshopPromise;
    }
    static #addWorkshopItems(responseJson) {
        if (!responseJson) {
            return;
        }
        if (!responseJson.result || responseJson.result != '1') {
            return;
        }
        const itemList = responseJson.items;
        if (!itemList) {
            return;
        }
        for (const item of itemList) {
            item.id = String(item.id);
            item.image_inventory = item.previewurl;
            item.is_workshop = true;
            item.name = item.title;
            item.workshopMetadata = null;
            item.paintable = true; // We don't have any clue about this
            // Create used_by_classes list from tags
            if (item.tags) {
                item.used_by_classes = {};
                const tagList = item.tags.split(';');
                for (const tag of tagList) {
                    //const tag = tagList[tagIndex];
                    switch (tag) {
                        case 'Demoman':
                        case 'Engineer':
                        case 'Heavy':
                        case 'Medic':
                        case 'Pyro':
                        case 'Scout':
                        case 'Sniper':
                        case 'Soldier':
                        case 'Spy':
                            item.used_by_classes[tag.toLowerCase()] = 1;
                            break;
                    }
                }
            }
            const itemTemplate = new ItemTemplate('w' + item.id, item);
            this.#itemTemplates.set(itemTemplate.id, itemTemplate);
            //const keywords = '';
            if (item.player_bodygroups) ;
        }
    }
    static async #updateSfmSortField() {
        if (!this.#filters.sfmWorkshop) {
            this.#setSortingType(this.#sortField);
        }
        else {
            this.#setSortingType(this.#sortFieldSfm);
        }
    }
    static async #updateSfmFilter() {
        this.#updateSfmSortField();
        this.#initSfmWorkshopItems();
    }
    static async #initSfmWorkshopItems() {
        if (!this.#filters.sfmWorkshop) {
            return;
        }
        if (!this.#initSfmWorkshopPromise) {
            this.#initSfmWorkshopPromise = new Promise((resolve) => {
                (async () => {
                    const response = await fetch('__sfmEndpoint__/api', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            action: 'get-item-list',
                            version: 1,
                            /*
                            params: {
                                filter: getSfmFilter(),
                                sort: getSfmSort(),
                            },
                            */
                        }),
                    });
                    const json = await response.json();
                    if (json) {
                        this.#addSfmWorkshopItems(json);
                    }
                    Tf2LoadoutController.dispatchEvent('sfmitemsloaded');
                    resolve();
                })();
            });
        }
        await this.#initSfmWorkshopPromise;
    }
    static #addSfmWorkshopItems(responseJson) {
        if (!responseJson) {
            return;
        }
        if (!responseJson.result || !responseJson.success) {
            return;
        }
        const itemList = responseJson.result?.items;
        if (!itemList) {
            return;
        }
        for (const item of itemList) {
            item.id = String(item.publishedfileid);
            if (item.preview_url?.startsWith('/')) {
                item.image_inventory = WORKSHOP_UGC_IMG_PREFIX + item.preview_url;
            }
            else {
                item.image_inventory = item.preview_url;
            }
            item.is_sfm_workshop = true;
            item.name = item.title;
            item.workshopMetadata = null;
            item.paintable = false;
            const itemTemplate = new ItemTemplate(item.id, item);
            this.#itemTemplates.set(itemTemplate.id, itemTemplate);
            //const keywords = '';
            if (item.player_bodygroups) ;
        }
    }
    static async initTournamentMedals() {
        if (!this.#initMedalsPromise) {
            this.#initMedalsPromise = new Promise((resolve) => {
                (async () => {
                    const response = await fetch(`${TF2_REPOSITORY}generated/items/medals_${this.#lang}.json`);
                    const json = await response.json();
                    if (json) {
                        this.#initItems2(json.items, true);
                    }
                    Tf2LoadoutController.dispatchEvent('itemsloaded');
                    resolve();
                })();
            });
        }
        await this.#initMedalsPromise;
    }
}

let updatePreview = false;

class Tf2Item {
    id;
    #itemTemplate;
    #character;
    #model = null;
    #modelBlu = null;
    #modelExtraWearable = null;
    #attachedModels = [];
    #festivizerModel;
    #stattrakModule;
    #team = Team.None;
    #killCount = null;
    #refreshingSkin = false;
    #showFestivizer = false;
    #critBoost = false;
    #critBoostSysRed;
    #critBoostSysBlu;
    #weaponEffectSystem;
    #loaded = false;
    #paint = null;
    #sheen = null;
    #weaponEffectId = null;
    #warpaintWear = 0;
    #warpaintId = null;
    #warpaintSeed = 0n;
    #materialOverride = null;
    #textureSize;
    changeTextureSize;
    #customTexture = null;
    #readyPromiseResolve;
    #ready = new Promise((resolve) => {
        this.#readyPromiseResolve = resolve;
    });
    constructor(itemTemplate, character) {
        this.#itemTemplate = itemTemplate;
        this.#character = character;
        this.id = itemTemplate.id;
        /*
        this.#ready = new Promise((resolve, reject) => {
            this.#readyPromiseResolve = resolve;
        });
        */
    }
    getTemplate() {
        return this.#itemTemplate;
    }
    async setTeam(team) {
        this.#team = team;
        await this.#refreshSkin();
        await this.#refreshSheen();
        this.#refreshWarPaint();
    }
    getEquipRegions() {
        return this.#itemTemplate.equipRegions;
    }
    async setKillCount(count) {
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
    getKillCount() {
        return this.#killCount;
    }
    async #refreshSkin() {
        // TODO
        if (this.#refreshingSkin) {
            return;
        }
        this.#refreshingSkin = true;
        const skin = this.#team ? this.#itemTemplate.bluSkin : this.#itemTemplate.redSkin;
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
        if (this.#character?.isInvulnerable() || this.#character?.getRagdoll() !== 0 /* Ragdoll.None */) {
            let materialName = null;
            switch (this.#character?.getRagdoll()) {
                case 0 /* Ragdoll.None */:
                    materialName = this.#team ? MATERIAL_INVULN_BLU : MATERIAL_INVULN_RED;
                    break;
                case 1 /* Ragdoll.Gold */:
                    materialName = MATERIAL_GOLD_RAGDOLL;
                    break;
                case 2 /* Ragdoll.Ice */:
                    materialName = MATERIAL_ICE_RAGDOLL;
                    break;
            }
            this.#setMaterialOverride(materialName);
        }
        else {
            this.#setMaterialOverride(null);
            const materialOverride = this.#itemTemplate.getMaterialOverride();
            if (materialOverride) {
                this.#setMaterialOverride(materialOverride);
            }
            else {
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
            if (this.#team == Team.Red) {
                this.#model?.setVisible(undefined);
                sourceModelBlu.setVisible(false);
            }
            else {
                this.#model?.setVisible(false);
                sourceModelBlu.setVisible(undefined);
            }
        }
        if (this.#model && this.#critBoost) {
            let systemName = '';
            let glowColor = null;
            let sys = null;
            if (this.#team == Team.Red) {
                sys = this.#critBoostSysRed;
                glowColor = [80, 8, 5];
                systemName = 'critgun_weaponmodel_red';
            }
            else {
                sys = this.#critBoostSysBlu;
                glowColor = [5, 20, 80];
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
            if (this.#team == Team.Red) {
                this.#critBoostSysRed = sys;
            }
            else {
                this.#critBoostSysBlu = sys;
            }
        }
        else {
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
        await this.#festivizerModel?.setSkinId(this.#team);
        await (await this.#stattrakModule)?.setSkinId(skin % 2);
        this.#refreshingSkin = false;
    }
    getRepository() {
        return this.#itemTemplate.repository ?? 'tf2';
    }
    async showFestivizer(showFestivizer) {
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
    getShowFestivizer() {
        return this.#showFestivizer;
    }
    async toggleFestivizer() {
        await this.showFestivizer(!this.#showFestivizer);
    }
    setCustomTexture(textureName) {
        this.#customTexture = textureName;
        if (this.#model) {
            this.#model.materialsParams.customtexture = textureName;
        }
    }
    getCustomTexture() {
        return this.#customTexture;
    }
    critBoost(boost) {
        if (boost !== undefined) {
            this.#critBoost = boost;
        }
        else {
            this.#critBoost = !this.#critBoost;
        }
        this.#refreshSkin();
    }
    isCritBoosted() {
        return this.#critBoost;
    }
    async loadModel(npc) {
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
                const extraModel = await addTF2Model(this.#model, attachedModel, this.getRepository() /*, this.name + ' attached'*/);
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
        }
        else {
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
    async attachSystems(npc) {
        if (!this.#model) {
            return;
        }
        let s = ItemManager.getEffectTemplate(EffectType.Cosmetic, Number(this.#itemTemplate.setAttachedParticleStatic));
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
    async getModel() {
        await this.#ready;
        return this.#model;
    }
    async getModelBlu() {
        await this.#ready;
        return this.#modelBlu;
    }
    async getModelExtraWearable() {
        await this.#ready;
        return this.#modelExtraWearable;
    }
    async remove() {
        await this.#ready;
        this.#model?.remove();
        this.#modelBlu?.remove();
        this.#modelExtraWearable?.remove();
        for (const extraModel of this.#attachedModels) {
            extraModel.remove();
        }
    }
    isConflicting(other) {
        return hasConflict(this.getEquipRegions(), other.getEquipRegions());
    }
    setPaint(paint) {
        if (paint == Paints.None) {
            paint = null;
        }
        if (paint !== null) {
            this.#paint = getPaint(paint);
        }
        else {
            this.#paint = paint;
        }
        if (this.#model) {
            if (paint == null) {
                this.#model.setTint(null);
                if (this.#team == Team.Red) {
                    if (this.#itemTemplate.setItemTintRGB) {
                        this.#model.setTint(colorToVec4(Number(this.#itemTemplate.setItemTintRGB)));
                    }
                }
                else {
                    if (this.#itemTemplate.setItemTintRGB2) {
                        this.#model.setTint(colorToVec4(Number(this.#itemTemplate.setItemTintRGB2)));
                    }
                }
            }
            else {
                this.#refreshPaint();
            }
        }
    }
    getPaint() {
        return this.#paint?.paint ?? null;
    }
    async #refreshPaint() {
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
    updatePaintColor() {
        this.#refreshPaint();
    }
    async #setMaterialOverride(materialOverride) {
        let material = null;
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
    setSheen(sheen) {
        this.#sheen = getKillstreak(sheen ?? KillstreakColor.None);
        if (this.#model) {
            if (sheen == null) ;
            else {
                this.#refreshSheen();
            }
        }
    }
    getSheen() {
        return this.#sheen?.killstreak ?? null;
    }
    async #refreshSheen() {
        await this.#ready;
        const sheen = this.#sheen;
        if (sheen && this.#model) {
            this.#model.sheen = sheen.getSheenColor(this.#team);
        }
    }
    isTaunt() {
        return this.#itemTemplate.isTaunt();
    }
    getCustomTauntScenePerClass(npc) {
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
    getCustomTauntPropScenePerClass(npc) {
        const customTauntPropScenePerClass = this.#itemTemplate.customTauntPropScenePerClass;
        if (!customTauntPropScenePerClass) {
            return null;
        }
        const scene = customTauntPropScenePerClass[npc];
        if (scene) {
            if (typeof scene == 'object') {
                return randomProperty(scene);
            }
            return scene;
        }
        return null;
    }
    getCustomTauntOutroScenePerClass(npc) {
        const customTauntOutroScenePerClass = this.#itemTemplate.customTauntOutroScenePerClass;
        return customTauntOutroScenePerClass?.[npc] ?? null;
    }
    getCustomTauntPropOutroScenePerClass(npc) {
        const customTauntPropOutroScenePerClass = this.#itemTemplate.customTauntPropOutroScenePerClass;
        return customTauntPropOutroScenePerClass?.[npc] ?? null;
    }
    getWorkshopAnimationPerClass(npc) {
        const importSessionClasses = this.#itemTemplate.getImportSessionClasses();
        if (!importSessionClasses) {
            return null;
        }
        const c = importSessionClasses[npc];
        return c?.['animation']?.['source_file'] ?? null;
    }
    getTauntAttackName() {
        return this.#itemTemplate.tauntAttackName;
    }
    setWeaponEffectId(weaponEffectId) {
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
            (async () => {
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
    getWeaponEffectId() {
        return this.#weaponEffectId;
    }
    setWarpaintId(warpaintId) {
        if (this.#warpaintId != warpaintId) {
            this.#warpaintId = warpaintId;
            this.#textureSize = this.changeTextureSize;
            this.#refreshWarPaint();
        }
    }
    getWarpaintId() {
        return this.#warpaintId ?? null;
    }
    setWarpaintWear(warpaintWear) {
        if (this.#warpaintWear != warpaintWear) {
            this.#warpaintWear = warpaintWear;
            this.#textureSize = this.changeTextureSize;
            this.#refreshWarPaint();
        }
    }
    getWarpaintWear() {
        return this.#warpaintWear;
    }
    setWarpaintSeed(warpaintSeed) {
        warpaintSeed = BigInt(warpaintSeed);
        if (this.#warpaintSeed != warpaintSeed) {
            this.#warpaintSeed = warpaintSeed;
            this.#textureSize = this.changeTextureSize;
            this.#refreshWarPaint();
        }
    }
    getWarpaintSeed() {
        return this.#warpaintSeed;
    }
    setWarpaint(warpaintId, warpaintWear, warpaintSeed) {
        warpaintSeed = BigInt(warpaintSeed);
        if (this.#warpaintId != warpaintId || this.#warpaintWear != warpaintWear || this.#warpaintSeed != warpaintSeed) {
            this.#warpaintId = warpaintId;
            this.#warpaintWear = warpaintWear;
            this.#warpaintSeed = warpaintSeed;
            this.#textureSize = this.changeTextureSize;
            this.#refreshWarPaint();
        }
    }
    setTextureSize(textureSize) {
        if (this.#textureSize !== undefined && this.#textureSize >= textureSize) {
            return;
        }
        this.#textureSize = textureSize;
        this.#refreshWarPaint();
    }
    getTextureSize() {
        return this.#textureSize;
    }
    #refreshWarPaint() {
        if (this.#model && this.#warpaintId !== null && this.#materialOverride === null) {
            WeaponManager.refreshWarpaint({
                id: this.id,
                warpaintId: this.#warpaintId,
                warpaintWear: this.#warpaintWear,
                warpaintSeed: this.#warpaintSeed,
                model: this.#model,
                team: this.#team,
                textureSize: this.#textureSize,
                updatePreview,
            });
        }
    }
    getCharacter() {
        return this.#character;
    }
    async *getAllModels() {
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

class FlyingBird {
    parent;
    launchSpot;
    flyAngle;
    flyAngleRate;
    flAccelZ;
    flSpeed;
    flGlideTime;
    flyZ = 0;
    constructor(parent, launchSpot, flyAngle, flyAngleRate, flAccelZ, flSpeed, flGlideTime) {
        this.parent = parent;
        this.launchSpot = launchSpot;
        this.flyAngle = flyAngle;
        this.flyAngleRate = flyAngleRate;
        this.flAccelZ = flAccelZ;
        this.flSpeed = flSpeed;
        this.flGlideTime = flGlideTime;
        this.#init();
    }
    async #init() {
        const dove = await addTF2Model(this.parent, TF2_DOVE_MODEL);
        if (!dove) {
            return;
        }
        dove.setPosition(this.launchSpot);
        this.parent?.parent?.addChild(dove);
        const tickEvent = (event) => {
            const delta = event.detail.delta;
            this.flyZ += this.flAccelZ * delta;
            this.flyAngle += this.flyAngleRate * delta;
            const forward = vec3.create();
            forward[0] = Math.cos(this.flyAngle);
            forward[1] = Math.sin(this.flyAngle);
            forward[2] = this.flyZ;
            vec3.normalize(forward, forward);
            dove.setQuaternion(quat.rotationTo(quat.create(), [1, 0, 0], forward));
            vec3.scale(forward, forward, delta * this.flSpeed);
            //console.log(forward);
            dove.setPosition(vec3.add(forward, forward, dove._position));
        };
        GraphicsEvents.addEventListener('tick', tickEvent);
        setTimeout(() => dove.playSequence('fly_cycle'), this.flGlideTime * 1000);
        setTimeout(() => { dove.remove(); GraphicsEvents.removeEventListener('tick', tickEvent); }, 10000);
    }
}

class PresetItem {
    id = '';
    paint;
    warpaintId;
    warpaintWear;
    warpaintSeed;
    isTournamentMedal = false;
    isWorkshop = false;
    weaponEffect;
    sheen;
    showFestivizer = false;
    killCount;
    fromJSON(json) {
        if (json.id !== undefined) {
            this.id = json.id;
        }
        if (json.paint !== undefined) {
            this.paint = json.paint;
        }
        if (json.warpaint_id !== undefined) {
            this.warpaintId = json.warpaint_id;
        }
        if (json.warpaint_wear !== undefined) {
            this.warpaintWear = json.warpaint_wear;
        }
        if (json.warpaint_seed !== undefined) {
            this.warpaintSeed = BigInt(json.warpaint_seed);
        }
        // For legacy presets
        if (json.paintkit_id !== undefined) {
            this.warpaintId = json.paintkit_id;
        }
        if (json.paintkit_wear !== undefined) {
            this.warpaintWear = json.paintkit_wear;
        }
        if (json.paintkit_seed !== undefined) {
            this.warpaintSeed = BigInt(json.paintkit_seed);
        }
        if (json.weapon_effect !== undefined) {
            this.weaponEffect = json.weapon_effect;
        }
        if (json.sheen !== undefined) {
            this.sheen = json.sheen;
        }
        if (json.kill_count !== undefined) {
            this.killCount = json.kill_count;
        }
        this.showFestivizer = json.show_festivizer ?? false;
        this.isTournamentMedal = json.is_tournament_medal ?? false;
        this.isWorkshop = json.is_workshop ?? false;
        return true;
    }
    toJSON() {
        const j = {};
        j.id = this.id;
        if (this.paint !== undefined) {
            j.paint = this.paint;
        }
        if (this.warpaintId !== undefined) {
            j.warpaint_id = this.warpaintId;
        }
        if (this.warpaintWear !== undefined) {
            j.warpaint_wear = this.warpaintWear;
        }
        if (this.warpaintSeed !== undefined) {
            j.warpaint_seed = String(this.warpaintSeed);
        }
        if (this.weaponEffect !== undefined) {
            j.weapon_effect = this.weaponEffect;
        }
        if (this.sheen !== undefined) {
            j.sheen = this.sheen;
        }
        if (this.showFestivizer !== false) {
            j.show_festivizer = this.showFestivizer;
        }
        j.kill_count = this.killCount || undefined;
        if (this.isTournamentMedal != false) {
            j.is_tournament_medal = this.isTournamentMedal;
        }
        if (this.isWorkshop != false) {
            j.is_workshop = this.isWorkshop;
        }
        return j;
    }
}
var PresetEffectType;
(function (PresetEffectType) {
    PresetEffectType["Unusual"] = "unusual";
    PresetEffectType["Taunt"] = "taunt";
    PresetEffectType["Killstreak"] = "killstreak";
    PresetEffectType["Weapon"] = "weapon";
    PresetEffectType["Other"] = "other";
})(PresetEffectType || (PresetEffectType = {}));
const VEC3_ZERO = vec3.create();
class PresetEffect {
    id = 0;
    type = PresetEffectType.Unusual;
    attachment = '';
    offset = vec3.create();
    color;
    setType(type) {
        switch (type) {
            case EffectType.Cosmetic:
                this.type = PresetEffectType.Unusual;
                break;
            case EffectType.Killstreak:
                this.type = PresetEffectType.Killstreak;
                break;
            case EffectType.Taunt:
                this.type = PresetEffectType.Taunt;
                break;
            case EffectType.Weapon:
                this.type = PresetEffectType.Weapon;
                break;
            case EffectType.Other:
                this.type = PresetEffectType.Other;
                break;
        }
    }
    getType() {
        switch (this.type) {
            case PresetEffectType.Unusual:
                return EffectType.Cosmetic;
            case PresetEffectType.Killstreak:
                return EffectType.Killstreak;
            case PresetEffectType.Taunt:
                return EffectType.Taunt;
            case PresetEffectType.Weapon:
                return EffectType.Weapon;
            case PresetEffectType.Other:
                return EffectType.Other;
        }
    }
    fromJSON(json) {
        if (json.id !== undefined) {
            this.id = json.id;
        }
        if (json.attachment !== undefined) {
            this.attachment = json.attachment;
        }
        if (json.type !== undefined) {
            this.type = json.type;
        }
        if (json.offset !== undefined) {
            vec3.copy(this.offset, json.offset);
        }
        if (json.color !== undefined) {
            this.color = json.color;
        }
        return true;
    }
    toJSON() {
        const j = {
            id: this.id,
            type: this.type,
        };
        if (this.attachment) {
            j.attachment = this.attachment;
        }
        if (!vec3.exactEquals(this.offset, VEC3_ZERO)) {
            j.offset = this.offset;
        }
        j.color = this.color;
        return j;
    }
}
class Preset {
    character = '';
    name = '';
    items = new Set();
    effects = new Set();
    decapitationLevel = 0;
    constructor(name) {
        if (name !== undefined) {
            this.name = name;
        }
    }
    addItem(item) {
        this.items.add(item);
    }
    addEffect(effect) {
        this.effects.add(effect);
    }
    fromJSON(json) {
        if (json.name !== undefined) {
            this.name = json.name;
        }
        if (json.character !== undefined) {
            this.character = json.character;
        }
        if (json.items !== undefined) {
            //this.name = json.name as string;
            for (const itemJson of json.items) {
                const presetItem = new PresetItem();
                if (presetItem.fromJSON(itemJson)) {
                    this.addItem(presetItem);
                }
            }
            for (const effectJson of json.effects) {
                const presetEffect = new PresetEffect();
                if (presetEffect.fromJSON(effectJson)) {
                    this.addEffect(presetEffect);
                }
            }
        }
        if (json.decapitation_level !== undefined) {
            this.decapitationLevel = json.decapitation_level;
        }
        return true;
    }
    toJSON() {
        const j = {
            name: this.name,
            character: this.character,
            items: [],
            effects: [],
        };
        for (const item of this.items) {
            j.items.push(item.toJSON());
        }
        for (const effect of this.effects) {
            j.effects.push(effect.toJSON());
        }
        if (this.decapitationLevel != 0) {
            j.decapitation_level = this.decapitationLevel;
        }
        return j;
    }
}
class Presets {
    #presets = new Map();
    selected;
    addPreset(preset) {
        this.#presets.set(preset.name, preset);
    }
    getPreset(name) {
        return this.#presets.get(name);
    }
    getPresets() {
        return this.#presets;
    }
    removePreset(name) {
        if (name == this.selected) {
            this.selected = undefined;
        }
        this.#presets.delete(name);
    }
    fromJSON(json) {
        this.selected = json.selected;
        if (json.presets) {
            for (const preset of json.presets) {
                const p = new Preset();
                if (p.fromJSON(preset)) {
                    this.addPreset(p);
                }
            }
        }
        return true;
    }
    toJSON() {
        const j = {};
        const presets = [];
        if (this.selected) {
            j.selected = this.selected;
        }
        j.presets = presets;
        for (const [, preset] of this.#presets) {
            presets.push(preset.toJSON());
        }
        return j;
    }
}

const eyeAttachments = ['eyeglow_R', 'eyeglow_L'];
class Character {
    scene;
    characterClass;
    name;
    npc;
    items = new Map();
    #showBodyParts = new Map();
    #model = null;
    #extraModels = new Set();
    effects = new Set();
    #tauntEffect = null;
    // [right, left]
    #killstreakEffects = [null, null];
    #decapitationEffects = [null, null];
    #team = Team.Red;
    #readyPromiseResolve;
    #ready = new Promise((resolve) => {
        this.#readyPromiseResolve = resolve;
    });
    #loaded = false;
    #visible = true;
    #zombieSkin = false;
    #isInvulnerable = false;
    #ragdoll = 0 /* Ragdoll.None */;
    #userAnim = '';
    #voicePose;
    #taunt = null;
    #flexControllers = new Map;
    #decapitationLevel = 0;
    static autoSelectAnim = true;
    constructor(characterClass, scene) {
        this.characterClass = characterClass;
        this.scene = scene;
        this.name = CharactersList.get(characterClass)?.name ?? '';
        this.npc = CharactersList.get(characterClass)?.npc ?? '';
    }
    async loadModel(path, name) {
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
    async getModel() {
        await this.#ready;
        return this.#model;
    }
    async addExtraModel(path, repository) {
        const extraModel = await addTF2Model(this.scene, path, repository);
        if (extraModel) {
            extraModel.setVisible(this.#visible);
            this.#extraModels.add(extraModel);
            await this.#refreshSkin();
        }
        return extraModel;
    }
    setVisible(visble) {
        this.#visible = visble;
        this.#model?.setVisible(visble);
        for (const extraModel of this.#extraModels) {
            extraModel?.setVisible(visble);
        }
    }
    async setTeam(team) {
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
    async #refreshSkin() {
        await this.#ready;
        let materialOverride;
        switch (this.#ragdoll) {
            case 0 /* Ragdoll.None */:
                await this.#setMaterialOverride(null);
                const zombieSkinOffset = (this.characterClass == Tf2Class.Spy ? 22 : 4);
                if (this.#model) {
                    await this.#model.setSkinId(this.#team + (this.#zombieSkin ? zombieSkinOffset : 0) + (this.#isInvulnerable ? 2 : 0));
                }
                for (const extraModel of this.#extraModels) {
                    if (this.#isInvulnerable) {
                        const materialOverride = this.#team ? MATERIAL_INVULN_BLU : MATERIAL_INVULN_RED;
                        const material = await Source1MaterialManager.getMaterial('tf2', materialOverride);
                        await extraModel.setMaterialOverride(material);
                    }
                    else {
                        extraModel.setSkinId(this.#team);
                    }
                }
                return;
            case 1 /* Ragdoll.Gold */:
                materialOverride = MATERIAL_GOLD_RAGDOLL;
                break;
            case 2 /* Ragdoll.Ice */:
                materialOverride = MATERIAL_ICE_RAGDOLL;
                break;
        }
        await this.#setMaterialOverride(materialOverride);
    }
    async #setMaterialOverride(materialOverride) {
        let material = null;
        if (materialOverride) {
            material = await Source1MaterialManager.getMaterial('tf2', materialOverride);
        }
        await this.#model?.setMaterialOverride(material);
        for (const extraModel of this.#extraModels) {
            await extraModel.setMaterialOverride(material);
        }
    }
    getTeam() {
        return this.#team;
    }
    getItemById(itemId) {
        return this.items.get(itemId);
    }
    async toggleItem(template) {
        const existingItem = this.items.get(template.id);
        if (existingItem) {
            this.#removeItem(existingItem);
            return [existingItem, false];
        }
        else {
            return [await this.#addItem(template), true];
        }
    }
    async addItem(template) {
        const existingItem = this.items.get(template.id);
        if (existingItem) {
            return existingItem;
        }
        else {
            return await this.#addItem(template);
        }
    }
    async #removeItem(item) {
        this.items.delete(item.id);
        if (item == this.#taunt) {
            this.#taunt = null;
            // TODO: play end choreo
            const npc = CharactersList.get(this.characterClass).name;
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
                }
                else {
                    item.remove();
                }
                const choreoName2 = item.getCustomTauntPropOutroScenePerClass(npc);
                const itemModel = await item.getModel();
                if (choreoName2 && itemModel) {
                    await ChoreographiesManager.init('tf2', './scenes/scenes.image');
                    ChoreographiesManager.playChoreography('tf2', choreoName2, [itemModel]);
                }
            }
            else {
                item.remove();
            }
        }
        else {
            item.remove();
        }
        Tf2LoadoutController.dispatchEvent('itemremoved', { detail: item });
        this.#loadoutChanged();
    }
    async #addItem(template) {
        const item = new Tf2Item(template, this);
        this.items.set(template.id, item);
        const npc = CharactersList.get(this.characterClass).name;
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
                    const dmx = unserializeDmxSync(result.buffer);
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
    updatePaintColor() {
        for (const [, item] of this.items) {
            item.updatePaintColor();
        }
    }
    isInvulnerable() {
        return this.#isInvulnerable;
    }
    async setInvulnerable(isInvulnerable) {
        this.#isInvulnerable = isInvulnerable;
        await this.#refreshSkinAll();
    }
    getRagdoll() {
        return this.#ragdoll;
    }
    async setRagdoll(ragdoll) {
        this.#ragdoll = ragdoll ?? 0 /* Ragdoll.None */;
        await this.#refreshSkinAll();
    }
    async #refreshSkinAll() {
        const promises = [];
        promises.push(this.#refreshSkin());
        this.items.forEach(item => promises.push(item.setTeam(this.#team)));
        await Promise.all(promises);
    }
    #loadoutChanged() {
        this.autoSelectAnim();
        this.#processSoul();
        this.#checkBodyGroups();
        //Controller.dispatchEvent(new CustomEvent('loadout-changed', { detail: { character: this } }));
    }
    async #checkBodyGroups() {
        await this.#ready;
        let bodyGroupIndex;
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
    renderBodyPart(bodyPart, render) {
        this.#showBodyParts.set(bodyPart, render);
        this.#model?.renderBodyPart(bodyPart, render);
    }
    #renderBodyParts(render) {
        this.#model?.renderBodyParts(render);
    }
    setBodyPartIdModel(bodyPartId, modelId) {
        this.#model?.setBodyPartIdModel(bodyPartId, modelId);
    }
    setBodyPartModel(bodyPartId, modelId) {
        this.#model?.setBodyPartModel(bodyPartId, modelId);
    }
    setPose(pose) {
        this.#voicePose = pose;
        this.autoSelectAnim();
    }
    setUserAnim(userAnim) {
        this.#userAnim = userAnim;
        if (userAnim) {
            this.#playAnim(userAnim);
        }
        else {
            this.autoSelectAnim();
        }
    }
    async #playAnim(animName) {
        await this.#ready;
        this.#model?.playSequence(animName);
        await this.#model?.setAnimation(0, animName, 1);
    }
    autoSelectAnim() {
        if (this.#userAnim) {
            return;
        }
        const pose = this.#voicePose ?? 'stand';
        if (Character.autoSelectAnim) {
            this.#playAnim(pose + '_secondary');
        }
        for (const [, item] of this.items) {
            const animSlot = item.getTemplate().animSlot;
            const itemSlot = item.getTemplate().getItemSlotPerClass(CharactersList.get(this.characterClass)?.name ?? 'scout' /*TODO: fix* scout*/);
            if (itemSlot != 'action' && animSlot && animSlot.toLowerCase() != 'building') {
                if (animSlot[0] == '#') ;
                else if (animSlot[0] == '!') {
                    this.#playAnim(animSlot.substring(1));
                }
                else if (animSlot.toLowerCase() == 'primary2') {
                    this.#playAnim(pose + '_primary');
                }
                else if (animSlot.toLowerCase() != 'force_not_used') {
                    this.#playAnim(pose + '_' + animSlot);
                }
            }
            else {
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
    #processSoul() {
        this.#zombieSkin = false;
        for (const [, item] of this.items) {
            if (item.getTemplate().name.includes('Voodoo-Cursed')) {
                this.#zombieSkin = true;
            }
        }
        this.#refreshSkin();
    }
    #doTauntAttack(tauntAttackName) {
        const spawnClientsideFlyingBird = async (pos) => {
            const flyAngle = RandomFloat(-Math.PI, Math.PI);
            const flyAngleRate = RandomFloat(-1.5, 1.5);
            const accelZ = RandomFloat(0.5, 2.0);
            const speed = RandomFloat(ENTITY_FLYING_BIRD_SPEED_MIN, ENTITY_FLYING_BIRD_SPEED_MAX);
            const glideTime = RandomFloat(0.25, 1.);
            await this.#ready;
            new FlyingBird(this.#model, pos, flyAngle, flyAngleRate, accelZ, speed, glideTime);
        };
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
                setTimeout(() => {
                    (async () => {
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
                    })();
                }, 3000);
                break;
        }
    }
    async #addEffect(name, systemName, attachment, offset) {
        const effect = new Effect(new EffectTemplate(EffectType.Other, -1, {}));
        this.effects.add(effect);
        //const system = await Source1ParticleControler.createSystem('tf2', systemName);
        effect.system = await Source1ParticleControler.createSystem('tf2', systemName);
        effect.system.name = name;
        await this.#ready;
        this.#model?.attachSystem(effect.system, attachment, 0, offset);
        effect.system.start();
        return effect;
    }
    async #attachSystem(system, attachmentName, attachmentType, offset) {
        await this.#ready;
        this.#model?.attachSystem(system, attachmentName, 0, offset);
    }
    async setFlexControllerValue(name, value) {
        this.#flexControllers.set(name, value);
        await this.#updateFlexes();
    }
    async resetFlexes() {
        this.#flexControllers.clear();
        await this.#updateFlexes();
    }
    async #updateFlexes() {
        await this.#ready;
        this.#model?.setFlexes(this.#flexControllers);
        for (const [, item] of this.items) {
            (await item.getModel())?.setFlexes(this.#flexControllers);
        }
        for (const extraModel of this.#extraModels) {
            extraModel.setFlexes(this.#flexControllers);
        }
    }
    async addEffect(template) {
        const effect = new Effect(template);
        this.effects.add(effect);
        await this.#createEffect(effect);
        this.#setEffectsTeam();
        return effect;
    }
    async #createEffect(effect, systemName, eyeAttachment) {
        effect.system = await Source1ParticleControler.createSystem('tf2', systemName ?? effect.template.getSystem());
        effect.system.name = effect.template.getName();
        await this.#ready;
        let attachment = '';
        switch (effect.template.type) {
            case EffectType.Cosmetic:
                attachment = 'bip_head';
                break;
            case EffectType.Killstreak:
                attachment = eyeAttachment ?? '';
                break;
        }
        if (this.characterClass == Tf2Class.Empty) {
            for (const [, item] of this.items) {
                const model = await item.getModel();
                if (model) {
                    model.attachSystem(effect.system, attachment, 0); // TODO: offset
                    break;
                }
            }
        }
        else {
            this.#model?.attachSystem(effect.system, attachment, 0); // TODO: offset
        }
        effect.system.start();
    }
    removeEffect(effect) {
        effect.system?.stop();
        effect.system?.remove();
        this.effects.delete(effect);
    }
    async #setEffectsTeam() {
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
    async #setEffectTeam(effect) {
        let from;
        let to;
        if (this.#team == Team.Red) {
            from = EFFECTS_BLU;
            to = EFFECTS_RED;
        }
        else {
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
    async setKillsteakEffect(template, color) {
        return this.#setKillsteakEffect(this.#killstreakEffects, template, 0 /* Eye.Right */, color);
    }
    async #setKillsteakEffect(array, template, demoEye, color) {
        for (let i = 0; i < 2; i++) {
            const effect = array[i];
            if (effect) {
                effect.system?.stop();
                effect.system?.remove();
            }
            array[i] = null;
            // No left eye for demoman
            if (i != demoEye && (this.characterClass == Tf2Class.Demoman || this.characterClass == Tf2Class.DemomanBot)) {
                continue;
            }
            if (template) {
                const effect = new Effect(template);
                effect.killstreakColor = color;
                await this.#createEffect(effect, undefined, eyeAttachments[i]);
                const sys = effect?.system;
                if (sys && color) {
                    const killstreakColor = getKillstreak(color)?.getKillstreakColor1(this.#team);
                    if (killstreakColor) {
                        sys.getControlPoint(9).setPosition(killstreakColor);
                    }
                }
                array[i] = effect;
            }
        }
        // Check team color
        this.#setEffectsTeam();
        return array;
    }
    async #updateKillsteakEffectsTeam() {
        const effect = this.#killstreakEffects[0] ?? this.#killstreakEffects[1];
        if (effect) {
            const killstreakColor = effect.killstreakColor;
            const killstreak = killstreakList.get(killstreakColor);
            // Only update if the effects is team colored
            if (killstreak?.teamColored) {
                await this.setKillsteakEffect(effect.template, effect.killstreakColor);
            }
        }
    }
    async setDecapitationLevel(level) {
        this.#decapitationLevel = level;
        let template = null;
        if (level > 0) {
            template = new EffectTemplate(EffectType.Killstreak, 20000, { 'name': 'Eye glow', 'system': 'eye_powerup_green_lvl_' + level, });
        }
        return this.#setKillsteakEffect(this.#decapitationEffects, template, 1 /* Eye.Left */);
    }
    getDecapitationLevel() {
        return this.#decapitationLevel;
    }
    async setTauntEffect(template) {
        if (this.#tauntEffect) {
            this.#tauntEffect.system?.stop();
            this.#tauntEffect.system?.remove();
        }
        if (!template) {
            this.#tauntEffect = null;
            return null;
        }
        const effect = new Effect(template);
        this.#tauntEffect = effect;
        await this.#createEffect(effect);
        this.#setEffectsTeam();
        return effect;
    }
    getTauntEffect() {
        return this.#tauntEffect;
    }
    getKillstreakEffects() {
        return this.#killstreakEffects;
    }
    setPoseParameter(name, value) {
        this.#model?.setPoseParameter(name, value);
        for (const extraModel of this.#extraModels) {
            extraModel.setPoseParameter(name, value);
        }
    }
    savePreset(name) {
        const preset = new Preset(name);
        const npc = CharactersList.get(this.characterClass).name;
        preset.character = npc;
        preset.decapitationLevel = this.#decapitationLevel;
        for (const [, item] of this.items) {
            const presetItem = new PresetItem();
            presetItem.id = item.id;
            if (presetItem.id.startsWith('w')) {
                // Remove leading w
                presetItem.id = presetItem.id.substring(1);
            }
            presetItem.isWorkshop = item.getTemplate().isWorkshop();
            presetItem.isTournamentMedal = item.getTemplate().isTournamentMedal();
            if (item.getWarpaintId() !== null) {
                presetItem.warpaintId = item.getWarpaintId();
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
        const addPresetEffect = (effect) => {
            if (!effect) {
                return;
            }
            const presetEffect = new PresetEffect();
            presetEffect.id = effect.template.id;
            presetEffect.setType(effect.template.type);
            presetEffect.attachment = effect.attachment;
            presetEffect.color = effect.killstreakColor;
            if (effect.offset) {
                vec3.copy(presetEffect.offset, effect.offset);
            }
            preset.addEffect(presetEffect);
        };
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
    async loadPreset(preset) {
        this.removeAllItems();
        this.removeAllEffects();
        const itemPromises = [];
        for (const presetItem of preset.items) {
            itemPromises.push(this.#loadPresetItem(presetItem));
        }
        await Promise.all(itemPromises);
        this.setDecapitationLevel(preset.decapitationLevel);
        for (const presetEffect of preset.effects) {
            const template = ItemManager.getEffectTemplate(presetEffect.getType(), presetEffect.id);
            if (!template) {
                continue;
            }
            switch (presetEffect.type) {
                case PresetEffectType.Unusual:
                    this.addEffect(template);
                    break;
                case PresetEffectType.Killstreak:
                    this.setKillsteakEffect(template, presetEffect.color);
                    break;
                case PresetEffectType.Taunt:
                    this.setTauntEffect(template);
                    break;
            }
        }
    }
    async #loadPresetItem(presetItem) {
        let itemId = presetItem.id;
        if (presetItem.isWorkshop) {
            itemId = 'w' + itemId;
        }
        const template = ItemManager.getItemTemplate(itemId);
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
    removeAll() {
        this.removeAllItems();
        this.removeAllEffects();
    }
    removeAllItems() {
        for (const [, item] of this.items) {
            this.#removeItem(item);
        }
    }
    removeAllEffects() {
        for (const effect of this.effects) {
            this.removeEffect(effect);
        }
        this.setKillsteakEffect(null);
        this.setTauntEffect(null);
    }
    async copy(other) {
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
            const warpaintId = copiedItem.getWarpaintId();
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

export { COIN_SPIN_EFFECT, COMMUNITY_SPARKLE_EFFECT, Character, CharactersList, ClassRemovablePartsOff, DEFAULT_ACTIVITY, Dota2AssetModifier, Dota2Hero, Dota2HeroTemplate, Dota2HeroTemplates, Dota2Item, Dota2ItemManager, Dota2ItemTemplate, Dota2ItemTemplates, Dota2LoadoutController, Dota2Units, Effect, EffectTemplate, EffectType, ItemTemplate, Panel, Team, Tf2Class, Tf2Item, colorToCss, colorToVec3, colorToVec4, getPersonaId, npcToClass, randomProperty, weaponEffects };
