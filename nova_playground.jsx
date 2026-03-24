import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════════════════
//  NOVA INTERPRETER v2.0 — JavaScript (synced with nova.py)
//  Lexer → Parser → AST → Tree-walking Interpreter
// ══════════════════════════════════════════════════════════════

const TT = {
  NUMBER:"NUMBER",STRING:"STRING",BOOL:"BOOL",NULL:"NULL",IDENT:"IDENT",
  PLUS:"PLUS",MINUS:"MINUS",STAR:"STAR",SLASH:"SLASH",PERCENT:"PERCENT",CARET:"CARET",DSLASH:"DSLASH",
  EQ:"EQ",NEQ:"NEQ",LT:"LT",GT:"GT",LTE:"LTE",GTE:"GTE",AND:"AND",OR:"OR",NOT:"NOT",
  ASSIGN:"ASSIGN",PLUS_EQ:"PLUS_EQ",MINUS_EQ:"MINUS_EQ",STAR_EQ:"STAR_EQ",
  SLASH_EQ:"SLASH_EQ",PERC_EQ:"PERC_EQ",DSLASH_EQ:"DSLASH_EQ",
  LPAREN:"LPAREN",RPAREN:"RPAREN",LBRACE:"LBRACE",RBRACE:"RBRACE",
  LBRACKET:"LBRACKET",RBRACKET:"RBRACKET",COMMA:"COMMA",SEMI:"SEMI",DOT:"DOT",COLON:"COLON",
  NEWLINE:"NEWLINE",ARROW:"ARROW",
  LET:"LET",FN:"FN",IF:"IF",ELSE:"ELSE",WHILE:"WHILE",FOR:"FOR",IN:"IN",
  RETURN:"RETURN",PRINT:"PRINT",RANGE:"RANGE",BREAK:"BREAK",CONT:"CONTINUE",
  TRY:"TRY",CATCH:"CATCH",FINALLY:"FINALLY",ASSERT:"ASSERT",EOF:"EOF",
};

const KEYWORDS={
  let:TT.LET,fn:TT.FN,if:TT.IF,else:TT.ELSE,while:TT.WHILE,for:TT.FOR,in:TT.IN,
  return:TT.RETURN,print:TT.PRINT,range:TT.RANGE,break:TT.BREAK,continue:TT.CONT,
  try:TT.TRY,catch:TT.CATCH,finally:TT.FINALLY,assert:TT.ASSERT,
  true:TT.BOOL,false:TT.BOOL,null:TT.NULL,and:TT.AND,or:TT.OR,not:TT.NOT,
};

class ReturnSig{constructor(v){this.v=v;}}
class BreakSig{}
class ContinueSig{}
class NovaError extends Error{constructor(m){super(m);this.name="NovaError";}}

class NovaList{
  constructor(items=[]){this.items=[...items];}
  toString(){return"["+this.items.map(novaStr).join(", ")+"]";}
}
class NovaDict{
  constructor(pairs=[]){this.data=new Map();for(const[k,v]of pairs)this.data.set(k,v);}
  toString(){return"{"+[...this.data.entries()].map(([k,v])=>`${novaStr(k)}: ${novaStr(v)}`).join(", ")+"}";}
}
class NovaFn{
  constructor(node,closure){this.node=node;this.closure=closure;}
  toString(){return`<fn ${this.node.name}>`;}
}

function novaStr(v){
  if(v===null)return"null";
  if(v===true)return"true";
  if(v===false)return"false";
  if(v instanceof NovaList)return v.toString();
  if(v instanceof NovaDict)return v.toString();
  if(v instanceof NovaFn)return v.toString();
  if(typeof v==="number"&&Number.isInteger(v))return String(v);
  return String(v);
}

