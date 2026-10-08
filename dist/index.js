import { vec3 } from 'gl-matrix';
import { Source2ModelManager, Source2ParticleManager, Group, stringToVec3 } from 'harmony-3d';
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
    async getAssetModifiers() {
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
        const modifiers = await this.getAssetModifiers();
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
                            "asset": characterId,
                            "modifier": unit.Model,
                            "type": 'entity_model',
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

export { DEFAULT_ACTIVITY, Dota2AssetModifier, Dota2Hero, Dota2HeroTemplate, Dota2HeroTemplates, Dota2Item, Dota2ItemManager, Dota2ItemTemplate, Dota2ItemTemplates, Dota2LoadoutController, Dota2Units, getPersonaId };
