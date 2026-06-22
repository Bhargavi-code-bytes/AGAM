#!/bin/zsh
set -euo pipefail

cd "/Users/vn593ms/Documents/AGAM/multiuser"
export PORT="8091"
exec /usr/bin/env python3 server.py
