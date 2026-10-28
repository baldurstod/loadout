import image from '@rollup/plugin-image';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import child_process from 'child_process';
import fs from 'fs';

const TEMP_BUILD = './dist/dts/index.js';

export default [
	{
		input: './src/index.ts',
		output: {
			file: TEMP_BUILD,
			format: 'esm'
		},
		plugins: [
			image(),
			json({
				compact: true,
			}),
			typescript({
				"declaration": true,
				"declarationMap": true,
				"declarationDir": "dist/dts",
			}),
			nodeResolve({
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
