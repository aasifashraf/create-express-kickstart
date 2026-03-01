#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function init() {
  const projectNameArg = process.argv[2];
  
  let projectName = projectNameArg;
  if (!projectName) {
    projectName = await question('\n> Project Directory Name (e.g. my-awesome-api): ');
  }
  
  if (!projectName) {
    console.error('\nError: Project Directory Name is required.');
    process.exit(1);
  }

  const currentPath = process.cwd();
  const projectPath = path.join(currentPath, projectName);

  if (fs.existsSync(projectPath)) {
    console.error(`\nError: Folder ${projectName} already exists. Please choose a different directory name.\n`);
    process.exit(1);
  }

  let packageJsonName = await question(`> package.json name (${projectName}): `);
  if (!packageJsonName.trim()) {
    packageJsonName = projectName; // Fallback to directory name
  }

  const description = await question('> Project description: ');
  const author = await question('> Author name: ');

  console.log('\n---  Select Dependencies ---');
  console.log('Press Enter for Yes (Y), type "n" for No.\n');

  const deps = {
    express: true, // Always required
    mongoose: (await question('Include Mongoose (MongoDB)? [Y/n] ')).toLowerCase() !== 'n',
    cors: (await question('Include CORS? [Y/n] ')).toLowerCase() !== 'n',
    helmet: (await question('Include Helmet (Security headers)? [Y/n] ')).toLowerCase() !== 'n',
    'cookie-parser': (await question('Include cookie-parser? [Y/n] ')).toLowerCase() !== 'n',
    'pino-http': (await question('Include Pino (HTTP Logger)? [Y/n] ')).toLowerCase() !== 'n',
    'express-rate-limit': (await question('Include Rate Limiting? [Y/n] ')).toLowerCase() !== 'n',
    dotenv: (await question('Include dotenv (Environment variables)? [Y/n] ')).toLowerCase() !== 'n',
    prettier: (await question('Include Prettier (Code formatter)? [Y/n] ')).toLowerCase() !== 'n'
  };

  let installPinoPretty = false;
  if (deps['pino-http']) {
    installPinoPretty = (await question('Include pino-pretty for clean development logs? [Y/n] ')).toLowerCase() !== 'n';
  }

  const packageManagerChoice = await question('\n> Which package manager would you like to use? [npm/yarn/pnpm/bun] (default: npm): ');
  const packageManager = ['yarn', 'pnpm', 'bun'].includes(packageManagerChoice.trim().toLowerCase()) 
    ? packageManagerChoice.trim().toLowerCase() 
    : 'npm';
    
  const initGit = (await question('\n> Initialize a git repository? [Y/n] ')).toLowerCase() !== 'n';
  const initDocker = (await question('> Include Dockerfile & docker-compose.yml? [Y/n] ')).toLowerCase() !== 'n';
  const initAuth = (await question('> Include basic JWT Auth boilerplate? [Y/n] ')).toLowerCase() !== 'n';
  const initTests = (await question('> Include Jest setup and boilerplate tests? [Y/n] ')).toLowerCase() !== 'n';

  rl.close();

  console.log(`\n Creating a new Node.js Express API in ${projectPath}...`);
  fs.mkdirSync(projectPath, { recursive: true });

  function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach((childItemName) => {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  // 1. Copy src directory
  const sourceDir = path.join(__dirname, '..', 'src');
  const targetSrcDir = path.join(projectPath, 'src');

  if (!fs.existsSync(sourceDir)) {
    console.error('\nError: Could not find "src" directory in the template generator.');
    process.exit(1);
  }

  console.log(` Bootstrapping application structure (errorHandler, ApiResponse, async handlers)...`);
  copyRecursiveSync(sourceDir, targetSrcDir);

  // 2. Copy .env.example
  console.log(` Generating environment files...`);
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, path.join(projectPath, '.env.example'));
    fs.copyFileSync(envExamplePath, path.join(projectPath, '.env')); 
  }

  if (initDocker) {
    console.log(` Adding Docker files...`);
    const dockerfilePath = path.join(__dirname, '..', 'templates', 'Dockerfile');
    const dockerComposePath = path.join(__dirname, '..', 'templates', 'docker-compose.yml');
    
    // Fallbacks if templates aren't bundled right
    if (fs.existsSync(dockerfilePath)) fs.copyFileSync(dockerfilePath, path.join(projectPath, 'Dockerfile'));
    if (fs.existsSync(dockerComposePath) && deps.mongoose) {
      fs.copyFileSync(dockerComposePath, path.join(projectPath, 'docker-compose.yml'));
    }
  }

  if (initAuth) {
    console.log(` Adding Auth templates...`);
    // Need to ensure directories exist
    fs.mkdirSync(path.join(projectPath, 'src', 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'src', 'middlewares'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'src', 'routes'), { recursive: true });
    
    // Copy the templates
    fs.copyFileSync(
      path.join(__dirname, '..', 'templates', 'auth', 'auth.controller.js'),
      path.join(projectPath, 'src', 'controllers', 'auth.controller.js')
    );
    fs.copyFileSync(
      path.join(__dirname, '..', 'templates', 'auth', 'auth.middleware.js'),
      path.join(projectPath, 'src', 'middlewares', 'auth.middleware.js')
    );
    fs.copyFileSync(
      path.join(__dirname, '..', 'templates', 'auth', 'auth.routes.js'),
      path.join(projectPath, 'src', 'routes', 'auth.routes.js')
    );
    
    // Append JWT secret and Salt Rounds to env example
    fs.appendFileSync(path.join(projectPath, '.env.example'), '\nJWT_SECRET=supersecretjwtkey123\nBCRYPT_SALT=10\n');
    fs.appendFileSync(path.join(projectPath, '.env'), '\nJWT_SECRET=supersecretjwtkey123\nBCRYPT_SALT=10\n');

    const utilsPath = path.join(projectPath, 'src', 'utils');
    if (!fs.existsSync(utilsPath)) {
      fs.mkdirSync(utilsPath, { recursive: true });
    }
    fs.writeFileSync(
      path.join(utilsPath, 'hash.util.js'),
`import bcrypt from "bcryptjs";

export const hashData = async (data, saltRounds = process.env.BCRYPT_SALT) => {
    const salt = await bcrypt.genSalt(Number(saltRounds) || 10);
    return await bcrypt.hash(data, salt);
};

export const compareData = async (data, hashedData) => {
    return await bcrypt.compare(data, hashedData);
};
`
    );

  }

  if (initTests) {
    console.log(` Adding Jest test templates...`);
    fs.mkdirSync(path.join(projectPath, 'tests'), { recursive: true });
    fs.copyFileSync(
      path.join(__dirname, '..', 'templates', 'tests', 'healthcheck.test.js'),
      path.join(projectPath, 'tests', 'healthcheck.test.js')
    );
  }

  // Rewrite app.js and server.js based on selections
  let appJsPath = path.join(projectPath, 'src', 'app.js');
  if (fs.existsSync(appJsPath)) {
    let appJsCode = fs.readFileSync(appJsPath, 'utf8');

    if (initAuth) {
      appJsCode = appJsCode.replace(
        '// Import routers',
        '// Import routers\nimport authRouter from "#routes/auth.routes.js";'
      );
      appJsCode = appJsCode.replace(
        '// Mount routers',
        '// Mount routers\napp.use("/api/v1/auth", authRouter);'
      );
    }
    if (!deps.cors) {
      appJsCode = appJsCode.replace(/import cors from "cors";\r?\n/, '');
      appJsCode = appJsCode.replace(/\/\/ CORS setup[\s\S]*?\n\);\r?\n/, '');
    }
    if (!deps.helmet) {
      appJsCode = appJsCode.replace(/import helmet from "helmet";\r?\n/, '');
      appJsCode = appJsCode.replace(/\/\/ Security HTTP headers\r?\napp\.use\(helmet\(\)\);\r?\n/, '');
    }
    if (!deps['cookie-parser']) {
      appJsCode = appJsCode.replace(/import cookieParser from "cookie-parser";\r?\n/, '');
      appJsCode = appJsCode.replace(/app\.use\(cookieParser\(\)\);\r?\n/, '');
    }
    if (!deps['pino-http']) {
      appJsCode = appJsCode.replace(/import pinoHttp from "pino-http";\r?\n/, '');
      appJsCode = appJsCode.replace(/\/\/ Logging[\s\S]*?\}\)\(\) \? : undefined\n\}\)\);\r?\n/g, ''); // Fallback block 
      appJsCode = appJsCode.replace(/\/\/ Logging[\s\S]*?\}\)\(\) : undefined\r?\n\}\)\);\r?\n/g, '');
    }
    if (!deps['express-rate-limit']) {
      appJsCode = appJsCode.replace(/import rateLimit from "express-rate-limit";\r?\n/, '');
      appJsCode = appJsCode.replace(/\/\/ Rate Limiting[\s\S]*?app\.use\("\/api", limiter\);[^\n]*\n/g, '');
    }

    fs.writeFileSync(appJsPath, appJsCode);
  }

  let serverJsPath = path.join(projectPath, 'src', 'server.js');
  if (fs.existsSync(serverJsPath)) {
    let serverJsCode = fs.readFileSync(serverJsPath, 'utf8');
    
    if (!deps.mongoose) {
      serverJsCode = serverJsCode.replace(/import connectDB from "#db\/index\.js";\r?\n/, '');
      serverJsCode = serverJsCode.replace(/connectDB\(\)\r?\n    \.then\(\(\) => \{\r?\n/, '');
      serverJsCode = serverJsCode.replace(/    \}\)\r?\n    \.catch\(\(err\) => \{\r?\n        console\.log\("MONGO db connection failed !!! ", err\);\r?\n    \}\);\r?\n/, '');
      // Fix indentation for app.listen
      serverJsCode = serverJsCode.replace(/        app\.listen\(PORT, \(\) => \{\r?\n            console\.log\(`Server is running at port : \$\{PORT\}`\);\r?\n        \}\);\r?\n/, 'app.listen(PORT, () => {\n    console.log(`Server is running at port : ${PORT}`);\n});\n');
      
      const dbDir = path.join(projectPath, 'src', 'db');
      if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
    }

    if (!deps.dotenv) {
      serverJsCode = serverJsCode.replace(/import dotenv from "dotenv";\r?\n/, '');
      serverJsCode = serverJsCode.replace(/\/\/ Load environment variables[\s\S]*?\}\);\r?\n/, '');
    }

    fs.writeFileSync(serverJsPath, serverJsCode);
  }

  // 3. Create package.json
  console.log(` Setting up package.json...`);
  const packageJsonTemplate = {
    name: packageJsonName.trim(),
    version: "1.0.0",
    description: description || "A production-ready Node.js Express API",
    main: "src/server.js",
    type: "module",
    scripts: {
      "start": "node src/server.js",
      "dev": "nodemon src/server.js"
    },
    imports: {
      "#*": "./src/*"
    },
    keywords: ["express", "node", "api"],
    author: author || "",
    license: "ISC"
  };

  if (deps.prettier) {
    packageJsonTemplate.scripts.format = "prettier --write \"src/**/*.{js,json}\"";
  }

  if (initTests) {
    packageJsonTemplate.scripts.test = "node --experimental-vm-modules node_modules/jest/bin/jest.js";
  }

  // Write package.json
  fs.writeFileSync(
    path.join(projectPath, 'package.json'), 
    JSON.stringify(packageJsonTemplate, null, 2)
  );

  // Install Dependencies
  const dependenciesToInstall = Object.keys(deps).filter(dep => deps[dep] && dep !== 'prettier');
  if (deps['pino-http']) {
    dependenciesToInstall.push('pino');
  }
  if (initAuth) {
    dependenciesToInstall.push('jsonwebtoken', 'bcryptjs'); // Add bcryptjs too since it's standard with JWT
  }
  
  const devDependenciesToInstall = ['nodemon'];
  if (deps.prettier) devDependenciesToInstall.push('prettier');
  if (installPinoPretty) devDependenciesToInstall.push('pino-pretty');
  if (initTests) {
    devDependenciesToInstall.push('jest', 'supertest');
  }

  try {
    const execConfig = { cwd: projectPath, stdio: 'inherit' };
    
    // Inject dependencies directly into package.json instead of doing them via raw arguments.
    // This perfectly bypasses PNPM / YARN / BUN specific registry caching bugs when downloading deeply nested trees.
    console.log(`\n Configuring ${packageManager} and resolving dependency trees...`);
    const finalPackageJsonPath = path.join(projectPath, 'package.json');
    const finalPackageJsonCode = JSON.parse(fs.readFileSync(finalPackageJsonPath, 'utf8'));
    
    // We add them dynamically so package managers can evaluate them holistically at once
    const latestDeps = {};
    dependenciesToInstall.forEach(d => latestDeps[d] = 'latest');
    finalPackageJsonCode.dependencies = latestDeps;

    const latestDevDeps = {};
    devDependenciesToInstall.forEach(d => latestDevDeps[d] = 'latest');
    finalPackageJsonCode.devDependencies = latestDevDeps;
    
    fs.writeFileSync(finalPackageJsonPath, JSON.stringify(finalPackageJsonCode, null, 2));

    console.log(`\n Running final installation via ${packageManager} (This might take a minute)...`);
    const installTriggerCmd = packageManager === 'npm' ? 'npm install' : `${packageManager} install`;
    execSync(installTriggerCmd, execConfig);

    if (initGit) {
      console.log(`\n Initializing Git repository...`);
      execSync('git init', { cwd: projectPath, stdio: 'inherit' });
      // Create .gitignore
      const gitignoreContent = "node_modules\n.env\ndist\nbuild\ncoverage\n";
      fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignoreContent);
      execSync('git add .', { cwd: projectPath, stdio: 'inherit' });
      execSync('git commit -m "initial commit"', { cwd: projectPath, stdio: 'inherit' });
    }

    console.log(`\n Success! Created "${projectName}" at ${projectPath}`);
    console.log('\nInside that directory, you can run several commands:');
    console.log(`\n  ${packageManager === 'npm' ? 'npm run' : packageManager} dev`);
    console.log('    Starts the development server on localhost.');
    console.log(`\n  ${packageManager === 'npm' ? 'npm' : packageManager} start`);
    console.log('    Starts the production server.');
    console.log('\nWe suggest that you begin by typing:');
    console.log(`\n  cd ${projectName}`);
    console.log(`  ${packageManager === 'npm' ? 'npm run' : packageManager} dev\n`);
  } catch (err) {
    console.error('\nFailed to install dependencies. You may need to install them manually inside the folder.', err);
  }
}

init().catch(err => {
  console.error('\nUnexpected error occurred:', err);
  process.exit(1);
});
