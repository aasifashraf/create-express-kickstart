import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { createProject, runCli } from "../bin/cli.js";

const silentLogger = {
  log() {},
  warn() {},
  error() {},
};

const tests = [];

const registerTest = (name, fn) => {
  tests.push({ name, fn });
};

const createTempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "cek-"));

const readText = (...segments) => fs.readFileSync(path.join(...segments), "utf8");

const readJson = (...segments) => JSON.parse(readText(...segments));

const collectJsFiles = (dirPath) => {
  const files = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") {
        files.push(...collectJsFiles(entryPath));
      }

      continue;
    }

    if (entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files;
};

const assertSyntaxValid = (projectPath) => {
  for (const jsFile of collectJsFiles(projectPath)) {
    const source = fs
      .readFileSync(jsFile, "utf8")
      .replace(/^import\s.+?;$/gm, "")
      .replace(/^export\s+default\s+/gm, "")
      .replace(/^export\s+\{[^}]+\};?$/gm, "")
      .replace(/^export\s+/gm, "");

    assert.doesNotThrow(() => {
      new vm.Script(source, { filename: jsFile });
    }, `Expected ${jsFile} to parse successfully.`);
  }
};

const assertNoTemplateTokens = (projectPath) => {
  for (const jsFile of collectJsFiles(projectPath)) {
    const contents = fs.readFileSync(jsFile, "utf8");
    assert.equal(
      contents.includes("__"),
      false,
      `Template token leaked into generated file ${jsFile}.`,
    );
  }
};

