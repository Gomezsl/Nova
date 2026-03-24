import { useState, useRef, useEffect, useCallback } from "react";

// ──────────────────────────────────────────────────────────────
//  NOVA INTERPRETER (ported to JavaScript)
// ──────────────────────────────────────────────────────────────

const TT = {
  NUMBER:"NUMBER",STRING:"STRING",BOOL:"BOOL",NULL:"NULL",IDENT:"IDENT",
  PLUS:"PLUS",MINUS:"MINUS",STAR:"STAR",SLASH:"SLASH",PERCENT:"PERCENT",CARET:"CARET",
  EQ:"EQ",NEQ:"NEQ",LT:"LT",GT:"GT",LTE:"LTE",GTE:"GTE",
  AND:"AND",OR:"OR",NOT:"NOT",
  ASSIGN:"ASSIGN",LPAREN:"LPAREN",RPAREN:"RPAREN",
  LBRACE:"LBRACE",RBRACE:"RBRACE",COMMA:"COMMA",SEMI:"SEMI",
  ARROW:"ARROW",LET:"LET",FN:"FN",IF:"IF",ELSE:"ELSE",
  WHILE:"WHILE",FOR:"FOR",IN:"IN",RETURN:"RETURN",PRINT:"PRINT",RANGE:"RANGE",
  EOF:"EOF",
};

const KEYWORDS = {
  let:TT.LET, fn:TT.FN, if:TT.IF, else:TT.ELSE, while:TT.WHILE,
  for:TT.FOR, in:TT.IN, return:TT.RETURN, print:TT.PRINT,
  true:TT.BOOL, false:TT.BOOL, null:TT.NULL,
  and:TT.AND, or:TT.OR, not:TT.NOT, range:TT.RANGE,
};

class Token { constructor(type,value,line){this.type=type;this.value=value;this.line=line;} }

class Lexer {
  constructor(src){this.src=src;this.pos=0;this.line=1;this.tokens=[];}
  err(m){throw new Error(`[Line ${this.line}] LexerError: ${m}`);}
  peek(o=0){const p=this.pos+o;return p<this.src.length?this.src[p]:"\0";}
  advance(){const c=this.src[this.pos++];if(c==="\n")this.line++;return c;}
  match(e){if(this.pos<this.src.length&&this.src[this.pos]===e){this.advance();return true;}return false;}
  add(t,v=null){this.tokens.push(new Token(t,v,this.line));}
  tokenize(){
    while(this.pos<this.src.length)this.scanToken();
    this.add(TT.EOF);return this.tokens;
  }
  scanToken(){
    const ch=this.advance();
    if(" \t\r".includes(ch))return;
    if(ch==="\n"){if(!this.tokens.length||this.tokens[this.tokens.length-1].type!=="NEWLINE")this.add("NEWLINE");return;}
    if(ch==="#"){while(this.pos<this.src.length&&this.src[this.pos]!=="\n")this.pos++;return;}
    if(ch==='"'){this.readString();return;}
    if(/\d/.test(ch)||(ch==="."&&/\d/.test(this.peek()))){this.readNumber(ch);return;}
    if(/[a-zA-Z_]/.test(ch)){this.readIdent(ch);return;}
    if(ch==="="){this.match("=")?this.add(TT.EQ):this.add(TT.ASSIGN);return;}
    if(ch==="!"){this.match("=")?this.add(TT.NEQ):this.err("Unexpected '!'");return;}
    if(ch==="<"){this.match("=")?this.add(TT.LTE):this.add(TT.LT);return;}
    if(ch===">"){this.match("=")?this.add(TT.GTE):this.add(TT.GT);return;}
    if(ch==="-"){this.match(">")?this.add(TT.ARROW):this.add(TT.MINUS);return;}
    const singles={"+":TT.PLUS,"*":TT.STAR,"/":TT.SLASH,"%":TT.PERCENT,"^":TT.CARET,
      "(":TT.LPAREN,")":TT.RPAREN,"{":TT.LBRACE,"}":TT.RBRACE,",":TT.COMMA,";":TT.SEMI};
    if(singles[ch]){this.add(singles[ch]);return;}
    this.err(`Unexpected '${ch}'`);
  }
  readString(){
    let s="",pos=this.pos;
    while(this.pos<this.src.length&&this.src[this.pos]!=='"'){
      if(this.src[this.pos]==="\n")this.err("Unterminated string");
      s+=this.src[this.pos++];
    }
    if(this.pos>=this.src.length)this.err("Unterminated string");
    this.pos++;
    s=s.replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\"/g,'"');
    this.add(TT.STRING,s);
  }
  readNumber(first){
    let n=first;
    while(/\d/.test(this.peek()))n+=this.advance();
    if(this.peek()==="."&&/\d/.test(this.peek(1))){n+=this.advance();while(/\d/.test(this.peek()))n+=this.advance();}
    this.add(TT.NUMBER,n.includes(".")?parseFloat(n):parseInt(n,10));
  }
  readIdent(first){
    let w=first;
    while(/[a-zA-Z0-9_]/.test(this.peek()))w+=this.advance();
    const tt=KEYWORDS[w]??TT.IDENT;
    if(w==="true")this.add(TT.BOOL,true);
    else if(w==="false")this.add(TT.BOOL,false);
    else if(w==="null")this.add(TT.NULL,null);
    else this.add(tt,w);
  }
}

