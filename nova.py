#!/usr/bin/env python3
"""
NOVA Language Interpreter — v3.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New in v3:
  • f-strings          f"Hello {name}, you are {age} years old!"
  • Ternary operator   x > 0 ? "positive" : "negative"
  • print(a, b, c)     multiple args, optional sep/end
  • throw "message"    raise custom errors
  • List comprehensions [x*2 for x in list if x > 0]
  • Dict comprehensions {k: v*2 for k, v in pairs}
  • match/switch        match x { 1 { ... } 2 { ... } _ { ... } }
  • do-while            do { ... } while(cond)
  • ++ / --             x++  x--  ++x  --x
  • global keyword      access outer scope from fn
  • *args variadic      fn sum(*args) { return args.sum() }
  • Pipe operator |>    [1,2,3] |> sum  or  x |> fn(y){y*2}
  • Multi-assign        let [a, b] = [1, 2]
  • not in / in         x in list   x not in list
  • ^= (xor assign)    x ^= 3
  • Walrus := (assign+return) — in conditions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
import sys, math, random, time, re
from dataclasses import dataclass
from typing import Any, List, Optional, Dict

# ══════════════════════════════════════════════════════════════
#  TOKEN TYPES
# ══════════════════════════════════════════════════════════════
class TT:
    NUMBER="NUMBER"; STRING="STRING"; FSTRING="FSTRING"; BOOL="BOOL"
    NULL="NULL"; IDENT="IDENT"
    PLUS="PLUS"; MINUS="MINUS"; STAR="STAR"; SLASH="SLASH"
    PERCENT="PERCENT"; CARET="CARET"; DSLASH="DSLASH"
    PLUS_PLUS="PLUS_PLUS"; MINUS_MINUS="MINUS_MINUS"
    EQ="EQ"; NEQ="NEQ"; LT="LT"; GT="GT"; LTE="LTE"; GTE="GTE"
    AND="AND"; OR="OR"; NOT="NOT"
    PIPE="PIPE"           # |>
    QUESTION="QUESTION"   # ?  (ternary)
    WALRUS="WALRUS"       # :=
    ASSIGN="ASSIGN"; PLUS_EQ="PLUS_EQ"; MINUS_EQ="MINUS_EQ"
    STAR_EQ="STAR_EQ"; SLASH_EQ="SLASH_EQ"; PERC_EQ="PERC_EQ"
    DSLASH_EQ="DSLASH_EQ"; CARET_EQ="CARET_EQ"
    LPAREN="LPAREN"; RPAREN="RPAREN"; LBRACE="LBRACE"; RBRACE="RBRACE"
    LBRACKET="LBRACKET"; RBRACKET="RBRACKET"
    COMMA="COMMA"; SEMI="SEMI"; DOT="DOT"; COLON="COLON"
    NEWLINE="NEWLINE"; ARROW="ARROW"; ELLIPSIS="ELLIPSIS"
    LET="LET"; FN="FN"; IF="IF"; ELSE="ELSE"; WHILE="WHILE"; FOR="FOR"
    IN="IN"; NOT_IN="NOT_IN"; RETURN="RETURN"; PRINT="PRINT"; RANGE="RANGE"
    BREAK="BREAK"; CONT="CONTINUE"; TRY="TRY"; CATCH="CATCH"; FINALLY="FINALLY"
    ASSERT="ASSERT"; IMPORT="IMPORT"; AS="AS"
    THROW="THROW"; MATCH="MATCH"; DO="DO"; GLOBAL="GLOBAL"
    EOF="EOF"

KEYWORDS = {
    "let":TT.LET,"fn":TT.FN,"if":TT.IF,"else":TT.ELSE,"while":TT.WHILE,
    "for":TT.FOR,"in":TT.IN,"return":TT.RETURN,"print":TT.PRINT,"range":TT.RANGE,
    "break":TT.BREAK,"continue":TT.CONT,"try":TT.TRY,"catch":TT.CATCH,"finally":TT.FINALLY,
    "assert":TT.ASSERT,"import":TT.IMPORT,"as":TT.AS,
    "throw":TT.THROW,"match":TT.MATCH,"do":TT.DO,"global":TT.GLOBAL,
    "true":TT.BOOL,"false":TT.BOOL,"null":TT.NULL,
    "and":TT.AND,"or":TT.OR,"not":TT.NOT,
}

@dataclass
class Token:
    type:str; value:Any; line:int
    def __repr__(self): return f"Token({self.type},{self.value!r},L{self.line})"

# ══════════════════════════════════════════════════════════════
#  LEXER
# ══════════════════════════════════════════════════════════════
class LexerError(Exception):
    def __init__(self,m,l): super().__init__(f"[Line {l}] LexerError: {m}")

class Lexer:
    def __init__(self,src):
        self.src=src; self.pos=0; self.line=1; self.tokens=[]
    def err(self,m): raise LexerError(m,self.line)
    def peek(self,o=0):
        p=self.pos+o; return self.src[p] if p<len(self.src) else "\0"
    def advance(self):
        c=self.src[self.pos]; self.pos+=1
        if c=="\n": self.line+=1
        return c
    def match(self,e):
        if self.pos<len(self.src) and self.src[self.pos]==e:
            self.advance(); return True
        return False
    def add(self,t,v=None): self.tokens.append(Token(t,v,self.line))
    def tokenize(self):
        while self.pos<len(self.src): self.scan()
        self.add(TT.EOF); return self.tokens

    def scan(self):
        ch=self.advance()
        if ch in " \t\r": return
        if ch=="\n":
            if not self.tokens or self.tokens[-1].type!=TT.NEWLINE: self.add(TT.NEWLINE)
            return
        if ch=="#":
            while self.pos<len(self.src) and self.src[self.pos]!="\n": self.pos+=1
            return
        # f-string
        if ch=="f" and self.pos<len(self.src) and self.src[self.pos] in('"',"'"):
            q=self.advance(); self.read_fstring(q); return
        if ch in('"',"'"): self.read_string(ch); return
        if ch.isdigit() or (ch=="." and self.peek().isdigit()): self.read_number(ch); return
        if ch.isalpha() or ch=="_": self.read_ident(ch); return

        # |> pipe
        if ch=="|":
            if self.match(">"): self.add(TT.PIPE); return
            self.err("Unexpected '|' — did you mean '|>'?")
        # := walrus
        if ch==":" and self.peek()=="=": self.advance(); self.add(TT.WALRUS); return
        # ?  ternary
        if ch=="?": self.add(TT.QUESTION); return
        # .. or ... (ellipsis/spread)
        if ch=="." and self.peek()=="." and self.peek(1)==".":
            self.advance(); self.advance(); self.add(TT.ELLIPSIS); return

        if ch=="=": self.add(TT.EQ if self.match("=") else TT.ASSIGN); return
        if ch=="!":
            if self.match("="): self.add(TT.NEQ)
            else: self.err("Unexpected '!'")
            return
        if ch=="<": self.add(TT.LTE if self.match("=") else TT.LT); return
        if ch==">": self.add(TT.GTE if self.match("=") else TT.GT); return
        if ch=="-":
            if self.match(">"): self.add(TT.ARROW)
            elif self.match("-"): self.add(TT.MINUS_MINUS)
            elif self.match("="): self.add(TT.MINUS_EQ)
            else: self.add(TT.MINUS)
            return
        if ch=="+":
            if self.match("+"): self.add(TT.PLUS_PLUS)
            elif self.match("="): self.add(TT.PLUS_EQ)
            else: self.add(TT.PLUS)
            return
        if ch=="*":
            if self.match("*"): self.add(TT.CARET)    # ** as power alias
            elif self.match("="): self.add(TT.STAR_EQ)
            else: self.add(TT.STAR)
            return
        if ch=="/":
            if self.match("/"):
                self.add(TT.DSLASH_EQ if self.match("=") else TT.DSLASH)
            elif self.match("="): self.add(TT.SLASH_EQ)
            else: self.add(TT.SLASH)
            return
        if ch=="%": self.add(TT.PERC_EQ if self.match("=") else TT.PERCENT); return
        if ch=="^": self.add(TT.CARET_EQ if self.match("=") else TT.CARET); return
        singles={"(":TT.LPAREN,")":TT.RPAREN,"{":TT.LBRACE,"}":TT.RBRACE,
                 "[":TT.LBRACKET,"]":TT.RBRACKET,",":TT.COMMA,";":TT.SEMI,
                 ".":TT.DOT,":":TT.COLON}
        if ch in singles: self.add(singles[ch]); return
        self.err(f"Unexpected character '{ch}'")

    def read_string(self,quote):
        s=""
        while self.pos<len(self.src) and self.src[self.pos]!=quote:
            if self.src[self.pos]=="\\":
                self.pos+=1
                esc={"n":"\n","t":"\t","r":"\r","\\":"\\",'"':'"',"'":"'","0":"\0"}
                s+=esc.get(self.src[self.pos],self.src[self.pos]); self.pos+=1
            else:
                s+=self.src[self.pos]; self.pos+=1
        if self.pos>=len(self.src): self.err("Unterminated string")
        self.pos+=1; self.add(TT.STRING,s)

    def read_fstring(self,quote):
        """f"Hello {expr}!" — stored as list of (is_expr, text_or_src) parts"""
        parts=[]; buf=""
        while self.pos<len(self.src) and self.src[self.pos]!=quote:
            c=self.src[self.pos]
            if c=="{":
                self.pos+=1
                if self.src[self.pos]=="{": buf+="{"; self.pos+=1; continue
                if buf: parts.append((False,buf)); buf=""
                expr_src=""
                depth=1
                while self.pos<len(self.src) and depth>0:
                    ec=self.src[self.pos]; self.pos+=1
                    if ec=="{": depth+=1
                    elif ec=="}": depth-=1
                    if depth>0: expr_src+=ec
                parts.append((True,expr_src))
            elif c=="}":
                self.pos+=1
                if self.pos<len(self.src) and self.src[self.pos]=="}": buf+="}"; self.pos+=1
                else: buf+="}"
            elif c=="\\":
                self.pos+=1
                esc={"n":"\n","t":"\t","r":"\r","\\":"\\"}
                buf+=esc.get(self.src[self.pos],self.src[self.pos]); self.pos+=1
            else:
                buf+=c; self.pos+=1
        if self.pos>=len(self.src): self.err("Unterminated f-string")
        self.pos+=1  # closing quote
        if buf: parts.append((False,buf))
        self.add(TT.FSTRING,parts)

    def read_number(self,first):
        n=first
        while self.peek().isdigit(): n+=self.advance()
        if self.peek()=="." and self.peek(1).isdigit():
            n+=self.advance()
            while self.peek().isdigit(): n+=self.advance()
        # 0x hex
        if first=="0" and self.peek() in "xX":
            n+=self.advance()
            while self.peek() in "0123456789abcdefABCDEF": n+=self.advance()
            self.add(TT.NUMBER,int(n,16)); return
        self.add(TT.NUMBER,float(n) if "." in n else int(n))

    def read_ident(self,first):
        w=first
        while self.peek().isalnum() or self.peek()=="_": w+=self.advance()
        # "not in" two-word token
        if w=="not" and self.pos<len(self.src):
            saved=self.pos
            while self.pos<len(self.src) and self.src[self.pos]==" ": self.pos+=1
            if self.src[self.pos:self.pos+2]=="in":
                self.pos+=2; self.add(TT.NOT_IN,"not in"); return
            self.pos=saved
        tt=KEYWORDS.get(w,TT.IDENT)
        if w=="true": self.add(TT.BOOL,True)
        elif w=="false": self.add(TT.BOOL,False)
        elif w=="null": self.add(TT.NULL,None)
        else: self.add(tt,w)

# ══════════════════════════════════════════════════════════════
#  AST NODES
# ══════════════════════════════════════════════════════════════
@dataclass
class Node: pass
@dataclass
class NumberLit(Node): value:Any
@dataclass
class StringLit(Node): value:str
@dataclass
class FStringLit(Node): parts:List   # [(is_expr, text_or_node)]
@dataclass
class BoolLit(Node): value:bool
@dataclass
class NullLit(Node): pass
@dataclass
class ListLit(Node): items:List
@dataclass
class DictLit(Node): pairs:List
@dataclass
class Identifier(Node): name:str
@dataclass
class Let(Node): targets:List; value:Node   # targets: str or [str,...]
@dataclass
class Assign(Node): target:Node; value:Node
@dataclass
class CompoundAssign(Node): target:Node; op:str; value:Node
@dataclass
class Incr(Node): target:Node; op:str; prefix:bool   # ++ --
@dataclass
class Index(Node): obj:Node; idx:Node
@dataclass
class Attr(Node): obj:Node; name:str
@dataclass
class Slice(Node): obj:Node; start:Optional[Node]; stop:Optional[Node]; step:Optional[Node]
@dataclass
class BinOp(Node): left:Node; op:str; right:Node
@dataclass
class UnaryOp(Node): op:str; operand:Node
@dataclass
class Ternary(Node): cond:Node; then:Node; els:Node
@dataclass
class Pipe(Node): left:Node; right:Node
@dataclass
class Membership(Node): item:Node; container:Node; negated:bool
@dataclass
class Walrus(Node): name:str; value:Node
@dataclass
class Print(Node): exprs:List; sep:Optional[Node]; end:Optional[Node]
@dataclass
class Block(Node): stmts:List
@dataclass
class If(Node): condition:Node; then_block:Node; else_block:Optional[Node]
@dataclass
class While(Node): condition:Node; body:Node
@dataclass
class DoWhile(Node): body:Node; condition:Node
@dataclass
class For(Node): var:str; iterable:Node; body:Node
@dataclass
class ListComp(Node): expr:Node; var:str; iterable:Node; condition:Optional[Node]
@dataclass
class DictComp(Node): kexpr:Node; vexpr:Node; var:str; iterable:Node; condition:Optional[Node]
@dataclass
class Break(Node): pass
@dataclass
class Continue(Node): pass
@dataclass
class Return(Node): value:Node
@dataclass
class Throw(Node): value:Node
@dataclass
class Assert(Node): expr:Node; msg:Optional[Node]
@dataclass
class TryCatch(Node): body:Node; var:Optional[str]; catch:Optional[Node]; finally_:Optional[Node]
@dataclass
class Match(Node): subject:Node; arms:List   # [(pattern, block)]  pattern=None → default
@dataclass
class FnDef(Node): name:str; params:List; defaults:List; variadic:bool; body:Node
@dataclass
class FnCall(Node): callee:Node; args:List
@dataclass
class Spread(Node): expr:Node
@dataclass
class NamedArg(Node): name:str; value:Node
@dataclass
class Range(Node): start:Node; stop:Node; step:Optional[Node]
@dataclass
class Import(Node): module:str; alias:Optional[str]
@dataclass
class Global(Node): names:List
@dataclass
class Program(Node): stmts:List

# ══════════════════════════════════════════════════════════════
#  PARSER
# ══════════════════════════════════════════════════════════════
class ParseError(Exception):
    def __init__(self,m,l): super().__init__(f"[Line {l}] ParseError: {m}")

class Parser:
    def __init__(self,tokens):
        self.tokens=[t for t in tokens if t.type!=TT.NEWLINE]; self.pos=0
    def err(self,m): raise ParseError(m,self.current().line)
    def current(self): return self.tokens[self.pos]
    def peek(self,o=1):
        p=self.pos+o; return self.tokens[p] if p<len(self.tokens) else self.tokens[-1]
    def check(self,*ts): return self.current().type in ts
    def advance(self):
        t=self.tokens[self.pos]
        if t.type!=TT.EOF: self.pos+=1
        return t
    def expect(self,tt):
        if not self.check(tt):
            self.err(f"Expected {tt}, got {self.current().type!r} ({self.current().value!r})")
        return self.advance()
    def match(self,*ts):
        if self.check(*ts): return self.advance()
        return None

    def parse(self):
        stmts=[]
        while not self.check(TT.EOF): stmts.append(self.statement())
        return Program(stmts)

    # ── Statements ─────────────────────────────────────────────
    def statement(self):
        if self.check(TT.LET):    return self.let_stmt()
        if self.check(TT.PRINT):  return self.print_stmt()
        if self.check(TT.IF):     return self.if_stmt()
        if self.check(TT.WHILE):  return self.while_stmt()
        if self.check(TT.DO):     return self.do_while_stmt()
        if self.check(TT.FOR):    return self.for_stmt()
        if self.check(TT.FN):     return self.fn_def()
        if self.check(TT.RETURN): return self.return_stmt()
        if self.check(TT.THROW):  return self.throw_stmt()
        if self.check(TT.BREAK):  self.advance(); self.match(TT.SEMI); return Break()
        if self.check(TT.CONT):   self.advance(); self.match(TT.SEMI); return Continue()
        if self.check(TT.TRY):    return self.try_stmt()
        if self.check(TT.ASSERT): return self.assert_stmt()
        if self.check(TT.IMPORT): return self.import_stmt()
        if self.check(TT.MATCH):  return self.match_stmt()
        if self.check(TT.GLOBAL): return self.global_stmt()
        return self.expr_or_assign()

    def let_stmt(self):
        self.expect(TT.LET)
        # Multi-assign: let [a, b] = expr
        if self.check(TT.LBRACKET):
            self.advance(); names=[]
            names.append(self.expect(TT.IDENT).value)
            while self.match(TT.COMMA): names.append(self.expect(TT.IDENT).value)
            self.expect(TT.RBRACKET)
            self.expect(TT.ASSIGN); value=self.expression()
            self.match(TT.SEMI); return Let(names, value)
        name=self.expect(TT.IDENT).value
        self.expect(TT.ASSIGN); value=self.expression()
        self.match(TT.SEMI); return Let([name], value)

    def expr_or_assign(self):
        # Handle prefix ++ --
        if self.check(TT.PLUS_PLUS,TT.MINUS_MINUS):
            op=self.advance().type; target=self.postfix_expr(self.primary())
            self.match(TT.SEMI); return Incr(target, op, True)
        expr=self.expression()
        # Postfix ++ --
        if self.check(TT.PLUS_PLUS,TT.MINUS_MINUS):
            op=self.advance().type; self.match(TT.SEMI); return Incr(expr, op, False)
        COMPOUND={TT.PLUS_EQ:"+",TT.MINUS_EQ:"-",TT.STAR_EQ:"*",TT.SLASH_EQ:"/",
                  TT.PERC_EQ:"%",TT.DSLASH_EQ:"//",TT.CARET_EQ:"^"}
        if self.current().type in COMPOUND:
            op=COMPOUND[self.advance().type]; val=self.expression()
            self.match(TT.SEMI); return CompoundAssign(expr,op,val)
        if self.check(TT.ASSIGN):
            self.advance(); val=self.expression(); self.match(TT.SEMI)
            return Assign(expr,val)
        self.match(TT.SEMI); return expr

    def print_stmt(self):
        self.expect(TT.PRINT); self.expect(TT.LPAREN)
        exprs=[]; sep=None; end=None
        if not self.check(TT.RPAREN):
            # Check for named args sep= end=
            exprs.append(self.expression())
            while self.match(TT.COMMA):
                if self.check(TT.IDENT) and self.peek().type==TT.ASSIGN:
                    kw=self.advance().value; self.advance()
                    val=self.expression()
                    if kw=="sep": sep=val
                    elif kw=="end": end=val
                else:
                    exprs.append(self.expression())
        self.expect(TT.RPAREN); self.match(TT.SEMI)
        return Print(exprs, sep, end)

    def if_stmt(self):
        self.expect(TT.IF); self.expect(TT.LPAREN)
        cond=self.expression(); self.expect(TT.RPAREN)
        then=self.block(); els=None
        if self.match(TT.ELSE):
            els=self.if_stmt() if self.check(TT.IF) else self.block()
        return If(cond,then,els)

    def while_stmt(self):
        self.expect(TT.WHILE); self.expect(TT.LPAREN)
        cond=self.expression(); self.expect(TT.RPAREN)
        return While(cond, self.block())

    def do_while_stmt(self):
        self.expect(TT.DO); body=self.block()
        self.expect(TT.WHILE); self.expect(TT.LPAREN)
        cond=self.expression(); self.expect(TT.RPAREN)
        self.match(TT.SEMI); return DoWhile(body, cond)

    def for_stmt(self):
        self.expect(TT.FOR); var=self.expect(TT.IDENT).value
        self.expect(TT.IN); it=self.expression()
        return For(var, it, self.block())

    def fn_def(self):
        self.expect(TT.FN); name=self.expect(TT.IDENT).value
        self.expect(TT.LPAREN)
        params=[]; defaults=[]; variadic=False
        if not self.check(TT.RPAREN):
            if self.match(TT.STAR):         # *args
                params.append(self.expect(TT.IDENT).value)
                defaults.append(None); variadic=True
            else:
                params.append(self.expect(TT.IDENT).value)
                defaults.append(self.expression() if self.match(TT.ASSIGN) else None)
                while self.match(TT.COMMA) and not self.check(TT.RPAREN):
                    if self.match(TT.STAR):
                        params.append(self.expect(TT.IDENT).value)
                        defaults.append(None); variadic=True; break
                    params.append(self.expect(TT.IDENT).value)
                    defaults.append(self.expression() if self.match(TT.ASSIGN) else None)
        self.expect(TT.RPAREN)
        return FnDef(name, params, defaults, variadic, self.block())

    def return_stmt(self):
        self.expect(TT.RETURN); val=self.expression(); self.match(TT.SEMI); return Return(val)

    def throw_stmt(self):
        self.expect(TT.THROW); val=self.expression(); self.match(TT.SEMI); return Throw(val)

    def try_stmt(self):
        self.expect(TT.TRY); body=self.block()
        var=None; catch_b=None; fin=None
        if self.match(TT.CATCH):
            self.expect(TT.LPAREN); var=self.expect(TT.IDENT).value
            self.expect(TT.RPAREN); catch_b=self.block()
        if self.check(TT.FINALLY):
            self.advance(); fin=self.block()
        return TryCatch(body,var,catch_b,fin)

    def assert_stmt(self):
        self.expect(TT.ASSERT); self.expect(TT.LPAREN)
        expr=self.expression()
        msg=self.expression() if self.match(TT.COMMA) else None
        self.expect(TT.RPAREN); self.match(TT.SEMI); return Assert(expr,msg)

    def import_stmt(self):
        self.expect(TT.IMPORT); mod=self.expect(TT.IDENT).value
        alias=self.expect(TT.IDENT).value if self.match(TT.AS) else None
        self.match(TT.SEMI); return Import(mod,alias)

    def match_stmt(self):
        self.expect(TT.MATCH); subject=self.expression()
        self.expect(TT.LBRACE); arms=[]
        while not self.check(TT.RBRACE) and not self.check(TT.EOF):
            # _ { ... }  or  expr { ... }  or  expr, expr { ... }
            if self.check(TT.IDENT) and self.current().value=="_":
                self.advance(); pattern=None
            else:
                patterns=[self.expression()]
                while self.match(TT.COMMA): patterns.append(self.expression())
                pattern=patterns[0] if len(patterns)==1 else patterns
            body=self.block()
            arms.append((pattern,body))
        self.expect(TT.RBRACE); return Match(subject, arms)

    def global_stmt(self):
        self.expect(TT.GLOBAL)
        names=[self.expect(TT.IDENT).value]
        while self.match(TT.COMMA): names.append(self.expect(TT.IDENT).value)
        self.match(TT.SEMI); return Global(names)

    def block(self):
        self.expect(TT.LBRACE); stmts=[]
        while not self.check(TT.RBRACE) and not self.check(TT.EOF):
            stmts.append(self.statement())
        self.expect(TT.RBRACE); return Block(stmts)

    # ── Expressions ─────────────────────────────────────────────
    def expression(self): return self.pipe_expr()

    def pipe_expr(self):
        left=self.ternary()
        while self.check(TT.PIPE):
            self.advance(); right=self.ternary()
            left=Pipe(left,right)
        return left

    def ternary(self):
        cond=self.or_expr()
        if self.check(TT.QUESTION):
            self.advance(); then=self.expression()
            self.expect(TT.COLON); els=self.expression()
            return Ternary(cond,then,els)
        return cond

    def or_expr(self):
        l=self.and_expr()
        while self.check(TT.OR): self.advance(); r=self.and_expr(); l=BinOp(l,"or",r)
        return l
    def and_expr(self):
        l=self.not_expr()
        while self.check(TT.AND): self.advance(); r=self.not_expr(); l=BinOp(l,"and",r)
        return l
    def not_expr(self):
        if self.check(TT.NOT): self.advance(); return UnaryOp("not",self.not_expr())
        return self.membership()
    def membership(self):
        l=self.eq_expr()
        if self.check(TT.IN):
            self.advance(); r=self.eq_expr(); return Membership(l,r,False)
        if self.check(TT.NOT_IN):
            self.advance(); r=self.eq_expr(); return Membership(l,r,True)
        return l
    def eq_expr(self):
        l=self.cmp_expr()
        while self.check(TT.EQ,TT.NEQ):
            op=self.advance().type; r=self.cmp_expr(); l=BinOp(l,op,r)
        return l
    def cmp_expr(self):
        l=self.add_expr()
        while self.check(TT.LT,TT.GT,TT.LTE,TT.GTE):
            op=self.advance().type; r=self.add_expr(); l=BinOp(l,op,r)
        return l
    def add_expr(self):
        l=self.mul_expr()
        while self.check(TT.PLUS,TT.MINUS):
            op="+" if self.advance().type==TT.PLUS else "-"
            r=self.mul_expr(); l=BinOp(l,op,r)
        return l
    def mul_expr(self):
        l=self.pow_expr()
        while self.check(TT.STAR,TT.SLASH,TT.PERCENT,TT.DSLASH):
            tt=self.advance().type
            op={"STAR":"*","SLASH":"/","PERCENT":"%","DSLASH":"//"}[tt]
            r=self.pow_expr(); l=BinOp(l,op,r)
        return l
    def pow_expr(self):
        l=self.unary()
        if self.check(TT.CARET): self.advance(); return BinOp(l,"^",self.pow_expr())
        return l
    def unary(self):
        if self.check(TT.MINUS): self.advance(); return UnaryOp("-",self.unary())
        if self.check(TT.PLUS_PLUS,TT.MINUS_MINUS):
            op=self.advance().type; target=self.postfix_expr(self.primary())
            return Incr(target,op,True)
        return self.postfix()

    def postfix(self):
        node=self.primary()
        return self.postfix_expr(node)

    def postfix_expr(self,node):
        while True:
            if self.check(TT.LBRACKET):
                self.advance()
                if self.check(TT.COLON):
                    self.advance()
                    stop=None
                    if self.check(TT.COLON):   # [::step]
                        pass
                    elif not self.check(TT.RBRACKET):
                        stop=self.expression()
                    step=None
                    if self.match(TT.COLON):
                        step=None if self.check(TT.RBRACKET) else self.expression()
                    self.expect(TT.RBRACKET); node=Slice(node,None,stop,step)
                else:
                    idx=self.expression()
                    if self.match(TT.COLON):
                        stop=None
                        if self.check(TT.COLON):  # [s::step]
                            pass
                        elif not self.check(TT.RBRACKET):
                            stop=self.expression()
                        step=None
                        if self.match(TT.COLON):
                            step=None if self.check(TT.RBRACKET) else self.expression()
                        self.expect(TT.RBRACKET); node=Slice(node,idx,stop,step)
                    else:
                        self.expect(TT.RBRACKET); node=Index(node,idx)
            elif self.check(TT.DOT):
                self.advance(); name=self.expect(TT.IDENT).value
                if self.check(TT.LPAREN):
                    self.advance(); args=self.arg_list(); self.expect(TT.RPAREN)
                    node=FnCall(Attr(node,name),args)
                else: node=Attr(node,name)
            elif self.check(TT.LPAREN):
                self.advance(); args=self.arg_list(); self.expect(TT.RPAREN)
                node=FnCall(node,args)
            else: break
        return node

    def arg_list(self):
        args=[]
        if not self.check(TT.RPAREN):
            args.append(self._one_arg())
            while self.match(TT.COMMA):
                if self.check(TT.RPAREN): break
                args.append(self._one_arg())
        return args

    def _one_arg(self):
        if self.match(TT.STAR): return Spread(self.expression())
        if self.match(TT.ELLIPSIS): return Spread(self.expression())
        if self.check(TT.IDENT) and self.peek().type==TT.ASSIGN:
            name=self.advance().value; self.advance()
            return NamedArg(name, self.expression())
        return self.expression()

    def primary(self):
        tok=self.current()
        if tok.type==TT.NUMBER:  self.advance(); return NumberLit(tok.value)
        if tok.type==TT.STRING:  self.advance(); return StringLit(tok.value)
        if tok.type==TT.FSTRING:
            self.advance()
            # Parse each expression part
            parts=[]
            for is_expr,content in tok.value:
                if is_expr:
                    sub_tokens=Lexer(content).tokenize()
                    node=Parser(sub_tokens).expression()
                    parts.append((True,node))
                else:
                    parts.append((False,content))
            return FStringLit(parts)
        if tok.type==TT.BOOL:    self.advance(); return BoolLit(tok.value)
        if tok.type==TT.NULL:    self.advance(); return NullLit()
        if tok.type==TT.IDENT:
            # Walrus := inside expressions
            if self.peek().type==TT.WALRUS:
                name=self.advance().value; self.advance()
                return Walrus(name,self.expression())
            self.advance(); return Identifier(tok.value)
        if tok.type==TT.LBRACKET:
            self.advance()
            if self.check(TT.RBRACKET): self.advance(); return ListLit([])
            if self.match(TT.ELLIPSIS):
                first=Spread(self.expression())
            else:
                first=self.expression()
            # List comprehension?
            if self.check(TT.FOR):
                self.advance(); var=self.expect(TT.IDENT).value
                self.expect(TT.IN); iterable=self.expression()
                cond=self.expression() if self.match(TT.IF) else None
                self.expect(TT.RBRACKET); return ListComp(first,var,iterable,cond)
            items=[first]
            while self.match(TT.COMMA):
                if self.check(TT.RBRACKET): break
                if self.match(TT.ELLIPSIS): items.append(Spread(self.expression()))
                else: items.append(self.expression())
            self.expect(TT.RBRACKET); return ListLit(items)
        if tok.type==TT.LBRACE:
            self.advance()
            if self.check(TT.RBRACE): self.advance(); return DictLit([])
            k=self.expression(); self.expect(TT.COLON); v=self.expression()
            # Dict comprehension?
            if self.check(TT.FOR):
                self.advance(); var=self.expect(TT.IDENT).value
                self.expect(TT.IN); iterable=self.expression()
                cond=self.expression() if self.match(TT.IF) else None
                self.expect(TT.RBRACE); return DictComp(k,v,var,iterable,cond)
            pairs=[(k,v)]
            while self.match(TT.COMMA):
                if self.check(TT.RBRACE): break
                k2=self.expression(); self.expect(TT.COLON); v2=self.expression()
                pairs.append((k2,v2))
            self.expect(TT.RBRACE); return DictLit(pairs)
        if tok.type==TT.LPAREN:
            self.advance(); e=self.expression(); self.expect(TT.RPAREN); return e
        if tok.type==TT.RANGE:
            self.advance(); self.expect(TT.LPAREN)
            s=self.expression(); self.expect(TT.COMMA); e=self.expression()
            step=self.expression() if self.match(TT.COMMA) else None
            self.expect(TT.RPAREN); return Range(s,e,step)
        if tok.type==TT.FN:
            self.advance(); self.expect(TT.LPAREN)
            params=[]; defaults=[]; variadic=False
            if not self.check(TT.RPAREN):
                if self.match(TT.STAR):
                    params.append(self.expect(TT.IDENT).value); defaults.append(None); variadic=True
                else:
                    params.append(self.expect(TT.IDENT).value)
                    defaults.append(self.expression() if self.match(TT.ASSIGN) else None)
                    while self.match(TT.COMMA) and not self.check(TT.RPAREN):
                        if self.match(TT.STAR):
                            params.append(self.expect(TT.IDENT).value); defaults.append(None); variadic=True; break
                        params.append(self.expect(TT.IDENT).value)
                        defaults.append(self.expression() if self.match(TT.ASSIGN) else None)
            self.expect(TT.RPAREN); body=self.block()
            return FnDef("__lambda__",params,defaults,variadic,body)
        self.err(f"Unexpected token '{tok.value}' ({tok.type})")

# ══════════════════════════════════════════════════════════════
#  RUNTIME
# ══════════════════════════════════════════════════════════════
class NovaList:
    def __init__(self,items=None): self.items=list(items) if items is not None else []
    def __repr__(self): return "["+", ".join(_str(i) for i in self.items)+"]"
    def __iter__(self): return iter(self.items)
    def __len__(self): return len(self.items)

class NovaDict:
    def __init__(self,pairs=None): self.data=dict(pairs) if pairs else {}
    def __repr__(self):
        return "{"+", ".join(f"{_str(k)}: {_str(v)}" for k,v in self.data.items())+"}"
    def __iter__(self): return iter(self.data)

class NovaFunction:
    def __init__(self,node,closure): self.node=node; self.closure=closure
    def __repr__(self): return f"<fn {self.node.name}>"

class NovaModule:
    def __init__(self,name,attrs): self.name=name; self.attrs=attrs
    def __repr__(self): return f"<module {self.name}>"

def _str(v):
    if v is None: return "null"
    if v is True: return "true"
    if v is False: return "false"
    if isinstance(v,float) and v.is_integer(): return str(int(v))
    if isinstance(v,(NovaList,NovaDict,NovaFunction,NovaModule)): return repr(v)
    return str(v)

class ReturnSig(Exception):
    def __init__(self,v): self.v=v
class BreakSig(Exception): pass
class ContinueSig(Exception): pass
class NovaError(Exception): pass
class ThrowSignal(Exception):
    def __init__(self,val): self.val=val; super().__init__(_str(val))

# ══════════════════════════════════════════════════════════════
#  ENVIRONMENT
# ══════════════════════════════════════════════════════════════
class Environment:
    def __init__(self,parent=None): self.vars={}; self.parent=parent; self.globals=set()
    def get(self,name):
        if name in self.vars: return self.vars[name]
        if self.parent: return self.parent.get(name)
        raise NovaError(f"Undefined variable '{name}'")
    def set(self,name,value): self.vars[name]=value
    def assign(self,name,value):
        if name in self.globals and self.parent:
            self.parent.assign(name,value); return
        if name in self.vars: self.vars[name]=value
        elif self.parent: self.parent.assign(name,value)
        else: raise NovaError(f"Undefined variable '{name}'")
    def declare_global(self,name): self.globals.add(name)

# ══════════════════════════════════════════════════════════════
#  BUILT-INS
# ══════════════════════════════════════════════════════════════
def _nova_input(args):
    try: return input(_str(args[0]) if args else "")
    except EOFError: return ""

CONSTANTS={"PI":math.pi,"E":math.e,"INF":math.inf,"NAN":math.nan,"TAU":math.tau}

BUILTINS={
    # Math
    "sqrt":    lambda a: math.sqrt(a[0]),
    "abs":     lambda a: abs(a[0]),
    "floor":   lambda a: math.floor(a[0]),
    "ceil":    lambda a: math.ceil(a[0]),
    "round":   lambda a: round(a[0],int(a[1]) if len(a)>1 else 0),
    "pow":     lambda a: math.pow(a[0],a[1]),
    "log":     lambda a: math.log(a[0]) if len(a)==1 else math.log(a[0],a[1]),
    "log2":    lambda a: math.log2(a[0]),
    "log10":   lambda a: math.log10(a[0]),
    "sin":     lambda a: math.sin(a[0]),
    "cos":     lambda a: math.cos(a[0]),
    "tan":     lambda a: math.tan(a[0]),
    "asin":    lambda a: math.asin(a[0]),
    "acos":    lambda a: math.acos(a[0]),
    "atan":    lambda a: math.atan(a[0]),
    "atan2":   lambda a: math.atan2(a[0],a[1]),
    "int_div": lambda a: int(a[0]//a[1]),
    "gcd":     lambda a: math.gcd(int(a[0]),int(a[1])),
    "lcm":     lambda a: int(abs(a[0]*a[1])//math.gcd(int(a[0]),int(a[1]))) if a[0] and a[1] else 0,
    "clamp":   lambda a: max(a[1],min(a[2],a[0])),
    "lerp":    lambda a: a[0]+(a[1]-a[0])*a[2],
    "max":     lambda a: max(a[0].items if isinstance(a[0],NovaList) else a),
    "min":     lambda a: min(a[0].items if isinstance(a[0],NovaList) else a),
    "sum":     lambda a: sum(a[0].items if isinstance(a[0],NovaList) else a),
    "product": lambda a: math.prod(a[0].items if isinstance(a[0],NovaList) else a),
    # Random
    "random":    lambda a: random.random(),
    "rand_int":  lambda a: random.randint(int(a[0]),int(a[1])),
    "rand_float":lambda a: random.uniform(a[0],a[1]),
    "choice":    lambda a: random.choice(a[0].items),
    "shuffle":   lambda a: (random.shuffle(a[0].items),a[0])[1],
    "seed":      lambda a: random.seed(int(a[0])),
    # Type conversion
    "str":  lambda a: _str(a[0]),
    "num":  lambda a: float(a[0]) if "." in str(a[0]) else int(str(a[0])),
    "int":  lambda a: int(float(a[0])),
    "bool": lambda a: bool(a[0]),
    "type": lambda a: {type(None):"null",bool:"bool",int:"number",float:"number",str:"string",
                       NovaList:"list",NovaDict:"dict",NovaFunction:"function"}.get(type(a[0]),"unknown"),
    "is_num":  lambda a: isinstance(a[0],(int,float)) and not isinstance(a[0],bool),
    "is_str":  lambda a: isinstance(a[0],str),
    "is_bool": lambda a: isinstance(a[0],bool),
    "is_list": lambda a: isinstance(a[0],NovaList),
    "is_dict": lambda a: isinstance(a[0],NovaDict),
    "is_null": lambda a: a[0] is None,
    "is_fn":   lambda a: isinstance(a[0],NovaFunction),
    # String
    "len":      lambda a: len(a[0].items) if isinstance(a[0],NovaList) else (len(a[0].data) if isinstance(a[0],NovaDict) else len(str(a[0]))),
    "upper":    lambda a: str(a[0]).upper(),
    "lower":    lambda a: str(a[0]).lower(),
    "trim":     lambda a: str(a[0]).strip(),
    "split":    lambda a: NovaList(str(a[0]).split(str(a[1]) if len(a)>1 else None)),
    "join":     lambda a: str(a[1]).join(_str(i) for i in a[0].items),
    "replace":  lambda a: str(a[0]).replace(str(a[1]),str(a[2])),
    "contains": lambda a: (str(a[1]) in str(a[0])) if isinstance(a[0],str) else (a[1] in a[0].items),
    "starts_with":lambda a: str(a[0]).startswith(str(a[1])),
    "ends_with":  lambda a: str(a[0]).endswith(str(a[1])),
    "index_of":lambda a: str(a[0]).find(str(a[1])) if isinstance(a[0],str) else (a[0].items.index(a[1]) if a[1] in a[0].items else -1),
    "repeat":  lambda a: str(a[0])*int(a[1]),
    "char_at": lambda a: str(a[0])[int(a[1])],
    "char_code":lambda a: ord(str(a[0])[0]),
    "from_code":lambda a: chr(int(a[0])),
    "substr":  lambda a: str(a[0])[int(a[1]):int(a[2]) if len(a)>2 else None],
    "pad_left":lambda a: str(a[0]).rjust(int(a[1]),str(a[2]) if len(a)>2 else " "),
    "pad_right":lambda a: str(a[0]).ljust(int(a[1]),str(a[2]) if len(a)>2 else " "),
    # List
    "list":     lambda a: NovaList(a),
    "push":     lambda a: (a[0].items.append(a[1]),a[0])[1],
    "pop":      lambda a: a[0].items.pop(),
    "shift":    lambda a: a[0].items.pop(0),
    "unshift":  lambda a: (a[0].items.insert(0,a[1]),a[0])[1],
    "insert":   lambda a: (a[0].items.insert(int(a[1]),a[2]),a[0])[1],
    "remove_at":lambda a: a[0].items.pop(int(a[1])),
    "reverse":  lambda a: NovaList(list(reversed(a[0].items))),
    "sort":     lambda a: NovaList(sorted(a[0].items,key=lambda x:(0,x) if isinstance(x,(int,float)) else (1,str(x)))),
    "slice":    lambda a: NovaList(a[0].items[int(a[1]):int(a[2]) if len(a)>2 else None]),
    "concat":   lambda a: NovaList(a[0].items+a[1].items),
    "flatten":  lambda a: NovaList(x for sub in a[0].items for x in (sub.items if isinstance(sub,NovaList) else [sub])),
    "unique":   lambda a: NovaList(dict.fromkeys(a[0].items)),
    "zip":      lambda a: NovaList(NovaList(list(pair)) for pair in zip(a[0].items,a[1].items)),
    "enumerate":lambda a: NovaList(NovaList([i,v]) for i,v in enumerate(a[0].items)),
    "all":      lambda a: all(a[0].items),
    "any":      lambda a: any(a[0].items),
    # Dict
    "dict":    lambda a: NovaDict(),
    "keys":    lambda a: NovaList(list(a[0].data.keys())),
    "values":  lambda a: NovaList(list(a[0].data.values())),
    "has":     lambda a: a[1] in a[0].data,
    "set_key": lambda a: (a[0].data.__setitem__(a[1],a[2]),a[0])[1],
    "del_key": lambda a: (a[0].data.pop(a[1],None),a[0])[1],
    "merge":   lambda a: NovaDict({**a[0].data,**a[1].data}),
    # IO
    "input":   _nova_input,
    "print_err":lambda a: (print(_str(a[0]),file=sys.stderr),None)[1],
    "exit":    lambda a: sys.exit(int(a[0]) if a else 0),
    "clock":   lambda a: time.time(),
}

# ══════════════════════════════════════════════════════════════
#  INTERPRETER
# ══════════════════════════════════════════════════════════════
class Interpreter:
    def __init__(self):
        self.output=[]
        self.global_env=Environment()
        for k,v in CONSTANTS.items(): self.global_env.set(k,v)

    def run(self,program):
        self.output=[]
        for stmt in program.stmts: self.eval(stmt,self.global_env)
        return self.output

    def eval(self,node,env):  # noqa
        match node:
            # ── Literals ────────────────────────────────────
            case NumberLit(value=v): return v
            case StringLit(value=v): return v
            case BoolLit(value=v):   return v
            case NullLit():          return None
            case Identifier(name=n):
                try: return env.get(n)
                except NovaError:
                    if n in CONSTANTS: return CONSTANTS[n]
                    raise
            case FStringLit(parts=parts):
                result=""
                for is_expr,content in parts:
                    if is_expr: result+=_str(self.eval(content,env))
                    else: result+=content
                return result
            case ListLit(items=items):
                out=[]
                for i in items:
                    if isinstance(i,Spread): out.extend(self.eval(i.expr,env).items)
                    else: out.append(self.eval(i,env))
                return NovaList(out)
            case DictLit(pairs=pairs):
                return NovaDict([(self.eval(k,env),self.eval(v,env)) for k,v in pairs])
            case ListComp(expr=expr,var=var,iterable=it,condition=cond):
                items=self.eval(it,env)
                lst=items.items if isinstance(items,NovaList) else list(items)
                result=[]
                for item in lst:
                    loc=Environment(env); loc.set(var,item)
                    if cond is None or self.eval(cond,loc):
                        result.append(self.eval(expr,loc))
                return NovaList(result)
            case DictComp(kexpr=ke,vexpr=ve,var=var,iterable=it,condition=cond):
                items=self.eval(it,env)
                lst=items.items if isinstance(items,NovaList) else list(items)
                result={}
                for item in lst:
                    loc=Environment(env); loc.set(var,item)
                    if cond is None or self.eval(cond,loc):
                        result[self.eval(ke,loc)]=self.eval(ve,loc)
                return NovaDict(result)

            # ── Variables ───────────────────────────────────
            case Let(targets=targets,value=v):
                val=self.eval(v,env)
                if len(targets)==1:
                    env.set(targets[0],val)
                else:
                    if not isinstance(val,NovaList) or len(val.items)<len(targets):
                        raise NovaError(f"Cannot unpack: expected {len(targets)} values")
                    for name,item in zip(targets,val.items): env.set(name,item)
            case Assign(target=t,value=v):
                self._assign(t,self.eval(v,env),env)
            case CompoundAssign(target=t,op=op,value=v):
                cur=self.eval(t,env); rhs=self.eval(v,env)
                self._assign(t,self._applyop(op,cur,rhs),env)
            case Incr(target=t,op=op,prefix=pre):
                cur=self.eval(t,env)
                delta=1 if op==TT.PLUS_PLUS else -1
                new_val=cur+delta; self._assign(t,new_val,env)
                return new_val if pre else cur
            case Walrus(name=n,value=v):
                val=self.eval(v,env); env.set(n,val); return val

            # ── Access ──────────────────────────────────────
            case Index(obj=o,idx=i):
                return self._idx_get(self.eval(o,env),self.eval(i,env))
            case Slice(obj=o,start=s,stop=e,step=st):
                obj=self.eval(o,env)
                sv=int(self.eval(s,env)) if s is not None else None
                ev=int(self.eval(e,env)) if e is not None else None
                stv=int(self.eval(st,env)) if st is not None else None
                if isinstance(obj,NovaList): return NovaList(obj.items[sv:ev:stv])
                if isinstance(obj,str): return obj[sv:ev:stv]
                raise NovaError("Slice requires list or string")
            case Attr(obj=o,name=n):
                obj=self.eval(o,env)
                if isinstance(obj,NovaDict) and n in obj.data: return obj.data[n]
                if isinstance(obj,NovaModule) and n in obj.attrs: return obj.attrs[n]
                raise NovaError(f"No attribute '{n}' on {_str(obj)}")

            # ── Operators ───────────────────────────────────
            case BinOp(left=l,op=op,right=r):
                return self._binop(op,l,r,env)
            case UnaryOp(op=op,operand=o):
                v=self.eval(o,env)
                if op=="-": return -v
                if op=="not": return not v
            case Ternary(cond=c,then=t,els=e):
                return self.eval(t,env) if self.eval(c,env) else self.eval(e,env)
            case Pipe(left=l,right=r):
                val=self.eval(l,env)
                if isinstance(r,Identifier) and r.name in BUILTINS:
                    try: return BUILTINS[r.name]([val])
                    except NovaError: raise
                    except Exception as e: raise NovaError(str(e))
                fn=self.eval(r,env)
                if isinstance(fn,NovaFunction): return self._invoke(fn,[val])
                raise NovaError("Pipe right side must be callable")
            case Membership(item=item,container=cont,negated=neg):
                iv=self.eval(item,env); cv=self.eval(cont,env)
                if isinstance(cv,NovaList): found=iv in cv.items
                elif isinstance(cv,NovaDict): found=iv in cv.data
                elif isinstance(cv,str): found=str(iv) in cv
                else: raise NovaError(f"'in' requires list, dict or string")
                return found if not neg else not found

            # ── IO ──────────────────────────────────────────
            case Print(exprs=exprs,sep=sep_node,end=end_node):
                sep=_str(self.eval(sep_node,env)) if sep_node else " "
                end=_str(self.eval(end_node,env)) if end_node else "\n"
                vals=[_str(self.eval(e,env)) for e in exprs]
                line=sep.join(vals)
                self.output.append(line)
                return None

            # ── Control flow ────────────────────────────────
            case Block(stmts=stmts):
                for s in stmts: self.eval(s,env)
            case If(condition=c,then_block=t,else_block=e):
                if self.eval(c,env): self.eval(t,Environment(env))
                elif e: self.eval(e,Environment(env))
            case While(condition=c,body=b):
                while self.eval(c,env):
                    try: self.eval(b,Environment(env))
                    except BreakSig: break
                    except ContinueSig: continue
            case DoWhile(body=b,condition=c):
                while True:
                    try: self.eval(b,Environment(env))
                    except BreakSig: break
                    except ContinueSig: pass
                    if not self.eval(c,env): break
            case For(var=v,iterable=it,body=b):
                items=self.eval(it,env)
                lst=items.items if isinstance(items,NovaList) else list(items)
                for item in lst:
                    loc=Environment(env); loc.set(v,item)
                    try: self.eval(b,loc)
                    except BreakSig: break
                    except ContinueSig: continue
            case Range(start=s,stop=st,step=sp):
                sv=int(self.eval(s,env)); stv=int(self.eval(st,env))
                spv=int(self.eval(sp,env)) if sp else 1
                return NovaList(list(range(sv,stv,spv)))
            case Break(): raise BreakSig()
            case Continue(): raise ContinueSig()
            case Return(value=v): raise ReturnSig(self.eval(v,env))
            case Throw(value=v): raise ThrowSignal(self.eval(v,env))

            # ── Error handling ──────────────────────────────
            case TryCatch(body=body,var=var,catch=catch,finally_=fin):
                try: self.eval(body,Environment(env))
                except (ReturnSig,BreakSig,ContinueSig): raise
                except ThrowSignal as e:
                    if catch:
                        loc=Environment(env)
                        if var: loc.set(var,_str(e.val))
                        self.eval(catch,loc)
                    else: raise
                except Exception as e:
                    if catch:
                        loc=Environment(env)
                        if var: loc.set(var,str(e))
                        self.eval(catch,loc)
                finally:
                    if fin: self.eval(fin,Environment(env))

            case Assert(expr=e,msg=m):
                if not self.eval(e,env):
                    msg=_str(self.eval(m,env)) if m else "Assertion failed"
                    raise NovaError(f"AssertionError: {msg}")

            # ── Match / Switch ───────────────────────────────
            case Match(subject=subj,arms=arms):
                val=self.eval(subj,env)
                matched=False
                for pattern,body in arms:
                    if pattern is None:  # default _
                        self.eval(body,Environment(env)); matched=True; break
                    # multi-pattern
                    if isinstance(pattern,list):
                        pvals=[self.eval(p,env) for p in pattern]
                        if val in pvals:
                            self.eval(body,Environment(env)); matched=True; break
                    else:
                        pval=self.eval(pattern,env)
                        if val==pval:
                            self.eval(body,Environment(env)); matched=True; break

            # ── Functions ───────────────────────────────────
            case FnDef(name=n) as fndef:
                fn=NovaFunction(fndef,env)
                if n!="__lambda__": env.set(n,fn)
                return fn
            case FnCall(callee=callee,args=arg_nodes):
                return self._call(callee,arg_nodes,env)

            # ── Global / Import ─────────────────────────────
            case Global(names=names):
                for n in names: env.declare_global(n)
            case Import(module=mod,alias=alias):
                env.set(alias or mod,self._import(mod))

            case Program(stmts=stmts):
                for s in stmts: self.eval(s,env)

            case _:
                raise NovaError(f"Unknown node: {type(node).__name__}")

    # ── Assignment helpers ──────────────────────────────────────
    def _assign(self,target,val,env):
        match target:
            case Identifier(name=n): env.assign(n,val)
            case Index(obj=o,idx=i):
                obj=self.eval(o,env); idx=self.eval(i,env)
                if isinstance(obj,NovaList): obj.items[int(idx)]=val
                elif isinstance(obj,NovaDict): obj.data[idx]=val
                else: raise NovaError("Cannot index-assign")
            case Attr(obj=o,name=n):
                obj=self.eval(o,env)
                if isinstance(obj,NovaDict): obj.data[n]=val
                else: raise NovaError(f"Cannot set attribute '{n}'")
            case _: raise NovaError("Invalid assignment target")

    def _applyop(self,op,a,b):
        if op=="+": return a+b
        if op=="-": return a-b
        if op=="*": return a*b
        if op=="/":
            if b==0: raise NovaError("Division by zero")
            return a/b
        if op=="//": return int(a//b)
        if op=="%": return a%b
        if op=="^": return a**b
        raise NovaError(f"Unknown op '{op}'")

    # ── Binary operators ────────────────────────────────────────
    def _binop(self,op,l_node,r_node,env):
        if op=="and":
            lv=self.eval(l_node,env); return lv and self.eval(r_node,env)
        if op=="or":
            lv=self.eval(l_node,env); return lv or self.eval(r_node,env)
        lv=self.eval(l_node,env); rv=self.eval(r_node,env)
        if op=="+":
            if isinstance(lv,NovaList) and isinstance(rv,NovaList):
                return NovaList(lv.items+rv.items)
            return lv+rv
        if op=="-":  return lv-rv
        if op=="*":
            if isinstance(lv,str): return lv*int(rv)
            if isinstance(rv,str): return rv*int(lv)
            return lv*rv
        if op=="/":
            if rv==0: raise NovaError("Division by zero")
            return lv/rv
        if op=="//": return int(lv//rv)
        if op=="%":  return lv%rv
        if op=="^":  return lv**rv
        if op=="EQ":  return lv==rv
        if op=="NEQ": return lv!=rv
        if op=="LT":  return lv<rv
        if op=="GT":  return lv>rv
        if op=="LTE": return lv<=rv
        if op=="GTE": return lv>=rv
        raise NovaError(f"Unknown operator '{op}'")

    # ── Indexing ────────────────────────────────────────────────
    def _idx_get(self,obj,idx):
        if isinstance(obj,NovaList):
            i=int(idx)
            if i<0: i=len(obj.items)+i
            if i<0 or i>=len(obj.items): raise NovaError(f"Index {idx} out of range")
            return obj.items[i]
        if isinstance(obj,NovaDict):
            if idx not in obj.data: raise NovaError(f"Key '{idx}' not found")
            return obj.data[idx]
        if isinstance(obj,str):
            i=int(idx); return obj[i] if i>=0 else obj[len(obj)+i]
        raise NovaError(f"Cannot index type '{type(obj).__name__}'")

    # ── Function calls ──────────────────────────────────────────
    def _call(self,callee_node,arg_nodes,env):
        # Method call: obj.method(args)
        if isinstance(callee_node,Attr):
            obj=self.eval(callee_node.obj,env)
            args,_=self._eval_args(arg_nodes,env)
            return self._method(obj,callee_node.name,args)

        # Named builtin or HOF
        if isinstance(callee_node,Identifier):
            name=callee_node.name
            if name in BUILTINS:
                args,_=self._eval_args(arg_nodes,env)
                try: return BUILTINS[name](args)
                except NovaError: raise
                except Exception as e: raise NovaError(str(e))
            if name in("map","filter","reduce"):
                args,_=self._eval_args(arg_nodes,env)
                if name=="map": return self._hof_map(args)
                if name=="filter": return self._hof_filter(args)
                if name=="reduce": return self._hof_reduce(args)

        callee=self.eval(callee_node,env)
        if isinstance(callee,NovaFunction):
            args,kwargs=self._eval_args(arg_nodes,env)
            return self._invoke(callee,args,kwargs)
        raise NovaError(f"'{_str(callee)}' is not callable")

    def _eval_args(self,arg_nodes,env):
        args=[]; kwargs={}
        for a in arg_nodes:
            if isinstance(a,Spread):
                val=self.eval(a.expr,env)
                if isinstance(val,NovaList): args.extend(val.items)
                else: raise NovaError("Spread requires a list")
            elif isinstance(a,NamedArg):
                kwargs[a.name]=self.eval(a.value,env)
            else:
                args.append(self.eval(a,env))
        return args,kwargs

    def _invoke(self,fn,args,kwargs=None):
        if kwargs is None: kwargs={}
        params=fn.node.params; defaults=fn.node.defaults; variadic=fn.node.variadic
        local=Environment(fn.closure)
        if variadic:
            reg_params=params[:-1]; vname=params[-1]
            for i,p in enumerate(reg_params):
                if p in kwargs: local.set(p,kwargs[p])
                elif i<len(args): local.set(p,args[i])
                elif defaults[i] is not None: local.set(p,self.eval(defaults[i],fn.closure))
                else: raise NovaError(f"Missing argument '{p}'")
            local.set(vname,NovaList(args[len(reg_params):]))
        else:
            for i,p in enumerate(params):
                if p in kwargs: local.set(p,kwargs[p])
                elif i<len(args): local.set(p,args[i])
                elif defaults[i] is not None: local.set(p,self.eval(defaults[i],fn.closure))
                else: raise NovaError(f"Missing argument '{p}'")
        try: self.eval(fn.node.body,local)
        except ReturnSig as r: return r.v
        return None

    # ── Method dispatch ─────────────────────────────────────────
    def _method(self,obj,method,args):
        if isinstance(obj,str):
            m={
                "upper":       lambda: obj.upper(),
                "lower":       lambda: obj.lower(),
                "trim":        lambda: obj.strip(),
                "trim_left":   lambda: obj.lstrip(),
                "trim_right":  lambda: obj.rstrip(),
                "split":       lambda: NovaList(obj.split(str(args[0]) if args else None)),
                "replace":     lambda: obj.replace(str(args[0]),str(args[1])),
                "contains":    lambda: str(args[0]) in obj,
                "starts_with": lambda: obj.startswith(str(args[0])),
                "ends_with":   lambda: obj.endswith(str(args[0])),
                "index_of":    lambda: obj.find(str(args[0])),
                "repeat":      lambda: obj*int(args[0]),
                "char_at":     lambda: obj[int(args[0])],
                "substr":      lambda: obj[int(args[0]):int(args[1]) if len(args)>1 else None],
                "len":         lambda: len(obj),
                "reverse":     lambda: obj[::-1],
                "to_list":     lambda: NovaList(list(obj)),
                "pad_left":    lambda: obj.rjust(int(args[0]),str(args[1]) if len(args)>1 else " "),
                "pad_right":   lambda: obj.ljust(int(args[0]),str(args[1]) if len(args)>1 else " "),
                "count":       lambda: obj.count(str(args[0])),
                "is_empty":    lambda: len(obj)==0,
                "to_num":      lambda: int(obj) if obj.lstrip("-").isdigit() else float(obj),
                "format":      lambda: obj.format(*[_str(x) for x in args]),
                "lines":       lambda: NovaList(obj.splitlines()),
                "words":       lambda: NovaList(obj.split()),
                "is_alpha":    lambda: obj.isalpha(),
                "is_digit":    lambda: obj.isdigit(),
                "is_alnum":    lambda: obj.isalnum(),
                "is_upper":    lambda: obj.isupper(),
                "is_lower":    lambda: obj.islower(),
                "slice":       lambda: obj[int(args[0]):int(args[1]) if len(args)>1 else None],
            }
            if method in m: return m[method]()
            raise NovaError(f"String has no method '{method}'")

        if isinstance(obj,NovaList):
            m={
                "push":     lambda: (obj.items.append(args[0]),obj)[1],
                "pop":      lambda: obj.items.pop(),
                "shift":    lambda: obj.items.pop(0),
                "unshift":  lambda: (obj.items.insert(0,args[0]),obj)[1],
                "insert":   lambda: (obj.items.insert(int(args[0]),args[1]),obj)[1],
                "remove_at":lambda: obj.items.pop(int(args[0])),
                "reverse":  lambda: NovaList(list(reversed(obj.items))),
                "sort":     lambda: NovaList(sorted(obj.items,key=lambda x:(0,x) if isinstance(x,(int,float)) else (1,str(x)))),
                "sort_desc":lambda: NovaList(sorted(obj.items,key=lambda x:(0,-x) if isinstance(x,(int,float)) else (1,str(x)),reverse=False)),
                "slice":    lambda: NovaList(obj.items[int(args[0]):int(args[1]) if len(args)>1 else None]),
                "concat":   lambda: NovaList(obj.items+args[0].items),
                "contains": lambda: args[0] in obj.items,
                "index_of": lambda: obj.items.index(args[0]) if args[0] in obj.items else -1,
                "len":      lambda: len(obj.items),
                "join":     lambda: (_str(args[0]) if args else ", ").join(_str(i) for i in obj.items),
                "map":      lambda: self._hof_map([args[0],obj]),
                "filter":   lambda: self._hof_filter([args[0],obj]),
                "reduce":   lambda: self._hof_reduce([args[0],obj]+(args[1:] if len(args)>1 else [])),
                "flat":     lambda: NovaList(x for sub in obj.items for x in (sub.items if isinstance(sub,NovaList) else [sub])),
                "flatten":  lambda: NovaList(x for sub in obj.items for x in (sub.items if isinstance(sub,NovaList) else [sub])),
                "unique":   lambda: NovaList(dict.fromkeys(obj.items)),
                "sum":      lambda: sum(obj.items),
                "all":      lambda: all(obj.items),
                "any":      lambda: any(obj.items),
                "first":    lambda: obj.items[0] if obj.items else None,
                "last":     lambda: obj.items[-1] if obj.items else None,
                "count":    lambda: obj.items.count(args[0]),
                "is_empty": lambda: len(obj.items)==0,
                "copy":     lambda: NovaList(list(obj.items)),
                "fill":     lambda: NovaList([args[0]]*int(args[1])),
                "take":     lambda: NovaList(obj.items[:int(args[0])]),
                "drop":     lambda: NovaList(obj.items[int(args[0]):]),
                "zip":      lambda: NovaList(NovaList(list(pair)) for pair in zip(obj.items,args[0].items)),
                "enumerate":lambda: NovaList(NovaList([i,v]) for i,v in enumerate(obj.items)),
                "min":      lambda: min(obj.items),
                "max":      lambda: max(obj.items),
                "to_str":   lambda: repr(obj),
                "find":     lambda: next((x for x in obj.items if self._invoke(args[0],[x])),None),
                "find_index":lambda: next((i for i,x in enumerate(obj.items) if self._invoke(args[0],[x])),-1),
                "every":    lambda: all(self._invoke(args[0],[x]) for x in obj.items),
                "some":     lambda: any(self._invoke(args[0],[x]) for x in obj.items),
                "for_each": lambda: [self._invoke(args[0],[x]) for x in obj.items] and None,
                "chunk":    lambda: NovaList(NovaList(obj.items[i:i+int(args[0])]) for i in range(0,len(obj.items),int(args[0]))),
                "remove":   lambda: (obj.items.remove(args[0]),obj)[1] if args[0] in obj.items else obj,
            }
            if method in m: return m[method]()
            raise NovaError(f"List has no method '{method}'")

        if isinstance(obj,NovaDict):
            m={
                "keys":    lambda: NovaList(list(obj.data.keys())),
                "values":  lambda: NovaList(list(obj.data.values())),
                "items":   lambda: NovaList(NovaList([k,v]) for k,v in obj.data.items()),
                "has":     lambda: args[0] in obj.data,
                "get":     lambda: obj.data.get(args[0],args[1] if len(args)>1 else None),
                "set":     lambda: (obj.data.__setitem__(args[0],args[1]),obj)[1],
                "delete":  lambda: (obj.data.pop(args[0],None),obj)[1],
                "merge":   lambda: NovaDict({**obj.data,**args[0].data}),
                "len":     lambda: len(obj.data),
                "is_empty":lambda: len(obj.data)==0,
                "copy":    lambda: NovaDict(dict(obj.data)),
                "to_str":  lambda: repr(obj),
                "for_each":lambda: [self._invoke(args[0],[k,v]) for k,v in obj.data.items()] and None,
                "map_values":lambda: NovaDict({k:self._invoke(args[0],[v]) for k,v in obj.data.items()}),
                "filter":  lambda: NovaDict({k:v for k,v in obj.data.items() if self._invoke(args[0],[k,v])}),
            }
            if method in m: return m[method]()
            raise NovaError(f"Dict has no method '{method}'")

        raise NovaError(f"Type '{type(obj).__name__}' has no method '{method}'")

    # ── Higher-order ────────────────────────────────────────────
    def _hof_map(self,args):
        fn,lst=args[0],args[1]
        return NovaList([self._invoke(fn,[item]) for item in lst.items])
    def _hof_filter(self,args):
        fn,lst=args[0],args[1]
        return NovaList([item for item in lst.items if self._invoke(fn,[item])])
    def _hof_reduce(self,args):
        fn,lst=args[0],args[1]
        items=lst.items
        if not items: raise NovaError("reduce on empty list")
        acc=args[2] if len(args)>2 else items[0]
        start=0 if len(args)>2 else 1
        for item in items[start:]: acc=self._invoke(fn,[acc,item])
        return acc

    # ── Module system ────────────────────────────────────────────
    def _import(self,name):
        if name=="math":
            return NovaModule("math",{k:getattr(math,k) for k in dir(math) if not k.startswith("_")})
        if name=="random":
            return NovaModule("random",{"random":random.random,"randint":random.randint,
                "seed":random.seed,"choice":random.choice,"shuffle":random.shuffle})
        if name=="time":
            return NovaModule("time",{"now":time.time,"sleep":time.sleep})
        raise NovaError(f"Unknown module '{name}'")

# ══════════════════════════════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════════════════════════════
def run_source(source):
    try:
        tokens=Lexer(source).tokenize()
        ast=Parser(tokens).parse()
        interp=Interpreter()
        out=interp.run(ast)
        return out,None
    except Exception as e:
        return [],str(e)

def main():
    if len(sys.argv)<2:
        print("NOVA v3.0 — Usage: nova.py <file.nova>"); sys.exit(1)
    try: source=open(sys.argv[1]).read()
    except FileNotFoundError:
        print(f"File not found: {sys.argv[1]}"); sys.exit(1)
    output,error=run_source(source)
    for line in output: print(line)
    if error: print(error,file=sys.stderr); sys.exit(1)

if __name__=="__main__":
    main()