// ── Lexer ──────────────────────────────────────────────────────
class Lexer{
  constructor(src){this.src=src;this.pos=0;this.line=1;this.tokens=[];}
  err(m){throw new NovaError(`[Line ${this.line}] LexerError: ${m}`);}
  peek(o=0){const p=this.pos+o;return p<this.src.length?this.src[p]:"\0";}
  advance(){const c=this.src[this.pos++];if(c==="\n")this.line++;return c;}
  match(e){if(this.pos<this.src.length&&this.src[this.pos]===e){this.advance();return true;}return false;}
  add(t,v=null){this.tokens.push({type:t,value:v,line:this.line});}
  tokenize(){while(this.pos<this.src.length)this.scan();this.add(TT.EOF);return this.tokens;}
  scan(){
    const ch=this.advance();
    if(" \t\r".includes(ch))return;
    if(ch==="\n"){const l=this.tokens[this.tokens.length-1];if(!l||l.type!==TT.NEWLINE)this.add(TT.NEWLINE);return;}
    if(ch==="#"){while(this.pos<this.src.length&&this.src[this.pos]!=="\n")this.pos++;return;}
    if(ch==='"'||ch==="'"){this.readString(ch);return;}
    if(/\d/.test(ch)||(ch==="."&&/\d/.test(this.peek()))){this.readNumber(ch);return;}
    if(/[a-zA-Z_]/.test(ch)){this.readIdent(ch);return;}
    if(ch==="="){this.match("=")?this.add(TT.EQ):this.add(TT.ASSIGN);return;}
    if(ch==="!"){this.match("=")?this.add(TT.NEQ):this.err("Unexpected '!'");return;}
    if(ch==="<"){this.match("=")?this.add(TT.LTE):this.add(TT.LT);return;}
    if(ch===">"){this.match("=")?this.add(TT.GTE):this.add(TT.GT);return;}
    if(ch==="-"){if(this.match(">"))this.add(TT.ARROW);else if(this.match("="))this.add(TT.MINUS_EQ);else this.add(TT.MINUS);return;}
    if(ch==="+"){this.match("=")?this.add(TT.PLUS_EQ):this.add(TT.PLUS);return;}
    if(ch==="*"){this.match("=")?this.add(TT.STAR_EQ):this.add(TT.STAR);return;}
    if(ch==="%"){this.match("=")?this.add(TT.PERC_EQ):this.add(TT.PERCENT);return;}
    if(ch==="/"){if(this.match("/")){this.match("=")?this.add(TT.DSLASH_EQ):this.add(TT.DSLASH);}else if(this.match("="))this.add(TT.SLASH_EQ);else this.add(TT.SLASH);return;}
    const s={"^":TT.CARET,"(":TT.LPAREN,")":TT.RPAREN,"{":TT.LBRACE,"}":TT.RBRACE,"[":TT.LBRACKET,"]":TT.RBRACKET,",":TT.COMMA,";":TT.SEMI,".":TT.DOT,":":TT.COLON};
    if(s[ch]){this.add(s[ch]);return;}
    this.err(`Unexpected character '${ch}'`);
  }
  readString(q){
    let s="";
    while(this.pos<this.src.length&&this.src[this.pos]!==q){
      if(this.src[this.pos]==="\\"){this.pos++;const e={n:"\n",t:"\t",r:"\r","\\":"\\",'"':'"',"'":"'"};s+=e[this.src[this.pos]]??this.src[this.pos];this.pos++;}
      else s+=this.src[this.pos++];
    }
    if(this.pos>=this.src.length)this.err("Unterminated string");
    this.pos++;this.add(TT.STRING,s);
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

// ── Parser ─────────────────────────────────────────────────────
class Parser{
  constructor(tokens){this.tokens=tokens.filter(t=>t.type!==TT.NEWLINE);this.pos=0;}
  err(m){const t=this.cur();throw new NovaError(`[Line ${t.line}] ParseError: ${m}`);}
  cur(){return this.tokens[this.pos];}
  peek(o=1){const p=this.pos+o;return p<this.tokens.length?this.tokens[p]:this.tokens[this.tokens.length-1];}
  check(...ts){return ts.includes(this.cur().type);}
  advance(){const t=this.tokens[this.pos];if(t.type!==TT.EOF)this.pos++;return t;}
  expect(tt){if(!this.check(tt))this.err(`Expected ${tt}, got ${this.cur().type} (${JSON.stringify(this.cur().value)})`);return this.advance();}
  match(...ts){if(this.check(...ts))return this.advance();return null;}
  parse(){const s=[];while(!this.check(TT.EOF))s.push(this.stmt());return{t:"Program",stmts:s};}

  stmt(){
    if(this.check(TT.LET))    return this.letStmt();
    if(this.check(TT.PRINT))  return this.printStmt();
    if(this.check(TT.IF))     return this.ifStmt();
    if(this.check(TT.WHILE))  return this.whileStmt();
    if(this.check(TT.FOR))    return this.forStmt();
    if(this.check(TT.FN))     return this.fnDef();
    if(this.check(TT.RETURN)) return this.retStmt();
    if(this.check(TT.BREAK))  {this.advance();this.match(TT.SEMI);return{t:"Break"};}
    if(this.check(TT.CONT))   {this.advance();this.match(TT.SEMI);return{t:"Continue"};}
    if(this.check(TT.TRY))    return this.tryStmt();
    if(this.check(TT.ASSERT)) return this.assertStmt();
    return this.exprOrAssign();
  }
  letStmt(){this.expect(TT.LET);const name=this.expect(TT.IDENT).value;this.expect(TT.ASSIGN);const value=this.expr();this.match(TT.SEMI);return{t:"Let",name,value};}
  exprOrAssign(){
    const expr=this.expr();
    const C={[TT.PLUS_EQ]:"+",[TT.MINUS_EQ]:"-",[TT.STAR_EQ]:"*",[TT.SLASH_EQ]:"/",[TT.PERC_EQ]:"%",[TT.DSLASH_EQ]:"//"};
    if(C[this.cur().type]){const op=C[this.advance().type];const val=this.expr();this.match(TT.SEMI);return{t:"CompoundAssign",target:expr,op,value:val};}
    if(this.check(TT.ASSIGN)){this.advance();const val=this.expr();this.match(TT.SEMI);return{t:"Assign",target:expr,value:val};}
    this.match(TT.SEMI);return expr;
  }
  printStmt(){this.expect(TT.PRINT);this.expect(TT.LPAREN);const expr=this.expr();this.expect(TT.RPAREN);this.match(TT.SEMI);return{t:"Print",expr};}
  ifStmt(){
    this.expect(TT.IF);this.expect(TT.LPAREN);const cond=this.expr();this.expect(TT.RPAREN);
    const then=this.block();let els=null;
    if(this.match(TT.ELSE))els=this.check(TT.IF)?this.ifStmt():this.block();
    return{t:"If",cond,then,els};
  }
  whileStmt(){this.expect(TT.WHILE);this.expect(TT.LPAREN);const cond=this.expr();this.expect(TT.RPAREN);return{t:"While",cond,body:this.block()};}
  forStmt(){this.expect(TT.FOR);const v=this.expect(TT.IDENT).value;this.expect(TT.IN);const iter=this.expr();return{t:"For",var:v,iter,body:this.block()};}
  fnDef(){
    this.expect(TT.FN);const name=this.expect(TT.IDENT).value;this.expect(TT.LPAREN);
    const params=[],defaults=[];
    if(!this.check(TT.RPAREN)){
      params.push(this.expect(TT.IDENT).value);defaults.push(this.match(TT.ASSIGN)?this.expr():null);
      while(this.match(TT.COMMA)){params.push(this.expect(TT.IDENT).value);defaults.push(this.match(TT.ASSIGN)?this.expr():null);}
    }
    this.expect(TT.RPAREN);return{t:"FnDef",name,params,defaults,body:this.block()};
  }
  retStmt(){this.expect(TT.RETURN);const v=this.expr();this.match(TT.SEMI);return{t:"Return",value:v};}
  tryStmt(){
    this.expect(TT.TRY);const body=this.block();
    let catchVar=null,catchBlock=null,finallyBlock=null;
    if(this.match(TT.CATCH)){this.expect(TT.LPAREN);catchVar=this.expect(TT.IDENT).value;this.expect(TT.RPAREN);catchBlock=this.block();}
    if(this.check(TT.FINALLY)){this.advance();finallyBlock=this.block();}
    return{t:"TryCatch",body,catchVar,catchBlock,finallyBlock};
  }
  assertStmt(){
    this.expect(TT.ASSERT);this.expect(TT.LPAREN);
    const expr=this.expr();const msg=this.match(TT.COMMA)?this.expr():null;
    this.expect(TT.RPAREN);this.match(TT.SEMI);return{t:"Assert",expr,msg};
  }
  block(){this.expect(TT.LBRACE);const stmts=[];while(!this.check(TT.RBRACE)&&!this.check(TT.EOF))stmts.push(this.stmt());this.expect(TT.RBRACE);return{t:"Block",stmts};}

  expr(){return this.orExpr();}
  orExpr(){let l=this.andExpr();while(this.check(TT.OR)){this.advance();l={t:"BinOp",op:"or",left:l,right:this.andExpr()};}return l;}
  andExpr(){let l=this.eqExpr();while(this.check(TT.AND)){this.advance();l={t:"BinOp",op:"and",left:l,right:this.eqExpr()};}return l;}
  eqExpr(){let l=this.cmpExpr();while(this.check(TT.EQ,TT.NEQ)){const op=this.advance().type;l={t:"BinOp",op,left:l,right:this.cmpExpr()};}return l;}
  cmpExpr(){let l=this.addExpr();while(this.check(TT.LT,TT.GT,TT.LTE,TT.GTE)){const op=this.advance().type;l={t:"BinOp",op,left:l,right:this.addExpr()};}return l;}
  addExpr(){let l=this.mulExpr();while(this.check(TT.PLUS,TT.MINUS)){const op=this.advance().type===TT.PLUS?"+":"-";l={t:"BinOp",op,left:l,right:this.mulExpr()};}return l;}
  mulExpr(){
    let l=this.powExpr();
    while(this.check(TT.STAR,TT.SLASH,TT.PERCENT,TT.DSLASH)){
      const tt=this.advance().type;const op={[TT.STAR]:"*",[TT.SLASH]:"/",[TT.PERCENT]:"%",[TT.DSLASH]:"//"}[tt];
      l={t:"BinOp",op,left:l,right:this.powExpr()};
    }
    return l;
  }
  powExpr(){let l=this.unary();if(this.check(TT.CARET)){this.advance();return{t:"BinOp",op:"^",left:l,right:this.powExpr()};}return l;}
  unary(){
    if(this.check(TT.MINUS)){this.advance();return{t:"Unary",op:"-",operand:this.unary()};}
    if(this.check(TT.NOT)){this.advance();return{t:"Unary",op:"not",operand:this.unary()};}
    return this.postfix();
  }
  postfix(){
    let node=this.primary();
    while(true){
      if(this.check(TT.LBRACKET)){
        this.advance();
        if(this.check(TT.COLON)){this.advance();const stop=this.check(TT.RBRACKET)?null:this.expr();this.expect(TT.RBRACKET);node={t:"Slice",obj:node,start:null,stop};}
        else{const idx=this.expr();if(this.match(TT.COLON)){const stop=this.check(TT.RBRACKET)?null:this.expr();this.expect(TT.RBRACKET);node={t:"Slice",obj:node,start:idx,stop};}else{this.expect(TT.RBRACKET);node={t:"Index",obj:node,idx};}}
      } else if(this.check(TT.DOT)){
        this.advance();const name=this.expect(TT.IDENT).value;
        if(this.check(TT.LPAREN)){this.advance();const args=this.argList();this.expect(TT.RPAREN);node={t:"MethodCall",obj:node,method:name,args};}
        else node={t:"Attr",obj:node,name};
      } else if(this.check(TT.LPAREN)){
        this.advance();const args=this.argList();this.expect(TT.RPAREN);node={t:"Call",callee:node,args};
      } else break;
    }
    return node;
  }
  argList(){const args=[];if(!this.check(TT.RPAREN)){args.push(this.expr());while(this.match(TT.COMMA))args.push(this.expr());}return args;}
  primary(){
    const tok=this.cur();
    if(tok.type===TT.NUMBER){this.advance();return{t:"Num",v:tok.value};}
    if(tok.type===TT.STRING){this.advance();return{t:"Str",v:tok.value};}
    if(tok.type===TT.BOOL)  {this.advance();return{t:"Bool",v:tok.value};}
    if(tok.type===TT.NULL)  {this.advance();return{t:"Null"};}
    if(tok.type===TT.IDENT) {this.advance();return{t:"Ident",name:tok.value};}
    if(tok.type===TT.LBRACKET){
      this.advance();const items=[];
      if(!this.check(TT.RBRACKET)){items.push(this.expr());while(this.match(TT.COMMA))items.push(this.expr());}
      this.expect(TT.RBRACKET);return{t:"ListLit",items};
    }
    if(tok.type===TT.LBRACE){
      this.advance();const pairs=[];
      if(!this.check(TT.RBRACE)){
        const k=this.expr();this.expect(TT.COLON);const v=this.expr();pairs.push([k,v]);
        while(this.match(TT.COMMA)){const k2=this.expr();this.expect(TT.COLON);const v2=this.expr();pairs.push([k2,v2]);}
      }
      this.expect(TT.RBRACE);return{t:"DictLit",pairs};
    }
    if(tok.type===TT.LPAREN){this.advance();const e=this.expr();this.expect(TT.RPAREN);return e;}
    if(tok.type===TT.RANGE){
      this.advance();this.expect(TT.LPAREN);const s=this.expr();this.expect(TT.COMMA);const e=this.expr();
      const step=this.match(TT.COMMA)?this.expr():null;this.expect(TT.RPAREN);return{t:"Range",start:s,stop:e,step};
    }
    if(tok.type===TT.FN){
      this.advance();this.expect(TT.LPAREN);const params=[],defaults=[];
      if(!this.check(TT.RPAREN)){params.push(this.expect(TT.IDENT).value);defaults.push(this.match(TT.ASSIGN)?this.expr():null);
        while(this.match(TT.COMMA)){params.push(this.expect(TT.IDENT).value);defaults.push(this.match(TT.ASSIGN)?this.expr():null);}
      }
      this.expect(TT.RPAREN);const body=this.block();return{t:"FnDef",name:"__lambda__",params,defaults,body};
    }
    this.err(`Unexpected token '${tok.value}' (${tok.type})`);
  }
}

// ── Environment ────────────────────────────────────────────────
class Env{
  constructor(parent=null){this.vars={};this.parent=parent;}
  get(n){if(n in this.vars)return this.vars[n];if(this.parent)return this.parent.get(n);throw new NovaError(`Undefined variable '${n}'`);}
  set(n,v){this.vars[n]=v;}
  assign(n,v){if(n in this.vars)this.vars[n]=v;else if(this.parent)this.parent.assign(n,v);else throw new NovaError(`Undefined variable '${n}'`);}
}

// ── Built-in functions (mirrors Python BUILTINS exactly) ───────
const MATH_CONSTS={PI:Math.PI,E:Math.E,INF:Infinity,NAN:NaN};
const BUILTINS={
  sqrt:a=>Math.sqrt(a[0]),abs:a=>Math.abs(a[0]),floor:a=>Math.floor(a[0]),ceil:a=>Math.ceil(a[0]),
  round:a=>a.length>1?Math.round(a[0]*10**a[1])/10**a[1]:Math.round(a[0]),
  pow:a=>Math.pow(a[0],a[1]),
  log:a=>a.length>1?Math.log(a[0])/Math.log(a[1]):Math.log(a[0]),
  log2:a=>Math.log2(a[0]),log10:a=>Math.log10(a[0]),
  sin:a=>Math.sin(a[0]),cos:a=>Math.cos(a[0]),tan:a=>Math.tan(a[0]),
  asin:a=>Math.asin(a[0]),acos:a=>Math.acos(a[0]),atan:a=>Math.atan(a[0]),atan2:a=>Math.atan2(a[0],a[1]),
  int_div:a=>Math.trunc(a[0]/a[1]),
  max:a=>a[0] instanceof NovaList?Math.max(...a[0].items):Math.max(...a),
  min:a=>a[0] instanceof NovaList?Math.min(...a[0].items):Math.min(...a),
  sum:a=>(a[0] instanceof NovaList?a[0].items:a).reduce((s,x)=>s+x,0),
  product:a=>(a[0] instanceof NovaList?a[0].items:a).reduce((p,x)=>p*x,1),
  random:()=>Math.random(),
  rand_int:a=>Math.floor(Math.random()*(a[1]-a[0]+1))+a[0],
  rand_float:a=>Math.random()*(a[1]-a[0])+a[0],
  choice:a=>a[0].items[Math.floor(Math.random()*a[0].items.length)],
  str:a=>novaStr(a[0]),num:a=>Number(a[0]),int:a=>Math.trunc(Number(a[0])),bool:a=>Boolean(a[0]),
  type:a=>{const v=a[0];if(v===null)return"null";if(typeof v==="boolean")return"bool";if(typeof v==="number")return"number";if(typeof v==="string")return"string";if(v instanceof NovaList)return"list";if(v instanceof NovaDict)return"dict";if(v instanceof NovaFn)return"function";return"unknown";},
  is_num:a=>typeof a[0]==="number"&&typeof a[0]!=="boolean",
  is_str:a=>typeof a[0]==="string",is_bool:a=>typeof a[0]==="boolean",
  is_list:a=>a[0] instanceof NovaList,is_dict:a=>a[0] instanceof NovaDict,is_null:a=>a[0]===null,
  len:a=>a[0] instanceof NovaList?a[0].items.length:(a[0] instanceof NovaDict?a[0].data.size:String(a[0]).length),
  upper:a=>String(a[0]).toUpperCase(),lower:a=>String(a[0]).toLowerCase(),trim:a=>String(a[0]).trim(),
  split:a=>new NovaList(String(a[0]).split(a.length>1?String(a[1]):undefined)),
  join:a=>a[0].items.map(novaStr).join(String(a[1])),
  replace:a=>String(a[0]).split(String(a[1])).join(String(a[2])),
  contains:a=>typeof a[0]==="string"?String(a[0]).includes(String(a[1])):a[0].items.includes(a[1]),
  starts_with:a=>String(a[0]).startsWith(String(a[1])),
  ends_with:a=>String(a[0]).endsWith(String(a[1])),
  index_of:a=>typeof a[0]==="string"?String(a[0]).indexOf(String(a[1])):a[0].items.indexOf(a[1]),
  repeat:a=>String(a[0]).repeat(a[1]),char_at:a=>String(a[0])[a[1]],
  char_code:a=>String(a[0]).charCodeAt(0),from_code:a=>String.fromCharCode(a[0]),
  substr:a=>String(a[0]).slice(a[1],a.length>2?a[2]:undefined),
  pad_left:a=>String(a[0]).padStart(a[1],a.length>2?String(a[2]):" "),
  pad_right:a=>String(a[0]).padEnd(a[1],a.length>2?String(a[2]):" "),
  list:a=>new NovaList(a),
  push:a=>{a[0].items.push(a[1]);return a[0];},
  pop:a=>a[0].items.pop(),shift:a=>a[0].items.shift(),
  unshift:a=>{a[0].items.unshift(a[1]);return a[0];},
  insert:a=>{a[0].items.splice(a[1],0,a[2]);return a[0];},
  remove_at:a=>a[0].items.splice(a[1],1)[0],
  reverse:a=>new NovaList([...a[0].items].reverse()),
  sort:a=>new NovaList([...a[0].items].sort((x,y)=>typeof x==="number"&&typeof y==="number"?x-y:String(x)<String(y)?-1:1)),
  slice:a=>new NovaList(a[0].items.slice(a[1],a.length>2?a[2]:undefined)),
  concat:a=>new NovaList([...a[0].items,...a[1].items]),
  flatten:a=>new NovaList(a[0].items.flatMap(x=>x instanceof NovaList?x.items:[x])),
  unique:a=>new NovaList([...new Set(a[0].items)]),
  zip:a=>new NovaList(a[0].items.map((x,i)=>new NovaList([x,a[1].items[i]]))),
  enumerate:a=>new NovaList(a[0].items.map((v,i)=>new NovaList([i,v]))),
  all:a=>a[0].items.every(Boolean),any:a=>a[0].items.some(Boolean),
  dict:()=>new NovaDict(),
  keys:a=>new NovaList([...a[0].data.keys()]),values:a=>new NovaList([...a[0].data.values()]),
  has:a=>a[0].data.has(a[1]),
  set_key:a=>{a[0].data.set(a[1],a[2]);return a[0];},
  del_key:a=>{a[0].data.delete(a[1]);return a[0];},
  merge:a=>new NovaDict([...a[0].data.entries(),...a[1].data.entries()]),
  clock:()=>Date.now()/1000,
};

// ── Interpreter ────────────────────────────────────────────────
class Interpreter{
  constructor(){this.output=[];this.steps=0;}
  run(src){
    this.output=[];this.steps=0;
    const tokens=new Lexer(src).tokenize();
    const ast=new Parser(tokens).parse();
    const env=new Env();
    for(const[k,v]of Object.entries(MATH_CONSTS))env.set(k,v);
    this.eval(ast,env);
    return this.output;
  }
  eval(node,env){
    if(++this.steps>500000)throw new NovaError("Execution limit reached");
    switch(node.t){
      case"Program":node.stmts.forEach(s=>this.eval(s,env));return;
      case"Num":return node.v;
      case"Str":return node.v;
      case"Bool":return node.v;
      case"Null":return null;
      case"Ident":try{return env.get(node.name);}catch(e){if(node.name in MATH_CONSTS)return MATH_CONSTS[node.name];throw e;}
      case"ListLit":return new NovaList(node.items.map(i=>this.eval(i,env)));
      case"DictLit":return new NovaDict(node.pairs.map(([k,v])=>[this.eval(k,env),this.eval(v,env)]));
      case"Let":env.set(node.name,this.eval(node.value,env));return;
      case"Assign":this.doAssign(node.target,this.eval(node.value,env),env);return;
      case"CompoundAssign":{const cur=this.eval(node.target,env);const rhs=this.eval(node.value,env);this.doAssign(node.target,this.applyOp(node.op,cur,rhs),env);return;}
      case"Index":return this.idxGet(this.eval(node.obj,env),this.eval(node.idx,env));
      case"Slice":{const obj=this.eval(node.obj,env);const s=node.start?Math.trunc(this.eval(node.start,env)):undefined;const e=node.stop?Math.trunc(this.eval(node.stop,env)):undefined;if(obj instanceof NovaList)return new NovaList(obj.items.slice(s,e));if(typeof obj==="string")return obj.slice(s,e);throw new NovaError("Slice requires list or string");}
      case"Attr":{const obj=this.eval(node.obj,env);if(obj instanceof NovaDict&&obj.data.has(node.name))return obj.data.get(node.name);throw new NovaError(`No attribute '${node.name}'`);}
      case"BinOp":return this.binop(node.op,node.left,node.right,env);
      case"Unary":{const v=this.eval(node.operand,env);return node.op==="-"?-v:!v;}
      case"Print":{const v=this.eval(node.expr,env);this.output.push(novaStr(v));return v;}
      case"Block":node.stmts.forEach(s=>this.eval(s,env));return;
      case"If":if(this.eval(node.cond,env))this.eval(node.then,new Env(env));else if(node.els)this.eval(node.els,new Env(env));return;
      case"While":while(this.eval(node.cond,env)){try{this.eval(node.body,new Env(env));}catch(e){if(e instanceof BreakSig)break;if(e instanceof ContinueSig)continue;throw e;}}return;
      case"For":{const items=this.eval(node.iter,env);const lst=items instanceof NovaList?items.items:(Array.isArray(items)?items:[]);for(const item of lst){const loc=new Env(env);loc.set(node.var,item);try{this.eval(node.body,loc);}catch(e){if(e instanceof BreakSig)break;if(e instanceof ContinueSig)continue;throw e;}}return;}
      case"Range":{const s=Math.trunc(this.eval(node.start,env));const e=Math.trunc(this.eval(node.stop,env));const step=node.step?Math.trunc(this.eval(node.step,env)):1;const arr=[];for(let i=s;i<e;i+=step)arr.push(i);return new NovaList(arr);}
      case"Break":throw new BreakSig();
      case"Continue":throw new ContinueSig();
      case"Return":throw new ReturnSig(this.eval(node.value,env));
      case"TryCatch":
        try{this.eval(node.body,new Env(env));}
        catch(e){
          if(e instanceof ReturnSig||e instanceof BreakSig||e instanceof ContinueSig)throw e;
          if(node.catchBlock){const loc=new Env(env);if(node.catchVar)loc.set(node.catchVar,e.message||String(e));this.eval(node.catchBlock,loc);}
        }finally{if(node.finallyBlock)this.eval(node.finallyBlock,new Env(env));}
        return;
      case"Assert":{if(!this.eval(node.expr,env)){const msg=node.msg?novaStr(this.eval(node.msg,env)):"Assertion failed";throw new NovaError(`AssertionError: ${msg}`);}return;}
      case"FnDef":{const fn=new NovaFn(node,env);if(node.name!=="__lambda__")env.set(node.name,fn);return fn;}
      case"Call":return this.doCall(node.callee,node.args,env);
      case"MethodCall":return this.doMethod(this.eval(node.obj,env),node.method,node.args.map(a=>this.eval(a,env)));
      default:throw new NovaError(`Unknown node: ${node.t}`);
    }
  }
  doAssign(target,val,env){
    if(target.t==="Ident"){env.assign(target.name,val);return;}
    if(target.t==="Index"){const obj=this.eval(target.obj,env);const idx=this.eval(target.idx,env);if(obj instanceof NovaList)obj.items[idx<0?obj.items.length+idx:idx]=val;else if(obj instanceof NovaDict)obj.data.set(idx,val);else throw new NovaError("Cannot index-assign");return;}
    if(target.t==="Attr"){const obj=this.eval(target.obj,env);if(obj instanceof NovaDict)obj.data.set(target.name,val);else throw new NovaError("Cannot set attr");return;}
    throw new NovaError("Invalid assignment target");
  }
  applyOp(op,a,b){
    if(op==="+")return a+b;if(op==="-")return a-b;if(op==="*")return a*b;
    if(op==="/"){if(b===0)throw new NovaError("Division by zero");return a/b;}
    if(op==="//")return Math.trunc(a/b);if(op==="%")return((a%b)+b)%b;if(op==="^")return Math.pow(a,b);
    throw new NovaError(`Unknown op '${op}'`);
  }
  binop(op,ln,rn,env){
    if(op==="and"){const lv=this.eval(ln,env);return lv&&this.eval(rn,env);}
    if(op==="or"){const lv=this.eval(ln,env);return lv||this.eval(rn,env);}
    const lv=this.eval(ln,env),rv=this.eval(rn,env);
    if(op==="+"){if(lv instanceof NovaList&&rv instanceof NovaList)return new NovaList([...lv.items,...rv.items]);return lv+rv;}
    if(op==="-")return lv-rv;
    if(op==="*"){if(typeof lv==="string")return lv.repeat(rv);return lv*rv;}
    if(op==="/"){if(rv===0)throw new NovaError("Division by zero");return lv/rv;}
    if(op==="//")return Math.trunc(lv/rv);
    if(op==="%")return((lv%rv)+rv)%rv;
    if(op==="^")return Math.pow(lv,rv);
    if(op==="EQ")return lv===rv;if(op==="NEQ")return lv!==rv;
    if(op==="LT")return lv<rv;if(op==="GT")return lv>rv;if(op==="LTE")return lv<=rv;if(op==="GTE")return lv>=rv;
    throw new NovaError(`Unknown operator '${op}'`);
  }
  idxGet(obj,idx){
    if(obj instanceof NovaList){const i=idx<0?obj.items.length+idx:idx;if(i<0||i>=obj.items.length)throw new NovaError(`Index ${idx} out of range`);return obj.items[i];}
    if(obj instanceof NovaDict){if(!obj.data.has(idx))throw new NovaError(`Key '${idx}' not found`);return obj.data.get(idx);}
    if(typeof obj==="string")return obj[idx<0?obj.length+idx:idx];
    throw new NovaError("Cannot index this type");
  }
  doCall(calleeNode,argNodes,env){
    if(calleeNode.t==="Ident"){
      const name=calleeNode.name;
      if(name in BUILTINS){const args=argNodes.map(a=>this.eval(a,env));try{return BUILTINS[name](args);}catch(e){if(e instanceof NovaError)throw e;throw new NovaError(e.message);}}
      if(name==="map"){const args=argNodes.map(a=>this.eval(a,env));return this.hofMap(args);}
      if(name==="filter"){const args=argNodes.map(a=>this.eval(a,env));return this.hofFilter(args);}
      if(name==="reduce"){const args=argNodes.map(a=>this.eval(a,env));return this.hofReduce(args);}
    }
    const callee=this.eval(calleeNode,env);
    if(callee instanceof NovaFn){const args=argNodes.map(a=>this.eval(a,env));return this.invoke(callee,args);}
    throw new NovaError(`'${novaStr(callee)}' is not callable`);
  }
  invoke(fn,args){
    const{params,defaults}=fn.node;const local=new Env(fn.closure);
    for(let i=0;i<params.length;i++){
      if(i<args.length)local.set(params[i],args[i]);
      else if(defaults[i]!==null)local.set(params[i],this.eval(defaults[i],fn.closure));
      else throw new NovaError(`Missing argument '${params[i]}'`);
    }
    try{this.eval(fn.node.body,local);}catch(e){if(e instanceof ReturnSig)return e.v;throw e;}
    return null;
  }
  doMethod(obj,method,args){
    if(typeof obj==="string"){
      const m={
        upper:()=>obj.toUpperCase(),lower:()=>obj.toLowerCase(),trim:()=>obj.trim(),
        trim_left:()=>obj.trimStart(),trim_right:()=>obj.trimEnd(),
        split:()=>new NovaList(obj.split(args.length?String(args[0]):undefined)),
        replace:()=>obj.split(String(args[0])).join(String(args[1])),
        contains:()=>obj.includes(String(args[0])),
        starts_with:()=>obj.startsWith(String(args[0])),
        ends_with:()=>obj.endsWith(String(args[0])),
        index_of:()=>obj.indexOf(String(args[0])),
        repeat:()=>obj.repeat(args[0]),
        char_at:()=>obj[args[0]],
        substr:()=>obj.slice(args[0],args.length>1?args[1]:undefined),
        len:()=>obj.length,reverse:()=>obj.split("").reverse().join(""),
        to_list:()=>new NovaList(obj.split("")),
        pad_left:()=>obj.padStart(args[0],args.length>1?String(args[1]):" "),
        pad_right:()=>obj.padEnd(args[0],args.length>1?String(args[1]):" "),
        count:()=>obj.split(String(args[0])).length-1,
        is_empty:()=>obj.length===0,to_num:()=>Number(obj),
        format:()=>{let s=obj,i=0;return s.replace(/{}/g,()=>novaStr(args[i++]));},
      };
      if(m[method])return m[method]();
      throw new NovaError(`String has no method '${method}'`);
    }
    if(obj instanceof NovaList){
      const m={
        push:()=>{obj.items.push(args[0]);return obj;},
        pop:()=>obj.items.pop(),shift:()=>obj.items.shift(),
        unshift:()=>{obj.items.unshift(args[0]);return obj;},
        insert:()=>{obj.items.splice(args[0],0,args[1]);return obj;},
        remove_at:()=>obj.items.splice(args[0],1)[0],
        reverse:()=>new NovaList([...obj.items].reverse()),
        sort:()=>new NovaList([...obj.items].sort((a,b)=>typeof a==="number"&&typeof b==="number"?a-b:String(a)<String(b)?-1:1)),
        slice:()=>new NovaList(obj.items.slice(args[0],args.length>1?args[1]:undefined)),
        concat:()=>new NovaList([...obj.items,...args[0].items]),
        contains:()=>obj.items.includes(args[0]),
        index_of:()=>obj.items.indexOf(args[0]),
        len:()=>obj.items.length,
        join:()=>obj.items.map(novaStr).join(args.length?String(args[0]):", "),
        map:()=>this.hofMap([args[0],obj]),
        filter:()=>this.hofFilter([args[0],obj]),
        reduce:()=>this.hofReduce([args[0],obj,...(args.length>1?[args[1]]:[])]),
        flat:()=>new NovaList(obj.items.flatMap(x=>x instanceof NovaList?x.items:[x])),
        flatten:()=>new NovaList(obj.items.flatMap(x=>x instanceof NovaList?x.items:[x])),
        unique:()=>new NovaList([...new Set(obj.items)]),
        sum:()=>obj.items.reduce((s,x)=>s+x,0),
        all:()=>obj.items.every(Boolean),any:()=>obj.items.some(Boolean),
        first:()=>obj.items[0]??null,last:()=>obj.items[obj.items.length-1]??null,
        count:()=>obj.items.filter(x=>x===args[0]).length,
        is_empty:()=>obj.items.length===0,
        copy:()=>new NovaList([...obj.items]),
        take:()=>new NovaList(obj.items.slice(0,args[0])),
        drop:()=>new NovaList(obj.items.slice(args[0])),
        zip:()=>new NovaList(obj.items.map((x,i)=>new NovaList([x,args[0].items[i]]))),
        enumerate:()=>new NovaList(obj.items.map((v,i)=>new NovaList([i,v]))),
        min:()=>Math.min(...obj.items),max:()=>Math.max(...obj.items),
        to_str:()=>obj.toString(),
      };
      if(m[method])return m[method]();
      throw new NovaError(`List has no method '${method}'`);
    }
    if(obj instanceof NovaDict){
      const m={
        keys:()=>new NovaList([...obj.data.keys()]),
        values:()=>new NovaList([...obj.data.values()]),
        items:()=>new NovaList([...obj.data.entries()].map(([k,v])=>new NovaList([k,v]))),
        has:()=>obj.data.has(args[0]),
        get:()=>obj.data.has(args[0])?obj.data.get(args[0]):(args.length>1?args[1]:null),
        set:()=>{obj.data.set(args[0],args[1]);return obj;},
        delete:()=>{obj.data.delete(args[0]);return obj;},
        merge:()=>new NovaDict([...obj.data.entries(),...args[0].data.entries()]),
        len:()=>obj.data.size,is_empty:()=>obj.data.size===0,
        copy:()=>new NovaDict([...obj.data.entries()]),to_str:()=>obj.toString(),
      };
      if(m[method])return m[method]();
      throw new NovaError(`Dict has no method '${method}'`);
    }
    throw new NovaError(`Type has no method '${method}'`);
  }
  hofMap(args){const[fn,lst]=args;return new NovaList(lst.items.map(item=>this.invoke(fn,[item])));}
  hofFilter(args){const[fn,lst]=args;return new NovaList(lst.items.filter(item=>this.invoke(fn,[item])));}
  hofReduce(args){
    const[fn,lst]=args;if(!lst.items.length)throw new NovaError("reduce on empty list");
    let acc=args.length>2?args[2]:lst.items[0];const start=args.length>2?0:1;
    for(let i=start;i<lst.items.length;i++)acc=this.invoke(fn,[acc,lst.items[i]]);
    return acc;
  }
}

// ══════════════════════════════════════════════════════════════
//  SYNTAX HIGHLIGHTER
// ══════════════════════════════════════════════════════════════
function highlight(code){
  return code.split('\n').map(line=>{
    let safe=line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const ci=safe.indexOf('#');
    if(ci!==-1)return safe.slice(0,ci)+`<span class="hl-comment">${safe.slice(ci)}</span>`;
    safe=safe.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g,m=>`<span class="hl-string">${m}</span>`);
    safe=safe.replace(/\b(let|fn|if|else|while|for|in|return|print|range|and|or|not|true|false|null|break|continue|try|catch|finally|assert)\b/g,m=>`<span class="hl-kw">${m}</span>`);
    safe=safe.replace(/\b(\d+\.?\d*)\b/g,m=>`<span class="hl-num">${m}</span>`);
    safe=safe.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g,m=>`<span class="hl-fn">${m}</span>`);
    return safe;
  }).join('\n');
}

