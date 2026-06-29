function indent(level) {
  return "  ".repeat(level);
}

function mapSpecialMemberChain(expr) {
  const parts = [];
  let node = expr;

  while (node && node.type === "MemberExpression") {
    parts.unshift(node.property);
    node = node.object;
  }

  if (node && node.type === "Identifier") {
    parts.unshift(node.name);
  } else {
    return null;
  }

  const chain = parts.join(".");
  if (chain === "System.out.println") {
    return "console.log";
  }
  return null;
}

function createGeneratorContext(instanceFieldNames, localNames = new Set(), inStaticMethod = false) {
  return {
    instanceFieldNames,
    localNames,
    inStaticMethod
  };
}

function cloneContextWithLocalNames(context, localNames) {
  return {
    instanceFieldNames: context.instanceFieldNames,
    localNames,
    inStaticMethod: context.inStaticMethod
  };
}

export function generate(ast, options = {}) {
  const flattenClassName = options.flattenClassName || null;
  const lines = [];

  for (const declaration of ast.imports ?? []) {
    lines.push(`import { ${declaration.imported} } from ${JSON.stringify(declaration.source)};`);
  }

  if ((ast.imports ?? []).length > 0) {
    lines.push("");
  }

  for (const cls of ast.classes) {
    if (flattenClassName && cls.name === flattenClassName) {
      lines.push(generateFlattenedPdeClass(cls));
      continue;
    }
    lines.push(generateClass(cls));
  }

  const mainTarget = findMainClass(ast, flattenClassName);
  const hasExports = ast.classes.some((cls) => cls.isExport && cls.name !== flattenClassName);
  if (mainTarget && !hasExports) {
    lines.push("");
    lines.push(`// Auto-start generated from ${mainTarget}.main`);
    lines.push(`${mainTarget}.main();`);
  }

  return `${lines.join("\n")}\n`;
}

function findMainClass(ast, excludedClassName = null) {
  for (const cls of ast.classes) {
    if (excludedClassName && cls.name === excludedClassName) {
      continue;
    }
    for (const member of cls.members) {
      if (member.type === "MethodDeclaration" && member.name === "main") {
        return cls.name;
      }
    }
  }
  return null;
}

function generateFlattenedPdeClass(cls) {
  const lines = [];
  const globalContext = createGeneratorContext(new Set(), new Set(), false);

  for (const member of cls.members) {
    if (member.type !== "FieldDeclaration" || member.modifiers.includes("static")) {
      continue;
    }
    const initializer = member.initializer
      ? generateExpression(member.initializer, globalContext)
      : "undefined";
    lines.push(`let ${member.name} = ${initializer};`);
  }

  for (const member of cls.members) {
    if (member.type !== "MethodDeclaration") {
      continue;
    }
    lines.push(generateGlobalMethod(member));
  }

  return lines.join("\n");
}

function generateGlobalMethod(method) {
  const params = method.params.map((p) => p.name).join(", ");
  const localNames = new Set(method.params.map((p) => p.name));
  const context = createGeneratorContext(new Set(), localNames, false);
  const body = generateBlock(method.body, 0, context);
  return `function ${method.name}(${params}) ${body}`;
}

function generateClass(cls) {
  const instanceFields = cls.members.filter(
    (member) => member.type === "FieldDeclaration" && !member.modifiers.includes("static")
  );
  const instanceFieldNames = new Set(instanceFields.map((field) => field.name));
  const staticFields = cls.members.filter(
    (member) => member.type === "FieldDeclaration" && member.modifiers.includes("static")
  );
  const constructorMember = cls.members.find(
    (member) => member.type === "ConstructorDeclaration"
  );

  const lines = [];
  const extendsPart = cls.superClass ? ` extends ${cls.superClass}` : "";
  lines.push(`${cls.isExport ? "export " : ""}class ${cls.name}${extendsPart} {`);

  if (constructorMember) {
    lines.push(
      generateConstructor(
        constructorMember,
        1,
        instanceFields,
        Boolean(cls.superClass),
        instanceFieldNames
      )
    );
  } else if (instanceFields.length > 0) {
    lines.push(
      generateSyntheticConstructor(instanceFields, 1, Boolean(cls.superClass), instanceFieldNames)
    );
  }

  for (const member of cls.members) {
    if (member.type === "FieldDeclaration" || member.type === "ConstructorDeclaration") {
      continue;
    }
    lines.push(generateMethod(member, 1, instanceFieldNames));
  }

  lines.push("}");

  for (const member of staticFields) {
    const target = cls.name;
    const value = member.initializer ? generateExpression(member.initializer) : "undefined";
    lines.push(`${target}.${member.name} = ${value};`);
  }

  return lines.join("\n");
}

