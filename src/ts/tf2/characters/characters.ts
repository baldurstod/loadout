import demoman from '../../../img/class/demoman.png';
import engineer from '../../../img/class/engineer.png';
import heavy from '../../../img/class/heavy.png';
import medic from '../../../img/class/medic.png';
import pyro from '../../../img/class/pyro.png';
import scout from '../../../img/class/scout.png';
import sniper from '../../../img/class/sniper.png';
import soldier from '../../../img/class/soldier.png';
import spy from '../../../img/class/spy.png';
import all from '../../../img/class_icon/filter_all_motd.png';
import extensionIcon from '../../../img/extension_icon.png';
import { UsePlayerModels } from '../enums';

export enum Tf2Class {
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
	CompareWarpaints = 1003,
}

export type CharactersType = { name: string, path: string, type: UsePlayerModels, icon: string, hidden?: boolean, npc: string };
export const CharactersList = new Map<Tf2Class, CharactersType>([
	[Tf2Class.Scout, { name: 'scout', type: 'human', path: 'models/player/scout', icon: scout, npc: 'scout' }],
	[Tf2Class.Sniper, { name: 'sniper', type: 'human', path: 'models/player/sniper', icon: sniper, npc: 'sniper' }],
	[Tf2Class.Soldier, { name: 'soldier', type: 'human', path: 'models/player/soldier', icon: soldier, npc: 'soldier' }],
	[Tf2Class.Demoman, { name: 'demoman', type: 'human', path: 'models/player/demo', icon: demoman, npc: 'demoman' }],
	[Tf2Class.Medic, { name: 'medic', type: 'human', path: 'models/player/medic', icon: medic, npc: 'medic' }],
	[Tf2Class.Heavy, { name: 'heavy', type: 'human', path: 'models/player/heavy', icon: heavy, npc: 'heavy' }],
	[Tf2Class.Pyro, { name: 'pyro', type: 'human', path: 'models/player/pyro', icon: pyro, npc: 'pyro' }],
	[Tf2Class.Spy, { name: 'spy', type: 'human', path: 'models/player/spy', icon: spy, npc: 'spy' }],
	[Tf2Class.Engineer, { name: 'engineer', type: 'human', path: 'models/player/engineer', icon: engineer, npc: 'engineer' }],

	[Tf2Class.ScoutBot, { name: 'scout', type: 'bot', path: 'models/bots/scout/bot_scout', icon: scout, npc: 'bot_scout' }],
	[Tf2Class.SniperBot, { name: 'sniper', type: 'bot', path: 'models/bots/sniper/bot_sniper', icon: sniper, npc: 'bot_sniper' }],
	[Tf2Class.SoldierBot, { name: 'soldier', type: 'bot', path: 'models/bots/soldier/bot_soldier', icon: soldier, npc: 'bot_soldier' }],
	[Tf2Class.DemomanBot, { name: 'demoman', type: 'bot', path: 'models/bots/demo/bot_demo', icon: demoman, npc: 'bot_demoman' }],
	[Tf2Class.MedicBot, { name: 'medic', type: 'bot', path: 'models/bots/medic/bot_medic', icon: medic, npc: 'bot_medic' }],
	[Tf2Class.HeavyBot, { name: 'heavy', type: 'bot', path: 'models/bots/heavy/bot_heavy', icon: heavy, npc: 'bot_heavy' }],
	[Tf2Class.PyroBot, { name: 'pyro', type: 'bot', path: 'models/bots/pyro/bot_pyro', icon: pyro, npc: 'bot_pyro' }],
	[Tf2Class.SpyBot, { name: 'spy', type: 'bot', path: 'models/bots/spy/bot_spy', icon: spy, npc: 'bot_spy' }],
	[Tf2Class.EngineerBot, { name: 'engineer', type: 'bot', path: 'models/bots/engineer/bot_engineer', icon: engineer, npc: 'bot_engineer' }],

	[Tf2Class.ScoutInfected, { name: 'scout', type: 'infected', path: 'models/player/scout_infected', icon: scout, npc: 'scout_infected' }],
	[Tf2Class.SniperInfected, { name: 'sniper', type: 'infected', path: 'models/player/sniper_infected', icon: sniper, npc: 'sniper_infected' }],
	[Tf2Class.SoldierInfected, { name: 'soldier', type: 'infected', path: 'models/player/soldier_infected', icon: soldier, npc: 'soldier_infected' }],
	[Tf2Class.DemomanInfected, { name: 'demoman', type: 'infected', path: 'models/player/demo_infected', icon: demoman, npc: 'demoman_infected' }],
	[Tf2Class.MedicInfected, { name: 'medic', type: 'infected', path: 'models/player/medic_infected', icon: medic, npc: 'medic_infected' }],
	[Tf2Class.HeavyInfected, { name: 'heavy', type: 'infected', path: 'models/player/heavy_infected', icon: heavy, npc: 'heavy_infected' }],
	[Tf2Class.PyroInfected, { name: 'pyro', type: 'infected', path: 'models/player/pyro_infected', icon: pyro, npc: 'pyro_infected' }],
	[Tf2Class.SpyInfected, { name: 'spy', type: 'infected', path: 'models/player/spy_infected', icon: spy, npc: 'spy_infected' }],
	[Tf2Class.EngineerInfected, { name: 'engineer', type: 'infected', path: 'models/player/engineer_infected', icon: engineer, npc: 'engineer_infected' }],

	[Tf2Class.Empty, { name: 'dummy', type: 'human', path: 'models/empty', icon: all, hidden: true, npc: 'dummy' }],
	[Tf2Class.CompareWarpaints, { name: 'warpaints', type: 'human', path: 'models/empty', icon: extensionIcon, hidden: true, npc: 'warpaints' }],
]);

export const ClassRemovablePartsOff = ['heavy_hand_dex_bodygroup', 'robotarm_bodygroup', 'darts_bodygroup', 'spyMask', 'rocket', 'medal_bodygroup', 'demo_smiley'];

export function npcToClass(npc: string): Tf2Class | null {
	for (const [tf2Class, character] of CharactersList) {
		if (character.npc == npc) {
			return tf2Class;
		}
	}
	return null;
}
