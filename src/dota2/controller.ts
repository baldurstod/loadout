//import { Character } from './loadout/characters/character';

/*
export enum ControllerEvent {
	ChangeAnimFrame = 'changeanimframe',
	CharacterSelected = 'characterselected',
	CharacterUnitsChanged = 'characterunitschanged',
	CharactersLoaded = 'charactersloaded',
	CharacterItemAdded = 'characteritemadded',
	CharacterItemRemoved = 'characteritemremoved',
	CharacterPersonaChanged = 'characterpersonachanged',
	ItemsLoaded = 'itemsloaded',
	ItemClick = 'itemclick',
	SlotClick = 'slotclick',
	OpenCharacterSelector = 'opencharacterselector',
	SetMarketPrices = 'setmarketprices',
	ExportObj = 'exportobj',
	RemoveItem = 'removeitem',
	CloseItemList = 'closeitemlist',
	OpenItemList = 'openitemlist',
	ToolbarShare = 'toolbarshare',
	ToolbarPicture = 'toolbarpicture',
	ToolbarExportFbx = 'toolbarexportfbx',
	ToolbarExportObj = 'toolbarexportoobj',
	ToolbarOptions = 'toolbaroptions',
	ToolbarAdvancedOptions = 'toolbar-advanced-options',
	ToolbarBug = 'toolbar-bug',
	ToolbarAbout = 'toolbar-about',
	ToolbarPlay = 'toolbar-play',
	ToolbarPause = 'toolbar-pause',
	ToolbarPatreon = 'toolbar-patreon',
	ToolbarActivitySelected = 'toolbar-activity-selected',
	ToolbarActivityModifiers = 'toolbar-activity-modifiers',
	PanelOptionsOpened = 'panel-options-opened',
	PanelOptionsClosed = 'panel-options-closed',
	ResetCamera = 'reset-camera',
}
*/
/*
export type CharacterSelected = {
	characterId: string,
};

export type ItemClick = {
	character: Character,
	itemId: string,
};

export type PersonaChanged = number;

export type SlotClick = string;

export type ToolbarActivitySelected = string;

export type ToolbarActivityModifiers = string[];

export type RemoveItem = {
	character: Character,
	itemID: string,
};
*/

export type Dota2LoadoutControllerEvent = 'heroitemadded' | 'heroitemremoved' | 'herounitschanged' | 'heropersonachanged';

export class Dota2LoadoutController {
	static readonly #eventTarget = new EventTarget();

	static addEventListener(type: Dota2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
		this.#eventTarget.addEventListener(type, callback, options);
	}

	static dispatchEvent<T>(type: Dota2LoadoutControllerEvent, options?: CustomEventInit<T>): boolean {
		return this.#eventTarget.dispatchEvent(new CustomEvent<T>(type, options));
	}

	static removeEventListener(type: Dota2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
		this.#eventTarget.removeEventListener(type, callback, options);
	}
}
