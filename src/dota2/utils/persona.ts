export function getPersonaId(slot: string): number {
	const result = /\_persona\_(\d)$/.exec(slot);
	if (result?.length == 2) {
		return Number(result[1]);
	}
	return 0;
}
