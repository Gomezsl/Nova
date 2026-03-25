# ◈ NOVA — Un Lenguaje de Programación Real

> Intérprete construido completamente desde cero en Python.  
> Lexer → Parser → AST → Intérprete de árbol.

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://python.org)
[![Versión](https://img.shields.io/badge/versión-3.0-purple.svg)]()
[![Features](https://img.shields.io/badge/features-53_confirmadas-green.svg)]()
[![Tests](https://img.shields.io/badge/tests-29%2F29_pasando-brightgreen.svg)]()

---

## ¿Qué es NOVA?

NOVA es un lenguaje de scripting dinámico y orientado a expresiones. No es un juguete — tiene closures, funciones de primera clase, comprensiones de listas y diccionarios, pattern matching, manejo de errores, argumentos nombrados, funciones variádicas, f-strings y operador pipe. Ejecuta programas reales.

NOVA fue construido para demostrar que entiendes cómo funcionan los lenguajes de programación a nivel fundamental — desde caracteres crudos hasta la ejecución. Eso es algo que la mayoría de desarrolladores nunca hace.

---

## Arquitectura

```
Código fuente (string)
       │
       ▼
  ┌─────────┐
  │  Lexer  │  Lee caracteres → emite un stream de Tokens
  └────┬────┘  40+ tipos de token, maneja f-strings, operadores, palabras clave
       │
       ▼  [Token, Token, Token, ...]
  ┌─────────┐
  │  Parser │  Descenso recursivo → construye Árbol Sintáctico Abstracto
  └────┬────┘  35+ tipos de nodo, precedencia de operadores completa
       │
       ▼  {t: "Program", stmts: [...]}
  ┌─────────────┐
  │ Intérprete  │  Evaluador por recorrido de árbol
  └─────────────┘  Entornos con scope, closures, 65+ funciones integradas
```

---

## Inicio Rápido

```bash
# Ejecutar un archivo .nova
python3 nova.py ejemplos/demo.nova

# Usar como librería
python3 -c "
from nova import run_source
output, error = run_source('''
  fn fib(n) {
    if (n <= 1) { return n }
    return fib(n - 1) + fib(n - 2)
  }
  for i in range(0, 10) {
    print(f\"fib({i}) = {fib(i)}\")
  }
''')
for linea in output: print(linea)
"
```

---

## Referencia del Lenguaje

### Variables

```nova
let nombre = "Mundo"
let x = 42
let pi = 3.14159

# Desestructuración
let [a, b, c] = [1, 2, 3]

# Asignación compuesta
x += 5
x *= 2
x //= 3    # división entera
x ^= 2     # potencia
```

### Tipos de Datos

| Tipo | Ejemplo | Notas |
|---|---|---|
| `number` | `42`, `3.14` | Entero o decimal |
| `string` | `"hola"`, `'mundo'` | Secuencias de escape: `\n \t \\` |
| `bool` | `true`, `false` | |
| `null` | `null` | Valor nulo |
| `list` | `[1, 2, 3]` | Dinámica, tipos mixtos |
| `dict` | `{"clave": "valor"}` | Mapa clave-valor ordenado |
| `function` | `fn(x) { return x }` | Valor de primera clase |

### Strings y f-strings

```nova
let nombre = "Nova"
let version = 3

# Concatenación normal
print("Hola, " + nombre + "!")

# f-strings — inserta cualquier expresión
print(f"Lenguaje: {nombre} v{version}")
print(f"2^10 = {2^10}")
print(f"PI ≈ {round(PI, 5)}")

# Métodos de string
let s = "  Hola, Mundo!  "
s.trim()              # "Hola, Mundo!"
s.upper()             # "  HOLA, MUNDO!  "
s.lower()             # "  hola, mundo!  "
s.replace("Mundo", "NOVA")  # reemplazar
s.split(", ")         # dividir en lista
s.contains("Mundo")   # true
s.starts_with("  H")  # true
s.ends_with("  ")     # true
s.reverse()           # invertir
s.repeat(2)           # repetir
s.index_of("Mundo")   # posición
```

### Listas

```nova
let nums = [10, 3, 7, 1, 9, 4]

# Acceso
nums[0]       # 10 (primer elemento)
nums[-1]      # 4  (último elemento, índice negativo)
nums[1:4]     # [3, 7, 1] (slice)
nums[:3]      # [10, 3, 7]
nums[3:]      # [1, 9, 4]

# Métodos que mutan la lista
nums.push(99)          # agregar al final
nums.pop()             # quitar y retornar el último → 99
nums.shift()           # quitar y retornar el primero → 10
nums.unshift(0)        # agregar al inicio
nums.insert(2, 42)     # insertar en índice
nums.remove_at(2)      # quitar en índice

# Métodos que retornan nueva lista
nums.sort()            # copia ordenada
nums.reverse()         # copia invertida
nums.unique()          # sin duplicados
nums.slice(1, 4)       # sub-lista
nums.concat([11, 12])  # unir listas
nums.flatten()         # aplanar un nivel

# Consultas
nums.contains(7)       # true
nums.index_of(7)       # 2
nums.len()             # longitud
nums.is_empty()        # ¿está vacía?
nums.first()           # primer elemento
nums.last()            # último elemento
nums.count(1)          # ocurrencias de 1

# Agregados
nums.sum()             # suma total
nums.min()             # mínimo
nums.max()             # máximo
nums.all()             # ¿todos verdaderos?
nums.any()             # ¿alguno verdadero?

# Iteración
nums.join(", ")        # "10, 3, 7, 1, 9, 4"
nums.enumerate()       # [[0,10],[1,3],...]
nums.zip([1,2,3,4,5,6])  # pares

# Funciones de orden superior
nums.map(fn(x) { return x * 2 })
nums.filter(fn(x) { return x > 5 })
nums.reduce(fn(acc, x) { return acc + x }, 0)

# Comprensiones de lista
let cuadrados = [x*x for x in range(1, 11)]
let pares     = [x for x in range(0, 20) if x % 2 == 0]
let mayus     = [w.upper() for w in ["hola", "mundo"]]
```

### Diccionarios

```nova
let persona = {"nombre": "Alicia", "edad": 30}

# Acceso y mutación
persona["nombre"]            # "Alicia"
persona["trabajo"] = "Ingeniera"
persona["edad"] += 1

# Métodos
persona.keys()               # ["nombre", "edad", "trabajo"]
persona.values()             # ["Alicia", 31, "Ingeniera"]
persona.items()              # [["nombre","Alicia"], ...]
persona.has("nombre")        # true
persona.get("x", null)       # acceso seguro con valor por defecto
persona.delete("edad")       # eliminar clave
persona.len()                # número de claves
persona.merge({"x": 1})      # fusionar dos dicts

# Comprensiones de diccionario
let cuadrados = {str(x): x*x for x in range(1, 6)}

# Dicts anidados
let config = {"db": {"host": "localhost", "puerto": 5432}}
print(config["db"]["host"])   # "localhost"
```

### Control de Flujo

```nova
# if / else if / else
if (puntuacion >= 90) {
    print("A")
} else if (puntuacion >= 80) {
    print("B")
} else {
    print("C")
}

# Ternario: condicion ? si_verdad : si_falso
let etiqueta = puntuacion >= 60 ? "aprobado" : "reprobado"

# while
let i = 0
while (i < 10) {
    i += 1
}

# do-while (siempre ejecuta al menos una vez)
let n = 0
do {
    n += 1
} while (n < 5)

# for / in con range
for i in range(0, 10) { }        # 0..9
for i in range(0, 10, 2) { }     # 0,2,4,6,8 (con paso)

# for sobre lista o dict
for item in [1, 2, 3] { }
for par in dict.items() { }

# break y continue
for i in range(0, 100) {
    if (i % 2 != 0) { continue }  # saltar impares
    if (i > 10) { break }          # salir del bucle
}

# match / switch (pattern matching)
match(codigo) {
    200        { print("OK") }
    301, 302   { print("Redirección") }
    404        { print("No encontrado") }
    _          { print("Otro: " + str(codigo)) }
}
```

### Funciones

```nova
# Básica
fn sumar(a, b) {
    return a + b
}

# Argumentos con valor por defecto
fn saludar(nombre, saludo = "Hola") {
    return saludo + ", " + nombre + "!"
}
saludar("Mundo")            # "Hola, Mundo!"
saludar("Nova", "Hola")     # "Hola, Nova!"

# Argumentos nombrados (en cualquier orden)
saludar(saludo = "Hola", nombre = "Mundo")

# Funciones variádicas *args
fn total(*nums) {
    return nums.sum()
}
total(1, 2, 3, 4, 5)        # 15

# Operador spread: desempaquetar lista en argumentos
let args = [1, 2, 3]
sumar(*args)                 # equivale a sumar(1, 2, 3)

# Funciones de primera clase
let doble = fn(x) { return x * 2 }
let resultado = doble(5)

# Closures (capturan el scope exterior)
fn crear_contador(inicio = 0, paso = 1) {
    let cuenta = inicio
    fn siguiente() {
        cuenta += paso
        return cuenta
    }
    return siguiente
}
let contador = crear_contador(0, 2)
contador()  # 2
contador()  # 4
contador()  # 6

# Funciones de orden superior
fn componer(f, g) {
    return fn(x) { return f(g(x)) }
}
fn doble(x)  { return x * 2 }
fn inc(x)    { return x + 1 }
let doble_luego_inc = componer(inc, doble)
doble_luego_inc(5)   # 11

# Operador pipe |>
[1, 2, 3, 4] |> sum          # 10
[3, 1, 4, 1, 5] |> max       # 5
"hola" |> len                 # 4
[1, 2, 3] |> mi_funcion       # función de usuario
```

### Manejo de Errores

```nova
# try / catch / finally
fn dividir_seguro(a, b) {
    try {
        if (b == 0) { throw "División por cero" }
        return a / b
    } catch (err) {
        print("Error: " + err)
        return null
    } finally {
        print("siempre se ejecuta")
    }
}

# Lanzar errores personalizados
fn requerir_positivo(n) {
    if (n <= 0) { throw f"Se esperaba positivo, se recibió {n}" }
    return n
}

# assert
assert(2 + 2 == 4, "Las matemáticas están rotas")
assert(len(lista) > 0, "La lista no puede estar vacía")
```

### Variables Globales

```nova
let total = 0

fn agregar(n) {
    global total
    total += n
}

agregar(10)
agregar(20)
print(total)   # 30
```

### Incremento / Decremento

```nova
let x = 5
x++        # postfijo: x se convierte en 6
x--        # postfijo: x se convierte en 5
++x        # prefijo:  x se convierte en 6 (retorna nuevo valor)
--x        # prefijo:  x se convierte en 5 (retorna nuevo valor)
```

---

## Funciones Integradas

### Matemáticas
| Función | Descripción |
|---|---|
| `sqrt(x)` | Raíz cuadrada |
| `abs(x)` | Valor absoluto |
| `floor(x)` | Redondear hacia abajo |
| `ceil(x)` | Redondear hacia arriba |
| `round(x, n)` | Redondear a n decimales |
| `pow(x, y)` | x elevado a la potencia y |
| `log(x)` / `log(x, base)` | Logaritmo natural o en base b |
| `log2(x)` / `log10(x)` | Log base 2 o 10 |
| `sin(x)` / `cos(x)` / `tan(x)` | Trigonometría |
| `int_div(a, b)` | División entera (igual que `//`) |
| `max(...)` / `min(...)` | Máximo / mínimo |
| `sum(lista)` / `product(lista)` | Suma o producto de una lista |

### Aleatorios
| Función | Descripción |
|---|---|
| `random()` | Flotante en [0, 1) |
| `rand_int(a, b)` | Entero aleatorio en [a, b] |
| `rand_float(a, b)` | Flotante aleatorio en [a, b] |
| `choice(lista)` | Elemento aleatorio de una lista |

### Conversión de Tipos
| Función | Descripción |
|---|---|
| `str(x)` | Convertir a string |
| `num(x)` | Convertir a número |
| `int(x)` | Convertir a entero |
| `bool(x)` | Convertir a booleano |
| `type(x)` | Retorna `"number"`, `"string"`, `"bool"`, `"null"`, `"list"`, `"dict"`, `"function"` |
| `is_num(x)` / `is_str(x)` / `is_bool(x)` | Verificaciones de tipo |
| `is_list(x)` / `is_dict(x)` / `is_null(x)` / `is_fn(x)` | Verificaciones de tipo |

### Constantes
| Nombre | Valor |
|---|---|
| `PI` | 3.141592653589793 |
| `E` | 2.718281828459045 |
| `INF` | Infinito positivo |
| `NAN` | No es un número |

---

## Programas Reales

### Fibonacci con memoización
```nova
let memo = {}

fn fib(n) {
    if (has(memo, n)) { return memo[n] }
    if (n <= 1) { return n }
    let resultado = fib(n - 1) + fib(n - 2)
    memo[n] = resultado
    return resultado
}

for i in range(0, 40) {
    print(f"fib({i}) = {fib(i)}")
}
```

### FizzBuzz (estilo funcional)
```nova
let etiquetas = range(1, 101).map(fn(i) {
    let fizz = i % 3 == 0
    let buzz = i % 5 == 0
    return fizz and buzz ? "FizzBuzz"
         : fizz          ? "Fizz"
         : buzz          ? "Buzz"
         : str(i)
})
for etiqueta in etiquetas { print(etiqueta) }
```

### Quicksort
```nova
fn quicksort(arr) {
    if (arr.len() <= 1) { return arr }
    let pivote = arr[0]
    let izq    = arr.filter(fn(x) { return x < pivote })
    let der    = arr.filter(fn(x) { return x > pivote })
    let igual  = arr.filter(fn(x) { return x == pivote })
    return quicksort(izq).concat(igual).concat(quicksort(der))
}

let datos = [3, 6, 8, 10, 1, 2, 1]
print(str(quicksort(datos)))   # [1, 1, 2, 3, 6, 8, 10]
```

### Pipeline de datos
```nova
let datos = [
    {"nombre": "Alicia", "puntuacion": 87},
    {"nombre": "Bob",    "puntuacion": 45},
    {"nombre": "Carol",  "puntuacion": 92},
    {"nombre": "David",  "puntuacion": 61},
]

let aprobados = datos
    .filter(fn(e) { return e["puntuacion"] >= 60 })
    .map(fn(e) { return e["nombre"] + ": " + str(e["puntuacion"]) })

for entrada in aprobados { print(entrada) }
```

---

## Extensión de VS Code

La carpeta `nova-vscode/` contiene una extensión completa para VS Code. Una vez instalada obtienes:

- **Syntax highlighting** — colores para palabras clave, strings, funciones, números, comentarios
- **Snippets** — plantillas de código con Tab (fn, for, if, try, match, closure, etc.)
- **Errores en tiempo real** — subraya errores de sintaxis mientras escribes
- **Hover** — documentación al pasar el mouse sobre cualquier función integrada
- **Autocompletado** — sugerencias de keywords, builtins, variables locales
- **Ir a definición** — Ctrl+Click en una función para saltar a donde fue definida
- **Ejecutar archivo** — botón ▶ en la barra de título o `Ctrl+Shift+N`
- **Ejecutar selección** — ejecuta el código seleccionado directamente

### Instalación de la extensión

**Opción A — Instalación manual (desarrollo)**
```bash
# 1. Requisitos
npm install -g @vscode/vsce typescript

# 2. Entrar al directorio
cd nova-vscode

# 3. Instalar dependencias
npm install

# 4. Compilar TypeScript
npm run compile

# 5a. Instalar directamente en VS Code
code --install-extension .

# 5b. O crear el archivo .vsix para distribuir
vsce package
# Genera: nova-language-1.0.0.vsix
# Instalar: code --install-extension nova-language-1.0.0.vsix
```

**Opción B — Modo desarrollo (sin compilar)**
```bash
# Copiar la carpeta al directorio de extensiones de VS Code
# macOS / Linux:
cp -r nova-vscode ~/.vscode/extensions/nova-language

# Windows:
xcopy nova-vscode %USERPROFILE%\.vscode\extensions\nova-language /E
```

**Opción C — Publicar en el Marketplace**
```bash
# 1. Crear cuenta en https://marketplace.visualstudio.com
# 2. Crear un Personal Access Token en Azure DevOps
vsce login tu-publisher-name
vsce publish
# ¡Tu extensión aparece en el marketplace de VS Code!
```

### Configuración

En `settings.json` de VS Code:
```json
{
    "nova.pythonPath": "python3",
    "nova.interpreterPath": "/ruta/a/nova.py",
    "nova.enableLSP": true
}
```

---

## Comparación con Otros Lenguajes

| Característica | NOVA | Lua 5.4 | Python 2.7 | Python 3.12 |
|---|:---:|:---:|:---:|:---:|
| Tipado dinámico | ✅ | ✅ | ✅ | ✅ |
| Funciones de primera clase | ✅ | ✅ | ✅ | ✅ |
| Closures | ✅ | ✅ | ✅ | ✅ |
| Listas (arrays) | ✅ | ✅ | ✅ | ✅ |
| Diccionarios | ✅ | ✅ | ✅ | ✅ |
| Comprensiones de lista | ✅ | ❌ | ✅ | ✅ |
| Comprensiones de dict | ✅ | ❌ | ✅ | ✅ |
| Pattern matching | ✅ | ❌ | ✅ 3.10+ | ✅ |
| f-strings | ✅ | ❌ | ❌ | ✅ 3.6+ |
| Argumentos nombrados | ✅ | ❌ | ✅ | ✅ |
| Variádicos *args | ✅ | ✅ | ✅ | ✅ |
| Operador pipe \|> | ✅ | ❌ | ❌ | ❌ |
| try/catch/throw | ✅ | ✅ | ✅ | ✅ |
| do-while | ✅ | ❌ | ❌ | ❌ |
| ++ / -- | ✅ | ❌ | ❌ | ❌ |
| Clases / OOP | ❌ | ❌* | ✅ | ✅ |
| Módulos propios | ❌ | ✅ | ✅ | ✅ |
| Async / await | ❌ | ❌ | ❌ | ✅ |

**Veredicto:** NOVA es comparable a **Lua 5.4** en expresividad y lo supera en ergonomía de sintaxis. Ya es un lenguaje real — puedes escribir algoritmos no triviales, procesar datos, y construir lógica compleja. Lo que le falta para el siguiente nivel es OOP y módulos de usuario.

---

## Hoja de Ruta

Estas son las funcionalidades que llevarían NOVA al siguiente nivel:

| Característica | Dificultad | Impacto |
|---|---|---|
| **Clases / structs** | Media | Alto — habilita patrones OOP |
| **Módulos de usuario** (`import "archivo.nova"`) | Media | Alto — programas multi-archivo |
| **Compilador a bytecode** | Alta | Alto — mejora 10-100x la velocidad |
| **Extensión VS Code publicada** | Media | Alto — soporte de editor |
| **Librería estándar** (I/O de archivos, HTTP, JSON) | Media | Alto — programas prácticos |
| **Generadores / yield** | Media | Media |
| **Async / await** | Alta | Media |
| **Anotaciones de tipo** (opcionales) | Media | Media — para tooling |

---

## Estructura del Proyecto

```
nova_lang/
├── nova.py              ← El intérprete completo (~1,430 líneas)
│   ├── Lexer            ← Tokenizador (40+ tipos de token)
│   ├── Token            ← Dataclass del token
│   ├── Parser           ← Parser de descenso recursivo
│   ├── Nodos AST        ← 35+ tipos de nodo
│   ├── Environment      ← Variables con scope + closures
│   ├── Interpreter      ← Evaluador por recorrido de árbol
│   └── BUILTINS         ← 65+ funciones integradas
├── nova-vscode/         ← Extensión de VS Code
│   ├── package.json     ← Manifiesto de la extensión
│   ├── extension.ts     ← Punto de entrada principal
│   ├── syntaxes/
│   │   └── nova.tmLanguage.json  ← Gramática para resaltado
│   ├── snippets/
│   │   └── nova.json    ← Snippets de código
│   ├── server/
│   │   └── nova_lsp.py  ← Language Server (diagnósticos, hover, autocompletado)
│   └── language-configuration.json
├── examples/
│   ├── showcase.nova    ← Demostración completa de features
│   └── fizzbuzz.nova
└── README.md
```

---

## Por Qué Importa Este Proyecto

Construir un intérprete te enseña cosas que años usando frameworks nunca te enseñarán:

- **Cómo funciona la tokenización** — por qué `===` es un token, no tres
- **Precedencia de operadores** — por qué `2 + 3 * 4` es `14` y no `20`
- **Scope y closures** — qué captura realmente un closure y por qué
- **Recursión vs iteración** — en el lenguaje y en su implementación
- **Propagación de errores** — cómo las excepciones desenrollan el call stack
- **El costo de la abstracción** — por qué Python es más lento que C

Este es el proyecto que muestras cuando quieres que alguien sepa que eres un ingeniero serio.

---

## Licencia

MIT — úsalo, aprende de él, constrúyelo.
