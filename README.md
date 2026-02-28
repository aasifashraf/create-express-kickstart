# create-express-kickstart

[![Node.js](https://img.shields.io/badge/Node.js-Production_Ready-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-Backend-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

A powerful CLI tool to instantly scaffold a production-ready, feature-rich backend Node.js template specifically tailored for Express API applications. It adheres to modern best practices, providing standard structures for error handling, CORS setups, routing, and middlewares right out of the box.

---

## 🚀 Getting Started

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

## 🌟 Features

- **Modern JavaScript**: ES6 Modules (`import`/`export`) enabled by default.
- **Robust Error Handling**: Centralized error management using custom `ApiError` and `errorHandler` middleware.
- **Standardized Responses**: Consistent API responses using the `ApiResponse` utility class.
- **No Try-Catch Hell**: `asyncHandler` wrapper to effortlessly catch unhandled promise rejections.
- **Security First**: Pre-configured with `helmet`, `cors`, `express-rate-limit`, `hpp` (HTTP Parameter Pollution), and `express-mongo-sanitize` (NoSQL injection prevention).
- **Graceful Shutdown**: Handles `SIGTERM` and `SIGINT` signals to close HTTP connections cleanly before exiting.
- **Process Error Safety**: `uncaughtException` and `unhandledRejection` handlers to prevent silent crashes.
- **Compressed Responses**: Optional `compression` middleware for gzip/deflate response compression.
- **Database Ready**: Built-in support and structural setup for MongoDB with `mongoose`.
- **Developer Experience**: Hot reloading via `nodemon.json` config, request logging with `pino`, and optional `pino-pretty`.
- **Code Formatting**: Optional Prettier integration with a pre-configured `.prettierrc`.
- **Testing Ready**: Optional Jest setup with `jest.config.js` (ESM-compatible) and boilerplate tests.
- **Docker Support**: Optional multi-stage `Dockerfile` with a non-root user for production-grade container builds.
- **Path Aliasing Native**: Pre-configured subpath imports (`#utils/...`).

---

## 🛠️ Core Utilities Built-In

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
## 🤝 Contributing & Repository

Love this tool? Want to add a feature or fix a bug?
Feel free to open an issue or submit a pull request on our GitHub Repository!

🔗 **GitHub Repository:** [https://github.com/aasifashraf/create-express-kickstart](https://github.com/aasifashraf/create-express-kickstart)