class ParseError extends Error{constructor(m,l){super(`[Line ${l}] ParseError: ${m}`);}}

class Parser {
  constructor(tokens){this.tokens=tokens.filter(t=>t.type!=="NEWLINE");this.pos=0;}
  err(m){const t=this.cur();throw new ParseError(m,t.line);}
  cur(){return this.tokens[this.pos];}
  peek(o=1){const p=this.pos+o;return p<this.tokens.length?this.tokens[p]:this.tokens[this.tokens.length-1];}
  check(...ts){return ts.includes(this.cur().type);}
  advance(){const t=this.tokens[this.pos];if(t.type!==TT.EOF)this.pos++;return t;}
  expect(tt){if(!this.check(tt))this.err(`Expected ${tt}, got ${this.cur().type} (${JSON.stringify(this.cur().value)})`);return this.advance();}
  match(...ts){if(this.check(...ts))return this.advance();return null;}
  parse(){const s=[];while(!this.check(TT.EOF))s.push(this.stmt());return{t:"Program",stmts:s};}
  stmt(){
    if(this.check(TT.LET))return this.letStmt();
    if(this.check(TT.PRINT))return this.printStmt();
    if(this.check(TT.IF))return this.ifStmt();
    if(this.check(TT.WHILE))return this.whileStmt();
    if(this.check(TT.FOR))return this.forStmt();
    if(this.check(TT.FN))return this.fnDef();
    if(this.check(TT.RETURN))return this.retStmt();
    if(this.check(TT.IDENT)&&this.peek().type===TT.ASSIGN)return this.assignStmt();
    return this.exprStmt();
  }
  letStmt(){this.expect(TT.LET);const n=this.expect(TT.IDENT).value;this.expect(TT.ASSIGN);const v=this.expr();this.match(TT.SEMI);return{t:"Let",name:n,value:v};}
  assignStmt(){const n=this.advance().value;this.expect(TT.ASSIGN);const v=this.expr();this.match(TT.SEMI);return{t:"Assign",name:n,value:v};}
  printStmt(){this.expect(TT.PRINT);this.expect(TT.LPAREN);const e=this.expr();this.expect(TT.RPAREN);this.match(TT.SEMI);return{t:"Print",expr:e};}
  ifStmt(){this.expect(TT.IF);this.expect(TT.LPAREN);const c=this.expr();this.expect(TT.RPAREN);const tb=this.block();let eb=null;if(this.match(TT.ELSE))eb=this.block();return{t:"If",cond:c,then:tb,els:eb};}
  whileStmt(){this.expect(TT.WHILE);this.expect(TT.LPAREN);const c=this.expr();this.expect(TT.RPAREN);const b=this.block();return{t:"While",cond:c,body:b};}
  forStmt(){this.expect(TT.FOR);const v=this.expect(TT.IDENT).value;this.expect(TT.IN);const it=this.expr();const b=this.block();return{t:"For",var:v,iter:it,body:b};}
  fnDef(){
    this.expect(TT.FN);const n=this.expect(TT.IDENT).value;this.expect(TT.LPAREN);
    const ps=[];
    if(!this.check(TT.RPAREN)){ps.push(this.expect(TT.IDENT).value);while(this.match(TT.COMMA))ps.push(this.expect(TT.IDENT).value);}
    this.expect(TT.RPAREN);const b=this.block();return{t:"FnDef",name:n,params:ps,body:b};
  }
  retStmt(){this.expect(TT.RETURN);const v=this.expr();this.match(TT.SEMI);return{t:"Return",value:v};}
  exprStmt(){const e=this.expr();this.match(TT.SEMI);return e;}
  block(){this.expect(TT.LBRACE);const s=[];while(!this.check(TT.RBRACE)&&!this.check(TT.EOF))s.push(this.stmt());this.expect(TT.RBRACE);return{t:"Block",stmts:s};}
  expr(){return this.orExpr();}
  orExpr(){let l=this.andExpr();while(this.check(TT.OR)){this.advance();const r=this.andExpr();l={t:"BinOp",op:"or",left:l,right:r};}return l;}
  andExpr(){let l=this.eqExpr();while(this.check(TT.AND)){this.advance();const r=this.eqExpr();l={t:"BinOp",op:"and",left:l,right:r};}return l;}
  eqExpr(){let l=this.cmpExpr();while(this.check(TT.EQ,TT.NEQ)){const op=this.advance().type;const r=this.cmpExpr();l={t:"BinOp",op,left:l,right:r};}return l;}
  cmpExpr(){let l=this.addExpr();while(this.check(TT.LT,TT.GT,TT.LTE,TT.GTE)){const op=this.advance().type;const r=this.addExpr();l={t:"BinOp",op,left:l,right:r};}return l;}
  addExpr(){let l=this.mulExpr();while(this.check(TT.PLUS,TT.MINUS)){const op=this.advance().type===TT.PLUS?"+":"-";const r=this.mulExpr();l={t:"BinOp",op,left:l,right:r};}return l;}
  mulExpr(){let l=this.powExpr();while(this.check(TT.STAR,TT.SLASH,TT.PERCENT)){const t=this.advance().type;const op=t===TT.STAR?"*":t===TT.SLASH?"/":"%";const r=this.powExpr();l={t:"BinOp",op,left:l,right:r};}return l;}
  powExpr(){let l=this.unary();if(this.check(TT.CARET)){this.advance();const r=this.powExpr();return{t:"BinOp",op:"^",left:l,right:r};}return l;}
  unary(){if(this.check(TT.MINUS)){this.advance();return{t:"Unary",op:"-",operand:this.unary()};}if(this.check(TT.NOT)){this.advance();return{t:"Unary",op:"not",operand:this.unary()};}return this.call();}
  call(){
    if(this.check(TT.IDENT)&&this.peek().type===TT.LPAREN){
      const n=this.advance().value;this.expect(TT.LPAREN);
      const args=[];
      if(!this.check(TT.RPAREN)){args.push(this.expr());while(this.match(TT.COMMA))args.push(this.expr());}
      this.expect(TT.RPAREN);return{t:"Call",name:n,args};
    }
    return this.rangeExpr();
  }
  rangeExpr(){
    if(this.check(TT.RANGE)){
      this.advance();this.expect(TT.LPAREN);
      const s=this.expr();this.expect(TT.COMMA);const e=this.expr();
      let step=null;if(this.match(TT.COMMA))step=this.expr();
      this.expect(TT.RPAREN);return{t:"Range",start:s,stop:e,step};
    }
    return this.primary();
  }
  primary(){
    const tok=this.cur();
    if(tok.type===TT.NUMBER){this.advance();return{t:"Num",v:tok.value};}
    if(tok.type===TT.STRING){this.advance();return{t:"Str",v:tok.value};}
    if(tok.type===TT.BOOL){this.advance();return{t:"Bool",v:tok.value};}
    if(tok.type===TT.NULL){this.advance();return{t:"Null"};}
    if(tok.type===TT.IDENT){this.advance();return{t:"Ident",name:tok.value};}
    if(tok.type===TT.LPAREN){this.advance();const e=this.expr();this.expect(TT.RPAREN);return e;}
    this.err(`Unexpected token '${tok.value}' (${tok.type})`);
  }
}

