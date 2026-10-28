import { Entity, Source1ModelInstance, Source1ModelManager } from 'harmony-3d';

export async function addTF2Model(parent: Entity | null, path: string, repository?: string, name?: string): Promise<Source1ModelInstance | null> {
	const model = await Source1ModelManager.createInstance(repository ?? 'tf2', path, true);
	if (!model) {
		return null;
	}
	if (name) {
		model.name = name;
	}
	model.setupPickingId();
	parent?.addChild(model);
	const itemStartSeq = model.sourceModel.mdl.getSequenceById(0);
	if (itemStartSeq) {
		model.playSequence(itemStartSeq.name);
		model.setAnimation(0, itemStartSeq.name, 1);
	}
	model.frame = 0.;
	return model;
}
