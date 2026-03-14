#!/usr/bin/env node

import { execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_PORT = 8000;
const DEFAULT_PACKAGE_MANAGER = "npm";
const AUTH_SECRET_PLACEHOLDER = "replace-me-with-a-long-random-secret";
const SUPPORTED_PACKAGE_MANAGERS = new Set(["npm", "yarn", "pnpm", "bun"]);
const ENV_SKIP_INSTALL = "CREATE_EXPRESS_KICKSTART_SKIP_INSTALL";
const ENV_SKIP_GIT = "CREATE_EXPRESS_KICKSTART_SKIP_GIT";

const DEFAULT_DEPENDENCIES = {
  express: true,
  mongoose: true,
  cors: true,
  helmet: true,
  "cookie-parser": true,
  "pino-http": true,
  "express-rate-limit": true,
  dotenv: true,
  prettier: true,
};

const GITIGNORE_CONTENT = `node_modules
.env
.env.keys
.env.local
dist
build
coverage
`;

const HASH_UTIL_TEMPLATE = `import bcrypt from "bcryptjs";

export const hashData = async (data, saltRounds = process.env.BCRYPT_SALT_ROUNDS) => {
    const salt = await bcrypt.genSalt(Number(saltRounds) || 10);
    return bcrypt.hash(data, salt);
};

export const compareData = async (data, hashedData) => {
    return bcrypt.compare(data, hashedData);
};
`;

const JWT_UTIL_TEMPLATE = `import jwt from "jsonwebtoken";

const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET must be set before using JWT helpers.");
    }

    return process.env.JWT_SECRET;
};

export const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || "1d") => {
    return jwt.sign(payload, getJwtSecret(), { expiresIn });
};

export const verifyToken = (token) => {
    return jwt.verify(token, getJwtSecret());
};
`;

const DOCKER_TEMPLATE_MAP = {
  npm: {
    baseImage: "node:22-alpine",
    packageManagerSetup: "",
    installCommand: "npm install --omit=dev",
    runtime: "node",
  },
  yarn: {
    baseImage: "node:22-alpine",
    packageManagerSetup: "RUN corepack enable",
    installCommand: "yarn install --production=true",
    runtime: "node",
  },
  pnpm: {
    baseImage: "node:22-alpine",
    packageManagerSetup: "RUN corepack enable",
    installCommand: "pnpm install --prod",
    runtime: "node",
  },
  bun: {
    baseImage: "oven/bun:1-alpine",
    packageManagerSetup: "",
    installCommand: "bun install --production",
    runtime: "bun",
  },
};

const parseYesNo = (answer) => answer.trim().toLowerCase() !== "n";

export const normalizePackageManager = (value) => {
  const normalized = value.trim().toLowerCase();
  return SUPPORTED_PACKAGE_MANAGERS.has(normalized)
    ? normalized
    : DEFAULT_PACKAGE_MANAGER;
};

const unique = (items) => [...new Set(items)];

const createSecret = () => crypto.randomBytes(32).toString("hex");

const copyRecursiveSync = (src, dest) => {
  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });

    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }

    return;
  }

  fs.copyFileSync(src, dest);
};

const renderTemplate = (template, replacements) => {
  let output = template;

  for (const [token, value] of Object.entries(replacements)) {
    output = output.replaceAll(token, value);
  }

  return output
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
};

const readTemplate = (...segments) =>
  fs.readFileSync(path.join(ROOT_DIR, ...segments), "utf8");

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const appendBlock = (filePath, block) => {
  const currentValue = fs.readFileSync(filePath, "utf8").trimEnd();
  fs.writeFileSync(filePath, `${currentValue}\n\n${block.trim()}\n`);
};

