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

function createGeneratorContext(
  instanceFieldNames,
  localNames = new Set(),
  inStaticMethod = false,
  instanceMethodNames = new Set()
) {
  return {
    instanceFieldNames,
    instanceMethodNames,
    localNames,
    inStaticMethod
  };
}

function cloneContextWithLocalNames(context, localNames) {
  return {
    instanceFieldNames: context.instanceFieldNames,
    instanceMethodNames: context.instanceMethodNames,
    localNames,
    inStaticMethod: context.inStaticMethod
  };
}

let generatedTempCounter = 0;

function nextGeneratedTemp(prefix) {
  generatedTempCounter += 1;
  return `__p5f_${prefix}${generatedTempCounter}`;
}

function generateSwitchCaseTestExpression(test, context, switchTargetName = null) {
  if (!test) {
    return null;
  }

  if (test.type === "Identifier" && switchTargetName) {
    const name = test.name;
    return `((typeof ${name} !== "undefined") ? ${name} : ${switchTargetName}.constructor.${name})`;
  }

  return generateExpression(test, context);
}

export function generate(ast, options = {}) {
  const flattenClassName = options.flattenClassName || null;
  const lines = [];
  const classMap = new Map((ast.classes ?? []).map((cls) => [cls.name, cls]));

  for (const declaration of ast.imports ?? []) {
    lines.push(`import { ${declaration.imported} } from ${JSON.stringify(declaration.source)};`);
  }

  if ((ast.imports ?? []).length > 0) {
    lines.push("");
  }

  for (const enm of ast.enums ?? []) {
    lines.push(generateEnum(enm));
  }

  if ((ast.enums ?? []).length > 0 && (ast.classes ?? []).length > 0) {
    lines.push("");
  }

  for (const cls of ast.classes) {
    if (flattenClassName && cls.name === flattenClassName) {
      lines.push(generateFlattenedPdeClass(cls));
      continue;
    }
    lines.push(generateClass(cls, classMap));
  }

  const mainTarget = findMainClass(ast, flattenClassName);
  const hasExports =
    ast.classes.some((cls) => cls.isExport && cls.name !== flattenClassName) ||
    (ast.enums ?? []).some((enm) => enm.isExport) ||
    (ast.interfaces ?? []).some((intf) => intf.isExport);
  if (mainTarget && !hasExports) {
    lines.push("");
    lines.push(`// Auto-start generated from ${mainTarget}.main`);
    lines.push(`${mainTarget}.main();`);
  }

  return `${lines.join("\n")}\n`;
}

