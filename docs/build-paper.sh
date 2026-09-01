#!/usr/bin/env bash
# Build the whitepaper into LaTeX (.tex), a typeset PDF (via the tectonic LaTeX
# engine), and an editable Word (.docx) with native equations and embedded
# figures — all from the single Markdown source.
#
# Requires: pandoc, tectonic.  (brew install pandoc tectonic)
set -euo pipefail
cd "$(dirname "$0")"

SRC="QuantBloom-Whitepaper.md"

# Swap the manual title/TOC for a title page + auto-TOC via a metadata block.
python3 - "$SRC" <<'PY'
import sys
src = open(sys.argv[1]).read().split('\n')
def idx(pred): return next((i for i,l in enumerate(src) if pred(l)), -1)
a  = idx(lambda l: l.strip()=='## Abstract')
t  = idx(lambda l: l.strip()=='## Table of Contents')
i0 = idx(lambda l: l.strip().startswith('## 1. Introduction'))
body = src[a:t] + src[i0:]
meta = '''---
title: "QuantBloom Terminal"
subtitle: "A Technical Whitepaper --- Machine Learning, Trading Strategies, and the Mathematics Behind Them"
author: "QuantBloom Research"
date: "Version 1.0"
geometry: margin=1in
fontsize: 11pt
toc: true
toc-depth: 2
colorlinks: true
linkcolor: RoyalBlue
urlcolor: RoyalBlue
---

'''
open('_body.md','w').write(meta + '\n'.join(body))
PY

pandoc _body.md --standalone            -o QuantBloom-Whitepaper.tex
pandoc _body.md --pdf-engine=tectonic   -o QuantBloom-Whitepaper.pdf
pandoc _body.md                         -o QuantBloom-Whitepaper.docx
rm -f _body.md

echo "Built: QuantBloom-Whitepaper.{tex,pdf,docx}"
