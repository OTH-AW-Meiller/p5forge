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
  const classNames = new Set((ast.classes ?? []).map((cls) => cls.name));
  const enumNames = new Set((ast.enums ?? []).map((enm) => enm.name));
  const interfaceNames = new Set((ast.interfaces ?? []).map((intf) => intf.name));
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
      enumNames.has(base) ||
      interfaceNames.has(base) ||
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
      case "SwitchStatement":
        validateExpression(stmt.discriminant, classScope, localTypeParams);
        for (const switchCase of stmt.cases) {
          if (switchCase.test) {
            validateExpression(switchCase.test, classScope, localTypeParams);
          }
          for (const caseStmt of switchCase.consequent) {
            validateStatement(caseStmt, classScope, localTypeParams);
          }
        }
        return;
      case "BreakStatement":
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

  const allTopLevelTypeNames = new Set();
  for (const enumName of enumNames) {
    if (allTopLevelTypeNames.has(enumName)) {
      error(`Duplicate top-level type '${enumName}'.`);
      continue;
    }
    allTopLevelTypeNames.add(enumName);
  }
  for (const interfaceName of interfaceNames) {
    if (allTopLevelTypeNames.has(interfaceName)) {
      error(`Duplicate top-level type '${interfaceName}'.`);
      continue;
    }
    allTopLevelTypeNames.add(interfaceName);
  }
  for (const className of classNames) {
    if (allTopLevelTypeNames.has(className)) {
      error(`Duplicate top-level type '${className}'.`);
      continue;
    }
    allTopLevelTypeNames.add(className);
  }

  const interfaceMap = new Map((ast.interfaces ?? []).map((intf) => [intf.name, intf]));
  const classMap = new Map((ast.classes ?? []).map((cls) => [cls.name, cls]));

  function collectInterfaceMethods(interfaceName, seen = new Set()) {
    if (seen.has(interfaceName)) {
      return [];
    }
    seen.add(interfaceName);

    const intf = interfaceMap.get(interfaceName);
    if (!intf) {
      return [];
    }

    const methods = [];
    for (const superName of intf.extendsInterfaces ?? []) {
      methods.push(...collectInterfaceMethods(superName, seen));
    }
    for (const member of intf.members ?? []) {
      if (member.type === "InterfaceMethodDeclaration") {
        methods.push(member);
      }
    }
    return methods;
  }

  function collectAbstractClassMethods(className, seen = new Set()) {
    if (seen.has(className)) {
      return [];
    }
    seen.add(className);

    const cls = classMap.get(className);
    if (!cls) {
      return [];
    }

    const inherited = cls.superClass
      ? collectAbstractClassMethods(cls.superClass, seen)
      : [];
    const abstractMethods = new Map(inherited.map((method) => [`${method.name}/${method.params.length}`, method]));

    for (const member of cls.members ?? []) {
      if (member.type !== "MethodDeclaration") {
        continue;
      }

      const key = `${member.name}/${member.params.length}`;
      if (member.isAbstract) {
        abstractMethods.set(key, member);
      } else {
        abstractMethods.delete(key);
      }
    }

    return [...abstractMethods.values()];
  }

  function collectImplementedInterfacesForClass(className, seen = new Set()) {
    if (seen.has(className)) {
      return new Set();
    }
    seen.add(className);

    const cls = classMap.get(className);
    if (!cls) {
      return new Set();
    }

    const interfaces = new Set(cls.interfaces ?? []);
    if (cls.superClass) {
      for (const interfaceName of collectImplementedInterfacesForClass(cls.superClass, seen)) {
        interfaces.add(interfaceName);
      }
    }

    return interfaces;
  }

  function collectEffectiveClassMethods(className, seen = new Set()) {
    if (seen.has(className)) {
      return new Map();
    }
    seen.add(className);

    const cls = classMap.get(className);
    if (!cls) {
      return new Map();
    }

    const methods = cls.superClass
      ? collectEffectiveClassMethods(cls.superClass, seen)
      : new Map();

    for (const member of cls.members ?? []) {
      if (member.type !== "MethodDeclaration") {
        continue;
      }
      methods.set(`${member.name}/${member.params.length}`, member);
    }

    return methods;
  }

  for (const intf of ast.interfaces ?? []) {
    const interfaceTypeParams = new Set(intf.typeParameters ?? []);

    if ((intf.typeParameters ?? []).length !== interfaceTypeParams.size) {
      error(`Duplicate type parameters in interface ${intf.name}.`);
    }

    const superInterfaces = new Set();
    for (const superName of intf.extendsInterfaces ?? []) {
      if (superInterfaces.has(superName)) {
        error(`Duplicate superinterface '${superName}' in interface ${intf.name}.`);
      }
      superInterfaces.add(superName);

      if (!interfaceNames.has(superName) && !importedNames.has(superName)) {
        error(`Unknown interface '${superName}' in extends clause of interface ${intf.name}.`);
      }
    }

    const fieldNames = new Set();
    const methodKeys = new Set();

    for (const member of intf.members ?? []) {
      if (member.type === "FieldDeclaration") {
        if (fieldNames.has(member.name)) {
          error(`Duplicate field '${member.name}' in interface ${intf.name}.`);
        }
        fieldNames.add(member.name);
        if (!forbidVarType(member.fieldType, `field '${member.name}' in interface ${intf.name}`)) {
          checkTypeExists(
            member.fieldType,
            `field '${member.name}' in interface ${intf.name}`,
            interfaceTypeParams
          );
        }
        if (member.initializer) {
          validateExpression(member.initializer, intf, interfaceTypeParams);
        }
      }

      if (member.type === "InterfaceMethodDeclaration") {
        const methodTypeParams = new Set(member.typeParameters ?? []);
        if ((member.typeParameters ?? []).length !== methodTypeParams.size) {
          error(`Duplicate type parameters in interface method ${intf.name}.${member.name}.`);
        }
        const methodScopeTypeParams = mergeTypeParams(interfaceTypeParams, methodTypeParams);
        const key = `${member.name}/${member.params.length}`;
        if (methodKeys.has(key)) {
          error(`Duplicate interface method '${member.name}' with arity ${member.params.length} in ${intf.name}.`);
        }
        methodKeys.add(key);

        if (!forbidVarType(member.returnType, `return type of ${intf.name}.${member.name}`)) {
          checkTypeExists(
            member.returnType,
            `return type of ${intf.name}.${member.name}`,
            methodScopeTypeParams
          );
        }
        for (const param of member.params) {
          if (!forbidVarType(param.paramType, `Parameter '${param.name}' in ${intf.name}.${member.name}`)) {
            checkTypeExists(
              param.paramType,
              `Parameter '${param.name}' in ${intf.name}.${member.name}`,
              methodScopeTypeParams
            );
          }
        }
      }
    }
  }

  for (const enm of ast.enums ?? []) {
    const enumConstantNames = new Set();
    for (const constant of enm.constants ?? []) {
      if (enumConstantNames.has(constant.name)) {
        error(`Duplicate enum value '${constant.name}' in enum ${enm.name}.`);
      }
      enumConstantNames.add(constant.name);

      for (const argument of constant.arguments ?? []) {
        validateExpression(argument, enm, new Set());
      }
    }

    const fieldNames = new Set();
    const methodNames = new Set();
    const constructorArities = new Set();

    for (const member of enm.members ?? []) {
      if (member.type === "FieldDeclaration") {
        if (fieldNames.has(member.name)) {
          error(`Duplicate field '${member.name}' in enum ${enm.name}.`);
        }
        fieldNames.add(member.name);

        if (
          !forbidVarType(
            member.fieldType,
            `field '${member.name}' in enum ${enm.name}`
          )
        ) {
          checkTypeExists(member.fieldType, `field '${member.name}' in enum ${enm.name}`);
        }

        if (member.initializer) {
          validateExpression(member.initializer, enm, new Set());
        }
      }

      if (member.type === "MethodDeclaration") {
        if (methodNames.has(member.name)) {
          error(`Duplicate method '${member.name}' in enum ${enm.name}.`);
        }
        methodNames.add(member.name);

        if (!forbidVarType(member.returnType, `return type of ${enm.name}.${member.name}`)) {
          checkTypeExists(member.returnType, `return type of ${enm.name}.${member.name}`);
        }
        for (const param of member.params) {
          if (
            !forbidVarType(
              param.paramType,
              `Parameter '${param.name}' in ${enm.name}.${member.name}`
            )
          ) {
            checkTypeExists(param.paramType, `Parameter '${param.name}' in ${enm.name}.${member.name}`);
          }
        }
        validateStatement(member.body, enm, new Set());
      }

      if (member.type === "ConstructorDeclaration") {
        const arity = member.params.length;
        if (constructorArities.has(arity)) {
          error(`Duplicate constructor with arity ${arity} in enum ${enm.name}.`);
        }
        constructorArities.add(arity);

        for (const param of member.params) {
          if (
            !forbidVarType(
              param.paramType,
              `constructor parameter '${param.name}' in enum ${enm.name}`
            )
          ) {
            checkTypeExists(
              param.paramType,
              `constructor parameter '${param.name}' in enum ${enm.name}`
            );
          }
        }

        member.body.statements.forEach((stmt, index) => {
          const kind = isCtorCallStatement(stmt);
          if (kind && index !== 0) {
            error(`${kind}(...) must be the first statement in constructor ${enm.name}.`);
          }
        });

        const firstKind =
          member.body.statements.length > 0
            ? isCtorCallStatement(member.body.statements[0])
            : null;

        if (firstKind === "super") {
          error(`super(...) is invalid in enum ${enm.name}.`);
        }

        if (firstKind === "this") {
          error(`this(...) is currently not supported (enum ${enm.name}).`);
        }

        validateStatement(member.body, enm, new Set());
      }
    }
  }

  for (const cls of ast.classes ?? []) {
    const classTypeParams = new Set(cls.typeParameters ?? []);
    const isAbstractClass = Boolean(cls.isAbstract);

    if ((cls.typeParameters ?? []).length !== classTypeParams.size) {
      error(`Duplicate type parameters in class ${cls.name}.`);
    }

    if (cls.superClass) {
      checkTypeExists(cls.superClass, `extends clause of class ${cls.name}`, classTypeParams);

      if (enumNames.has(cls.superClass)) {
        error(`Class ${cls.name} cannot extend enum ${cls.superClass}.`);
      }

      if (interfaceNames.has(cls.superClass)) {
        error(`Class ${cls.name} cannot extend interface ${cls.superClass}; use implements.`);
      }
    }

    const implementedInterfaces = new Set();
    for (const interfaceName of cls.interfaces ?? []) {
      if (implementedInterfaces.has(interfaceName)) {
        error(`Duplicate interface '${interfaceName}' in implements clause of class ${cls.name}.`);
      }
      implementedInterfaces.add(interfaceName);

      if (!interfaceNames.has(interfaceName) && !importedNames.has(interfaceName)) {
        error(`Unknown interface '${interfaceName}' in implements clause of class ${cls.name}.`);
      }
    }

    const fieldNames = new Set();
    const methodNames = new Set();
    const constructorArities = new Set();
    const methodSignatures = new Map();

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
        methodSignatures.set(`${member.name}/${member.params.length}`, member);

        if (member.isAbstract && !isAbstractClass) {
          error(`Abstract method '${member.name}' is only allowed in abstract class ${cls.name}.`);
        }

        if (!member.isAbstract && !member.body) {
          error(`Method '${member.name}' in class ${cls.name} requires a body.`);
        }

        if (member.isAbstract && member.body) {
          error(`Abstract method '${member.name}' in class ${cls.name} must not have a body.`);
        }

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
        if (member.body) {
          validateStatement(member.body, cls, methodScopeTypeParams);
        }
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

    const effectiveMethodSignatures = collectEffectiveClassMethods(cls.name);
    const allImplementedInterfaces = collectImplementedInterfacesForClass(cls.name);

    for (const interfaceName of allImplementedInterfaces) {
      const interfaceMethods = collectInterfaceMethods(interfaceName);
      for (const method of interfaceMethods) {
        const key = `${method.name}/${method.params.length}`;
        const implementation = effectiveMethodSignatures.get(key);
        if (!implementation) {
          if (!isAbstractClass) {
            error(
              `Class ${cls.name} does not implement interface method '${method.name}' with arity ${method.params.length} from ${interfaceName}.`
            );
          }
          continue;
        }

        if (implementation.isAbstract) {
          if (!isAbstractClass) {
            error(
              `Class ${cls.name} does not implement interface method '${method.name}' with arity ${method.params.length} from ${interfaceName}.`
            );
          }
          continue;
        }

        if (implementation.returnType !== method.returnType) {
          error(
            `Class ${cls.name} implements '${method.name}' from ${interfaceName} with return type '${implementation.returnType}', expected '${method.returnType}'.`
          );
        }
      }
    }

    if (!isAbstractClass) {
      const inheritedAbstractMethods = cls.superClass
        ? collectAbstractClassMethods(cls.superClass)
        : [];
      for (const method of inheritedAbstractMethods) {
        const key = `${method.name}/${method.params.length}`;
        const implementation = methodSignatures.get(key);
        if (!implementation || implementation.isAbstract) {
          error(
            `Concrete class ${cls.name} does not implement abstract method '${method.name}' with arity ${method.params.length}${cls.superClass ? ` from ${cls.superClass}` : ""}.`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Semantic errors:\n- ${errors.join("\n- ")}`);
  }
}