const createPackageJsonTemplate = (config) => {
  const packageJsonTemplate = {
    name: config.packageJsonName.trim(),
    version: "1.0.0",
    description: config.description || "A configurable Node.js Express API starter",
    main: "src/server.js",
    type: "module",
    scripts: {
      start: config.deps.dotenv
        ? "dotenvx run -f .env.local -- node src/server.js"
        : "node src/server.js",
      dev: config.deps.dotenv
        ? "dotenvx run -f .env.local -- nodemon src/server.js"
        : "nodemon src/server.js",
    },
    imports: {
      "#*": "./src/*",
    },
    keywords: ["express", "node", "api"],
    author: config.author || "",
    license: "ISC",
  };

  if (config.deps.prettier) {
    packageJsonTemplate.scripts.format = 'prettier --write "src/**/*.{js,json}"';
  }

  if (config.initTests) {
    packageJsonTemplate.scripts.test =
      "node --experimental-vm-modules node_modules/jest/bin/jest.js";
  }

  return packageJsonTemplate;
};

const resolveDependencyLists = (config) => {
  const dependencyCandidates = Object.entries(config.deps)
    .filter(([dependencyName, enabled]) => {
      return enabled && dependencyName !== "dotenv" && dependencyName !== "prettier";
    })
    .map(([dependencyName]) => dependencyName);

  const dependencies = unique([
    ...dependencyCandidates,
    ...(config.deps["pino-http"] ? ["pino"] : []),
    ...(config.initAuth ? ["jsonwebtoken", "bcryptjs"] : []),
  ]);

  const devDependencies = unique([
    "nodemon",
    ...(config.deps.dotenv ? ["@dotenvx/dotenvx"] : []),
    ...(config.deps.prettier ? ["prettier"] : []),
    ...(config.installPinoPretty && config.deps["pino-http"] ? ["pino-pretty"] : []),
    ...(config.initTests ? ["jest", "supertest"] : []),
  ]);

  return { dependencies, devDependencies };
};

