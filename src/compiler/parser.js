const TYPE_KEYWORDS = new Set(["int", "double", "boolean", "String", "void"]);
const MODIFIERS = new Set(["public", "private", "protected", "static"]);

export function parse(tokens) {
  let pos = 0;

  function current() {
    return tokens[pos];
  }

  function previous() {
    return tokens[pos - 1];
  }

  function isAtEnd() {
    return current().type === "eof";
  }

  function check(type, value) {
    if (isAtEnd()) {
      return false;
    }
    if (current().type !== type) {
      return false;
    }
    if (value !== undefined && current().value !== value) {
      return false;
    }
    return true;
  }

  function checkNext(type, value, offset = 1) {
    const token = tokens[pos + offset];
    if (!token) {
      return false;
    }
    if (type !== undefined && token.type !== type) {
      return false;
    }
    if (value !== undefined && token.value !== value) {
      return false;
    }
    return true;
  }

  function match(type, value) {
    if (!check(type, value)) {
      return false;
    }
    pos += 1;
    return true;
  }

  function consume(type, value, message) {
    if (check(type, value)) {
      pos += 1;
      return previous();
    }
    const token = current();
    throw new Error(`${message} at ${token.line}:${token.column}`);
  }

  function parseModifiers() {
    const modifiers = [];
    while (check("keyword") && MODIFIERS.has(current().value)) {
      modifiers.push(current().value);
      pos += 1;
    }
    return modifiers;
  }

  function parseType() {
    let typeName = parseBaseTypeName("Expected type");

    parseOptionalTypeArguments();

    while (match("symbol", "[")) {
      consume("symbol", "]", "Expected ']' in array type");
      typeName += "[]";
    }

    return typeName;
  }

  function findTypeEnd(startIndex = pos) {
    const start = tokens[startIndex];
    if (!start) {
      return -1;
    }

    const isTypeToken =
      (start.type === "keyword" && TYPE_KEYWORDS.has(start.value)) ||
      start.type === "identifier";
    if (!isTypeToken) {
      return -1;
    }

    let index = startIndex + 1;

    if (tokens[index] && tokens[index].type === "operator" && tokens[index].value === "<") {
      index = skipGenericArguments(index);
      if (index < 0) {
        return -1;
      }
    }

    while (
      tokens[index] &&
      tokens[index].type === "symbol" &&
      tokens[index].value === "[" &&
      tokens[index + 1] &&
      tokens[index + 1].type === "symbol" &&
      tokens[index + 1].value === "]"
    ) {
      index += 2;
    }

    return index;
  }

  function parseBaseTypeName(errorPrefix) {
    if (check("keyword") && TYPE_KEYWORDS.has(current().value)) {
      const value = current().value;
      pos += 1;
      return value;
    }
    if (check("identifier")) {
      const value = current().value;
      pos += 1;
      return value;
    }
    const token = current();
    throw new Error(`${errorPrefix} at ${token.line}:${token.column}`);
  }

  function parseOptionalTypeArguments() {
    if (!match("operator", "<")) {
      return;
    }

    do {
      parseTypeArgument();
    } while (match("symbol", ","));

    consume("operator", ">", "Expected '>' after generic type arguments");
  }

  function parseTypeArgument() {
    if (match("symbol", "?")) {
      if (match("keyword", "extends") || match("keyword", "super")) {
        parseType();
      }
      return;
    }

    parseType();
  }

  function parseTypeParametersDeclaration() {
    const parameters = [];
    if (!match("operator", "<")) {
      return parameters;
    }

    do {
      const name = consume("identifier", undefined, "Expected type parameter name").value;
      parameters.push(name);

      if (match("keyword", "extends")) {
        parseType();
      }
    } while (match("symbol", ","));

    consume("operator", ">", "Expected '>' after type parameter list");
    return parameters;
  }

  function skipGenericArguments(openAngleIndex) {
    let index = openAngleIndex;
    let depth = 0;

    while (tokens[index]) {
      const token = tokens[index];
      if (token.type === "operator" && token.value === "<") {
        depth += 1;
      } else if (token.type === "operator" && token.value === ">") {
        depth -= 1;
        if (depth === 0) {
          return index + 1;
        }
      }
      index += 1;
    }

    return -1;
  }

  function parseProgram() {
    const imports = [];
    while (check("keyword", "import")) {
      imports.push(parseImportDeclaration());
    }

    const classes = [];
    while (!isAtEnd()) {
      if (check("keyword", "export")) {
        const token = current();
        throw new Error(
          `Unsupported legacy syntax 'export class' at ${token.line}:${token.column}. Use 'public class'.`
        );
      }
      classes.push(parseClassDeclaration());
    }

    return { type: "Program", imports, classes };
  }

  function parseImportDeclaration() {
    consume("keyword", "import", "Expected 'import'");
    const imported = consume(
      "identifier",
      undefined,
      "Expected imported class name"
    ).value;

    if (check("keyword", "from")) {
      const token = current();
      throw new Error(
        `Unsupported legacy import syntax at ${token.line}:${token.column}. Use 'import ${imported};'.`
      );
    }

    const source = `./${imported}.js`;

    consume("symbol", ";", "Expected ';' after import declaration");
    return { type: "ImportDeclaration", imported, source };
  }

  function parseClassDeclaration() {
    const classModifiers = parseModifiers();
    const isPublic = classModifiers.includes("public");
    const isExport = isPublic;
    consume("keyword", "class", "Expected 'class'");
    const name = consume("identifier", undefined, "Expected class name").value;
    const typeParameters = parseTypeParametersDeclaration();

    let superClass = null;
    if (match("keyword", "extends")) {
      superClass = consume("identifier", undefined, "Expected superclass name").value;
      parseOptionalTypeArguments();
    }

    consume("symbol", "{", "Expected '{' after class name");

    const members = [];
    while (!check("symbol", "}") && !isAtEnd()) {
      members.push(parseClassMember(name));
    }

    consume("symbol", "}", "Expected '}' after class body");
    return {
      type: "ClassDeclaration",
      name,
      typeParameters,
      superClass,
      isExport,
      modifiers: classModifiers,
      members
    };
  }

  function parseClassMember(className) {
    const modifiers = parseModifiers();
    const memberTypeParameters = parseTypeParametersDeclaration();

    if (
      memberTypeParameters.length === 0 &&
      check("identifier", className) &&
      checkNext("symbol", "(")
    ) {
      const name = consume("identifier", className, "Expected constructor name").value;
      consume("symbol", "(", "Expected '(' after constructor name");
      const params = parseParameterList();
      const body = parseBlockStatement();
      return {
        type: "ConstructorDeclaration",
        name,
        modifiers,
        params,
        body
      };
    }

    const typeName = parseType();
    const name = consume("identifier", undefined, "Expected member name").value;

    if (match("symbol", "(")) {
      const params = parseParameterList();
      const body = parseBlockStatement();
      return {
        type: "MethodDeclaration",
        name,
        returnType: typeName,
        modifiers,
        typeParameters: memberTypeParameters,
        params,
        body
      };
    }

    let initializer = null;
    if (match("operator", "=")) {
      initializer = parseExpression();
    }
    consume("symbol", ";", "Expected ';' after field declaration");

    return {
      type: "FieldDeclaration",
      fieldType: typeName,
      name,
      modifiers,
      initializer
    };
  }

  function parseParameterList() {
    const params = [];
    if (!check("symbol", ")")) {
      do {
        const paramType = parseType();
        const paramName = consume(
          "identifier",
          undefined,
          "Expected parameter name"
        ).value;
        params.push({ type: "Parameter", paramType, name: paramName });
      } while (match("symbol", ","));
    }
    consume("symbol", ")", "Expected ')' after parameters");
    return params;
  }

  function parseBlockStatement() {
    consume("symbol", "{", "Expected '{'");
    const statements = [];
    while (!check("symbol", "}") && !isAtEnd()) {
      statements.push(parseStatement());
    }
    consume("symbol", "}", "Expected '}' after block");
    return { type: "BlockStatement", statements };
  }

  function parseStatement() {
    if (check("symbol", "{")) {
      return parseBlockStatement();
    }
    if (match("keyword", "if")) {
      return parseIfStatement();
    }
    if (match("keyword", "while")) {
      return parseWhileStatement();
    }
    if (match("keyword", "for")) {
      return parseForStatement();
    }
    if (match("keyword", "try")) {
      return parseTryStatement();
    }
    if (match("keyword", "throw")) {
      const argument = parseExpression();
      consume("symbol", ";", "Expected ';' after throw");
      return { type: "ThrowStatement", argument };
    }
    if (match("keyword", "return")) {
      const argument = check("symbol", ";") ? null : parseExpression();
      consume("symbol", ";", "Expected ';' after return");
      return { type: "ReturnStatement", argument };
    }

    if (isVariableDeclarationStart()) {
      return parseVariableDeclaration();
    }

    const expression = parseExpression();
    consume("symbol", ";", "Expected ';' after expression");
    return { type: "ExpressionStatement", expression };
  }

  function isVariableDeclarationStart() {
    const typeEnd = findTypeEnd(pos);
    return typeEnd >= 0 && !!tokens[typeEnd] && tokens[typeEnd].type === "identifier";
  }

  function parseVariableDeclaration() {
    const varType = parseType();
    const name = consume("identifier", undefined, "Expected variable name").value;
    let initializer = null;
    if (match("operator", "=")) {
      initializer = parseExpression();
    }
    consume("symbol", ";", "Expected ';' after variable declaration");
    return { type: "VariableDeclaration", varType, name, initializer };
  }

  function parseIfStatement() {
    consume("symbol", "(", "Expected '(' after if");
    const test = parseExpression();
    consume("symbol", ")", "Expected ')' after if condition");
    const consequent = parseStatement();
    const alternate = match("keyword", "else") ? parseStatement() : null;
    return { type: "IfStatement", test, consequent, alternate };
  }

  function parseWhileStatement() {
    consume("symbol", "(", "Expected '(' after while");
    const test = parseExpression();
    consume("symbol", ")", "Expected ')' after while condition");
    const body = parseStatement();
    return { type: "WhileStatement", test, body };
  }

  function parseForStatement() {
    consume("symbol", "(", "Expected '(' after for");

    if (isVariableDeclarationStart()) {
      const varType = parseType();
      const name = consume(
        "identifier",
        undefined,
        "Expected variable name"
      ).value;

      if (match("symbol", ":")) {
        const iterable = parseExpression();
        consume("symbol", ")", "Expected ')' after enhanced for");
        const body = parseStatement();
        return {
          type: "ForEachStatement",
          variable: { type: "VariableDeclaration", varType, name, initializer: null },
          iterable,
          body
        };
      }

      let initializer = null;
      if (match("operator", "=")) {
        initializer = parseExpression();
      }
      const init = { type: "VariableDeclaration", varType, name, initializer };

      consume("symbol", ";", "Expected ';' after for init");
      const test = check("symbol", ";") ? null : parseExpression();
      consume("symbol", ";", "Expected ';' after for condition");
      const update = check("symbol", ")") ? null : parseExpression();
      consume("symbol", ")", "Expected ')' after for clauses");
      const body = parseStatement();
      return { type: "ForStatement", init, test, update, body };
    }

    let init = null;
    if (!check("symbol", ";")) {
      init = parseExpression();
    }
    consume("symbol", ";", "Expected ';' after for init");
    const test = check("symbol", ";") ? null : parseExpression();
    consume("symbol", ";", "Expected ';' after for condition");
    const update = check("symbol", ")") ? null : parseExpression();
    consume("symbol", ")", "Expected ')' after for clauses");
    const body = parseStatement();
    return { type: "ForStatement", init, test, update, body };
  }

  function parseTryStatement() {
    const block = parseBlockStatement();

    let handler = null;
    if (match("keyword", "catch")) {
      consume("symbol", "(", "Expected '(' after catch");
      const paramTypes = [parseType()];
      while (match("operator", "|")) {
        paramTypes.push(parseType());
      }
      const paramName = consume("identifier", undefined, "Expected catch variable name").value;
      consume("symbol", ")", "Expected ')' after catch parameter");
      const body = parseBlockStatement();
      handler = {
        type: "CatchClause",
        param: { type: "Parameter", paramType: paramTypes[0], paramTypes, name: paramName },
        body
      };
    }

    const finalizer = match("keyword", "finally") ? parseBlockStatement() : null;

    if (!handler && !finalizer) {
      const token = current();
      throw new Error(`Expected 'catch' or 'finally' after try at ${token.line}:${token.column}`);
    }

    return { type: "TryStatement", block, handler, finalizer };
  }

  function parseExpression() {
    return parseAssignment();
  }

  function parseAssignment() {
    const left = parseLogicalOr();

    if (
      match("operator", "=") ||
      match("operator", "+=") ||
      match("operator", "-=") ||
      match("operator", "*=") ||
      match("operator", "/=")
    ) {
      const operator = previous().value;
      const right = parseAssignment();
      return { type: "AssignmentExpression", operator, left, right };
    }

    return left;
  }

  function parseLogicalOr() {
    let expr = parseLogicalAnd();
    while (match("operator", "||")) {
      const operator = previous().value;
      const right = parseLogicalAnd();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  function parseLogicalAnd() {
    let expr = parseEquality();
    while (match("operator", "&&")) {
      const operator = previous().value;
      const right = parseEquality();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  function parseEquality() {
    let expr = parseComparison();
    while (match("operator", "==") || match("operator", "!=")) {
      const operator = previous().value;
      const right = parseComparison();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  function parseComparison() {
    let expr = parseTerm();
    while (
      match("operator", "<") ||
      match("operator", "<=") ||
      match("operator", ">") ||
      match("operator", ">=")
    ) {
      const operator = previous().value;
      const right = parseTerm();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  function parseTerm() {
    let expr = parseFactor();
    while (match("operator", "+") || match("operator", "-")) {
      const operator = previous().value;
      const right = parseFactor();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  function parseFactor() {
    let expr = parseUnary();
    while (
      match("operator", "*") ||
      match("operator", "/") ||
      match("operator", "%")
    ) {
      const operator = previous().value;
      const right = parseUnary();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  function parseUnary() {
    if (
      match("operator", "!") ||
      match("operator", "-") ||
      match("operator", "+") ||
      match("operator", "++") ||
      match("operator", "--")
    ) {
      const operator = previous().value;
      const argument = parseUnary();
      return { type: "UnaryExpression", operator, argument, prefix: true };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let expr = parseCallMember();
    while (match("operator", "++") || match("operator", "--")) {
      const operator = previous().value;
      expr = { type: "UpdateExpression", operator, argument: expr, prefix: false };
    }
    return expr;
  }

  function parseCallMember() {
    let expr = parsePrimary();

    while (true) {
      if (match("symbol", ".")) {
        const property = consume(
          "identifier",
          undefined,
          "Expected property name after '.'"
        ).value;
        expr = { type: "MemberExpression", object: expr, property };
        continue;
      }

      if (match("symbol", "[")) {
        const index = parseExpression();
        consume("symbol", "]", "Expected ']' after index expression");
        expr = { type: "IndexExpression", object: expr, index };
        continue;
      }

      if (match("symbol", "(")) {
        const args = [];
        if (!check("symbol", ")")) {
          do {
            args.push(parseExpression());
          } while (match("symbol", ","));
        }
        consume("symbol", ")", "Expected ')' after arguments");
        expr = { type: "CallExpression", callee: expr, arguments: args };
        continue;
      }

      break;
    }

    return expr;
  }

  function parsePrimary() {
    if (match("number")) {
      return { type: "Literal", value: Number(previous().value), raw: previous().value };
    }
    if (match("string")) {
      return { type: "Literal", value: previous().value, raw: `\"${previous().value}\"` };
    }
    if (match("keyword", "true")) {
      return { type: "Literal", value: true, raw: "true" };
    }
    if (match("keyword", "false")) {
      return { type: "Literal", value: false, raw: "false" };
    }
    if (match("keyword", "null")) {
      return { type: "Literal", value: null, raw: "null" };
    }
    if (match("keyword", "this")) {
      return { type: "ThisExpression" };
    }
    if (match("keyword", "super")) {
      return { type: "SuperExpression" };
    }

    if (match("keyword", "new")) {
      const callee = parseBaseTypeName("Expected type after new");
      parseOptionalTypeArguments();

      if (match("symbol", "[")) {
        const dimensions = [];
        dimensions.push(parseExpression());
        consume("symbol", "]", "Expected ']' after array size");
        while (match("symbol", "[")) {
          dimensions.push(parseExpression());
          consume("symbol", "]", "Expected ']' after array size");
        }
        return { type: "NewArrayExpression", elementType: callee, dimensions };
      }

      consume("symbol", "(", "Expected '(' after class name");
      const args = [];
      if (!check("symbol", ")")) {
        do {
          args.push(parseExpression());
        } while (match("symbol", ","));
      }
      consume("symbol", ")", "Expected ')' after constructor args");
      return { type: "NewExpression", callee, arguments: args };
    }

    if (match("identifier")) {
      return { type: "Identifier", name: previous().value };
    }

    if (match("symbol", "(")) {
      const expr = parseExpression();
      consume("symbol", ")", "Expected ')' after expression");
      return expr;
    }

    const token = current();
    throw new Error(
      `Unexpected token '${token.value}' at ${token.line}:${token.column}`
    );
  }

  return parseProgram();
}
