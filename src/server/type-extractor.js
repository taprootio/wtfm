/**
 * @module type-extractor
 *
 * Scans TypeScript source files and extracts exported declarations
 * (interfaces, type aliases, const objects, functions) that carry a
 * `@docUrl` JSDoc tag.  Produces a `type-manifest.json` in a format
 * that parallels the Custom Elements Manifest, so WTFM can consume
 * both manifests through the same plugin pipeline.
 *
 * Requires `typescript` as a peer dependency.
 *
 * @example
 * ```js
 * import { extractTypes } from "@taprootio/wtfm/type-extractor";
 *
 * extractTypes({
 *   tsConfigPath: "./tsconfig.json",
 *   outFile: "type-manifest.json",
 * });
 * ```
 */

import ts from "typescript";
import { writeFileSync } from "fs";
import { resolve, relative, dirname } from "path";

/* ================================================================ */
/*  JSDoc Helpers                                                     */
/* ================================================================ */

/**
 * Converts a TypeScript JSDoc comment node (string or
 * NodeArray<JSDocComment>) to a plain text string.
 */
function commentToText(comment) {
  if (!comment) return "";
  if (typeof comment === "string") return comment;
  // NodeArray of JSDocComment parts — concatenate text and link nodes
  return comment
    .map((part) => {
      if (typeof part === "string") return part;
      if (part.kind === ts.SyntaxKind.JSDocText) return part.text;
      // JSDocLink, JSDocLinkCode, JSDocLinkPlain
      if (part.name) {
        const linkText = part.text ? part.text.trim() : "";
        const linkName =
          part.name.getText?.() ?? part.name.escapedText ?? String(part.name);
        return linkText || `{@link ${linkName}}`;
      }
      return part.text ?? "";
    })
    .join("");
}

/**
 * Extracts JSDoc description and custom tags from a node.
 *
 * @param {object} node - TypeScript AST node
 * @param {string[]} tagNames - Custom JSDoc tag names to extract
 * @returns {{ description: string, tags: object }}
 */
function getJSDocInfo(node, tagNames) {
  const result = { description: "", tags: {} };

  const jsDocs = node.jsDoc;
  if (!jsDocs || jsDocs.length === 0) return result;

  // Use the last JSDoc block (closest to the declaration)
  const doc = jsDocs[jsDocs.length - 1];
  result.description = commentToText(doc.comment);

  if (doc.tags) {
    for (const tag of doc.tags) {
      const name = tag.tagName.text;
      if (tagNames.includes(name)) {
        const value = commentToText(tag.comment);
        // Mimic @wc-toolkit/jsdoc-tags split: first word → name,
        // rest → description.
        const parts = value.split(/\s+/);
        const tagObj = { name: parts[0] || "" };
        const rest = parts.slice(1).join(" ");
        if (rest) tagObj.description = rest;
        result.tags[name] = tagObj;
      }
    }
  }

  return result;
}

/**
 * Extracts a JSDoc description from a member node (property
 * signature, method signature, property assignment, etc.).
 */
function getMemberDescription(member) {
  const jsDocs = member.jsDoc;
  if (!jsDocs || jsDocs.length === 0) return "";
  return commentToText(jsDocs[jsDocs.length - 1].comment);
}

/* ================================================================ */
/*  Type Text Helpers                                                 */
/* ================================================================ */

/**
 * Gets the source text of a type node, preserving the original
 * author-written form for readability.
 */
function typeNodeSourceText(typeNode, sourceFile) {
  if (!typeNode) return "";
  return typeNode.getText(sourceFile);
}

/* ================================================================ */
/*  Export Detection                                                   */
/* ================================================================ */