const updatePackageJsonDependencies = (projectPath, dependencies, devDependencies) => {
  const packageJsonPath = path.join(projectPath, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  packageJson.dependencies = Object.fromEntries(
    dependencies.map((dependencyName) => [dependencyName, "latest"]),
  );
  packageJson.devDependencies = Object.fromEntries(
    devDependencies.map((dependencyName) => [dependencyName, "latest"]),
  );

  writeJson(packageJsonPath, packageJson);
};

const updatePackageJsonWithInstalledVersions = (projectPath, dependencies, devDependencies) => {
  const packageJsonPath = path.join(projectPath, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  const getInstalledVersion = (dependencyName) => {
    try {
      const dependencyPackageJson = JSON.parse(
        fs.readFileSync(
          path.join(projectPath, "node_modules", dependencyName, "package.json"),
          "utf8",
        ),
      );

      return `^${dependencyPackageJson.version}`;
    } catch {
      return "latest";
    }
  };

  for (const dependencyName of dependencies) {
    packageJson.dependencies[dependencyName] = getInstalledVersion(dependencyName);
  }

  for (const dependencyName of devDependencies) {
    packageJson.devDependencies[dependencyName] = getInstalledVersion(dependencyName);
  }

  writeJson(packageJsonPath, packageJson);
};

const buildDockerfile = (packageManager) => {
  const dockerTemplate = readTemplate("templates", "Dockerfile");
  const dockerOptions = DOCKER_TEMPLATE_MAP[packageManager] || DOCKER_TEMPLATE_MAP.npm;

  return renderTemplate(dockerTemplate, {
    "__BASE_IMAGE__": dockerOptions.baseImage,
    "__PACKAGE_MANAGER_SETUP__": dockerOptions.packageManagerSetup,
    "__INSTALL_COMMAND__": dockerOptions.installCommand,
    "__PORT__": String(DEFAULT_PORT),
    "__RUNTIME__": dockerOptions.runtime,
  });
};

const buildDockerCompose = () => {
  const dockerComposeTemplate = readTemplate("templates", "docker-compose.yml");

  return renderTemplate(dockerComposeTemplate, {
    "__PORT__": String(DEFAULT_PORT),
    "__MONGODB_URI__": "mongodb://mongo:27017/my_app_db",
    "__CORS_ORIGIN__": "http://localhost:3000",
  });
};

const buildAppCode = (config) => {
  const appTemplate = readTemplate("src", "app.js");

  return renderTemplate(appTemplate, {
    "__CORS_IMPORT__": config.deps.cors ? 'import cors from "cors";' : "",
    "__COOKIE_PARSER_IMPORT__": config.deps["cookie-parser"]
      ? 'import cookieParser from "cookie-parser";'
      : "",
    "__HELMET_IMPORT__": config.deps.helmet ? 'import helmet from "helmet";' : "",
    "__LOGGER_IMPORT__": config.deps["pino-http"] ? 'import pinoHttp from "pino-http";' : "",
    "__RATE_LIMIT_IMPORT__": config.deps["express-rate-limit"]
      ? 'import rateLimit from "express-rate-limit";'
      : "",
    "__AUTH_IMPORT__": config.initAuth ? 'import authRouter from "#routes/auth.routes.js";' : "",
    "__HELMET_SETUP__": config.deps.helmet ? "app.use(helmet());" : "",
    "__RATE_LIMIT_SETUP__": config.deps["express-rate-limit"]
      ? `const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again later",
});

app.use("/api", limiter);`
      : "",
    "__LOGGER_SETUP__": config.deps["pino-http"]
      ? `const enablePrettyLogs =
    process.env.NODE_ENV === "development" && process.env.PINO_PRETTY === "true";

app.use(
    pinoHttp({
        customLogLevel(req, res, err) {
            if (res.statusCode >= 500 || err) {
                return "error";
            }

            if (res.statusCode >= 400) {
                return "warn";
            }

            if (res.statusCode >= 300) {
                return "silent";
            }

            return "info";
        },
        transport: enablePrettyLogs
            ? {
                  target: "pino-pretty",
                  options: { colorize: true },
              }
            : undefined,
    }),
);`
      : "",
    "__CORS_SETUP__": config.deps.cors
      ? `const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes("*");

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    throw new Error("CORS_ORIGIN must list one or more allowed origins in production.");
}

app.use(
    cors({
        origin: allowAllOrigins
            ? true
            : allowedOrigins.length > 0
              ? allowedOrigins
              : true,
        credentials: !allowAllOrigins && allowedOrigins.length > 0,
    }),
);`
      : "",
    "__COOKIE_PARSER_SETUP__": config.deps["cookie-parser"] ? "app.use(cookieParser());" : "",
    "__AUTH_ROUTE__": config.initAuth ? 'app.use("/api/v1/auth", authRouter);' : "",
  });
};

const buildServerCode = (config) => {
  const serverTemplate = readTemplate("src", "server.js");

  return renderTemplate(serverTemplate, {
    "__DB_IMPORT__": config.deps.mongoose ? 'import connectDB from "#db/index.js";' : "",
    "__SERVER_STARTUP__": config.deps.mongoose
      ? `const bootstrap = async () => {
    await connectDB();
    startServer();
};

bootstrap().catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
});`
      : "startServer();",
  });
};

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeAuthUtilities = (projectPath) => {
  const utilsPath = path.join(projectPath, "src", "utils");
  ensureDir(utilsPath);

  fs.writeFileSync(path.join(utilsPath, "hash.util.js"), HASH_UTIL_TEMPLATE);
  fs.writeFileSync(path.join(utilsPath, "jwt.util.js"), JWT_UTIL_TEMPLATE);
};

const writeAuthFiles = (projectPath) => {
  ensureDir(path.join(projectPath, "src", "controllers"));
  ensureDir(path.join(projectPath, "src", "middlewares"));
  ensureDir(path.join(projectPath, "src", "routes"));
  ensureDir(path.join(projectPath, "src", "models"));

  fs.copyFileSync(
    path.join(ROOT_DIR, "templates", "auth", "auth.controller.js"),
    path.join(projectPath, "src", "controllers", "auth.controller.js"),
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, "templates", "auth", "auth.middleware.js"),
    path.join(projectPath, "src", "middlewares", "auth.middleware.js"),
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, "templates", "auth", "auth.routes.js"),
    path.join(projectPath, "src", "routes", "auth.routes.js"),
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, "templates", "auth", "user.model.js"),
    path.join(projectPath, "src", "models", "user.model.js"),
  );
};

