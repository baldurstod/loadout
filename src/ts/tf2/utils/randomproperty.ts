export function randomProperty(obj: Record<string, any/*TODO: fix type*/>): string {
	const keys = Object.keys(obj);
	return obj[keys[keys.length * Math.random() << 0]!];
}