function hasExportModifier(node) {
  if (node.modifiers) {
    return node.modifiers.some(
      (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
    );
  }
  return false;
}

/* ================================================================ */
/*  Type Parameter Extraction                                         */
/* ================================================================ */

function extractTypeParameters(node, sourceFile) {
  if (!node.typeParameters) return [];
  return node.typeParameters.map((tp) => {
    const name = tp.name.text;
    const constraint = tp.constraint
      ? typeNodeSourceText(tp.constraint, sourceFile)
      : undefined;
    const defaultType = tp.default
      ? typeNodeSourceText(tp.default, sourceFile)
      : undefined;
    return {
      name,
      ...(constraint && { constraint }),
      ...(defaultType && { default: defaultType }),
    };
  });
}

/* ================================================================ */
/*  Declaration Extractors                                            */
/* ================================================================ */

/**
 * Extracts an interface declaration.
 */
function extractInterface(node, checker, sourceFile, tagNames) {
  const { description, tags } = getJSDocInfo(node, tagNames);
  if (!tags.docUrl) return null;

  const members = [];
  for (const member of node.members) {
    if (ts.isPropertySignature(member) || ts.isMethodSignature(member)) {
      const name = member.name.getText(sourceFile);
      const typeText = member.type
        ? typeNodeSourceText(member.type, sourceFile)
        : "";
      const desc = getMemberDescription(member);
      const optional = !!member.questionToken;

      members.push({
        kind: ts.isMethodSignature(member) ? "method" : "field",
        name,
        type: { text: typeText },
        description: desc,
        privacy: "public",
        ...(optional && { optional: true }),
      });
    }
  }

  const typeParameters = extractTypeParameters(node, sourceFile);

  return {
    kind: "interface",
    name: node.name.text,
    description,
    ...(typeParameters.length > 0 && { typeParameters }),
    members,
    ...tags,
  };
}

/**
 * Extracts a type alias declaration.
 */
function extractTypeAlias(node, checker, sourceFile, tagNames) {
  const { description, tags } = getJSDocInfo(node, tagNames);
  if (!tags.docUrl) return null;

  const typeText = typeNodeSourceText(node.type, sourceFile);
  const typeParameters = extractTypeParameters(node, sourceFile);

  return {
    kind: "type-alias",
    name: node.name.text,
    description,
    type: { text: typeText },
    ...(typeParameters.length > 0 && { typeParameters }),
    ...tags,
  };
}

/**
 * Extracts a variable statement (typically `export const FOO = ...`).
 * Returns an array because a statement can declare multiple variables,
 * though in practice `export const` almost always has one.
 */
function extractVariable(statement, checker, sourceFile, tagNames) {
  const { description, tags } = getJSDocInfo(statement, tagNames);
  if (!tags.docUrl) return null;

  const results = [];

  for (const decl of statement.declarationList.declarations) {
    if (!ts.isIdentifier(decl.name)) continue;

    const name = decl.name.text;
    const type = checker.getTypeAtLocation(decl);
    const typeText = checker.typeToString(
      type,
      decl,
      ts.TypeFormatFlags.NoTruncation,
    );

    // Extract members for object literals
    const members = [];
    if (
      decl.initializer &&
      ts.isObjectLiteralExpression(decl.initializer)
    ) {
      for (const prop of decl.initializer.properties) {
        if (
          ts.isPropertyAssignment(prop) ||
          ts.isShorthandPropertyAssignment(prop)
        ) {
          const propName = prop.name.getText(sourceFile);
          const propType = checker.getTypeAtLocation(prop);
          const propTypeText = checker.typeToString(propType);
          const propDesc = getMemberDescription(prop);

          members.push({
            kind: "field",
            name: propName,
            type: { text: propTypeText },
            description: propDesc,
            privacy: "public",
          });
        }
      }
    }

    results.push({
      kind: "variable",
      name,
      description,
      type: { text: typeText },
      ...(members.length > 0 && { members }),
      ...tags,
    });
  }

  return results.length === 1
    ? results[0]
    : results.length > 0
      ? results
      : null;
}

/**
 * Extracts a function declaration.
 */
function extractFunction(node, checker, sourceFile, tagNames) {
  if (!node.name) return null;

  const { description, tags } = getJSDocInfo(node, tagNames);
  if (!tags.docUrl) return null;

  const parameters = [];
  for (const param of node.parameters) {
    const paramName = param.name.getText(sourceFile);
    const paramType = param.type
      ? typeNodeSourceText(param.type, sourceFile)
      : "";
    const optional = !!param.questionToken;
    const defaultValue = param.initializer
      ? param.initializer.getText(sourceFile)
      : undefined;

    // Look for @param JSDoc description
    let paramDesc = "";
    const jsDocs = node.jsDoc;
    if (jsDocs) {
      for (const doc of jsDocs) {
        if (!doc.tags) continue;
        const paramTag = doc.tags.find(
          (t) =>
            t.tagName.text === "param" &&
            t.name?.getText?.(sourceFile) === paramName,
        );
        if (paramTag) {
          paramDesc = commentToText(paramTag.comment);
        }
      }
    }

    parameters.push({
      name: paramName,
      type: { text: paramType },
      description: paramDesc,
      ...(optional && { optional: true }),
      ...(defaultValue && { default: defaultValue }),
    });
  }

  // Return type
  const returnType = node.type
    ? typeNodeSourceText(node.type, sourceFile)
    : "";

  // @returns / @return JSDoc tag
  let returnDesc = "";
  const jsDocs = node.jsDoc;
  if (jsDocs) {
    for (const doc of jsDocs) {
      if (!doc.tags) continue;
      const returnsTag = doc.tags.find(
        (t) =>
          t.tagName.text === "returns" || t.tagName.text === "return",
      );
      if (returnsTag) {
        returnDesc = commentToText(returnsTag.comment);
      }
    }
  }

  const typeParameters = extractTypeParameters(node, sourceFile);

  return {
    kind: "function",
    name: node.name.text,
    description,
    ...(typeParameters.length > 0 && { typeParameters }),
    parameters,
    return: {
      type: { text: returnType },
      ...(returnDesc && { description: returnDesc }),
    },
    ...tags,
  };
}

/* ================================================================ */
/*  Main Entry                                                        */
/* ================================================================ */

/**
 * Extracts exported type declarations carrying `@docUrl` from
 * TypeScript source files and writes a type-manifest.json.
 *
 * The manifest mirrors the Custom Elements Manifest structure:
 * `{ modules: [{ path, declarations }] }`.  Each declaration
 * carries `kind`, `name`, `description`, any custom JSDoc tags,
 * and kind-specific metadata (members, parameters, return, type).
 *
 * @param {object} [options]
 *
 * @param {string} [options.tsConfigPath="tsconfig.json"]
 *   Path to the project's tsconfig.json.  All files referenced by
 *   the tsconfig will be scanned.
 *
 * @param {string} [options.outFile="type-manifest.json"]
 *   Output path for the generated manifest.
 *
 * @param {string[]} [options.tags]
 *   JSDoc tag names to extract alongside the declaration.
 *   Defaults to: `docUrl`, `menuLabel`, `menuIcon`, `docPageTitle`,
 *   `docSections`.
 *
 * @returns {{ modules: object[] }} The generated manifest object.
 */
export function extractTypes(options = {}) {
  const {
    tsConfigPath = "tsconfig.json",
    outFile = "type-manifest.json",
    tags = ["docUrl", "menuLabel", "menuIcon", "menuGroup", "docPageTitle", "docSections"],
  } = options;

  const configPath = resolve(tsConfigPath);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    const msg = ts.flattenDiagnosticMessageText(
      configFile.error.messageText,
      "\n",
    );
    throw new Error(`Failed to read ${tsConfigPath}: ${msg}`);
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(configPath),
  );

  const program = ts.createProgram(
    parsedConfig.fileNames,
    parsedConfig.options,
  );
  const checker = program.getTypeChecker();
  const baseDir = dirname(configPath);

  const modules = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (sourceFile.fileName.includes("node_modules")) continue;

    const declarations = [];

    ts.forEachChild(sourceFile, (node) => {
      if (!hasExportModifier(node)) return;

      let decl = null;

      if (ts.isInterfaceDeclaration(node)) {
        decl = extractInterface(node, checker, sourceFile, tags);
      } else if (ts.isTypeAliasDeclaration(node)) {
        decl = extractTypeAlias(node, checker, sourceFile, tags);
      } else if (ts.isVariableStatement(node)) {
        decl = extractVariable(node, checker, sourceFile, tags);
      } else if (ts.isFunctionDeclaration(node)) {
        decl = extractFunction(node, checker, sourceFile, tags);
      }

      if (decl) {
        if (Array.isArray(decl)) {
          declarations.push(...decl.filter(Boolean));
        } else {
          declarations.push(decl);
        }
      }
    });

    if (declarations.length > 0) {
      modules.push({
        path: relative(baseDir, sourceFile.fileName),
        declarations,
      });
    }
  }

  const manifest = { modules };

  writeFileSync(resolve(outFile), JSON.stringify(manifest, null, 2));
  return manifest;
}