// ══════════════════════════════════════════════════════════════
//  EXAMPLES
// ══════════════════════════════════════════════════════════════
const EXAMPLES={
  "Hello World":`# My first NOVA program
let name = "World"
print("Hello, " + name + "!")
print("1 + 1 = " + str(1 + 1))
print("PI = " + str(PI))`,

  "Lists":`# Lists — creation, methods, slicing
let nums = [10, 3, 7, 1, 9, 4]
print("original:  " + str(nums))
print("sorted:    " + str(nums.sort()))
print("sum:       " + str(nums.sum()))
print("max / min: " + str(nums.max()) + " / " + str(nums.min()))
nums.push(99)
print("after push:" + str(nums))
print("pop:       " + str(nums.pop()))
print("[1:4]:     " + str(nums[1:4]))
print("last:      " + str(nums[-1]))
print("first:     " + str(nums.first()))
let squares = nums.map(fn(x) { return x * x })
print("squares:   " + str(squares))`,

  "Dicts":`# Dictionaries — key/value store
let person = {
  "name": "Alice",
  "age": 30,
  "city": "Madrid"
}
print("name: " + person["name"])
print("age:  " + str(person["age"]))
person["job"] = "Engineer"
print("keys:    " + str(person.keys()))
print("has job: " + str(person.has("job")))
print("has pet: " + str(person.has("pet")))
for pair in person.items() {
  print(str(pair[0]) + " -> " + str(pair[1]))
}`,

  "Fibonacci":`# Fibonacci with recursion
fn fib(n) {
  if (n <= 1) { return n }
  return fib(n - 1) + fib(n - 2)
}
for i in range(0, 12) {
  print("fib(" + str(i) + ") = " + str(fib(i)))
}`,

  "Map/Filter/Reduce":`# Higher-order functions
let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

let doubled = numbers.map(fn(x) { return x * 2 })
print("doubled: " + str(doubled))

let evens = numbers.filter(fn(x) { return x % 2 == 0 })
print("evens:   " + str(evens))

let total = numbers.reduce(fn(acc, x) { return acc + x }, 0)
print("sum:     " + str(total))

let result = numbers
  .filter(fn(x) { return x % 2 == 0 })
  .map(fn(x) { return x * x })
print("even squares: " + str(result))`,

  "Try/Catch":`# Error handling
fn safe_divide(a, b) {
  try {
    return a / b
  } catch (err) {
    print("Caught: " + err)
    return null
  }
}
print(str(safe_divide(10, 2)))
print(str(safe_divide(10, 0)))
try {
  assert(1 == 2, "Math is broken!")
} catch (e) {
  print("Caught: " + e)
} finally {
  print("Finally always runs")
}`,

  "String Methods":`# String operations
let s = "  Hello, World!  "
print("trim:        '" + s.trim() + "'")
print("upper:       " + s.trim().upper())
print("replace:     " + s.trim().replace("World", "NOVA"))
print("contains:    " + str(s.contains("World")))
print("starts_with: " + str(s.trim().starts_with("Hello")))
print("ends_with:   " + str(s.trim().ends_with("!")))
print("split CSV:   " + str("one,two,three".split(",")))
print("join back:   " + "one,two,three".split(",").join(" | "))
print("repeat:      " + "ha".repeat(3))
print("reverse:     " + "NOVA".reverse())`,

  "Closures":`# Closures & default arguments
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
print("by10: " + str(by10()))
print("by10: " + str(by10()))

fn compose(f, g) { return fn(x) { return f(g(x)) } }
fn double(x) { return x * 2 }
fn inc(x)    { return x + 1 }
let dbl_then_inc = compose(inc, double)
print("compose(5): " + str(dbl_then_inc(5)))`,

  "Break/Continue":`# Loop control flow
for i in range(0, 100) {
  if (i * i > 50) {
    print("First i where i^2 > 50: " + str(i))
    break
  }
}
let evens = []
for i in range(0, 20) {
  if (i % 2 != 0) { continue }
  evens.push(i)
}
print("Evens 0-19: " + str(evens))

let n = 1024
let steps = 0
while (n > 1) {
  n = n // 2
  steps += 1
}
print("Steps to halve 1024 to 1: " + str(steps))`,
};

