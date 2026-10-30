import bot_demoman from '../../../json/animations/bot_demoman.json';
import bot_engineer from '../../../json/animations/bot_engineer.json';
import bot_heavy from '../../../json/animations/bot_heavy.json';
import bot_medic from '../../../json/animations/bot_medic.json';
import bot_pyro from '../../../json/animations/bot_pyro.json';
import bot_scout from '../../../json/animations/bot_scout.json';
import bot_sniper from '../../../json/animations/bot_sniper.json';
import bot_soldier from '../../../json/animations/bot_soldier.json';
import bot_spy from '../../../json/animations/bot_spy.json';
import demoman from '../../../json/animations/demoman.json';
import engineer from '../../../json/animations/engineer.json';
import heavy from '../../../json/animations/heavy.json';
import medic from '../../../json/animations/medic.json';
import pyro from '../../../json/animations/pyro.json';
import scout from '../../../json/animations/scout.json';
import sniper from '../../../json/animations/sniper.json';
import soldier from '../../../json/animations/soldier.json';
import spy from '../../../json/animations/spy.json';
import { Tf2Class } from './characters';

export type ClassAnimations = {
	character: string,
	animations: Record<string, { name: string, file: string }>,
}

const TF2_CLASS_ANIMATIONS = new Map<Tf2Class, ClassAnimations>([
	[Tf2Class.Scout, scout],
	[Tf2Class.Sniper, sniper],
	[Tf2Class.Soldier, soldier],
	[Tf2Class.Demoman, demoman],
	[Tf2Class.Medic, medic],
	[Tf2Class.Heavy, heavy],
	[Tf2Class.Pyro, pyro],
	[Tf2Class.Spy, spy],
	[Tf2Class.Engineer, engineer],
	[Tf2Class.ScoutBot, bot_scout],
	[Tf2Class.SniperBot, bot_sniper],
	[Tf2Class.SoldierBot, bot_soldier],
	[Tf2Class.DemomanBot, bot_demoman],
	[Tf2Class.MedicBot, bot_medic],
	[Tf2Class.HeavyBot, bot_heavy],
	[Tf2Class.PyroBot, bot_pyro],
	[Tf2Class.SpyBot, bot_spy],
	[Tf2Class.EngineerBot, bot_engineer],
]);

export function getTf2ClassAnimations(tf2Class: Tf2Class): ClassAnimations | null {
	return TF2_CLASS_ANIMATIONS.get(tf2Class) ?? null;

}