class ReturnSig{constructor(v){this.v=v;}}
class Env{
  constructor(parent=null){this.vars={};this.parent=parent;}
  get(n){if(n in this.vars)return this.vars[n];if(this.parent)return this.parent.get(n);throw new Error(`Undefined variable '${n}'`);}
  set(n,v){this.vars[n]=v;}
  assign(n,v){if(n in this.vars){this.vars[n]=v;}else if(this.parent){this.parent.assign(n,v);}else{throw new Error(`Undefined variable '${n}'`);}}
}

const BUILTINS={
  sqrt:[1,([a])=>Math.sqrt(a)],
  abs:[1,([a])=>Math.abs(a)],
  floor:[1,([a])=>Math.floor(a)],
  ceil:[1,([a])=>Math.ceil(a)],
  round:[1,([a])=>Math.round(a)],
  pow:[2,([a,b])=>Math.pow(a,b)],
  max:[null,(args)=>Math.max(...args)],
  min:[null,(args)=>Math.min(...args)],
  len:[1,([a])=>String(a).length],
  str:[1,([a])=>nova_str(a)],
  num:[1,([a])=>Number(a)],
  type:[1,([a])=>typeof a],
};

function nova_str(v){
  if(v===null)return"null";
  if(v===true)return"true";
  if(v===false)return"false";
  if(typeof v==="number"&&Number.isInteger(v))return String(v);
  return String(v);
}

