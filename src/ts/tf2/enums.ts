export enum Team {
	None = -1,
	Red = 0,
	Blu = 1,
};

export type UsePlayerModels = 'human' | 'bot' | 'infected';

export enum Panel {//TODO: turn into type
	None = 'none',
	Items = 'items',
	Printful = 'printful',
	Options = 'options',
	Effects = 'effects',
	Presets = 'presets',
	Paints = 'paints',
	Sheens = 'sheens',
	WeaponEffects = 'weaponeffects',
	Warpaints = 'warpaints',
	Flexes = 'flexes',
	SfmRepositories = 'sfmrepositories',
}