function generateMethod(method, level, instanceFieldNames) {
  const staticPrefix = method.modifiers.includes("static") ? "static " : "";
  const params = method.params.map((p) => p.name).join(", ");
  const localNames = new Set(method.params.map((p) => p.name));
  const context = createGeneratorContext(instanceFieldNames, localNames, method.modifiers.includes("static"));
  const body = generateBlock(method.body, level, context);
  return `${indent(level)}${staticPrefix}${method.name}(${params}) ${body}`;
}

function generateConstructor(
  constructorNode,
  level,
  instanceFields,
  hasSuperClass,
  instanceFieldNames
) {
  const params = constructorNode.params.map((p) => p.name).join(", ");
  const lines = [`${indent(level)}constructor(${params}) {`];
  const context = createGeneratorContext(
    instanceFieldNames,
    new Set(constructorNode.params.map((p) => p.name)),
    false
  );

  const ctorCall = detectExplicitCtorCall(constructorNode.body.statements);
  if (ctorCall?.kind === "super") {
    const args = ctorCall.call.arguments.map(generateExpression).join(", ");
    lines.push(`${indent(level + 1)}super(${args});`);
  } else if (hasSuperClass) {
    lines.push(`${indent(level + 1)}super();`);
  }

  for (const field of instanceFields) {
    const init = field.initializer ? generateExpression(field.initializer, context) : "undefined";
    lines.push(`${indent(level + 1)}this.${field.name} = ${init};`);
  }

  const bodyStatements = ctorCall
    ? constructorNode.body.statements.slice(1)
    : constructorNode.body.statements;

  for (const stmt of bodyStatements) {
    lines.push(generateStatement(stmt, level + 1, context));
  }

  lines.push(`${indent(level)}}`);
  return lines.join("\n");
}

function detectExplicitCtorCall(statements) {
  if (statements.length === 0) {
    return null;
  }

  const first = statements[0];
  if (first.type !== "ExpressionStatement") {
    return null;
  }
  if (first.expression.type !== "CallExpression") {
    return null;
  }

  const callee = first.expression.callee;
  if (callee.type === "SuperExpression") {
    return { kind: "super", call: first.expression };
  }
  if (callee.type === "ThisExpression") {
    return { kind: "this", call: first.expression };
  }

  return null;
}

function generateSyntheticConstructor(instanceFields, level, hasSuperClass, instanceFieldNames) {
  const lines = [`${indent(level)}constructor() {`];
  const context = createGeneratorContext(instanceFieldNames, new Set(), false);

  if (hasSuperClass) {
    lines.push(`${indent(level + 1)}super();`);
  }

  for (const field of instanceFields) {
    const init = field.initializer ? generateExpression(field.initializer, context) : "undefined";
    lines.push(`${indent(level + 1)}this.${field.name} = ${init};`);
  }

  lines.push(`${indent(level)}}`);
  return lines.join("\n");
}

function generateBlock(block, level, context) {
  const lines = ["{"];
  const blockContext = cloneContextWithLocalNames(context, new Set(context.localNames));
  for (const stmt of block.statements) {
    lines.push(generateStatement(stmt, level + 1, blockContext));
  }
  lines.push(`${indent(level)}}`);
  return lines.join("\n");
}

