import { vec3, vec4 } from 'gl-matrix';

/**
 * Return a css value of a color
 * @param {Number} color The color, in integer format (ie: Indubitably Green: 7511618)
 */
export function colorToCss(color = 0): string {
	const red = ((color & 0xFF0000) >> 16);
	const green = ((color & 0x00FF00) >> 8);
	const blue = ((color & 0x0000FF) >> 0);
	return `rgb(${red},${green},${blue})`;
}

export function colorToVec3(color: number, tint = vec3.create()): vec3 {
	tint[0] = ((color & 0xFF0000) >> 16) / 255.0;
	tint[1] = ((color & 0x00FF00) >> 8) / 255.0;
	tint[2] = ((color & 0x0000FF) >> 0) / 255.0;
	return tint;
}

export function colorToVec4(color: number, tint = vec4.create()): vec4 {
	tint[0] = ((color & 0xFF0000) >> 16) / 255.0;
	tint[1] = ((color & 0x00FF00) >> 8) / 255.0;
	tint[2] = ((color & 0x0000FF) >> 0) / 255.0;
	tint[3] = 1.0;
	return tint;
}
