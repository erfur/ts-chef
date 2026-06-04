# Contributing to ts-chef

Thank you for your interest in contributing to ts-chef! This document provides instructions for setting up your development environment, building the project, and releasing new versions.

## Development Environment Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/michaelweiss/ts-chef.git
    cd ts-chef/vscode-ts-chef
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Local Build Process

We use `npm` scripts to manage the build process.

-   **Build all:**
    ```bash
    npm run build
    ```
    This compiles the chef operations, generates the operations registry, and bundles the extension using esbuild.

-   **Watch mode:**
    ```bash
    npm run watch
    ```

-   **Linting and Formatting:**
    ```bash
    npm run lint      # Check for linting errors
    npm run lint:fix  # Automatically fix linting errors
    npm run format    # Format code with Prettier
    ```

## Testing

We use Jest for unit testing.

-   **Run all tests:**
    ```bash
    npm test
    ```

-   **Watch mode:**
    ```bash
    npm run test:watch
    ```

-   **Code Coverage:**
    ```bash
    npm run test:coverage
    ```

## Documentation

API documentation is generated using [TypeDoc](https://typedoc.org/).

-   **Build documentation:**
    ```bash
    npm run docs
    ```
    The output will be in the `docs/api` directory.

## Releasing a New Version

1.  **Update the version** in `package.json`.
2.  **Ensure all tests pass and documentation is up to date:**
    ```bash
    npm run release
    ```
    This command will build, test, and package the extension into a `.vsix` file.

3.  **Publishing:**
    To publish to the VS Code Marketplace, you need a Personal Access Token (PAT).
    ```bash
    npm run upload
    ```
    *Note: Never commit your PAT or credentials to the repository.*

## Code Standards

-   Use **TSDoc** for all public classes and methods.
-   Ensure **Type Safety** by avoiding `any` where possible.
-   Standardize **Input Normalization** to handle both `string` and `ArrayBuffer` in operations.
-   Follow the existing **conventions** for operation structure and categorization.
