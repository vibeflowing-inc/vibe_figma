#!/usr/bin/env bun

import { readdirSync, renameSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';

const renameMap = new Map<string, string>([
  // PascalCase to kebab-case
  ['src/core/css-to-tailwind/TailwindNodesManager.ts', 'src/core/css-to-tailwind/tailwind-nodes-manager.ts'],
  ['src/core/css-to-tailwind/TailwindConverter.ts', 'src/core/css-to-tailwind/tailwind-converter.ts'],
  ['src/core/css-to-tailwind/types/ConverterMapping.ts', 'src/core/css-to-tailwind/types/converter-mapping.ts'],
  ['src/core/css-to-tailwind/types/utils/KnownKeys.ts', 'src/core/css-to-tailwind/types/utils/known-keys.ts'],
  ['src/core/css-to-tailwind/types/utils/RemoveKeys.ts', 'src/core/css-to-tailwind/types/utils/remove-keys.ts'],
  ['src/core/css-to-tailwind/types/utils/SetPartialProps.ts', 'src/core/css-to-tailwind/types/utils/set-partial-props.ts'],
  ['src/core/css-to-tailwind/types/utils/SetRequiredProps.ts', 'src/core/css-to-tailwind/types/utils/set-required-props.ts'],

  // camelCase to kebab-case
  ['src/core/css-to-tailwind/utils/buildMediaQueryByScreen.ts', 'src/core/css-to-tailwind/utils/build-media-query-by-screen.ts'],
  ['src/core/css-to-tailwind/utils/converterMappingByTailwindTheme.ts', 'src/core/css-to-tailwind/utils/converter-mapping-by-tailwind-theme.ts'],
  ['src/core/css-to-tailwind/utils/detectIndent.ts', 'src/core/css-to-tailwind/utils/detect-indent.ts'],
  ['src/core/css-to-tailwind/utils/flattenObject.ts', 'src/core/css-to-tailwind/utils/flatten-object.ts'],
  ['src/core/css-to-tailwind/utils/isAtRuleNode.ts', 'src/core/css-to-tailwind/utils/is-at-rule-node.ts'],
  ['src/core/css-to-tailwind/utils/isCSSVariable.ts', 'src/core/css-to-tailwind/utils/is-css-variable.ts'],
  ['src/core/css-to-tailwind/utils/isChildNode.ts', 'src/core/css-to-tailwind/utils/is-child-node.ts'],
  ['src/core/css-to-tailwind/utils/isObject.ts', 'src/core/css-to-tailwind/utils/is-object.ts'],
  ['src/core/css-to-tailwind/utils/normalizeNumbersInString.ts', 'src/core/css-to-tailwind/utils/normalize-numbers-in-string.ts'],
  ['src/core/css-to-tailwind/utils/reduceTailwindClasses.ts', 'src/core/css-to-tailwind/utils/reduce-tailwind-classes.ts'],
  ['src/core/css-to-tailwind/utils/remValueToPx.ts', 'src/core/css-to-tailwind/utils/rem-value-to-px.ts'],
  ['src/core/css-to-tailwind/utils/removeUnnecessarySpaces.ts', 'src/core/css-to-tailwind/utils/remove-unnecessary-spaces.ts'],
  ['src/core/css-to-tailwind/utils/parseCSSFunction.ts', 'src/core/css-to-tailwind/utils/parse-css-function.ts'],
  ['src/core/css-to-tailwind/utils/parseCSSFunctions.ts', 'src/core/css-to-tailwind/utils/parse-css-functions.ts'],
  ['src/core/css-to-tailwind/utils/resolveConfig.ts', 'src/core/css-to-tailwind/utils/resolve-config.ts'],
]);

interface FileUpdate {
  path: string;
  content: string;
  newContent: string;
}

function getAllTsFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

function updateImports(content: string, renameMap: Map<string, string>): string {
  let updatedContent = content;

  for (const [oldPath, newPath] of renameMap.entries()) {
    const oldImport = oldPath.replace(/\.ts$/, '').replace(/\\/g, '/');
    const newImport = newPath.replace(/\.ts$/, '').replace(/\\/g, '/');

    // Update relative imports
    const oldFileName = basename(oldPath, '.ts');
    const newFileName = basename(newPath, '.ts');

    // Match various import patterns
    const patterns = [
      // Direct file import: './TailwindConverter' or '../TailwindConverter'
      new RegExp(`(['"\`])(\\.{1,2}/(?:.*/)?)${oldFileName}\\1`, 'g'),
      // Absolute import from src
      new RegExp(`(['"\`])${oldImport}\\1`, 'g'),
    ];

    for (const pattern of patterns) {
      updatedContent = updatedContent.replace(pattern, (match, quote, prefix) => {
        if (prefix) {
          return `${quote}${prefix}${newFileName}${quote}`;
        }
        return `${quote}${newImport}${quote}`;
      });
    }
  }

  return updatedContent;
}

async function main() {
  console.log('Starting file rename process...\n');

  // Step 1: Rename all files
  console.log('Step 1: Renaming files...');
  for (const [oldPath, newPath] of renameMap.entries()) {
    try {
      renameSync(oldPath, newPath);
      console.log(`✓ Renamed: ${oldPath} -> ${newPath}`);
    } catch (error) {
      console.error(`✗ Failed to rename ${oldPath}:`, error);
    }
  }

  console.log('\nStep 2: Updating imports in all TypeScript files...');

  // Step 2: Update all imports
  const allTsFiles = getAllTsFiles('src');
  const filesToUpdate: FileUpdate[] = [];

  for (const filePath of allTsFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const newContent = updateImports(content, renameMap);

      if (content !== newContent) {
        filesToUpdate.push({ path: filePath, content, newContent });
      }
    } catch (error) {
      console.error(`✗ Failed to read ${filePath}:`, error);
    }
  }

  // Apply updates
  for (const { path, newContent } of filesToUpdate) {
    try {
      writeFileSync(path, newContent, 'utf-8');
      console.log(`✓ Updated imports in: ${path}`);
    } catch (error) {
      console.error(`✗ Failed to update ${path}:`, error);
    }
  }

  console.log(`\n✅ Rename complete!`);
  console.log(`   - ${renameMap.size} files renamed`);
  console.log(`   - ${filesToUpdate.length} files updated with new imports`);
}

main().catch(console.error);
