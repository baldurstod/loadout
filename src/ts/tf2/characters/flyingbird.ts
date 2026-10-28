import { quat, vec3 } from 'gl-matrix';
import { GraphicsEvents, Source1ModelInstance } from 'harmony-3d';
import { addTF2Model } from '../addtf2model';
import { TF2_DOVE_MODEL } from '../constants';

export class FlyingBird {
	parent;
	launchSpot;
	flyAngle;
	flyAngleRate;
	flAccelZ;
	flSpeed;
	flGlideTime;
	flyZ = 0;

	constructor(parent: Source1ModelInstance | null, launchSpot: vec3, flyAngle: number, flyAngleRate: number, flAccelZ: number, flSpeed: number, flGlideTime: number) {
		this.parent = parent;
		this.launchSpot = launchSpot;
		this.flyAngle = flyAngle;
		this.flyAngleRate = flyAngleRate;
		this.flAccelZ = flAccelZ;
		this.flSpeed = flSpeed;
		this.flGlideTime = flGlideTime;
		this.#init();
	}

	async #init(): Promise<void> {
		const dove = await addTF2Model(this.parent, TF2_DOVE_MODEL);
		if (!dove) {
			return;
		}

		dove.setPosition(this.launchSpot);
		this.parent?.parent?.addChild(dove);

		const tickEvent = (event: Event): void => {
			const delta = (event as CustomEvent).detail.delta;
			this.flyZ += this.flAccelZ * delta;
			this.flyAngle += this.flyAngleRate * delta;
			const forward = vec3.create();
			forward[0] = Math.cos(this.flyAngle);
			forward[1] = Math.sin(this.flyAngle);
			forward[2] = this.flyZ;
			vec3.normalize(forward, forward);
			dove.setQuaternion(quat.rotationTo(quat.create(), [1, 0, 0], forward));
			vec3.scale(forward, forward, delta * this.flSpeed);
			//console.log(forward);
			dove.setPosition(vec3.add(forward, forward, dove._position));
		}

		GraphicsEvents.addEventListener('tick', tickEvent);

		setTimeout(() => dove.playSequence('fly_cycle'), this.flGlideTime * 1000);
		setTimeout(() => { dove.remove(); GraphicsEvents.removeEventListener('tick', tickEvent); }, 10000);
	}
}