const addAuthEnvironment = (projectPath, secretGenerator) => {
  appendBlock(
    path.join(projectPath, ".env.example"),
    `# Bcrypt Configuration
BCRYPT_SALT_ROUNDS=10

# JWT Configuration
JWT_SECRET=${AUTH_SECRET_PLACEHOLDER}
JWT_EXPIRES_IN=1d`,
  );

  appendBlock(
    path.join(projectPath, ".env.local"),
    `# Bcrypt Configuration
BCRYPT_SALT_ROUNDS=10

# JWT Configuration
JWT_SECRET=${secretGenerator()}
JWT_EXPIRES_IN=1d`,
  );
};

const addPinoPrettyEnvironment = (projectPath) => {
  appendBlock(path.join(projectPath, ".env.example"), "PINO_PRETTY=true");
  appendBlock(path.join(projectPath, ".env.local"), "PINO_PRETTY=true");
};

const initializeGitRepository = ({ projectPath, runCommand, logger, skipGit }) => {
  fs.writeFileSync(path.join(projectPath, ".gitignore"), GITIGNORE_CONTENT);

  if (skipGit) {
    logger.log(` Skipping git initialization because ${ENV_SKIP_GIT}=1.`);
    return {
      gitInitialized: false,
      warnings: ["Git initialization was skipped by environment override."],
    };
  }

  const warnings = [];

  try {
    runCommand("git init", { cwd: projectPath, stdio: "inherit" });
    runCommand("git add .", { cwd: projectPath, stdio: "inherit" });
    runCommand('git commit -m "initial commit"', {
      cwd: projectPath,
      stdio: "inherit",
    });

    return { gitInitialized: true, warnings };
  } catch (error) {
    warnings.push(
      "Git initialization completed partially. Review git configuration before committing.",
    );
    logger.warn("\nGit setup could not finish cleanly. The project files are still ready to use.");

    return { gitInitialized: false, warnings, error };
  }
};

const installDependencies = ({
  projectPath,
  packageManager,
  dependencies,
  devDependencies,
  runCommand,
  logger,
  skipInstall,
}) => {
  updatePackageJsonDependencies(projectPath, dependencies, devDependencies);

  if (skipInstall) {
    logger.log(`\n Skipping dependency installation because ${ENV_SKIP_INSTALL}=1.`);
    return {
      installSucceeded: false,
      warnings: ["Dependency installation was skipped by environment override."],
    };
  }

  try {
    logger.log(`\n Configuring ${packageManager} and resolving dependency trees...`);
    logger.log(`\n Running final installation via ${packageManager} (this might take a minute)...`);

    const installCommand =
      packageManager === "npm" ? "npm install" : `${packageManager} install`;

    runCommand(installCommand, { cwd: projectPath, stdio: "inherit" });
    updatePackageJsonWithInstalledVersions(projectPath, dependencies, devDependencies);

    return { installSucceeded: true, warnings: [] };
  } catch (error) {
    logger.warn(
      "\nDependency installation did not complete. You can still open the project and run the install manually.",
    );

    return {
      installSucceeded: false,
      warnings: [
        "Dependency installation failed. Run the package manager manually inside the project.",
      ],
      error,
    };
  }
};

