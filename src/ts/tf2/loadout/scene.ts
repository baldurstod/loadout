import { Camera, CameraControl, ColorBackground, Entity, FirstPersonControl, Group, HALF_PI, OrbitControl, PointLight, Scene, SceneExplorer, Source1ModelInstance, Source1ModelManager } from 'harmony-3d';
import { CameraType } from '../../common';

export const loadoutScene = new Scene();
export const loadoutColorBackground = new ColorBackground();
export const orbitCamera = new Camera({ name: 'Orbit camera', nearPlane: 10, farPlane: 5000, autoResize: true });
export const firstPersonCamera = new Camera({
	nearPlane: 5,
	farPlane: 1000,
	verticalFov: 90,
	name: 'First person camera',
	autoResize: true,
	position: [0, 5, -7],
	quaternion: [0, 0, 1, 0],
});
export const orbitCameraControl = new OrbitControl(orbitCamera);
export const firstPersonCameraControl = new FirstPersonControl(orbitCamera);
firstPersonCameraControl.movementSpeed = 100;
firstPersonCameraControl.lookSpeed = 0.1;
export let activeCameraControl: CameraControl = orbitCameraControl;

loadoutScene.addChild(orbitCameraControl.target);

export let customLightsContainer: Entity | undefined;
export const lightsContainer = new Group({ name: 'Lights' });

export function setCustomLightsContainer(container: Entity): void {
	customLightsContainer = container;
}

export let activeCamera = orbitCamera;
setActiveCamera(CameraType.Orbit);
new SceneExplorer().setScene(loadoutScene);
loadoutScene.activeCamera = orbitCamera;
loadoutScene.addChild(orbitCamera);
loadoutScene.background = loadoutColorBackground;

export const mapLightsContainer = new Group({ name: 'Photo studio lights', parent: loadoutScene, visible: false });
for (let i = 0; i < 3; ++i) {
	new PointLight({ name: 'Photo studio point light ' + i, position: [i * 200 - 200, -200, 50], range: 700, parent: mapLightsContainer });
}

export function setPolarRotation(polarRotation: boolean): void {
	if (polarRotation) {
		orbitCameraControl.minPolarAngle = -Infinity;
		orbitCameraControl.maxPolarAngle = Infinity;
	} else {
		orbitCameraControl.minPolarAngle = HALF_PI;
		orbitCameraControl.maxPolarAngle = HALF_PI;
	}
}

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

export function setActiveCamera(cameraType: CameraType): void {
	let camera: Camera;
	switch (cameraType) {
		case CameraType.Orbit:
			camera = orbitCamera;
			setActiveCameraControl(orbitCameraControl);
			break;
		case CameraType.FreeFly:
			camera = orbitCamera;
			setActiveCameraControl(firstPersonCameraControl);
			break;
		case CameraType.FirstPerson:
			camera = firstPersonCamera;
			setActiveCameraControl(null);
			break;
	}

	activeCamera = camera;
	camera.setActiveCamera();
}

function setActiveCameraControl(control: CameraControl | null): void {
	firstPersonCameraControl.enabled = false;
	orbitCameraControl.enabled = false;
	if (control) {
		activeCameraControl = control;
		control.enabled = true;
	}
}