class Interpreter{
  constructor(){this.output=[];this.steps=0;}
  run(src){
    this.output=[];this.steps=0;
    const tokens=new Lexer(src).tokenize();
    const ast=new Parser(tokens).parse();
    const env=new Env();
    this.eval(ast,env);
    return this.output;
  }
  eval(node,env){
    if(++this.steps>500000)throw new Error("Execution limit reached (infinite loop?)");
    switch(node.t){
      case"Program":node.stmts.forEach(s=>this.eval(s,env));break;
      case"Num":return node.v;
      case"Str":return node.v;
      case"Bool":return node.v;
      case"Null":return null;
      case"Ident":return env.get(node.name);
      case"Let":env.set(node.name,this.eval(node.value,env));break;
      case"Assign":env.assign(node.name,this.eval(node.value,env));break;
      case"Print":{const v=this.eval(node.expr,env);this.output.push(nova_str(v));return v;}
      case"Block":node.stmts.forEach(s=>this.eval(s,env));break;
      case"BinOp":return this.evalBin(node.op,node.left,node.right,env);
      case"Unary":{
        const v=this.eval(node.operand,env);
        if(node.op==="-")return -v;
        if(node.op==="not")return !v;
        break;
      }
      case"If":{
        const c=this.eval(node.cond,env);
        if(c)this.eval(node.then,new Env(env));
        else if(node.els)this.eval(node.els,new Env(env));
        break;
      }
      case"While":{
        let guard=0;
        while(this.eval(node.cond,env)){
          if(++guard>100000)throw new Error("While loop limit reached");
          this.eval(node.body,new Env(env));
        }
        break;
      }
      case"For":{
        const items=this.eval(node.iter,env);
        if(!Array.isArray(items))throw new Error("for..in requires a range");
        for(const item of items){const loc=new Env(env);loc.set(node.var,item);this.eval(node.body,loc);}
        break;
      }
      case"Range":{
        const s=Math.trunc(this.eval(node.start,env));
        const e=Math.trunc(this.eval(node.stop,env));
        const step=node.step?Math.trunc(this.eval(node.step,env)):1;
        const arr=[];for(let i=s;i<e;i+=step)arr.push(i);
        return arr;
      }
      case"FnDef":env.set(node.name,{__fn__:true,node,closure:env});break;
      case"Call":return this.evalCall(node.name,node.args,env);
      case"Return":throw new ReturnSig(this.eval(node.value,env));
      default:throw new Error(`Unknown node type: ${node.t}`);
    }
  }
  evalBin(op,l,r,env){
    const lv=this.eval(l,env);
    const rv=this.eval(r,env);
    switch(op){
      case"+":return lv+rv;
      case"-":return lv-rv;
      case"*":return lv*rv;
      case"/":{if(rv===0)throw new Error("Division by zero");return lv/rv;}
      case"%":return lv%rv;
      case"^":return Math.pow(lv,rv);
      case"EQ":return lv===rv;
      case"NEQ":return lv!==rv;
      case"LT":return lv<rv;
      case"GT":return lv>rv;
      case"LTE":return lv<=rv;
      case"GTE":return lv>=rv;
      case"and":return Boolean(lv)&&Boolean(rv);
      case"or":return Boolean(lv)||Boolean(rv);
      default:throw new Error(`Unknown op '${op}'`);
    }
  }
  evalCall(name,argNodes,env){
    if(BUILTINS[name]){
      const [,fn]=BUILTINS[name];
      const args=argNodes.map(a=>this.eval(a,env));
      return fn(args);
    }
    const fn=env.get(name);
    if(!fn?.__fn__)throw new Error(`'${name}' is not a function`);
    const args=argNodes.map(a=>this.eval(a,env));
    if(args.length!==fn.node.params.length)throw new Error(`'${name}' expects ${fn.node.params.length} args, got ${args.length}`);
    const local=new Env(fn.closure);
    fn.node.params.forEach((p,i)=>local.set(p,args[i]));
    try{this.eval(fn.node.body,local);}catch(e){if(e instanceof ReturnSig)return e.v;throw e;}
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
//  SYNTAX HIGHLIGHTER
// ──────────────────────────────────────────────────────────────
function highlight(code) {
  const keywords = /\b(let|fn|if|else|while|for|in|return|print|range|and|or|not|true|false|null)\b/g;
  const numbers = /\b(\d+\.?\d*)\b/g;
  const strings = /"([^"\\]|\\.)*"/g;
  const comments = /#.*/g;
  const funcs = /\b([a-zA-Z_]\w*)\s*(?=\()/g;

  // We need to do this carefully to avoid nested replacements
  const parts = [];
  let last = 0;
  
  // Simple line-by-line approach
  return code.split('\n').map(line => {
    // Escape HTML first
    let safe = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    
    // Comment
    const commentIdx = safe.indexOf('#');
    if (commentIdx !== -1) {
      return safe.slice(0, commentIdx) + `<span class="hl-comment">${safe.slice(commentIdx)}</span>`;
    }
    
    // Strings
    safe = safe.replace(/"([^"\\]|\\.)*"/g, m => `<span class="hl-string">${m}</span>`);
    // Keywords
    safe = safe.replace(/\b(let|fn|if|else|while|for|in|return|print|range|and|or|not|true|false|null)\b/g, 
      m => `<span class="hl-kw">${m}</span>`);
    // Numbers
    safe = safe.replace(/\b(\d+\.?\d*)\b/g, m => `<span class="hl-num">${m}</span>`);
    // Functions
    safe = safe.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, m => `<span class="hl-fn">${m}</span>`);
    
    return safe;
  }).join('\n');
}

