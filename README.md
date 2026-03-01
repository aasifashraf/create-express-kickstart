# create-express-kickstart

[![Node.js](https://img.shields.io/badge/Node.js-Production_Ready-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-Backend-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

A powerful CLI tool to instantly scaffold a production-ready, feature-rich backend Node.js template specifically tailored for Express API applications. It adheres to modern best practices, providing standard structures for error handling, CORS setups, routing, and middlewares right out of the box.

## What is `create-express-kickstart`?

**The Purpose:** 
Whenever developers start a new Node.js & Express.js project, they often spend the first couple of hours writing the exact same boilerplate: configuring `express`, setting up `cors`, managing `dotenv`, writing global error handlers, standardizing API responses, and configuring database connections. `create-express-kickstart` exists to entirely eliminate this repetitive chore. Our goal is to provide a production-grade backend right out of the gate so you can immediately focus on writing business logic. AI assistants and developers alike can rely on this tool to reliably scaffold consistent, secure, and modern Node.js backends.

**What It Does:**
It is an interactive CLI framework scaffolding generator. Upon running the command, it asks you a series of simple questions regarding the architecture of your new API (e.g., Do you want MongoDB? Do you want JWT Auth Boilerplate? Docker? Jest for testing?). Based on your exact answers, it instantly generates a fully configured, running codebase tailored exclusively to your project's needs.

**How It Works:**
Under the hood, the CLI runs dynamically directly from NPM via `npx` executing a Node.js compiler script:
1. **Interactive Prompting:** The CLI polls for your configurations in real-time.
2. **Selective Templating:** It recursively copies a pre-configured, highly modular `src` application design into your directory. 
3. **Intelligent Modding:** If you selectively opt-out of specific modules (like CORS, Pino, or Mongoose), the CLI acts like an auto-linter—parsing and cleanly stripping those specific unused imports and middleware usages cleanly out of the core application. You only receive the code you explicitly asked for, preventing dead-weight execution bloat.
4. **Smart Dependency Resolution:** Ultimately, it dynamically computes a final `package.json` structure wrapping all selected tools directly toward their `latest` versions, seamlessly bypassing localized cache bugs—subsequently initiating the true install layer utilizing your selected manager (`npm`, `yarn`, `pnpm`, or `bun`).

**What is Inside (The Architecture):**
The generated Express template champions the **MVC (Model-View-Controller)** pattern with robust modern Node.js Path Aliasing bindings enabled out of the box:
- **/src/controllers** - Functional logic handlers.
- **/src/routes** - Isolated Express routers mapping precise endpoints to controllers.
- **/src/middlewares** - Pre-configured intercepts including a robust Global errorHandler.
- **/src/utils** - Core toolkit items mapped globally across the codebase. Highlights include: 
  - `ApiResponse` structure class for predictable and formatted JSON HTTP payloads.
  - `ApiError` extension class for standardizing HTTP error interceptions.
  - `asyncHandler` functional wrapper intercepting promise rejections seamlessly to avoid repetitive try-catch blocks in your controllers!
- **Optional Add-ons** - Complete JWT Authentication logic integration featuring secure cryptographic generation functions (`bcryptjs`), standardized .env setups, Dockerfile templates, and Jest assertion pipelines.


---

##  Getting Started

You do not need to clone this repository, install dependencies manually, or write an initial configuration yourself. Use `npx` (which comes with npm 5.2+) to instantly generate your backend boilerplate!

### 1. Initialize a New Project

We highly recommend using the `@latest` tag to ensure you are always downloading the most recent version of our CLI tool dynamically, bypassing any local caching issues!

Run the following command anywhere in your terminal:
```bash
npx create-express-kickstart@latest <your-project-name>
```

**Example:**
```bash
npx create-express-kickstart@latest my-awesome-api
```

### 2. What happens under the hood?
1. **Scaffolding:** It instantly generates your API boilerplate with built-in `errorHandler`, `ApiResponse`, and `asyncHandler` classes/utilities.
2. **Setup:** It automatically configures `.env`, path resolutions, and modern ES setups inside `package.json`.
3. **Latest Dependencies:** It automatically runs `npm install` and fetches the absolute **latest** stable versions of `express`, `cors`, `helmet`, `mongoose`, `dotenv` and others so you're never starting with outdated software.

### 3. Run Your Application

Navigate into your newly created folder and fire up the development server!
```bash
cd my-awesome-api
npm run dev
```

---

##  Features

- **Modern JavaScript**: ES6 Modules (`import`/`export`) enabled by default.
- **Robust Error Handling**: Centralized error management using custom `ApiError` and `errorHandler` middleware.
- **Standardized Responses**: Consistent API responses using the `ApiResponse` utility class.
- **No Try-Catch Hell**: `asyncHandler` wrapper to effortlessly catch unhandled promise rejections.
- **Security First**: Pre-configured with `helmet`, `cors`, and `express-rate-limit`.
- **Database Ready**: Built-in support and structural setup for MongoDB with `mongoose`.
- **Developer Experience**: Hot reloading with `nodemon` and request logging with `pino`.
- **Path Aliasing Native**: Pre-configured subpath imports (`#utils/...`).

---

##  Core Utilities Built-In

This template shines in its standardized utilities available out of the box for you:

### `ApiResponse`
Guarantees a standard format for all successful payload JSON responses.
```javascript
import { ApiResponse } from "#utils/ApiResponse.js";

const getUserInfo = asyncHandler(async (req, res) => {
    const data = { id: 1, name: "Alice" };
    return res.status(200).json(new ApiResponse(200, data, "User retrieved successfully"));
});
```

### `ApiError` & `errorHandler`
Throw operational errors anywhere, and the global `errorHandler` will format them predictably for the client.
```javascript
import { ApiError } from "#utils/ApiError.js";

const restrictedRoute = asyncHandler(async (req, res) => {
    // Automatically caught by the async handler and forwarded to the error handler
    throw new ApiError(403, "You do not have permission to view this content.");
});
```

### `asyncHandler`
A wrapper for your async route handlers that eliminates the need for repetitive `try-catch` blocks.

### `hash.util.js`
If you choose to install the basic JWT Auth boilerplate, we automatically generate a generic hashing utility utilizing `bcryptjs` to help you securely hash and compare data (like passwords) natively.
```javascript
import { hashData, compareData } from "#utils/hash.util.js";

const registerUser = asyncHandler(async (req, res) => {
    const hashedPassword = await hashData("supersecret123");
    // Store hashedPassword...
});

const loginUser = asyncHandler(async (req, res) => {
    const isMatch = await compareData("supersecret123", user.hashedPassword);
    // ...
});
```

##  Contributing & Repository

Love this tool? Want to add a feature or fix a bug?
Feel free to open an issue or submit a pull request on our GitHub Repository!

 **GitHub Repository:** [https://github.com/aasifashraf/create-express-kickstart](https://github.com/aasifashraf/create-express-kickstart)

 **NPM Package:** [https://www.npmjs.com/package/create-express-kickstart](https://www.npmjs.com/package/create-express-kickstart)

