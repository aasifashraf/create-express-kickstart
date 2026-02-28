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
    projectName = await question('\n👉 Project name (e.g. my-awesome-api): ');
  }
  
  if (!projectName) {
    console.error('\n❌ Error: Project name is required.');
    process.exit(1);
  }

  const currentPath = process.cwd();
  const projectPath = path.join(currentPath, projectName);

  if (fs.existsSync(projectPath)) {
    console.error(`\n❌ Error: Folder ${projectName} already exists. Please choose a different name.\n`);
    process.exit(1);
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

  // 3. Create package.json
  console.log(`📦 Setting up package.json...`);
  const packageJsonTemplate = {
    name: projectName,
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

  // Remove the readline dependency from the generated boilerplate if mistakenly mixed
  fs.writeFileSync(
    path.join(projectPath, 'package.json'), 
    JSON.stringify(packageJsonTemplate, null, 2)
  );

  // 4. Install Dependencies
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
    if (depString) {
      execSync(`npm install ${depString}`, { 
        cwd: projectPath, 
        stdio: 'inherit' 
      });
    }
    
    console.log(`\n⏳ Installing latest dev dependencies (${devDepString})...`);
    execSync(`npm install ${devDepString} --save-dev`, { 
      cwd: projectPath, 
      stdio: 'inherit' 
    });

    console.log(`\n✅ Success! Created "${projectName}" at ${projectPath}`);
    console.log('\nInside that directory, you can run several commands:');
    console.log('\n  npm run dev');
    console.log('    Starts the development server on localhost.');
    console.log('\n  npm start');
    console.log('    Starts the production server.');
    console.log('\nWe suggest that you begin by typing:');
    console.log(`\n  cd ${projectName}`);
    console.log('  npm run dev\n');
  } catch (err) {
    console.error('\n❌ Failed to install dependencies. You may need to run npm install manually inside the folder.', err);
  }
}

init().catch(err => {
  console.error('\n❌ Unexpected error occurred:', err);
  process.exit(1);
});
