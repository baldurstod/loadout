import { vec3 } from 'gl-matrix';
import { Source1ParticleSystem } from 'harmony-3d';
import { KillstreakColor } from '../paints/killstreaks';
import { Tf2EffectTemplate, Tf2EffectType } from './effecttemplate';

export const COMMUNITY_SPARKLE_EFFECT = 4;
export const COIN_SPIN_EFFECT = 406;

export const weaponEffects = new Map<number, [string, string]>([
	[701, ['hot', 'Hot']],
	[702, ['isotope', 'Isotope']],
	[703, ['cool', 'Cool']],
	[704, ['energyorb', 'Energy orb']],
	[COMMUNITY_SPARKLE_EFFECT, ['community_sparkle', 'Community Sparkle']],
]);

export class Tf2Effect {
	readonly template: Tf2EffectTemplate;
	name = '';
	system: Source1ParticleSystem | null = null;
	attachment?: string;
	offset = vec3.create();
	killstreakColor?: KillstreakColor;

	constructor(template: Tf2EffectTemplate) {
		this.template = template;
	}

	getId(): number {
		return this.template.id;
	}

	getType(): Tf2EffectType {
		return this.template.type;
	}
}
