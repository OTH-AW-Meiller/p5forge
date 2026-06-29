const PRIMITIVE_BASE_TYPES = new Set([
  "int",
  "float",
  "double",
  "long",
  "short",
  "byte",
  "boolean",
  "char",
  "String",
  "void",
  "color",
  "PImage",
  "PFont",
  "PVector",
  "ArrayList",
  "HashMap",
  "IntDict",
  "FloatDict",
  "StringDict",
  "IntList",
  "FloatList",
  "StringList"
]);

export function validateSemantics(ast) {
  const errors = [];
  const classNames = new Set(ast.classes.map((cls) => cls.name));
  const importedNames = new Set((ast.imports ?? []).map((imp) => imp.imported));

  function error(message) {
    errors.push(message);
  }

  function baseType(typeName) {
    return typeName.replace(/\[\]/g, "");
  }

  function mergeTypeParams(...sets) {
    const out = new Set();
    for (const set of sets) {
      for (const item of set) {
        out.add(item);
      }
    }
    return out;
  }

  function checkTypeExists(typeName, context, localTypeParams = new Set()) {
    const base = baseType(typeName);
    const known =
      PRIMITIVE_BASE_TYPES.has(base) ||
      classNames.has(base) ||
      importedNames.has(base) ||
      localTypeParams.has(base);

    if (!known) {
      error(`Unknown type '${typeName}' in ${context}.`);
    }
  }

  function validateLocalVarType(typeName, hasInitializer, context) {
    if (typeName !== "var") {
      return;
    }

    if (!hasInitializer) {
      error(`'var' requires an initializer in ${context}.`);
      return;
    }
  }

  function forbidVarType(typeName, context) {
    if (typeName === "var") {
      error(`'var' is not allowed in ${context}.`);
      return true;
    }
    return false;
  }

  function isCtorCallStatement(stmt) {
    if (stmt.type !== "ExpressionStatement") {
      return null;
    }
    const expr = stmt.expression;
    if (expr.type !== "CallExpression") {
      return null;
    }
    if (expr.callee.type === "ThisExpression") {
      return "this";
    }
    if (expr.callee.type === "SuperExpression") {
      return "super";
    }
    return null;
  }

  function validateExpression(expr, classScope, localTypeParams) {
    switch (expr.type) {
      case "Literal":
      case "Identifier":
      case "ThisExpression":
      case "SuperExpression":
        return;
      case "BinaryExpression":
      case "AssignmentExpression":
        validateExpression(expr.left, classScope, localTypeParams);
        validateExpression(expr.right, classScope, localTypeParams);
        return;
      case "UnaryExpression":
      case "UpdateExpression":
        validateExpression(expr.argument, classScope, localTypeParams);
        return;
      case "MemberExpression":
        validateExpression(expr.object, classScope, localTypeParams);
        return;
      case "IndexExpression":
        validateExpression(expr.object, classScope, localTypeParams);
        validateExpression(expr.index, classScope, localTypeParams);
        return;
      case "CallExpression":
        validateExpression(expr.callee, classScope, localTypeParams);
        for (const arg of expr.arguments) {
          validateExpression(arg, classScope, localTypeParams);
        }
        return;
      case "NewExpression":
        checkTypeExists(
          expr.callee,
          `new-expression in class ${classScope.name}`,
          localTypeParams
        );
        for (const arg of expr.arguments) {
          validateExpression(arg, classScope, localTypeParams);
        }
        return;
      case "NewArrayExpression":
        checkTypeExists(
          expr.elementType,
          `array allocation in class ${classScope.name}`,
          localTypeParams
        );
        for (const dim of expr.dimensions) {
          validateExpression(dim, classScope, localTypeParams);
        }
        return;
      default:
        return;
    }
  }

  function validateStatement(stmt, classScope, localTypeParams) {
    switch (stmt.type) {
      case "BlockStatement":
        for (const inner of stmt.statements) {
          validateStatement(inner, classScope, localTypeParams);
        }
        return;
      case "VariableDeclaration":
        validateLocalVarType(
          stmt.varType,
          Boolean(stmt.initializer),
          `variable declaration '${stmt.name}'`
        );

        if (stmt.varType === "var") {
          if (stmt.initializer) {
            validateExpression(stmt.initializer, classScope, localTypeParams);
          }
          return;
        }

        checkTypeExists(
          stmt.varType,
          `variable declaration '${stmt.name}'`,
          localTypeParams
        );
        if (stmt.initializer) {
          validateExpression(stmt.initializer, classScope, localTypeParams);
        }
        return;
      case "ExpressionStatement":
        validateExpression(stmt.expression, classScope, localTypeParams);
        return;
      case "ReturnStatement":
        if (stmt.argument) {
          validateExpression(stmt.argument, classScope, localTypeParams);
        }
        return;
      case "IfStatement":
        validateExpression(stmt.test, classScope, localTypeParams);
        validateStatement(stmt.consequent, classScope, localTypeParams);
        if (stmt.alternate) {
          validateStatement(stmt.alternate, classScope, localTypeParams);
        }
        return;
      case "WhileStatement":
        validateExpression(stmt.test, classScope, localTypeParams);
        validateStatement(stmt.body, classScope, localTypeParams);
        return;
      case "ForStatement":
        if (stmt.init) {
          if (stmt.init.type === "VariableDeclaration") {
            validateLocalVarType(
              stmt.init.varType,
              Boolean(stmt.init.initializer),
              `for-initializer '${stmt.init.name}'`
            );

            if (stmt.init.varType === "var") {
              if (stmt.init.initializer) {
                validateExpression(stmt.init.initializer, classScope, localTypeParams);
              }
            } else {
            checkTypeExists(
              stmt.init.varType,
              `for-initializer '${stmt.init.name}'`,
              localTypeParams
            );
            }
            if (stmt.init.initializer) {
              validateExpression(stmt.init.initializer, classScope, localTypeParams);
            }
          } else {
            validateExpression(stmt.init, classScope, localTypeParams);
          }
        }
        if (stmt.test) {
          validateExpression(stmt.test, classScope, localTypeParams);
        }
        if (stmt.update) {
          validateExpression(stmt.update, classScope, localTypeParams);
        }
        validateStatement(stmt.body, classScope, localTypeParams);
        return;
      case "ForEachStatement": {
        if (stmt.variable.varType !== "var") {
          checkTypeExists(
            stmt.variable.varType,
            `for-each Variable '${stmt.variable.name}'`,
            localTypeParams
          );
        }
        validateExpression(stmt.iterable, classScope, localTypeParams);
        validateStatement(stmt.body, classScope, localTypeParams);
        return;
      }
      case "TryStatement":
        validateStatement(stmt.block, classScope, localTypeParams);
        if (stmt.handler) {
          const catchTypes = stmt.handler.param.paramTypes ?? [stmt.handler.param.paramType];
          if (catchTypes.length > 1 && catchTypes.includes("var")) {
            error(
              `'var' is not allowed in multi-catch for '${stmt.handler.param.name}'.`
            );
          }

          for (const catchType of catchTypes) {
            if (catchType !== "var") {
              checkTypeExists(
                catchType,
                `catch parameter '${stmt.handler.param.name}'`,
                localTypeParams
              );
            }
          }
          validateStatement(stmt.handler.body, classScope, localTypeParams);
        }
        if (stmt.finalizer) {
          validateStatement(stmt.finalizer, classScope, localTypeParams);
        }
        return;
      case "ThrowStatement":
        validateExpression(stmt.argument, classScope, localTypeParams);
        return;
      default:
        return;
    }
  }

  for (const cls of ast.classes) {
    const classTypeParams = new Set(cls.typeParameters ?? []);

    if ((cls.typeParameters ?? []).length !== classTypeParams.size) {
      error(`Duplicate type parameters in class ${cls.name}.`);
    }

    if (cls.superClass) {
      checkTypeExists(cls.superClass, `extends clause of class ${cls.name}`, classTypeParams);
    }

    const fieldNames = new Set();
    const methodNames = new Set();
    const constructorArities = new Set();

    for (const member of cls.members) {
      if (member.type === "FieldDeclaration") {
        if (fieldNames.has(member.name)) {
          error(`Duplicate field '${member.name}' in class ${cls.name}.`);
        }
        fieldNames.add(member.name);
        if (
          !forbidVarType(
            member.fieldType,
            `field '${member.name}' in class ${cls.name}`
          )
        ) {
          checkTypeExists(
            member.fieldType,
            `field '${member.name}' in class ${cls.name}`,
            classTypeParams
          );
        }
        if (member.initializer) {
          validateExpression(member.initializer, cls, classTypeParams);
        }
      }

      if (member.type === "MethodDeclaration") {
        if (methodNames.has(member.name)) {
          error(`Duplicate method '${member.name}' in class ${cls.name}.`);
        }
        methodNames.add(member.name);

        const methodTypeParams = new Set(member.typeParameters ?? []);
        if ((member.typeParameters ?? []).length !== methodTypeParams.size) {
          error(`Duplicate type parameters in method ${cls.name}.${member.name}.`);
        }
        const methodScopeTypeParams = mergeTypeParams(classTypeParams, methodTypeParams);

        if (!forbidVarType(member.returnType, `return type of ${cls.name}.${member.name}`)) {
          checkTypeExists(
            member.returnType,
            `return type of ${cls.name}.${member.name}`,
            methodScopeTypeParams
          );
        }
        for (const param of member.params) {
          if (
            !forbidVarType(
              param.paramType,
              `Parameter '${param.name}' in ${cls.name}.${member.name}`
            )
          ) {
            checkTypeExists(
              param.paramType,
              `Parameter '${param.name}' in ${cls.name}.${member.name}`,
              methodScopeTypeParams
            );
          }
        }
        validateStatement(member.body, cls, methodScopeTypeParams);
      }

      if (member.type === "ConstructorDeclaration") {
        const arity = member.params.length;
        if (constructorArities.has(arity)) {
          error(`Duplicate constructor with arity ${arity} in class ${cls.name}.`);
        }
        constructorArities.add(arity);

        for (const param of member.params) {
          if (
            !forbidVarType(
              param.paramType,
              `constructor parameter '${param.name}' in class ${cls.name}`
            )
          ) {
            checkTypeExists(
              param.paramType,
              `constructor parameter '${param.name}' in class ${cls.name}`,
              classTypeParams
            );
          }
        }

        member.body.statements.forEach((stmt, index) => {
          const kind = isCtorCallStatement(stmt);
          if (kind && index !== 0) {
            error(
              `${kind}(...) must be the first statement in constructor ${cls.name}.`
            );
          }
        });

        const firstKind =
          member.body.statements.length > 0
            ? isCtorCallStatement(member.body.statements[0])
            : null;

        if (firstKind === "super" && !cls.superClass) {
          error(`super(...) is invalid in class ${cls.name} without extends.`);
        }

        if (firstKind === "this") {
          error(
            `this(...) is currently not supported (class ${cls.name}).`
          );
        }

        validateStatement(member.body, cls, classTypeParams);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Semantic errors:\n- ${errors.join("\n- ")}`);
  }
}