// ──────────────────────────────────────────────────────────────
//  EXAMPLE PROGRAMS
// ──────────────────────────────────────────────────────────────
const EXAMPLES = {
  "Hello World": `# My first NOVA program
let name = "World"
print("Hello, " + name + "!")
print("1 + 1 = " + str(1 + 1))`,

  "Lists": `# Lists — creation, methods, slicing
let nums = [10, 3, 7, 1, 9, 4]
print("original: " + str(nums))
print("sorted:   " + str(nums.sort()))
print("sum:      " + str(nums.sum()))
print("max:      " + str(nums.max()))

nums.push(99)
print("after push(99): " + str(nums))
print("pop: " + str(nums.pop()))
print("slice [1:4]: " + str(nums[1:4]))
print("last:  " + str(nums[-1]))
print("first: " + str(nums.first()))

# list of squares via map
let squares = nums.map(fn(x) { return x * x })
print("squares: " + str(squares))`,

  "Dicts": `# Dictionaries — key/value store
let person = {
  "name": "Alice",
  "age": 30,
  "city": "Madrid"
}

print("name: " + person["name"])
print("age:  " + str(person["age"]))

person["job"] = "Engineer"
print("keys:   " + str(person.keys()))
print("values: " + str(person.values()))
print("has job: " + str(person.has("job")))
print("has pet: " + str(person.has("pet")))

# Iterate over dict items
for pair in person.items() {
  print(str(pair[0]) + " -> " + str(pair[1]))
}`,

  "Fibonacci": `# Fibonacci with recursion
fn fib(n) {
  if (n <= 1) { return n }
  return fib(n - 1) + fib(n - 2)
}

for i in range(0, 12) {
  print("fib(" + str(i) + ") = " + str(fib(i)))
}`,

  "Map/Filter/Reduce": `# Higher-order functions
let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# map — transform each element
let doubled = numbers.map(fn(x) { return x * 2 })
print("doubled: " + str(doubled))

# filter — keep matching elements  
let evens = numbers.filter(fn(x) { return x % 2 == 0 })
print("evens:   " + str(evens))

# reduce — fold into a single value
let total = numbers.reduce(fn(acc, x) { return acc + x }, 0)
print("sum:     " + str(total))

# chain them!
let result = numbers
  .filter(fn(x) { return x % 2 == 0 })
  .map(fn(x) { return x * x })
print("even squares: " + str(result))`,

  "Try/Catch": `# Error handling
fn safe_divide(a, b) {
  try {
    return a / b
  } catch (err) {
    print("Error: " + err)
    return null
  }
}

print(str(safe_divide(10, 2)))
print(str(safe_divide(10, 0)))

# try / catch / finally
try {
  assert(1 == 2, "Math is broken!")
} catch (e) {
  print("Caught: " + e)
} finally {
  print("Finally always runs")
}`,

  "String Methods": `# String operations
let s = "  Hello, World!  "
print("original:    '" + s + "'")
print("trim:        '" + s.trim() + "'")
print("upper:       " + s.trim().upper())
print("lower:       " + s.trim().lower())
print("replace:     " + s.trim().replace("World", "NOVA"))
print("contains:    " + str(s.contains("World")))
print("starts_with: " + str(s.trim().starts_with("Hello")))
print("ends_with:   " + str(s.trim().ends_with("!")))
print("split CSV:   " + str("one,two,three".split(",")))
print("join back:   " + "one,two,three".split(",").join(" | "))
print("repeat:      " + "ha".repeat(3))
print("reverse:     " + "NOVA".reverse())
print("char_at(0):  " + "Hello"[0])`,

  "Closures": `# Closures & default arguments
fn make_counter(start = 0, step = 1) {
  let count = start
  fn next() {
    count += step
    return count
  }
  return next
}

let by1  = make_counter(0, 1)
let by10 = make_counter(0, 10)

print("by1:  " + str(by1()))
print("by1:  " + str(by1()))
print("by1:  " + str(by1()))
print("by10: " + str(by10()))
print("by10: " + str(by10()))

# compose functions
fn compose(f, g) {
  return fn(x) { return f(g(x)) }
}
fn double(x) { return x * 2 }
fn inc(x)    { return x + 1 }

let dbl_then_inc = compose(inc, double)
print("double then inc 5: " + str(dbl_then_inc(5)))`,

  "Break/Continue": `# Loop control flow
# break — exit early
print("First i where i^2 > 50:")
for i in range(0, 100) {
  if (i * i > 50) {
    print("  i = " + str(i))
    break
  }
}

# continue — skip iterations
let evens = []
for i in range(0, 20) {
  if (i % 2 != 0) { continue }
  evens.push(i)
}
print("Evens 0-19: " + str(evens))

# break in while
let n = 1024
let steps = 0
while (n > 1) {
  n = n // 2
  steps += 1
}
print("Steps to halve 1024 to 1: " + str(steps))`,
};

