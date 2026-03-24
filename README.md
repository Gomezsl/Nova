# ◈ NOVA — A Tiny Programming Language

A fully hand-crafted interpreter built from scratch in Python, featuring:

- **Lexical Analysis** — tokenizes source code into a stream of `Token` objects
- **Syntax Analysis** — recursive-descent parser that builds an **Abstract Syntax Tree (AST)**
- **Tree-walking Interpreter** — evaluates the AST with proper scoping and closures

---

## Features

| Feature | Example |
|---|---|
| Variables | `let x = 42` |
| Arithmetic | `x ^ 2 + sqrt(x) * 3.14` |
| Strings | `"Hello, " + name + "!"` |
| Booleans | `true`, `false`, `and`, `or`, `not` |
| Conditionals | `if (x > 0) { ... } else { ... }` |
| While loops | `while (x < 10) { x = x + 1 }` |
| For loops | `for i in range(0, 10) { print(i) }` |
| Functions | `fn factorial(n) { return n * factorial(n-1) }` |
| Closures | Functions capture their defining scope |
| Built-ins | `sqrt abs floor ceil round pow max min len str num type` |
| Comments | `# This is a comment` |

---

## Architecture

```
Source Code (string)
       │
       ▼
  ┌─────────┐
  │  Lexer  │  ← Lexical Analysis
  └────┬────┘    Reads chars → emits Token stream
       │
       ▼  [Token, Token, Token, ...]
  ┌─────────┐
  │  Parser │  ← Syntax Analysis
  └────┬────┘    Tokens → Abstract Syntax Tree (AST)
       │
       ▼  {t: "Program", stmts: [...]}
  ┌─────────────┐
  │ Interpreter │  ← Evaluation
  └─────────────┘    Walks the AST, executes nodes
```

### Token Types (Lexer output)
```
NUMBER STRING BOOL NULL IDENT
PLUS MINUS STAR SLASH PERCENT CARET
EQ NEQ LT GT LTE GTE
AND OR NOT
ASSIGN LPAREN RPAREN LBRACE RBRACE COMMA SEMI
LET FN IF ELSE WHILE FOR IN RETURN PRINT RANGE
```

### AST Node Types (Parser output)
```
Program   Block     Let       Assign
Print     If        While     For
FnDef     FnCall    Return    Range
BinOp     UnaryOp   NumberLit StringLit
BoolLit   NullLit   Identifier
```

---

## Usage

```bash
# Run a .nova file
python3 nova.py examples/demo.nova

# Run a quick program inline (import the module)
python3 -c "
from nova import run_source
output, error = run_source('''
  fn fib(n) {
    if (n <= 1) { return n }
    return fib(n-1) + fib(n-2)
  }
  for i in range(0, 8) {
    print(str(i) + \" -> \" + str(fib(i)))
  }
''')
for line in output:
    print(line)
"
```

---

## Example Programs

### Fibonacci
```nova
fn fib(n) {
  if (n <= 1) { return n }
  return fib(n - 1) + fib(n - 2)
}

for i in range(0, 10) {
  print("fib(" + str(i) + ") = " + str(fib(i)))
}
```

### FizzBuzz
```nova
for i in range(1, 31) {
  let fizz = i % 3 == 0
  let buzz = i % 5 == 0
  if (fizz and buzz) { print("FizzBuzz") }
  else { if (fizz) { print("Fizz") }
         else { if (buzz) { print("Buzz") }
                else { print(str(i)) } } }
}
```

### Higher-order functions
```nova
fn make_adder(n) {
  fn adder(x) { return x + n }
  return adder
}

let add5 = make_adder(5)
print(add5(10))  # 15
```

---

## Project Structure

```
nova_lang/
├── nova.py          ← The entire interpreter (~400 lines)
│   ├── Lexer        ← Tokenizer
│   ├── Token        ← Token data class
│   ├── Parser       ← Recursive descent parser
│   ├── AST nodes    ← @dataclass nodes (23 types)
│   ├── Environment  ← Variable scoping with closures
│   └── Interpreter  ← Tree-walking evaluator
├── examples/
│   ├── demo.nova    ← Comprehensive demo
│   └── fizzbuzz.nova
└── README.md
```

---

## Why This Project?

Building an interpreter teaches you:

- **Lexical analysis** — how compilers break source code into tokens
- **Recursive descent parsing** — operator precedence, grammar rules
- **Abstract Syntax Trees** — the backbone of every compiler
- **Scope & closures** — how variables work in real languages
- **Tree-walking evaluation** — the simplest interpreter strategy

It's one of the most impressive things you can put on a portfolio.

---

## License

MIT
