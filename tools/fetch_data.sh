#!/bin/sh
# Download the raw word lists (not committed). Then: node tools/build_lexicon.mjs
set -e
cd "$(dirname "$0")/../data/raw" 2>/dev/null || { mkdir -p "$(dirname "$0")/../data/raw"; cd "$(dirname "$0")/../data/raw"; }
curl -sSfL -o enable1.txt https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
curl -sSfL -o scowl.tar.gz https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz
tar xzf scowl.tar.gz
echo "raw data ready"
# Clues from published crosswords: the xd corpus by Saul Pwanson (https://xd.saul.pw)
mkdir -p xd && curl -sSfL -o xd/xd-clues.zip https://xd.saul.pw/xd-clues.zip && (cd xd && unzip -o -q xd-clues.zip)
echo "xd clues ready"
