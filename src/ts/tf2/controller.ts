import { Panel } from './enums';
import { Tf2Item } from './items/item';
import { Tf2ItemTemplate } from './items/itemtemplate';

export type Tf2LoadoutControllerEvent =
	'itemadded'
	| 'itemremoved'
	| 'inititems'
	| 'itemsloaded'
	| 'sfmitemsloaded'
	| 'systemsloaded'
	| 'setitemfilter'
	| 'setitemsortascending'
	| 'setsfmitemsortascending'
	| 'filtersupdated'
	| 'setitemsorttype'
	| 'setsfmsortfield'
	| 'itempinned'
	;

// Same as CustomEventInit with required detail
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Tf2LoadoutControllerEventInit<T = any> extends EventInit {
	detail: T;
}

export class Tf2LoadoutController {
	static readonly #eventTarget = new EventTarget();

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
	static addEventListener(type: Tf2LoadoutControllerEvent, callback: (evt: CustomEvent) => void, options?: AddEventListenerOptions | boolean): void {
		this.#eventTarget.addEventListener(type, callback as (evt: Event) => void, options);
	}

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
	static dispatchEvent<T>(type: Tf2LoadoutControllerEvent, options?: CustomEventInit<T>): boolean {
		return this.#eventTarget.dispatchEvent(new CustomEvent<T>(type, options));
	}

	static removeEventListener(type: Tf2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
		this.#eventTarget.removeEventListener(type, callback, options);
	}
}

export enum ItemFilterAttribute {//TODO: turn into type
	Name,
	Selected,
	Workshop,
	SfmWorkshop,
	SfmUniverse,
	SfmModel,
	HideConflict,
	TournamentMedals,
	ShowMultiClass,
	ShowOneClass,
	ShowAllClass,
	DoNotFilterPerClass,
	Paintable,
	Warpaintable,
	Halloween,
	DisplayMedals,
	DisplayWeapons,
	DisplayCosmetics,
	DisplayTaunts,
	Collection,
}

export type SetItemFilter = {
	attribute: ItemFilterAttribute;
	value: string | boolean | undefined;
}

export type ItemPinned = {
	item: Tf2ItemTemplate;
	pinned: boolean;
}
