import { Scene } from 'harmony-3d';
import { Ragdoll, Tf2Character } from './characters/character';
import { UsePlayerModels } from './enums';
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
	| 'setinvulnerable'
	| 'setragdoll'
	| 'setanim'
	| 'setapplytoall'
	| 'usebots'
	| 'importpresets'
	| 'changeanimframe'
	| 'characterchanged'
	| 'activatemeettheteammap'
	| 'presetsupdated'
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

export type SetInvulnerable = {
	invulnerable: boolean;
	scene: Scene;
}

export type SetRagdoll = {
	ragdoll: Ragdoll;
	scene: Scene;
}

export type SetAnim = {
	anim: string;
	scene: Scene;
}

export type ImportPresets = {
	files: File[];
	scene: Scene;
}

export type ChangeAnimFrame = {
	frame: number;
	scene: Scene;
}
