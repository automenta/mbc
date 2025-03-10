import { Project, SyntaxKind, SourceFile } from "ts-morph";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// ESM-compatible __dirname and __filename equivalents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration options
const config = {
  dryRun: false, // Set to true to preview changes without saving
  includePatterns: ["src/**/*.{ts,js,svelte}", "tests/**/*.{ts,js,svelte}"],
  logFile: "unresolved-imports.log",
  // Mapping for internal aliases (adjust based on your project structure)
  aliasMapping: {
    "src/util": path.resolve(__dirname, "src/util"),
  },
};

// Initialize a new ts-morph project
const project = new Project({
  tsConfigFilePath: path.resolve(__dirname, "tsconfig.json"),
  addFilesFromTsConfig: true,
});

// Array to store unresolved imports for logging
const unresolvedImports: string[] = [];

// Custom function to resolve an import path (mimics Node.js/TS resolution)
function resolveImportPath(sourceFile: SourceFile, importPath: string): string | null {
  try {
    const sourceDir = path.dirname(sourceFile.getFilePath());
    let resolvedPath: string | null = null;
    let adjustedImportPath = importPath;

    // Step 1: Check if the import matches an internal alias (e.g., src/*)
    let isAliasImport = false;
    for (const alias in config.aliasMapping) {
      if (importPath.startsWith(`${alias}/`)) {
        isAliasImport = true;
        const basePath = config.aliasMapping[alias];
        const suffix = importPath.slice(`${alias}/`.length);
        adjustedImportPath = path.join(basePath, suffix);
        break;
      } else if (importPath === alias) {
        isAliasImport = true;
        adjustedImportPath = config.aliasMapping[alias];
        break;
      }
    }

    // Step 2: Compute the absolute path to start resolving from
    const absoluteImportPath = path.resolve(
      isAliasImport ? __dirname : sourceDir,
      adjustedImportPath
    );

    // Step 3: Try resolving the import by checking possible file extensions
    const possibleExtensions = [".ts", ".tsx", ".js", ".svelte"];
    const possiblePaths = [
      absoluteImportPath,
      ...possibleExtensions.map((ext) => `${absoluteImportPath}${ext}`),
      ...possibleExtensions.map((ext) => `${absoluteImportPath}/index${ext}`),
    ];

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        resolvedPath = testPath;
        break;
      }
      // Also check if the file is known to ts-morph (in case it's already loaded)
      if (project.getSourceFile(testPath)) {
        resolvedPath = testPath;
        break;
      }
    }

    // Step 4: If no resolved path, log it and return null
    if (!resolvedPath) {
      unresolvedImports.push(`${importPath} in ${sourceFile.getFilePath()}`);
      return null;
    }

    // Step 5: Compute the relative path from the source file
    let relativePath = path.relative(sourceDir, resolvedPath);
    if (!relativePath.startsWith("..") && !relativePath.startsWith("./")) {
      relativePath = `./${relativePath}`;
    }

    if (relativePath.startsWith(".."))
      relativePath = relativePath.substring(1, relativePath.length); //HACK

    // Step 6: Handle file extensions
    let finalPath = relativePath;
    const ext = path.extname(resolvedPath);
    if (ext === ".ts" || ext === ".tsx") {
      // Replace .ts/.tsx with .js for ESM output compatibility
      finalPath = finalPath.replace(/\.ts(x)?$/, ".js");
    } else if (ext === ".svelte") {
      // Keep .svelte extension since Svelte files are imported as-is
      finalPath = finalPath;
    } else if (!ext) {
      // If no extension, assume it's an index file
      const possibleIndexFiles = [
        `${resolvedPath}/index.ts`,
        `${resolvedPath}/index.js`,
        `${resolvedPath}/index.svelte`,
      ];
      const foundIndex = possibleIndexFiles.find((file) => fs.existsSync(file));
      if (foundIndex) {
        finalPath = `${finalPath}/index.js`; // Assume .js for ESM
      } else {
        unresolvedImports.push(`${importPath} (no index file) in ${sourceFile.getFilePath()}`);
        return null;
      }
    }

    // Step 7: Remove "index.js" from the end of the path if present (optional in imports)
    if (finalPath.endsWith("/index.js")) {
      finalPath = finalPath.substring(0, finalPath.length - 9); // Remove "/index.js"
    }

    return finalPath;
  } catch (error) {
    console.error(`Error resolving ${importPath} in ${sourceFile.getFilePath()}:`, error);
    unresolvedImports.push(`${importPath} (resolution error) in ${sourceFile.getFilePath()}`);
    return null;
  }
}

// Function to process a single file
function processFile(sourceFile: SourceFile) {
  let hasChanges = false;

  // Find all import declarations
  const imports = sourceFile.getDescendantsOfKind(SyntaxKind.ImportDeclaration);

  for (const importDecl of imports) {
    const importPathNode = importDecl.getModuleSpecifier();
    let importPath = importPathNode.getLiteralText();

    // Skip external imports (e.g., "fs", "react") unless they match an internal alias
    let shouldProcess = false;
    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      shouldProcess = true;
    } else {
      // Check if it matches an internal alias (e.g., src/*)
      for (const alias in config.aliasMapping) {
        if (importPath === alias || importPath.startsWith(`${alias}/`)) {
          shouldProcess = true;
          break;
        }
      }
    }

    if (!shouldProcess) {
      continue;
    }

    // Resolve the import to its actual file
    const resolvedPath = resolveImportPath(sourceFile, importPath);
    if (!resolvedPath) continue;

    // Update the import path with the resolved path
    console.log(
      `Updating import in ${sourceFile.getFilePath()}: ${importPath} -> ${resolvedPath}`
    );
    importDecl.setModuleSpecifier(resolvedPath);
    hasChanges = true;
  }

  // If changes were made and not a dry run, save the file
  if (hasChanges && !config.dryRun) {
    sourceFile.saveSync();
    console.log(`Saved changes to ${sourceFile.getFilePath()}`);
  }
}

// Main function to process all files
async function main() {
  // Add all source files from the project
  const sourceFiles = project.getSourceFiles();

  console.log(`Found ${sourceFiles.length} files to process.`);

  // Process each file
  for (const sourceFile of sourceFiles) {
    processFile(sourceFile);
  }

  // Log unresolved imports
  if (unresolvedImports.length > 0) {
    console.log(`\nFound ${unresolvedImports.length} unresolved imports:`);
    console.log(unresolvedImports.join("\n"));
    // Optionally write to a log file
    if (!config.dryRun) {
      fs.writeFileSync(config.logFile, unresolvedImports.join("\n"), "utf8");
      console.log(`Unresolved imports written to ${config.logFile}`);
    }
  } else {
    console.log("\nNo unresolved imports found.");
  }

  console.log(config.dryRun ? "Dry run completed." : "Finished updating imports.");
}

main();