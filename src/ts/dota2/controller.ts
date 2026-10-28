import { Dota2Item } from "./items/item";

export type Dota2LoadoutControllerEvent = 'heroitemadded' | 'heroitemremoved' | 'herounitschanged' | 'heropersonachanged' | 'itemsloaded';

// Same as CustomEventInit with required detail
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Dota2LoadoutControllerEventInit<T = any> extends EventInit {
	detail: T;
}

export class Dota2LoadoutController {
	static readonly #eventTarget = new EventTarget();

	static addEventListener(type: 'heroitemadded', callback: (evt: CustomEvent<Dota2Item>) => void, options?: AddEventListenerOptions | boolean): void;
	static addEventListener(type: 'heroitemremoved', callback: (evt: CustomEvent<Dota2Item>) => void, options?: AddEventListenerOptions | boolean): void;
	static addEventListener(type: 'herounitschanged', callback: (evt: CustomEvent<void>) => void, options?: AddEventListenerOptions | boolean): void;
	static addEventListener(type: 'heropersonachanged', callback: (evt: CustomEvent<number>) => void, options?: AddEventListenerOptions | boolean): void;
	static addEventListener(type: 'itemsloaded', callback: (evt: CustomEvent<string>) => void, options?: AddEventListenerOptions | boolean): void;
	static addEventListener(type: Dota2LoadoutControllerEvent, callback: (evt: CustomEvent) => void, options?: AddEventListenerOptions | boolean): void {
		this.#eventTarget.addEventListener(type, callback as (evt: Event) => void, options);
	}

	static dispatchEvent(type: 'heroitemadded', options: Dota2LoadoutControllerEventInit<Dota2Item>): boolean;
	static dispatchEvent(type: 'heroitemremoved', options: Dota2LoadoutControllerEventInit<Dota2Item>): boolean;
	static dispatchEvent(type: 'herounitschanged', options?: CustomEventInit<void>): boolean;
	static dispatchEvent(type: 'heropersonachanged', options: Dota2LoadoutControllerEventInit<number>): boolean;
	static dispatchEvent(type: 'itemsloaded', options: Dota2LoadoutControllerEventInit<string>): boolean;
	static dispatchEvent<T>(type: Dota2LoadoutControllerEvent, options?: CustomEventInit<T>): boolean {
		return this.#eventTarget.dispatchEvent(new CustomEvent<T>(type, options));
	}

	static removeEventListener(type: Dota2LoadoutControllerEvent, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
		this.#eventTarget.removeEventListener(type, callback, options);
	}
}