// ══════════════════════════════════════════════════════════════
//  PLAYGROUND COMPONENT
// ══════════════════════════════════════════════════════════════
const interp=new Interpreter();

export default function NovaPlayground(){
  const[code,setCode]=useState(EXAMPLES["Fibonacci"]);
  const[output,setOutput]=useState([]);
  const[error,setError]=useState(null);
  const[running,setRunning]=useState(false);
  const[activeExample,setActiveExample]=useState("Fibonacci");
  const[tab,setTab]=useState("output");
  const[tokens,setTokens]=useState([]);
  const[ast,setAst]=useState(null);
  const[justRan,setJustRan]=useState(false);
  const textareaRef=useRef(null);

  const run=useCallback(()=>{
    setRunning(true);setError(null);
    setTimeout(()=>{
      try{
        const toks=new Lexer(code).tokenize();
        setTokens(toks.filter(t=>t.type!==TT.NEWLINE&&t.type!==TT.EOF));
        const tree=new Parser(new Lexer(code).tokenize()).parse();
        setAst(tree);
        const out=interp.run(code);
        setOutput(out);setTab("output");
        setJustRan(true);setTimeout(()=>setJustRan(false),600);
      }catch(e){
        setError(e.message);setOutput([]);setTab("output");
      }
      setRunning(false);
    },20);
  },[code]);

  useEffect(()=>{
    const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();run();}};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[run]);

  const handleTab=e=>{
    if(e.key==="Tab"){
      e.preventDefault();
      const ta=textareaRef.current,s=ta.selectionStart,end=ta.selectionEnd;
      const nc=code.slice(0,s)+"  "+code.slice(end);
      setCode(nc);setTimeout(()=>{ta.selectionStart=ta.selectionEnd=s+2;},0);
    }
  };

  const loadExample=name=>{setActiveExample(name);setCode(EXAMPLES[name]);setOutput([]);setError(null);setTokens([]);setAst(null);};

  const tokenColor=type=>{
    if(["LET","FN","IF","ELSE","WHILE","FOR","IN","RETURN","PRINT","RANGE","BREAK","CONTINUE","TRY","CATCH","FINALLY","ASSERT","AND","OR","NOT"].includes(type))return"#c084fc";
    if(type==="NUMBER")return"#fb923c";
    if(type==="STRING")return"#4ade80";
    if(type==="BOOL"||type==="NULL")return"#60a5fa";
    if(type==="IDENT")return"#e2e8f0";
    return"#475569";
  };

  const S={
    root:{fontFamily:"'JetBrains Mono','Fira Code','Cascadia Code',monospace",background:"#0a0a0f",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column"},
    header:{background:"linear-gradient(135deg,#1a0533 0%,#0d1b3e 50%,#0a0a0f 100%)",borderBottom:"1px solid #1e1b4b",padding:"13px 24px",display:"flex",alignItems:"center",gap:"16px",flexShrink:0},
    logo:{fontSize:"19px",fontWeight:800,background:"linear-gradient(90deg,#a855f7,#3b82f6,#06b6d4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
    tabs:{display:"flex",gap:"5px",padding:"7px 24px",borderBottom:"1px solid #0f172a",flexWrap:"wrap",background:"#050508",flexShrink:0},
    main:{display:"flex",flex:1,overflow:"hidden",minHeight:0},
    editor:{flex:1,display:"flex",flexDirection:"column",borderRight:"1px solid #0f172a",position:"relative",minWidth:0},
    topbar:{padding:"5px 16px",background:"#050508",borderBottom:"1px solid #0f172a",fontSize:"11px",color:"#334155",display:"flex",justifyContent:"space-between"},
    editorWrap:{flex:1,position:"relative",overflow:"hidden"},
    lineNums:{position:"absolute",left:0,top:0,bottom:0,width:"40px",background:"#050508",borderRight:"1px solid #0f172a",padding:"16px 0",fontSize:"12px",lineHeight:"1.7",color:"#1e293b",textAlign:"right",userSelect:"none",overflow:"hidden",pointerEvents:"none",zIndex:2},
    textarea:{position:"absolute",inset:0,paddingLeft:"52px",paddingTop:"16px",paddingRight:"16px",paddingBottom:"16px",background:"transparent",color:"#e2e8f0",fontSize:"13px",lineHeight:"1.7",border:"none",outline:"none",resize:"none",fontFamily:"inherit",width:"100%",height:"100%",boxSizing:"border-box",caretColor:"#a855f7",zIndex:1},
    runbar:{padding:"10px 16px",background:"#050508",borderTop:"1px solid #0f172a",display:"flex",gap:"8px"},
    outPane:{width:"40%",display:"flex",flexDirection:"column",minWidth:0,minHeight:0},
    outTabs:{display:"flex",background:"#050508",borderBottom:"1px solid #0f172a",flexShrink:0},
    outContent:{flex:1,overflow:"auto",padding:"16px",minHeight:0},
    footer:{padding:"6px 24px",background:"#050508",borderTop:"1px solid #0f172a",fontSize:"11px",color:"#1e293b",display:"flex",gap:"24px",flexShrink:0},
  };

  return(
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.logo}>◈ NOVA v2.0</div>
        <div style={{color:"#334155",fontSize:"12px"}}>— Your own programming language</div>
        <div style={{marginLeft:"auto",color:"#1e293b",fontSize:"11px"}}>⌘↵ to run</div>
      </div>

      <div style={S.tabs}>
        {Object.keys(EXAMPLES).map(name=>(
          <button key={name} onClick={()=>loadExample(name)} style={{padding:"3px 11px",borderRadius:"20px",border:activeExample===name?"1px solid #7c3aed":"1px solid #1e293b",background:activeExample===name?"#1e1040":"transparent",color:activeExample===name?"#a855f7":"#475569",fontSize:"12px",cursor:"pointer",transition:"all 0.15s"}}>{name}</button>
        ))}
      </div>

      <div style={S.main}>
        <div style={S.editor}>
          <div style={S.topbar}><span>editor.nova</span><span>{code.split('\n').length} lines</span></div>
          <div style={S.editorWrap}>
            <div style={S.lineNums}>{code.split('\n').map((_,i)=><div key={i} style={{paddingRight:"8px"}}>{i+1}</div>)}</div>
            <textarea ref={textareaRef} value={code} onChange={e=>setCode(e.target.value)} onKeyDown={handleTab} spellCheck={false} style={S.textarea}/>
          </div>
          <div style={S.runbar}>
            <button onClick={run} disabled={running} style={{padding:"7px 24px",background:running?"#1e1040":"linear-gradient(135deg,#7c3aed,#3b82f6)",color:"white",border:"none",borderRadius:"6px",fontSize:"13px",fontFamily:"inherit",cursor:running?"wait":"pointer",fontWeight:700,boxShadow:running?"none":"0 0 20px rgba(124,58,237,0.3)"}}>
              {running?"▶ Running...":"▶ Run"}
            </button>
            <button onClick={()=>{setCode("");setOutput([]);setError(null);setTokens([]);setAst(null);}} style={{padding:"7px 16px",background:"transparent",color:"#475569",border:"1px solid #1e293b",borderRadius:"6px",fontSize:"12px",fontFamily:"inherit",cursor:"pointer"}}>Clear</button>
          </div>
        </div>

        <div style={S.outPane}>
          <div style={S.outTabs}>
            {[["output","Output"],["tokens","Tokens"],["ast","AST"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{padding:"7px 16px",background:"transparent",color:tab===id?"#a855f7":"#475569",border:"none",borderBottom:tab===id?"2px solid #7c3aed":"2px solid transparent",fontSize:"12px",fontFamily:"inherit",cursor:"pointer"}}>{label}</button>
            ))}
          </div>
          <div style={S.outContent}>
            {tab==="output"&&(
              <div>
                {error&&<div style={{padding:"10px 12px",background:"#1c0a0a",border:"1px solid #7f1d1d",borderRadius:"6px",color:"#fca5a5",fontSize:"12px",marginBottom:"12px",whiteSpace:"pre-wrap"}}>⚠ {error}</div>}
                {output.length===0&&!error&&<div style={{color:"#1e293b",fontSize:"12px",textAlign:"center",marginTop:"40px"}}>No output yet — click ▶ Run or press ⌘↵</div>}
                {output.map((line,i)=>(
                  <div key={i} style={{display:"flex",gap:"12px",padding:"3px 0",borderBottom:"1px solid #0a0a12",animation:justRan?"fadeIn 0.3s ease":"none"}}>
                    <span style={{color:"#1e293b",fontSize:"11px",userSelect:"none",minWidth:"20px",textAlign:"right"}}>{i+1}</span>
                    <span style={{color:"#e2e8f0",fontSize:"13px"}}>{line}</span>
                  </div>
                ))}
              </div>
            )}
            {tab==="tokens"&&(
              <div>
                {tokens.length===0
                  ?<div style={{color:"#1e293b",fontSize:"12px",textAlign:"center",marginTop:"40px"}}>Run to see tokens</div>
                  :<div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                    {tokens.map((t,i)=>(
                      <div key={i} style={{padding:"3px 7px",background:"#0d1117",border:`1px solid ${tokenColor(t.type)}33`,borderRadius:"4px",fontSize:"11px",display:"flex",flexDirection:"column",gap:"1px"}}>
                        <span style={{color:tokenColor(t.type),fontWeight:700,fontSize:"10px"}}>{t.type}</span>
                        <span style={{color:"#94a3b8"}}>{t.value!==null?JSON.stringify(t.value):""}</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}
            {tab==="ast"&&(
              <div>
                {!ast?<div style={{color:"#1e293b",fontSize:"12px",textAlign:"center",marginTop:"40px"}}>Run to see AST</div>
                     :<pre style={{fontSize:"11px",color:"#64748b",lineHeight:"1.6",margin:0,whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{JSON.stringify(ast,null,2)}</pre>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={S.footer}>
        <span>NOVA v2.0</span>
        <span>Lexer → Parser → AST → Interpreter</span>
        <span>Lists · Dicts · try/catch · break/continue · map/filter/reduce · 60+ builtins</span>
      </div>
      <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:#050508;}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px;}@keyframes fadeIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}`}</style>
    </div>
  );
}