export const createProject = (rawConfig, runtime = {}) => {
  const logger = runtime.logger || console;
  const cwd = runtime.cwd || process.cwd();
  const runCommand = runtime.runCommand || execSync;
  const secretGenerator = runtime.secretGenerator || createSecret;
  const skipInstall = runtime.skipInstall ?? process.env[ENV_SKIP_INSTALL] === "1";
  const skipGit = runtime.skipGit ?? process.env[ENV_SKIP_GIT] === "1";

  const config = {
    ...rawConfig,
    projectName: rawConfig.projectName?.trim(),
    packageJsonName: rawConfig.packageJsonName?.trim() || rawConfig.projectName?.trim(),
    packageManager: normalizePackageManager(
      rawConfig.packageManager || DEFAULT_PACKAGE_MANAGER,
    ),
    deps: {
      ...DEFAULT_DEPENDENCIES,
      ...rawConfig.deps,
      express: true,
    },
  };

  if (!config.projectName) {
    throw new Error("Project directory name is required.");
  }

  if (!config.packageJsonName) {
    throw new Error("package.json name is required.");
  }

  const warnings = [];
  const projectPath = path.join(cwd, config.projectName);

  if (fs.existsSync(projectPath)) {
    throw new Error(
      `Folder ${config.projectName} already exists. Please choose a different directory name.`,
    );
  }

  if (config.initAuth && !config.deps.mongoose) {
    config.deps.mongoose = true;
    const authWarning =
      "JWT auth boilerplate requires Mongoose in this starter, so MongoDB support was enabled automatically.";
    warnings.push(authWarning);
    logger.log(`\n ${authWarning}`);
  }

  logger.log(`\n Creating a new Node.js Express API in ${projectPath}...`);
  fs.mkdirSync(projectPath, { recursive: true });

  const sourceDir = path.join(ROOT_DIR, "src");
  const targetSrcDir = path.join(projectPath, "src");

  if (!fs.existsSync(sourceDir)) {
    throw new Error('Could not find "src" directory in the template generator.');
  }

  logger.log(" Bootstrapping application structure...");
  copyRecursiveSync(sourceDir, targetSrcDir);

  logger.log(" Generating environment files...");
  const envExamplePath = path.join(ROOT_DIR, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, path.join(projectPath, ".env.example"));
    fs.copyFileSync(envExamplePath, path.join(projectPath, ".env.local"));
  }

  fs.writeFileSync(path.join(targetSrcDir, "app.js"), buildAppCode(config));
  fs.writeFileSync(path.join(targetSrcDir, "server.js"), buildServerCode(config));

  if (!config.deps.mongoose) {
    const dbDir = path.join(targetSrcDir, "db");
    if (fs.existsSync(dbDir)) {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
  }

  if (config.initDocker) {
    logger.log(" Adding Docker files...");
    fs.writeFileSync(path.join(projectPath, "Dockerfile"), buildDockerfile(config.packageManager));
    fs.copyFileSync(
      path.join(ROOT_DIR, "templates", ".dockerignore"),
      path.join(projectPath, ".dockerignore"),
    );

    if (config.deps.mongoose) {
      fs.writeFileSync(path.join(projectPath, "docker-compose.yml"), buildDockerCompose());
    }
  }

  if (config.initAuth) {
    logger.log(" Adding auth templates...");
    writeAuthFiles(projectPath);
    writeAuthUtilities(projectPath);
    addAuthEnvironment(projectPath, secretGenerator);
  }

  if (config.installPinoPretty && config.deps["pino-http"]) {
    addPinoPrettyEnvironment(projectPath);
  }

  if (config.initTests) {
    logger.log(" Adding Jest test templates...");
    ensureDir(path.join(projectPath, "tests"));
    fs.copyFileSync(
      path.join(ROOT_DIR, "templates", "tests", "healthcheck.test.js"),
      path.join(projectPath, "tests", "healthcheck.test.js"),
    );
  }

  logger.log(" Setting up package.json...");
  writeJson(path.join(projectPath, "package.json"), createPackageJsonTemplate(config));

  const { dependencies, devDependencies } = resolveDependencyLists(config);
  const installResult = installDependencies({
    projectPath,
    packageManager: config.packageManager,
    dependencies,
    devDependencies,
    runCommand,
    logger,
    skipInstall,
  });
  warnings.push(...installResult.warnings);

  let gitResult = { gitInitialized: false, warnings: [] };
  if (config.initGit) {
    logger.log("\n Initializing Git repository...");
    gitResult = initializeGitRepository({
      projectPath,
      runCommand,
      logger,
      skipGit,
    });
    warnings.push(...gitResult.warnings);
  }

  return {
    projectPath,
    config,
    dependencies,
    devDependencies,
    installSucceeded: installResult.installSucceeded,
    gitInitialized: gitResult.gitInitialized,
    warnings,
  };
};

