"""Minimal JS-object-literal parser: objects, arrays, single/double-quoted strings,
numbers, booleans, null, and unquoted identifier keys. Enough for the .dc.html data blocks."""
import json, sys

class P:
    def __init__(s, t): s.t=t; s.i=0
    def ws(s):
        while s.i < len(s.t):
            c = s.t[s.i]
            if c in ' \t\r\n': s.i += 1
            elif s.t.startswith('/*', s.i): s.i = s.t.index('*/', s.i) + 2
            elif s.t.startswith('//', s.i):
                nl = s.t.find('\n', s.i); s.i = len(s.t) if nl < 0 else nl + 1
            else: break
    def val(s):
        s.ws(); c = s.t[s.i]
        if c == '{': return s.obj()
        if c == '[': return s.arr()
        if c in '"\'': return s.str()
        j = s.i; depth = 0
        while s.i < len(s.t):
            c = s.t[s.i]
            if c in '([{': depth += 1
            elif c in ')]}':
                if depth == 0: break
                depth -= 1
            elif c in '"\'':
                q = c; s.i += 1
                while s.t[s.i] != q:
                    s.i += 2 if s.t[s.i] == '\\' else 1
            elif c == ',' and depth == 0: break
            s.i += 1
        raw = s.t[j:s.i].strip()
        if raw == 'true': return True
        if raw == 'false': return False
        if raw in ('null','undefined'): return None
        try: return int(raw)
        except ValueError:
            try: return float(raw)
            except ValueError: return raw
    def str(s):
        q = s.t[s.i]; s.i += 1; out = []
        while s.t[s.i] != q:
            if s.t[s.i] == '\\':
                nxt = s.t[s.i+1]
                out.append({'n':'\n','t':'\t','r':'\r'}.get(nxt, nxt)); s.i += 2
            else:
                out.append(s.t[s.i]); s.i += 1
        s.i += 1
        return ''.join(out)
    def arr(s):
        s.i += 1; out = []
        while True:
            s.ws()
            if s.t[s.i] == ']': s.i += 1; return out
            out.append(s.val()); s.ws()
            if s.t[s.i] == ',': s.i += 1
    def obj(s):
        s.i += 1; out = {}
        while True:
            s.ws()
            if s.t[s.i] == '}': s.i += 1; return out
            if s.t[s.i] in '"\'': k = s.str()
            else:
                j = s.i
                while s.t[s.i] not in ': \t\r\n': s.i += 1
                k = s.t[j:s.i]
            s.ws(); assert s.t[s.i] == ':', s.t[s.i-20:s.i+20]
            s.i += 1
            out[k] = s.val(); s.ws()
            if s.t[s.i] == ',': s.i += 1

def extract(src, name):
    i = src.index(f'const {name} = [')
    i = src.index('[', i)
    return P(src[i:]).val()

if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    print(json.dumps({n: extract(src, n) for n in sys.argv[2:]}, ensure_ascii=False, indent=2))
