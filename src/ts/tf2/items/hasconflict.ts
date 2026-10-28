const equipConflicts: Record<string, string[]> = {
	'glasses': ['face', 'lenses'],
	'whole_head': ['hat', 'face', 'glasses'],
}

export function hasConflict(equipRegions1: string[], equipRegions2: string[]): boolean {
	if (!equipRegions1 || !equipRegions2) {
		return false;
	}

	for (let region1 of equipRegions1) {
		for (let region2 of equipRegions2) {

			region1 = region1.toLowerCase();
			region2 = region2.toLowerCase();
			if (region1 == region2) {
				return true;
			}

			const eq1 = equipConflicts[region1];
			const eq2 = equipConflicts[region2];
			if (eq1) {
				for (const k of eq1) {
					if (k == region2) {
						return true;
					}
				}
			}

			if (eq2) {
				for (const l of eq2) {
					if (l == region1) {
						return true;
					}
				}
			}
		}
	}
	return false
}