function generateStatement(stmt, level, context) {
  switch (stmt.type) {
    case "BlockStatement":
      return `${indent(level)}${generateBlock(stmt, level, context)}`;
    case "VariableDeclaration": {
      const init = stmt.initializer
        ? ` = ${generateExpression(stmt.initializer, context)}`
        : "";
      context.localNames.add(stmt.name);
      return `${indent(level)}let ${stmt.name}${init};`;
    }
    case "ExpressionStatement":
      return `${indent(level)}${generateExpression(stmt.expression, context)};`;
    case "ReturnStatement":
      if (!stmt.argument) {
        return `${indent(level)}return;`;
      }
      return `${indent(level)}return ${generateExpression(stmt.argument, context)};`;
    case "IfStatement": {
      const base = `${indent(level)}if (${generateExpression(stmt.test, context)})`;
      const consequent = wrapStatement(stmt.consequent, level, context);
      if (!stmt.alternate) {
        return `${base} ${consequent}`;
      }
      const alternate = wrapStatement(stmt.alternate, level, context);
      return `${base} ${consequent} else ${alternate}`;
    }
    case "WhileStatement": {
      const test = generateExpression(stmt.test, context);
      return `${indent(level)}while (${test}) ${wrapStatement(stmt.body, level, context)}`;
    }
    case "ForStatement": {
      const loopContext = cloneContextWithLocalNames(context, new Set(context.localNames));
      const init = stmt.init
        ? stmt.init.type === "VariableDeclaration"
          ? (() => {
              const initExpr = stmt.init.initializer
                ? ` = ${generateExpression(stmt.init.initializer, context)}`
                : "";
              loopContext.localNames.add(stmt.init.name);
              return `let ${stmt.init.name}${initExpr}`;
            })()
          : generateExpression(stmt.init, context)
        : "";
      const test = stmt.test ? generateExpression(stmt.test, loopContext) : "";
      const update = stmt.update ? generateExpression(stmt.update, loopContext) : "";
      return `${indent(level)}for (${init}; ${test}; ${update}) ${wrapStatement(
        stmt.body,
        level,
        loopContext
      )}`;
    }
    case "ForEachStatement":
      {
      const eachContext = cloneContextWithLocalNames(context, new Set(context.localNames));
      eachContext.localNames.add(stmt.variable.name);
      return `${indent(level)}for (let ${stmt.variable.name} of ${generateExpression(
        stmt.iterable
      , context)}) ${wrapStatement(stmt.body, level, eachContext)}`;
      }
    case "TryStatement": {
      const tryPart = `${indent(level)}try ${generateBlock(stmt.block, level, context)}`;
      const catchPart = stmt.handler
        ? (() => {
            const catchContext = cloneContextWithLocalNames(context, new Set(context.localNames));
            catchContext.localNames.add(stmt.handler.param.name);
            return ` catch (${stmt.handler.param.name}) ${generateBlock(
              stmt.handler.body,
              level,
              catchContext
            )}`;
          })()
        : "";
      const finallyPart = stmt.finalizer
        ? ` finally ${generateBlock(stmt.finalizer, level, context)}`
        : "";
      return `${tryPart}${catchPart}${finallyPart}`;
    }
    case "ThrowStatement":
      return `${indent(level)}throw ${generateExpression(stmt.argument, context)};`;
    default:
      throw new Error(`Unsupported statement type: ${stmt.type}`);
  }
}

function wrapStatement(stmt, level, context) {
  if (stmt.type === "BlockStatement") {
    return generateBlock(stmt, level, context);
  }
  const nestedContext = cloneContextWithLocalNames(context, new Set(context.localNames));
  return `\n${generateStatement(stmt, level + 1, nestedContext)}`;
}

function generateExpression(expr, context = null) {
  switch (expr.type) {
    case "Literal":
      if (expr.value === null) {
        return "null";
      }
      if (typeof expr.value === "string") {
        return JSON.stringify(expr.value);
      }
      return String(expr.value);
    case "Identifier":
      if (
        context &&
        !context.inStaticMethod &&
        context.instanceFieldNames.has(expr.name) &&
        !context.localNames.has(expr.name)
      ) {
        return `this.${expr.name}`;
      }
      return expr.name;
    case "ThisExpression":
      return "this";
    case "SuperExpression":
      return "super";
    case "BinaryExpression":
      return `(${generateExpression(expr.left, context)} ${expr.operator} ${generateExpression(
        expr.right,
        context
      )})`;
    case "AssignmentExpression":
      return `(${generateExpression(expr.left, context)} ${expr.operator} ${generateExpression(
        expr.right,
        context
      )})`;
    case "UnaryExpression":
      return expr.prefix
        ? `${expr.operator}${generateExpression(expr.argument, context)}`
        : `${generateExpression(expr.argument, context)}${expr.operator}`;
    case "UpdateExpression":
      return expr.prefix
        ? `${expr.operator}${generateExpression(expr.argument, context)}`
        : `${generateExpression(expr.argument, context)}${expr.operator}`;
    case "MemberExpression": {
      const mapped = mapSpecialMemberChain(expr);
      if (mapped) {
        return mapped;
      }
      return `${generateExpression(expr.object, context)}.${expr.property}`;
    }
    case "IndexExpression":
      return `${generateExpression(expr.object, context)}[${generateExpression(expr.index, context)}]`;
    case "CallExpression": {
      const callee = generateExpression(expr.callee, context);
      const args = expr.arguments.map((arg) => generateExpression(arg, context)).join(", ");
      return `${callee}(${args})`;
    }
    case "NewExpression": {
      const args = expr.arguments.map((arg) => generateExpression(arg, context)).join(", ");
      return `new ${expr.callee}(${args})`;
    }
    case "NewArrayExpression":
      return generateNewArrayExpression(expr.dimensions, 0, context);
    default:
      throw new Error(`Unsupported expression type: ${expr.type}`);
  }
}

function generateNewArrayExpression(dimensions, index = 0, context = null) {
  const sizeExpr = generateExpression(dimensions[index], context);
  if (index === dimensions.length - 1) {
    return `new Array(${sizeExpr}).fill(null)`;
  }

  const nested = generateNewArrayExpression(dimensions, index + 1, context);
  return `Array.from({ length: ${sizeExpr} }, () => ${nested})`;
}
