import fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import child_process from 'child_process';

const TEMP_BUILD = './dist/dts/index.js';

export default [
	{
		input: './src/index.ts',
		output: {
			file: TEMP_BUILD,
			format: 'esm'
		},
		plugins: [
			typescript({
				"declaration": true,
				"declarationMap": true,
				"declarationDir": "dist/dts",
			}),
			{
				name: 'postbuild-commands',
				closeBundle: async () => {
					await postBuildCommands()
				}
			},
		],
		external: [
			'gl-matrix',
			'harmony-3d',
			'harmony-browser-utils',
		],
	},
];

async function postBuildCommands() {
	fs.copyFile(TEMP_BUILD, './dist/index.js', err => { if (err) throw err });
	return new Promise(resolve => child_process.exec(
		'api-extractor run --local --verbose --typescript-compiler-folder ./node_modules/typescript',
		(error, stdout, stderr) => {
			if (error) {
				console.log(error);
			}
			resolve("done")
		},
	));
}
