// What the pre-commit hook (.husky/pre-commit) runs on the files being committed. lint-staged passes each
// command the staged files that match, and adds any fixes back into the commit. Whole-project checks
// (tests, build, e2e) run before a push instead (.husky/pre-push), since they take minutes.
export default {
  // The same files `npm run format` and `npm run lint` cover.
  '{src,cypress}/**/*.{ts,html}': ['prettier --write', 'eslint --fix --max-warnings=0'],
  'scripts/**/*.mts': ['prettier --write', 'eslint --fix --max-warnings=0'],
  'cypress*.config.ts': ['prettier --write', 'eslint --fix --max-warnings=0'],
  'src/**/*.scss': 'prettier --write',
  // The data files are checked together (one file can refer to another), so this one ignores the file
  // list: a function that returns the command stops lint-staged from appending the file names.
  'public/data/*.json': () => 'npm run validate-data',
};
