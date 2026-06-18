// Metro config tuned for this pnpm monorepo. pnpm stores each package's deps in
// the `.pnpm` virtual store and links them via symlinks, so Metro must (a) watch
// the workspace root to follow those links and (b) keep hierarchical node_modules
// lookup ENABLED — disabling it (the npm/yarn-hoisted recipe) breaks resolution
// of nested deps such as @expo/log-box.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