const createQuestioner = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    ask(prompt) {
      return new Promise((resolve) => rl.question(prompt, resolve));
    },
    close() {
      rl.close();
    },
  };
};

export const runCli = async ({
  argv = process.argv,
  cwd = process.cwd(),
  logger = console,
  questioner = createQuestioner(),
} = {}) => {

  try {
    let projectName = argv[2];
    if (!projectName) {
      projectName = await questioner.ask("\n> Project Directory Name (e.g. my-awesome-api): ");
    }

    if (!projectName?.trim()) {
      throw new Error("Project directory name is required.");
    }

    let packageJsonName = await questioner.ask(`> package.json name (${projectName}): `);
    if (!packageJsonName.trim()) {
      packageJsonName = projectName;
    }

    const description = await questioner.ask("> Project description: ");
    const author = await questioner.ask("> Author name: ");

    logger.log("\n--- Select Dependencies ---");
    logger.log('Press Enter for Yes (Y), type "n" for No.\n');

    const deps = {
      express: true,
      mongoose: parseYesNo(await questioner.ask("Include Mongoose (MongoDB)? [Y/n] ")),
      cors: parseYesNo(await questioner.ask("Include CORS? [Y/n] ")),
      helmet: parseYesNo(await questioner.ask("Include Helmet (Security headers)? [Y/n] ")),
      "cookie-parser": parseYesNo(await questioner.ask("Include cookie-parser? [Y/n] ")),
      "pino-http": parseYesNo(await questioner.ask("Include Pino (HTTP Logger)? [Y/n] ")),
      "express-rate-limit": parseYesNo(
        await questioner.ask("Include Rate Limiting? [Y/n] "),
      ),
      dotenv: parseYesNo(await questioner.ask("Include dotenvx (Environment variables)? [Y/n] ")),
      prettier: parseYesNo(await questioner.ask("Include Prettier (Code formatter)? [Y/n] ")),
    };

    let installPinoPretty = false;
    if (deps["pino-http"]) {
      installPinoPretty = parseYesNo(
        await questioner.ask("Include pino-pretty for clean development logs? [Y/n] "),
      );
    }

    const packageManagerChoice = await questioner.ask(
      "\n> Which package manager would you like to use? [npm/yarn/pnpm/bun] (default: npm): ",
    );
    const packageManager = normalizePackageManager(packageManagerChoice);

    const initGit = parseYesNo(await questioner.ask("\n> Initialize a git repository? [Y/n] "));
    const initDocker = parseYesNo(
      await questioner.ask("> Include Dockerfile & docker-compose.yml? [Y/n] "),
    );
    const initAuth = parseYesNo(
      await questioner.ask("> Include basic JWT Auth boilerplate? [Y/n] "),
    );
    const initTests = parseYesNo(
      await questioner.ask("> Include Jest setup and boilerplate tests? [Y/n] "),
    );

    const result = createProject(
      {
        projectName,
        packageJsonName,
        description,
        author,
        deps,
        installPinoPretty,
        packageManager,
        initGit,
        initDocker,
        initAuth,
        initTests,
      },
      { cwd, logger },
    );

    logger.log(`\n Success! Created "${projectName}" at ${result.projectPath}`);

    if (result.warnings.length > 0) {
      logger.log("\nNotes:");
      for (const warning of result.warnings) {
        logger.log(`- ${warning}`);
      }
    }

    const devCommand =
      result.config.packageManager === "npm"
        ? "npm run dev"
        : `${result.config.packageManager} dev`;
    const startCommand =
      result.config.packageManager === "npm"
        ? "npm start"
        : `${result.config.packageManager} start`;

    logger.log("\nInside that directory, you can run:");
    logger.log(`\n  ${devCommand}`);
    logger.log("    Starts the development server.");
    logger.log(`\n  ${startCommand}`);
    logger.log("    Starts the production server.");
    logger.log("\nWe suggest that you begin with:");
    logger.log(`\n  cd ${projectName}`);
    logger.log(`  ${devCommand}\n`);
  } finally {
    questioner.close();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