// ──────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
const interp = new Interpreter();

export default function NovaPlayground() {
  const [code, setCode] = useState(EXAMPLES["Fibonacci"]);
  const [output, setOutput] = useState([]);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [activeExample, setActiveExample] = useState("Fibonacci");
  const [tab, setTab] = useState("output"); // "output" | "tokens" | "ast"
  const [tokens, setTokens] = useState([]);
  const [ast, setAst] = useState(null);
  const [justRan, setJustRan] = useState(false);
  const textareaRef = useRef(null);

  const run = useCallback(() => {
    setRunning(true);
    setError(null);
    setTimeout(() => {
      try {
        // Collect tokens
        const toks = new Lexer(code).tokenize();
        setTokens(toks.filter(t => t.type !== "NEWLINE" && t.type !== TT.EOF));
        // Parse AST
        const tree = new Parser(new Lexer(code).tokenize()).parse();
        setAst(tree);
        // Run
        const out = interp.run(code);
        setOutput(out);
        setTab("output");
        setJustRan(true);
        setTimeout(() => setJustRan(false), 600);
      } catch(e) {
        setError(e.message);
        setOutput([]);
        setTab("output");
      }
      setRunning(false);
    }, 20);
  }, [code]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  const handleTab = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      const s = ta.selectionStart, end = ta.selectionEnd;
      const newCode = code.slice(0, s) + "  " + code.slice(end);
      setCode(newCode);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2; }, 0);
    }
  };

  const loadExample = (name) => {
    setActiveExample(name);
    setCode(EXAMPLES[name]);
    setOutput([]);
    setError(null);
    setTokens([]);
    setAst(null);
  };

  const tokenColor = (type) => {
    if (["LET","FN","IF","ELSE","WHILE","FOR","IN","RETURN","PRINT","RANGE","AND","OR","NOT"].includes(type))
      return "#c084fc";
    if (type === "NUMBER") return "#fb923c";
    if (type === "STRING") return "#4ade80";
    if (type === "BOOL" || type === "NULL") return "#60a5fa";
    if (type === "IDENT") return "#e2e8f0";
    return "#94a3b8";
  };

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      background: "#0a0a0f",
      minHeight: "100vh",
      color: "#e2e8f0",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a0533 0%, #0d1b3e 50%, #0a0a0f 100%)",
        borderBottom: "1px solid #1e1b4b",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: "22px",
          fontWeight: 800,
          background: "linear-gradient(90deg, #a855f7, #3b82f6, #06b6d4)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.5px",
        }}>◈ NOVA</div>
        <div style={{color:"#64748b",fontSize:"13px"}}>— A tiny language playground</div>
        <div style={{marginLeft:"auto",display:"flex",gap:"8px",alignItems:"center"}}>
          <span style={{color:"#334155",fontSize:"11px"}}>⌘↵ to run</span>
        </div>
      </div>

      {/* Example selector */}
      <div style={{
        display: "flex",
        gap: "6px",
        padding: "10px 24px",
        borderBottom: "1px solid #0f172a",
        flexWrap: "wrap",
        background: "#050508",
        flexShrink: 0,
      }}>
        {Object.keys(EXAMPLES).map(name => (
          <button key={name} onClick={() => loadExample(name)} style={{
            padding: "4px 12px",
            borderRadius: "20px",
            border: activeExample === name ? "1px solid #7c3aed" : "1px solid #1e293b",
            background: activeExample === name ? "#1e1040" : "transparent",
            color: activeExample === name ? "#a855f7" : "#475569",
            fontSize: "12px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}>{name}</button>
        ))}
      </div>

      {/* Main layout */}
      <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
        {/* Editor pane */}
        <div style={{
          flex:1,
          display:"flex",
          flexDirection:"column",
          borderRight:"1px solid #0f172a",
          position:"relative",
          minWidth:0,
        }}>
          <div style={{
            padding:"8px 16px",
            background:"#050508",
            borderBottom:"1px solid #0f172a",
            fontSize:"11px",
            color:"#334155",
            display:"flex",
            justifyContent:"space-between",
          }}>
            <span>editor.nova</span>
            <span>{code.split('\n').length} lines</span>
          </div>
          <div style={{flex:1,position:"relative",overflow:"hidden"}}>
            {/* Line numbers */}
            <div style={{
              position:"absolute",left:0,top:0,bottom:0,width:"40px",
              background:"#050508",
              borderRight:"1px solid #0f172a",
              padding:"16px 0",
              fontSize:"12px",
              lineHeight:"1.7",
              color:"#1e293b",
              textAlign:"right",
              userSelect:"none",
              overflow:"hidden",
              pointerEvents:"none",
              zIndex:2,
            }}>
              {code.split('\n').map((_,i)=>(
                <div key={i} style={{paddingRight:"8px"}}>{i+1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleTab}
              spellCheck={false}
              style={{
                position:"absolute",inset:0,
                paddingLeft:"52px",
                paddingTop:"16px",
                paddingRight:"16px",
                paddingBottom:"16px",
                background:"transparent",
                color:"#e2e8f0",
                fontSize:"13px",
                lineHeight:"1.7",
                border:"none",
                outline:"none",
                resize:"none",
                fontFamily:"inherit",
                width:"100%",
                height:"100%",
                boxSizing:"border-box",
                tabSize:2,
                caretColor:"#a855f7",
                zIndex:1,
              }}
            />
          </div>
          {/* Run button */}
          <div style={{
            padding:"12px 16px",
            background:"#050508",
            borderTop:"1px solid #0f172a",
            display:"flex",
            gap:"8px",
          }}>
            <button onClick={run} disabled={running} style={{
              padding:"8px 24px",
              background: running ? "#1e1040" : "linear-gradient(135deg, #7c3aed, #3b82f6)",
              color:"white",
              border:"none",
              borderRadius:"6px",
              fontSize:"13px",
              fontFamily:"inherit",
              cursor: running ? "wait" : "pointer",
              fontWeight:700,
              letterSpacing:"0.5px",
              transition:"all 0.2s",
              boxShadow: running ? "none" : "0 0 20px rgba(124,58,237,0.3)",
            }}>
              {running ? "▶ Running..." : "▶ Run"}
            </button>
            <button onClick={() => {setCode("");setOutput([]);setError(null);setTokens([]);setAst(null);}} style={{
              padding:"8px 16px",
              background:"transparent",
              color:"#475569",
              border:"1px solid #1e293b",
              borderRadius:"6px",
              fontSize:"12px",
              fontFamily:"inherit",
              cursor:"pointer",
            }}>Clear</button>
          </div>
        </div>

        {/* Output / Tokens / AST pane */}
        <div style={{
          width:"40%",
          display:"flex",
          flexDirection:"column",
          minWidth:0,
          minHeight:0,
        }}>
          {/* Tab bar */}
          <div style={{
            display:"flex",
            background:"#050508",
            borderBottom:"1px solid #0f172a",
            flexShrink:0,
          }}>
            {[["output","Output"],["tokens","Tokens"],["ast","AST"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{
                padding:"8px 16px",
                background:"transparent",
                color: tab===id ? "#a855f7" : "#475569",
                border:"none",
                borderBottom: tab===id ? "2px solid #7c3aed" : "2px solid transparent",
                fontSize:"12px",
                fontFamily:"inherit",
                cursor:"pointer",
                transition:"all 0.15s",
              }}>{label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{flex:1,overflow:"auto",padding:"16px",minHeight:0}}>
            {tab === "output" && (
              <div>
                {error && (
                  <div style={{
                    padding:"12px",
                    background:"#1c0a0a",
                    border:"1px solid #7f1d1d",
                    borderRadius:"6px",
                    color:"#fca5a5",
                    fontSize:"12px",
                    marginBottom:"12px",
                    whiteSpace:"pre-wrap",
                  }}>⚠ {error}</div>
                )}
                {output.length === 0 && !error && (
                  <div style={{color:"#1e293b",fontSize:"12px",textAlign:"center",marginTop:"40px"}}>
                    No output yet — click Run or press ⌘↵
                  </div>
                )}
                {output.map((line, i) => (
                  <div key={i} style={{
                    display:"flex",
                    gap:"12px",
                    padding:"3px 0",
                    borderBottom:"1px solid #0f172a",
                    animation: justRan ? "fadeIn 0.3s ease" : "none",
                  }}>
                    <span style={{color:"#1e293b",fontSize:"11px",userSelect:"none",minWidth:"20px",textAlign:"right"}}>{i+1}</span>
                    <span style={{color:"#e2e8f0",fontSize:"13px"}}>{line}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "tokens" && (
              <div>
                {tokens.length === 0 ? (
                  <div style={{color:"#1e293b",fontSize:"12px",textAlign:"center",marginTop:"40px"}}>
                    Run the program to see tokens
                  </div>
                ) : (
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    {tokens.map((t, i) => (
                      <div key={i} style={{
                        padding:"3px 8px",
                        background:"#0d1117",
                        border:`1px solid ${tokenColor(t.type)}33`,
                        borderRadius:"4px",
                        fontSize:"11px",
                        display:"flex",
                        flexDirection:"column",
                        gap:"2px",
                      }}>
                        <span style={{color:tokenColor(t.type),fontWeight:700,fontSize:"10px"}}>{t.type}</span>
                        <span style={{color:"#94a3b8"}}>{t.value !== null ? JSON.stringify(t.value) : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "ast" && (
              <div>
                {!ast ? (
                  <div style={{color:"#1e293b",fontSize:"12px",textAlign:"center",marginTop:"40px"}}>
                    Run the program to see the AST
                  </div>
                ) : (
                  <pre style={{
                    fontSize:"11px",
                    color:"#64748b",
                    lineHeight:"1.6",
                    margin:0,
                    whiteSpace:"pre-wrap",
                    wordBreak:"break-all",
                  }}>
                    {JSON.stringify(ast, null, 2)
                      .replace(/"t":\s*"([^"]+)"/g, (_,m) => `"t": "<span style='color:#a855f7;font-weight:bold'>${m}</span>"`)
                    }
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding:"8px 24px",
        background:"#050508",
        borderTop:"1px solid #0f172a",
        fontSize:"11px",
        color:"#1e293b",
        display:"flex",
        gap:"24px",
        flexShrink:0,
      }}>
        <span>NOVA v1.0</span>
        <span>Lexer → Parser → AST → Interpreter</span>
        <span>Built-ins: sqrt abs floor ceil round pow max min len str num type</span>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #050508; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform: translateY(-4px); } to { opacity:1; transform: none; } }
      `}</style>
    </div>
  );
}