function generateEnum(enm) {
  const prefix = enm.isExport ? "export " : "";
  const instanceFields = (enm.members ?? []).filter(
    (member) => member.type === "FieldDeclaration" && !member.modifiers.includes("static")
  );
  const instanceFieldNames = new Set(instanceFields.map((field) => field.name));
  const staticFields = (enm.members ?? []).filter(
    (member) => member.type === "FieldDeclaration" && member.modifiers.includes("static")
  );
  const instanceMethodNames = new Set(
    (enm.members ?? [])
      .filter(
        (member) =>
          member.type === "MethodDeclaration" &&
          !member.modifiers.includes("static")
      )
      .map((member) => member.name)
  );
  const constructorMember = (enm.members ?? []).find(
    (member) => member.type === "ConstructorDeclaration"
  );

  const lines = [];
  lines.push(`${prefix}class ${enm.name} {`);

  if (constructorMember) {
    lines.push(
      generateConstructor(
        constructorMember,
        1,
        instanceFields,
        false,
        instanceFieldNames,
        instanceMethodNames
      )
    );
  } else if (instanceFields.length > 0) {
    lines.push(
      generateSyntheticConstructor(
        instanceFields,
        1,
        false,
        instanceFieldNames,
        instanceMethodNames
      )
    );
  }

  for (const member of enm.members ?? []) {
    if (member.type === "FieldDeclaration" || member.type === "ConstructorDeclaration") {
      continue;
    }
    lines.push(generateMethod(member, 1, instanceFieldNames, instanceMethodNames));
  }

  const values = (enm.constants ?? []).map((constant) => `${enm.name}.${constant.name}`).join(", ");
  lines.push(`${indent(1)}static values() {`);
  lines.push(`${indent(2)}return [${values}];`);
  lines.push(`${indent(1)}}`);

  lines.push(`${indent(1)}static valueOf(name) {`);
  lines.push(`${indent(2)}const value = ${enm.name}[name];`);
  lines.push(`${indent(2)}if (!value) {`);
  lines.push(`${indent(3)}throw new Error(\`No enum constant ${enm.name}.\${name}\`);`);
  lines.push(`${indent(2)}}`);
  lines.push(`${indent(2)}return value;`);
  lines.push(`${indent(1)}}`);

  lines.push("}");

  (enm.constants ?? []).forEach((constant, ordinal) => {
    const args = (constant.arguments ?? []).map((arg) => generateExpression(arg)).join(", ");
    lines.push(`{`);
    lines.push(`${indent(1)}const value = new ${enm.name}(${args});`);
    lines.push(`${indent(1)}value.name = ${JSON.stringify(constant.name)};`);
    lines.push(`${indent(1)}value.ordinal = ${ordinal};`);
    lines.push(`${indent(1)}${enm.name}.${constant.name} = Object.freeze(value);`);
    lines.push(`}`);
  });

  for (const member of staticFields) {
    const target = enm.name;
    const value = member.initializer ? generateExpression(member.initializer) : "undefined";
    lines.push(`${target}.${member.name} = ${value};`);
  }

  return lines.join("\n");
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
  const context = createGeneratorContext(new Set(), localNames, false, new Set());
  const body = generateBlock(method.body, 0, context);
  return `function ${method.name}(${params}) ${body}`;
}

function collectEffectiveInstanceFields(cls, classMap, visited = new Set()) {
  if (!cls || visited.has(cls.name)) {
    return new Set();
  }
  visited.add(cls.name);

  const fieldNames = cls.superClass
    ? collectEffectiveInstanceFields(classMap.get(cls.superClass), classMap, visited)
    : new Set();

  for (const member of cls.members) {
    if (member.type === "FieldDeclaration" && !member.modifiers.includes("static")) {
      fieldNames.add(member.name);
    }
  }

  return fieldNames;
}

function collectEffectiveInstanceMethods(cls, classMap, visited = new Set()) {
  if (!cls || visited.has(cls.name)) {
    return new Set();
  }
  visited.add(cls.name);

  const methodNames = cls.superClass
    ? collectEffectiveInstanceMethods(classMap.get(cls.superClass), classMap, visited)
    : new Set();

  for (const member of cls.members) {
    if (member.type === "MethodDeclaration" && !member.modifiers.includes("static")) {
      methodNames.add(member.name);
    }
  }

  return methodNames;
}

function generateClass(cls, classMap = new Map()) {
  const instanceFields = cls.members.filter(
    (member) => member.type === "FieldDeclaration" && !member.modifiers.includes("static")
  );
  const ownInstanceFieldNames = new Set(instanceFields.map((field) => field.name));
  const staticFields = cls.members.filter(
    (member) => member.type === "FieldDeclaration" && member.modifiers.includes("static")
  );
  const instanceFieldNames = collectEffectiveInstanceFields(cls, classMap);
  const instanceMethodNames = collectEffectiveInstanceMethods(cls, classMap);
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
        ownInstanceFieldNames,
        instanceMethodNames
      )
    );
  } else if (instanceFields.length > 0) {
    lines.push(
      generateSyntheticConstructor(
        instanceFields,
        1,
        Boolean(cls.superClass),
        ownInstanceFieldNames,
        instanceMethodNames
      )
    );
  }

  for (const member of cls.members) {
    if (member.type === "FieldDeclaration" || member.type === "ConstructorDeclaration") {
      continue;
    }
    if (member.type === "MethodDeclaration" && member.isAbstract) {
      continue;
    }
    lines.push(generateMethod(member, 1, instanceFieldNames, instanceMethodNames));
  }

  lines.push("}");

  for (const member of staticFields) {
    const target = cls.name;
    const value = member.initializer ? generateExpression(member.initializer) : "undefined";
    lines.push(`${target}.${member.name} = ${value};`);
  }

  return lines.join("\n");
}

