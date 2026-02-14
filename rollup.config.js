export default {
  input: "./main.mjs",
  output: {
    file: './public/main.mjs',
    format: 'esm',
  },
  external: [
    '/scripts/greensock/esm/all.js'
  ]
};