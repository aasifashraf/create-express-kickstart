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
    projectName = await question('\n👉 Project Directory Name (e.g. my-awesome-api): ');
  }
  
  if (!projectName) {
    console.error('\n❌ Error: Project Directory Name is required.');
    process.exit(1);
  }

  const currentPath = process.cwd();
  const projectPath = path.join(currentPath, projectName);

  if (fs.existsSync(projectPath)) {
    console.error(`\n❌ Error: Folder ${projectName} already exists. Please choose a different directory name.\n`);
    process.exit(1);
  }

  let packageJsonName = await question(`👉 package.json name (${projectName}): `);
  if (!packageJsonName.trim()) {
    packageJsonName = projectName; // Fallback to directory name
  }

  const description = await question('👉 Project description: ');
  const author = await question('👉 Author name: ');

  console.log('\n--- 📦 Select Dependencies ---');
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

  const packageManagerChoice = await question('\n👉 Which package manager would you like to use? [npm/yarn/pnpm/bun] (default: npm): ');
  const packageManager = ['yarn', 'pnpm', 'bun'].includes(packageManagerChoice.trim().toLowerCase()) 
    ? packageManagerChoice.trim().toLowerCase() 
    : 'npm';
    
  const initGit = (await question('\n👉 Initialize a git repository? [Y/n] ')).toLowerCase() !== 'n';
  const initDocker = (await question('👉 Include Dockerfile & docker-compose.yml? [Y/n] ')).toLowerCase() !== 'n';

  rl.close();

  console.log(`\n🚀 Creating a new Node.js Express API in ${projectPath}...`);
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
    console.error('\n❌ Error: Could not find "src" directory in the template generator.');
    process.exit(1);
  }

  console.log(`📂 Bootstrapping application structure (errorHandler, ApiResponse, async handlers)...`);
  copyRecursiveSync(sourceDir, targetSrcDir);

  // 2. Copy .env.example
  console.log(`🔧 Generating environment files...`);
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, path.join(projectPath, '.env.example'));
    fs.copyFileSync(envExamplePath, path.join(projectPath, '.env')); 
  }

  if (initDocker) {
    console.log(`🐳 Adding Docker files...`);
    const dockerfilePath = path.join(__dirname, '..', 'templates', 'Dockerfile');
    const dockerComposePath = path.join(__dirname, '..', 'templates', 'docker-compose.yml');
    
    // Fallbacks if templates aren't bundled right
    if (fs.existsSync(dockerfilePath)) fs.copyFileSync(dockerfilePath, path.join(projectPath, 'Dockerfile'));
    if (fs.existsSync(dockerComposePath) && deps.mongoose) {
      fs.copyFileSync(dockerComposePath, path.join(projectPath, 'docker-compose.yml'));
    }
  }

  // 3. Create package.json
  console.log(`📦 Setting up package.json...`);
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
  const depString = dependenciesToInstall.join(' ');
  
  const devDependenciesToInstall = ['nodemon'];
  if (deps.prettier) devDependenciesToInstall.push('prettier');
  if (installPinoPretty) devDependenciesToInstall.push('pino-pretty');
  const devDepString = devDependenciesToInstall.join(' ');

  console.log(`\n⏳ Installing selected core dependencies (${dependenciesToInstall.join(', ')}). This might take a minute...`);
  try {
    let installCmd = packageManager === 'yarn' ? 'yarn add' 
      : packageManager === 'pnpm' ? 'pnpm add'
      : packageManager === 'bun' ? 'bun add'
      : 'npm install';
      
    let installDevCmd = packageManager === 'yarn' ? 'yarn add -D' 
      : packageManager === 'pnpm' ? 'pnpm add -D'
      : packageManager === 'bun' ? 'bun add -d'
      : 'npm install --save-dev';

    if (depString) {
      execSync(`${installCmd} ${depString}`, { 
        cwd: projectPath, 
        stdio: 'inherit' 
      });
    }
    
    console.log(`\n⏳ Installing latest dev dependencies (${devDepString})...`);
    execSync(`${installDevCmd} ${devDepString}`, { 
      cwd: projectPath, 
      stdio: 'inherit' 
    });

    if (initGit) {
      console.log(`\n🌱 Initializing Git repository...`);
      execSync('git init', { cwd: projectPath, stdio: 'inherit' });
      // Create .gitignore
      const gitignoreContent = "node_modules\n.env\ndist\nbuild\ncoverage\n";
      fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignoreContent);
      execSync('git add .', { cwd: projectPath, stdio: 'inherit' });
      execSync('git commit -m "initial commit"', { cwd: projectPath, stdio: 'inherit' });
    }

    console.log(`\n✅ Success! Created "${projectName}" at ${projectPath}`);
    console.log('\nInside that directory, you can run several commands:');
    console.log(`\n  ${packageManager === 'npm' ? 'npm run' : packageManager} dev`);
    console.log('    Starts the development server on localhost.');
    console.log(`\n  ${packageManager === 'npm' ? 'npm' : packageManager} start`);
    console.log('    Starts the production server.');
    console.log('\nWe suggest that you begin by typing:');
    console.log(`\n  cd ${projectName}`);
    console.log(`  ${packageManager === 'npm' ? 'npm run' : packageManager} dev\n`);
  } catch (err) {
    console.error('\n❌ Failed to install dependencies. You may need to install them manually inside the folder.', err);
  }
}

init().catch(err => {
  console.error('\n❌ Unexpected error occurred:', err);
  process.exit(1);
});
