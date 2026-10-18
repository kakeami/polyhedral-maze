#!/usr/bin/env bash
# Runs the folding-maze benchmarks on a Linux VM (Debian or Ubuntu).
#
#   bash vm.sh setup [<source> <commit>]   Node, and the code at one commit
#   bash vm.sh start <name> <first> <count> <total> [run.ts options...]
#                                           shards first..first+count-1 of total,
#                                           in the background, one process each
#   bash vm.sh status <name>                last line of every shard's log
#   bash vm.sh pack <name>                  ~/<name>.tgz, ready to copy back
#
# Run from inside a checkout (bench/cloud/vm.sh of a clone), it measures that
# checkout: `setup` installs Node and checks the tree is clean, and moves
# nothing. Run as a copy on its own, it keeps a checkout of its own in
# $MAZE_BENCH_DIR (~/maze-bench), cloned by `setup` from <source> — a git
# bundle, so that a commit never pushed can be measured, or a repository URL —
# and checked out at <commit>.
#
# The results' header records the commit and whether the tree was clean, and
# the summary insists on one commit and a clean tree, so measure a commit.
#
# One process per physical core: a VM's vCPUs are usually hyperthreads, two to
# a core, so four vCPUs take two shards. More than that and the shards measure
# each other, and so does anything else the VM is doing.
set -euo pipefail

NODE_VERSION=${NODE_VERSION:-26.5.0}
NODE_DIR=${NODE_DIR:-$HOME/node}
here=$(cd "$(dirname "$0")" && pwd)
if [ -d "$here/../../.git" ]; then
  REPO=$(cd "$here/../.." && pwd)
  OWN=0
else
  REPO=${MAZE_BENCH_DIR:-$HOME/maze-bench}
  OWN=1
fi
NODE=$NODE_DIR/bin/node

usage() { sed -n '2,9p' "$0" >&2; exit 2; }

install_node() {
  if [ -x "$NODE" ] && [ "$("$NODE" --version)" = "v$NODE_VERSION" ]; then return; fi
  if ! command -v xz >/dev/null || ! command -v curl >/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq xz-utils curl ca-certificates >/dev/null
  fi
  local arch name tmp
  case $(uname -m) in
    x86_64) arch=x64 ;;
    aarch64) arch=arm64 ;;
    *) echo "unsupported machine: $(uname -m)" >&2; exit 1 ;;
  esac
  name=node-v$NODE_VERSION-linux-$arch
  tmp=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$name.tar.xz" -o "$tmp/$name.tar.xz"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  (cd "$tmp" && grep " $name.tar.xz\$" SHASUMS256.txt | sha256sum -c - >/dev/null)
  rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
  tar -xJf "$tmp/$name.tar.xz" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
}

cmd=${1:-}; [ -n "$cmd" ] || usage; shift

case $cmd in
  setup)
    install_node
    if [ "$OWN" = 1 ]; then
      source=${1:?a bundle or repository URL to clone from}; commit=${2:?the commit to measure}
      if ! command -v git >/dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y -qq git >/dev/null
      fi
      # Replaced only if it is one this script made.
      if [ -e "$REPO" ] && [ ! -e "$REPO/.maze-bench" ]; then
        echo "$REPO exists and was not made by this script; set MAZE_BENCH_DIR elsewhere" >&2
        exit 1
      fi
      rm -rf "$REPO"
      git clone -q --no-checkout "$source" "$REPO"
      git -C "$REPO" -c advice.detachedHead=false checkout -q --detach "$commit"
      touch "$REPO/.maze-bench"
      git -C "$REPO" update-index -q --refresh || true
    elif [ $# -gt 0 ]; then
      echo "inside a checkout, setup takes no arguments: check out the commit with git" >&2
      exit 2
    fi
    if [ -n "$(git -C "$REPO" status --porcelain --untracked-files=no)" ]; then
      echo "warning: $REPO has uncommitted changes; its results will be marked dirty" >&2
    fi
    echo "node $("$NODE" --version), $(nproc) vCPUs ($(lscpu | sed -n 's/^Model name: *//p' | head -n1))"
    echo "measuring $REPO at $(git -C "$REPO" rev-parse HEAD)"
    ;;

  start)
    name=${1:?name}; first=${2:?first}; count=${3:?count}; total=${4:?total}; shift 4
    [ -x "$NODE" ] || { echo "run setup first" >&2; exit 1; }
    out=$REPO/bench/results/$name
    mkdir -p "$out"
    cd "$REPO"
    for ((i = first; i < first + count; i++)); do
      # setsid so the shards outlive the ssh session that started them.
      setsid nohup "$NODE" bench/run.ts "$@" \
        --shard "$i/$total" --out "$out/shard-$i.jsonl" \
        >/dev/null 2>"$out/shard-$i.log" < /dev/null &
      echo "shard $i/$total: pid $!"
    done
    ;;

  status)
    name=${1:?name}
    out=$REPO/bench/results/$name
    for log in "$out"/shard-*.log; do
      runs=$(grep -c '"kind":"run"' "${log%.log}.jsonl" 2>/dev/null || true)
      echo "$(basename "$log" .log): ${runs:-0} runs; $(tail -n 1 "$log")"
    done
    echo "still running: $(pgrep -fc 'bench/run.ts' || true)"
    ;;

  pack)
    name=${1:?name}
    tar -czf "$HOME/$name.tgz" -C "$REPO/bench/results" "$name"
    echo "$HOME/$name.tgz"
    ;;

  *) usage ;;
esac