function generateMethod(method, level, instanceFieldNames, instanceMethodNames = new Set()) {
  const staticPrefix = method.modifiers.includes("static") ? "static " : "";
  const params = method.params.map((p) => p.name).join(", ");
  const localNames = new Set(method.params.map((p) => p.name));
  const context = createGeneratorContext(
    instanceFieldNames,
    localNames,
    method.modifiers.includes("static"),
    instanceMethodNames
  );
  const body = generateBlock(method.body, level, context);
  return `${indent(level)}${staticPrefix}${method.name}(${params}) ${body}`;
}

function generateConstructor(
  constructorNode,
  level,
  instanceFields,
  hasSuperClass,
  instanceFieldNames,
  instanceMethodNames = new Set()
) {
  const params = constructorNode.params.map((p) => p.name).join(", ");
  const lines = [`${indent(level)}constructor(${params}) {`];
  const context = createGeneratorContext(
    instanceFieldNames,
    new Set(constructorNode.params.map((p) => p.name)),
    false,
    instanceMethodNames
  );

  const ctorCall = detectExplicitCtorCall(constructorNode.body.statements);
  if (ctorCall?.kind === "super") {
    const args = ctorCall.call.arguments
      .map((arg) => generateExpression(arg, context))
      .join(", ");
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

function generateSyntheticConstructor(
  instanceFields,
  level,
  hasSuperClass,
  instanceFieldNames,
  instanceMethodNames = new Set()
) {
  const lines = [`${indent(level)}constructor() {`];
  const context = createGeneratorContext(
    instanceFieldNames,
    new Set(),
    false,
    instanceMethodNames
  );

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
    case "SwitchStatement": {
      const switchTarget = generateExpression(stmt.discriminant, context);
      const hasBareIdentifierCase = stmt.cases.some(
        (switchCase) => switchCase.test && switchCase.test.type === "Identifier"
      );
      const switchTargetName = hasBareIdentifierCase
        ? nextGeneratedTemp("switchTarget")
        : null;
      const lines = [];

      if (switchTargetName) {
        lines.push(`${indent(level)}{`);
        lines.push(`${indent(level + 1)}const ${switchTargetName} = ${switchTarget};`);
        lines.push(`${indent(level + 1)}switch (${switchTargetName}) {`);
      } else {
        lines.push(`${indent(level)}switch (${switchTarget}) {`);
      }

      const caseIndent = switchTargetName ? level + 2 : level + 1;
      const statementIndent = switchTargetName ? level + 3 : level + 2;

      for (const switchCase of stmt.cases) {
        if (switchCase.test) {
          const caseExpr = generateSwitchCaseTestExpression(
            switchCase.test,
            context,
            switchTargetName
          );
          lines.push(`${indent(caseIndent)}case ${caseExpr}:`);
        } else {
          lines.push(`${indent(caseIndent)}default:`);
        }

        for (const caseStmt of switchCase.consequent) {
          lines.push(generateStatement(caseStmt, statementIndent, context));
        }
      }

      if (switchTargetName) {
        lines.push(`${indent(level + 1)}}`);
        lines.push(`${indent(level)}}`);
      } else {
        lines.push(`${indent(level)}}`);
      }

      return lines.join("\n");
    }
    case "BreakStatement":
      return `${indent(level)}break;`;
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
        (context.instanceFieldNames.has(expr.name) ||
          context.instanceMethodNames.has(expr.name)) &&
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
