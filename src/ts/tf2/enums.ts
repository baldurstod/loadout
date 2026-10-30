export type Tf2Team = 'none' | 'red' | 'blu';

export function getTf2TeamId(team: Tf2Team): 0 | 1 {
	return team === 'blu' ? 1 : 0;
}

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