const makeConfig = (overrides = {}) => {
  const baseDeps = {
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

  return {
    projectName: "sample-app",
    packageJsonName: "sample-app",
    description: "A generated project",
    author: "Codex",
    deps: {
      ...baseDeps,
      ...(overrides.deps || {}),
    },
    installPinoPretty: true,
    packageManager: "npm",
    initGit: false,
    initDocker: true,
    initAuth: true,
    initTests: true,
    ...overrides,
  };
};

registerTest(
  "scaffolds a full project with safe auth, CORS, Docker, and logger defaults",
  () => {
    const tempRoot = createTempRoot();

    try {
      const result = createProject(
        makeConfig({
          projectName: "full-app",
          packageJsonName: "full-app",
        }),
        {
          cwd: tempRoot,
          skipInstall: true,
          skipGit: true,
          logger: silentLogger,
          secretGenerator: () => "unit-test-secret",
        },
      );

      const projectPath = result.projectPath;
      const packageJson = readJson(projectPath, "package.json");
      const envExample = readText(projectPath, ".env.example");
      const envLocal = readText(projectPath, ".env.local");
      const appCode = readText(projectPath, "src", "app.js");
      const dbCode = readText(projectPath, "src", "db", "index.js");
      const dockerfile = readText(projectPath, "Dockerfile");
      const dockerCompose = readText(projectPath, "docker-compose.yml");

      assert.equal(fs.existsSync(path.join(projectPath, "src", "models", "user.model.js")), true);
      assert.equal(fs.existsSync(path.join(projectPath, "tests", "healthcheck.test.js")), true);

      assert.deepEqual(
        Object.keys(packageJson.dependencies).sort(),
        [
          "bcryptjs",
          "cookie-parser",
          "cors",
          "express",
          "express-rate-limit",
          "helmet",
          "jsonwebtoken",
          "mongoose",
          "pino",
          "pino-http",
        ],
      );
      assert.deepEqual(
        Object.keys(packageJson.devDependencies).sort(),
        ["@dotenvx/dotenvx", "jest", "nodemon", "pino-pretty", "prettier", "supertest"],
      );

      assert.match(envExample, /JWT_SECRET=replace-me-with-a-long-random-secret/);
      assert.doesNotMatch(envExample, /JWT_SECRET=unit-test-secret/);
      assert.match(envLocal, /JWT_SECRET=unit-test-secret/);
      assert.match(envLocal, /PINO_PRETTY=true/);

      assert.match(appCode, /const enablePrettyLogs/);
      assert.match(appCode, /credentials: !allowAllOrigins && allowedOrigins.length > 0/);
      assert.match(appCode, /app\.use\("\/api\/v1\/auth", authRouter\);/);
      assert.doesNotMatch(appCode, /import\("pino-pretty"\)/);
      assert.doesNotMatch(dbCode, /DB_NAME/);
      assert.match(dbCode, /mongoose\.connect\(process\.env\.MONGODB_URI\)/);

      assert.match(dockerfile, /FROM node:22-alpine/);
      assert.match(dockerfile, /RUN npm install --omit=dev/);
      assert.match(dockerfile, /EXPOSE 8000/);
      assert.match(dockerCompose, /8000:8000/);
      assert.match(dockerCompose, /mongodb:\/\/mongo:27017\/my_app_db/);

      assertNoTemplateTokens(projectPath);
      assertSyntaxValid(projectPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);

registerTest(
  "scaffolds a minimal project without optional middleware, auth, db, or tests",
  () => {
    const tempRoot = createTempRoot();

    try {
      const result = createProject(
        makeConfig({
          projectName: "minimal-app",
          packageJsonName: "minimal-app",
          deps: {
            mongoose: false,
            cors: false,
            helmet: false,
            "cookie-parser": false,
            "pino-http": false,
            "express-rate-limit": false,
            dotenv: false,
            prettier: false,
          },
          installPinoPretty: false,
          initDocker: false,
          initAuth: false,
          initTests: false,
        }),
        {
          cwd: tempRoot,
          skipInstall: true,
          skipGit: true,
          logger: silentLogger,
        },
      );

      const projectPath = result.projectPath;
      const packageJson = readJson(projectPath, "package.json");
      const appCode = readText(projectPath, "src", "app.js");
      const serverCode = readText(projectPath, "src", "server.js");

      assert.equal(fs.existsSync(path.join(projectPath, "src", "db")), false);
      assert.equal(fs.existsSync(path.join(projectPath, "src", "routes", "auth.routes.js")), false);
      assert.equal(fs.existsSync(path.join(projectPath, "tests")), false);
      assert.equal(fs.existsSync(path.join(projectPath, "Dockerfile")), false);

      assert.deepEqual(Object.keys(packageJson.dependencies), ["express"]);
      assert.deepEqual(Object.keys(packageJson.devDependencies), ["nodemon"]);

      assert.doesNotMatch(appCode, /cors/);
      assert.doesNotMatch(appCode, /cookieParser/);
      assert.doesNotMatch(appCode, /helmet/);
      assert.doesNotMatch(appCode, /pinoHttp/);
      assert.doesNotMatch(appCode, /rateLimit/);
      assert.doesNotMatch(appCode, /authRouter/);
      assert.doesNotMatch(serverCode, /connectDB/);
      assert.match(serverCode, /startServer\(\);/);

      assertNoTemplateTokens(projectPath);
      assertSyntaxValid(projectPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);

registerTest("auth scaffolding automatically enables mongoose when auth is selected", () => {
  const tempRoot = createTempRoot();

  try {
    const result = createProject(
      makeConfig({
        projectName: "auth-app",
        packageJsonName: "auth-app",
        deps: {
          mongoose: false,
        },
        initAuth: true,
        initDocker: false,
        initTests: false,
      }),
      {
        cwd: tempRoot,
        skipInstall: true,
        skipGit: true,
        logger: silentLogger,
        secretGenerator: () => "another-secret",
      },
    );

    assert.equal(result.config.deps.mongoose, true);
    assert.equal(
      result.warnings.some((warning) => warning.includes("enabled automatically")),
      true,
    );
    assert.equal(fs.existsSync(path.join(result.projectPath, "src", "db", "index.js")), true);

    const packageJson = readJson(result.projectPath, "package.json");
    assert.equal(packageJson.dependencies.mongoose, "latest");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

registerTest("renders Dockerfiles for npm, yarn, pnpm, and bun", () => {
  const packageManagers = {
    npm: {
      baseImage: "FROM node:22-alpine",
      installCommand: "RUN npm install --omit=dev",
      runtime: 'CMD [ "node", "src/server.js" ]',
    },
    yarn: {
      baseImage: "FROM node:22-alpine",
      installCommand: "RUN yarn install --production=true",
      runtime: 'CMD [ "node", "src/server.js" ]',
    },
    pnpm: {
      baseImage: "FROM node:22-alpine",
      installCommand: "RUN pnpm install --prod",
      runtime: 'CMD [ "node", "src/server.js" ]',
    },
    bun: {
      baseImage: "FROM oven/bun:1-alpine",
      installCommand: "RUN bun install --production",
      runtime: 'CMD [ "bun", "src/server.js" ]',
    },
  };

  for (const [packageManager, expectations] of Object.entries(packageManagers)) {
    const tempRoot = createTempRoot();

    try {
      const result = createProject(
        makeConfig({
          projectName: `${packageManager}-app`,
          packageJsonName: `${packageManager}-app`,
          packageManager,
          initDocker: true,
          initAuth: false,
          initTests: false,
        }),
        {
          cwd: tempRoot,
          skipInstall: true,
          skipGit: true,
          logger: silentLogger,
        },
      );

      const dockerfile = readText(result.projectPath, "Dockerfile");

      assert.match(dockerfile, new RegExp(expectations.baseImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(
        dockerfile,
        new RegExp(expectations.installCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      assert.match(
        dockerfile,
        new RegExp(expectations.runtime.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      assert.equal(dockerfile.includes("__"), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
});

registerTest("pins installed dependency versions after a successful install", () => {
  const tempRoot = createTempRoot();

  try {
    const versions = {
      express: "4.21.2",
      nodemon: "3.1.9",
    };
    const commands = [];

    const runCommand = (command, options) => {
      commands.push(command);

      if (!command.includes("install")) {
        return;
      }

      const packageJson = readJson(options.cwd, "package.json");
      const allDependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };

      for (const dependencyName of Object.keys(allDependencies)) {
        const dependencyDir = path.join(options.cwd, "node_modules", dependencyName);
        fs.mkdirSync(dependencyDir, { recursive: true });
        fs.writeFileSync(
          path.join(dependencyDir, "package.json"),
          JSON.stringify({
            name: dependencyName,
            version: versions[dependencyName] || "1.0.0",
          }),
        );
      }
    };

    const result = createProject(
      makeConfig({
        projectName: "versioned-app",
        packageJsonName: "versioned-app",
        deps: {
          mongoose: false,
          cors: false,
          helmet: false,
          "cookie-parser": false,
          "pino-http": false,
          "express-rate-limit": false,
          dotenv: false,
          prettier: false,
        },
        installPinoPretty: false,
        initDocker: false,
        initAuth: false,
        initTests: false,
      }),
      {
        cwd: tempRoot,
        logger: silentLogger,
        runCommand,
        skipGit: true,
      },
    );

    const packageJson = readJson(result.projectPath, "package.json");

    assert.equal(result.installSucceeded, true);
    assert.deepEqual(commands, ["npm install"]);
    assert.equal(packageJson.dependencies.express, "^4.21.2");
    assert.equal(packageJson.devDependencies.nodemon, "^3.1.9");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

registerTest("continues scaffolding even if the initial git commit fails", () => {
  const tempRoot = createTempRoot();

  try {
    const commands = [];
    const runCommand = (command) => {
      commands.push(command);

      if (command.startsWith('git commit -m "initial commit"')) {
        throw new Error("git identity missing");
      }
    };

    const result = createProject(
      makeConfig({
        projectName: "git-app",
        packageJsonName: "git-app",
        deps: {
          mongoose: false,
          cors: false,
          helmet: false,
          "cookie-parser": false,
          "pino-http": false,
          "express-rate-limit": false,
          dotenv: false,
          prettier: false,
        },
        installPinoPretty: false,
        initDocker: false,
        initAuth: false,
        initTests: false,
        initGit: true,
      }),
      {
        cwd: tempRoot,
        logger: silentLogger,
        runCommand,
        skipInstall: true,
      },
    );

    assert.equal(result.gitInitialized, false);
    assert.equal(
      result.warnings.some((warning) => warning.includes("Git initialization completed partially")),
      true,
    );
    assert.deepEqual(commands, ["git init", "git add .", 'git commit -m "initial commit"']);
    assert.equal(fs.existsSync(path.join(result.projectPath, ".gitignore")), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

registerTest("supports the interactive CLI path end to end without spawning a subprocess", async () => {
  const tempRoot = createTempRoot();
  const logs = [];
  const answers = [
    "",
    "Smoke test app",
    "Tester",
    "n",
    "n",
    "n",
    "n",
    "n",
    "n",
    "n",
    "n",
    "",
    "n",
    "n",
    "n",
    "n",
  ];
  const questioner = {
    ask() {
      const answer = answers.shift();
      if (answer === undefined) {
        throw new Error("Questioner ran out of canned answers.");
      }

      return Promise.resolve(answer);
    },
    close() {},
  };

  const logger = {
    log(message) {
      logs.push(message);
    },
    warn(message) {
      logs.push(message);
    },
    error(message) {
      logs.push(message);
    },
  };

  const previousSkipInstall = process.env.CREATE_EXPRESS_KICKSTART_SKIP_INSTALL;
  const previousSkipGit = process.env.CREATE_EXPRESS_KICKSTART_SKIP_GIT;

  process.env.CREATE_EXPRESS_KICKSTART_SKIP_INSTALL = "1";
  process.env.CREATE_EXPRESS_KICKSTART_SKIP_GIT = "1";

  try {
    await runCli({
      argv: ["node", "bin/cli.js", "smoke-app"],
      cwd: tempRoot,
      logger,
      questioner,
    });

    assert.equal(fs.existsSync(path.join(tempRoot, "smoke-app", "package.json")), true);
    assert.equal(logs.join("\n").includes('Success! Created "smoke-app"'), true);
  } finally {
    if (previousSkipInstall === undefined) {
      delete process.env.CREATE_EXPRESS_KICKSTART_SKIP_INSTALL;
    } else {
      process.env.CREATE_EXPRESS_KICKSTART_SKIP_INSTALL = previousSkipInstall;
    }

    if (previousSkipGit === undefined) {
      delete process.env.CREATE_EXPRESS_KICKSTART_SKIP_GIT;
    } else {
      process.env.CREATE_EXPRESS_KICKSTART_SKIP_GIT = previousSkipGit;
    }

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

let passed = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

console.log(`\n${passed}/${tests.length} tests passed`);

if (process.exitCode) {
  process.exit(process.exitCode);
}

