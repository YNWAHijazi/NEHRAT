#!/usr/bin/env python3
"""Extracts plain text from a .docx: paragraphs and tables, in document order.
Tables render as rows of ' | '-joined cells. Stdlib only."""
import sys, zipfile
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def cell_text(tc):
    parts = []
    for p in tc.iter(f'{W}p'):
        text = ''.join(t.text or '' for t in p.iter(f'{W}t'))
        if text.strip():
            parts.append(text.strip())
    return ' / '.join(parts)

def main(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(f'{W}body')
    out = []
    for el in body:
        if el.tag == f'{W}p':
            text = ''.join(t.text or '' for t in el.iter(f'{W}t'))
            style = el.find(f'{W}pPr/{W}pStyle')
            sid = style.get(f'{W}val') if style is not None else ''
            if text.strip():
                prefix = '## ' if sid and 'Heading' in sid else ''
                out.append(prefix + text.strip())
        elif el.tag == f'{W}tbl':
            for tr in el.findall(f'{W}tr'):
                cells = [cell_text(tc) for tc in tr.findall(f'{W}tc')]
                out.append('| ' + ' | '.join(cells))
            out.append('')
    print('\n'.join(out))

if __name__ == '__main__':
    main(sys.argv[1])
