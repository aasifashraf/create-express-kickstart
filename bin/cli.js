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

function generateAppContent(deps, installPinoPretty) {
  const lines = [];

  lines.push('import express from "express";');
  if (deps.cors)              lines.push('import cors from "cors";');
  if (deps['cookie-parser'])  lines.push('import cookieParser from "cookie-parser";');
  if (deps.helmet)            lines.push('import helmet from "helmet";');
  if (deps['pino-http']) {
    lines.push('import pinoHttp from "pino-http";');
    if (installPinoPretty)    lines.push('import { createRequire } from "module";');
  }
  if (deps['express-rate-limit']) lines.push('import rateLimit from "express-rate-limit";');
  lines.push('import { errorHandler } from "#middlewares/errorHandler.middleware.js";');
  lines.push('');
  lines.push('// Import routers');
  lines.push('import healthcheckRouter from "#routes/healthcheck.routes.js";');
  lines.push('');

  if (deps['pino-http'] && installPinoPretty) {
    lines.push('const _require = createRequire(import.meta.url);');
    lines.push('');
  }

  lines.push('const app = express();');
  lines.push('');

  if (deps.helmet) {
    lines.push('// Security HTTP headers');
    lines.push('app.use(helmet());');
    lines.push('');
  }

  if (deps['express-rate-limit']) {
    lines.push('// Rate Limiting');
    lines.push('const limiter = rateLimit({');
    lines.push('    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // Default 15 minutes');
    lines.push('    limit: process.env.RATE_LIMIT_MAX || 100,');
    lines.push("    standardHeaders: 'draft-7',");
    lines.push('    legacyHeaders: false,');
    lines.push('    message: "Too many requests from this IP, please try again later"');
    lines.push('});');
    lines.push('app.use("/api", limiter); // Apply rate limiting to all API routes');
    lines.push('');
  }

  if (deps['pino-http']) {
    lines.push('// Logging');
    lines.push('app.use(pinoHttp({');
    lines.push('    customLogLevel: function (req, res, err) {');
    lines.push('        if (res.statusCode >= 400 && res.statusCode < 500) {');
    lines.push("            return 'warn'");
    lines.push('        } else if (res.statusCode >= 500 || err) {');
    lines.push("            return 'error'");
    lines.push('        } else if (res.statusCode >= 300 && res.statusCode < 400) {');
    lines.push("            return 'silent'");
    lines.push('        }');
    lines.push("        return 'info'");
    lines.push('    },');
    if (installPinoPretty) {
      lines.push('    transport: process.env.NODE_ENV === "development" ? (function() {');
      lines.push('        try {');
      lines.push("            _require.resolve('pino-pretty');");
      lines.push('            return {');
      lines.push("                target: 'pino-pretty',");
      lines.push('                options: { colorize: true }');
      lines.push('            };');
      lines.push('        } catch (e) {');
      lines.push('            return undefined;');
      lines.push('        }');
      lines.push('    })() : undefined');
    }
    lines.push('}));');
    lines.push('');
  }

  if (deps.cors) {
    lines.push('// CORS setup');
    lines.push('app.use(');
    lines.push('    cors({');
    lines.push('        origin: process.env.CORS_ORIGIN || "*", // Fallback to allowing everything');
    lines.push('        credentials: true, // Allow cookies with requests');
    lines.push('    })');
    lines.push(');');
    lines.push('');
  }

  lines.push('// Payload sizes and forms');
  lines.push('app.use(express.json({ limit: "16kb" }));');
  lines.push('app.use(express.urlencoded({ extended: true, limit: "16kb" }));');
  lines.push('app.use(express.static("public"));');
  if (deps['cookie-parser']) {
    lines.push('app.use(cookieParser());');
  }
  lines.push('');
  lines.push('// -------- API ROUTES ---------');
  lines.push('// Mount routers');
  lines.push('app.use("/api/v1/healthcheck", healthcheckRouter);');
  lines.push('');
  lines.push('// Global Error Handler');
  lines.push('// Always add this as the very last middleware');
  lines.push('app.use(errorHandler);');
  lines.push('');
  lines.push('export { app };');

  return lines.join('\n');
}

function generateServerContent(deps) {
  const lines = [];

  if (deps.dotenv) {
    lines.push('import dotenv from "dotenv";');
    lines.push('');
    lines.push('// Load environment variables BEFORE importing modules that depend on them');
    lines.push("dotenv.config({ path: './.env' });");
    lines.push('');
  }

  lines.push('const { app } = await import("#app.js");');

  if (deps.mongoose) {
    lines.push('const { default: connectDB } = await import("#db/index.js");');
  }

  lines.push('');
  lines.push('const PORT = process.env.PORT || 8000;');
  lines.push('');

  if (deps.mongoose) {
    lines.push('connectDB()');
    lines.push('    .then(() => {');
    lines.push('        app.listen(PORT, () => {');
    lines.push('            console.log(`Server is running at port : ${PORT}`);');
    lines.push('        });');
    lines.push('    })');
    lines.push('    .catch((err) => {');
    lines.push('        console.log("MONGO db connection failed !!! ", err);');
    lines.push('    });');
  } else {
    lines.push('app.listen(PORT, () => {');
    lines.push('    console.log(`Server is running at port : ${PORT}`);');
    lines.push('});');
  }

  lines.push('');
  lines.push('process.on("unhandledRejection", (err) => {');
  lines.push('    console.log("UNHANDLED REJECTION! Shutting down...");');
  lines.push('    console.log(err.name, err.message);');
  lines.push('    process.exit(1);');
  lines.push('});');

  return lines.join('\n');
}

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

  // Generate app.js and server.js tailored to the selected dependencies
  fs.writeFileSync(path.join(targetSrcDir, 'app.js'), generateAppContent(deps, installPinoPretty));
  fs.writeFileSync(path.join(targetSrcDir, 'server.js'), generateServerContent(deps));

  // If mongoose was not selected, remove the db and models directories
  if (!deps.mongoose) {
    fs.rmSync(path.join(targetSrcDir, 'db'), { recursive: true, force: true });
    fs.rmSync(path.join(targetSrcDir, 'models'), { recursive: true, force: true });
  }

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
