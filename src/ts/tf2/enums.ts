export type Tf2Team = 'none' | 'red' | 'blu';

export function getTf2TeamId(team: Tf2Team): 0 | 1 {
	return team === 'blu' ? 1 : 0;
}

export type UsePlayerModels = 'human' | 'bot' | 'infected';
