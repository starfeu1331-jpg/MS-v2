#!/bin/bash
set -e

REPO_URL="https://github.com/decordiscount/MS-Preprod.git"
REMOTE="origin"
MAIN_BRANCH="main"

usage() {
  echo "Usage: bash git-workflow.sh <commande>"
  echo ""
  echo "Commandes:"
  echo "  new <nom>       Créer une branche et commencer à coder"
  echo "  push <message>  Commit + push la branche courante"
  echo "  pr              Ouvrir une Pull Request sur GitHub"
  echo "  sync            Mettre à jour main avec les derniers changements"
  echo "  done            Revenir sur main après merge d'une PR"
  exit 1
}

current_branch() {
  git branch --show-current
}

# --- new : créer une branche ---
cmd_new() {
  [ -z "$1" ] && echo "Erreur: nom de branche requis. Ex: bash git-workflow.sh new feature/mon-truc" && exit 1
  git checkout "$MAIN_BRANCH"
  git pull "$REMOTE" "$MAIN_BRANCH"
  git checkout -b "$1"
  echo ""
  echo "Branche '$1' créée. Code, puis: bash git-workflow.sh push \"mon message\""
}

# --- push : commit + push ---
cmd_push() {
  BRANCH=$(current_branch)
  [ "$BRANCH" = "$MAIN_BRANCH" ] && echo "Erreur: ne push pas directement sur main. Crée une branche d'abord." && exit 1
  [ -z "$1" ] && echo "Erreur: message de commit requis." && exit 1
  git add -A
  git commit -m "$1"
  git push "$REMOTE" "$BRANCH"
  echo ""
  echo "Poussé sur $BRANCH. Pour créer la PR: bash git-workflow.sh pr"
}

# --- pr : ouvrir une PR ---
cmd_pr() {
  BRANCH=$(current_branch)
  [ "$BRANCH" = "$MAIN_BRANCH" ] && echo "Erreur: tu es sur main, pas de PR à créer." && exit 1
  gh pr create --base "$MAIN_BRANCH" --head "$BRANCH" --fill
  echo ""
  echo "PR créée. Review + merge sur GitHub."
}

# --- sync : mettre à jour main ---
cmd_sync() {
  git checkout "$MAIN_BRANCH"
  git pull "$REMOTE" "$MAIN_BRANCH"
  echo ""
  echo "Main à jour."
}

# --- done : nettoyer après merge ---
cmd_done() {
  BRANCH=$(current_branch)
  [ "$BRANCH" = "$MAIN_BRANCH" ] && echo "Déjà sur main." && exit 0
  git checkout "$MAIN_BRANCH"
  git pull "$REMOTE" "$MAIN_BRANCH"
  git branch -d "$BRANCH" 2>/dev/null || git branch -D "$BRANCH"
  echo ""
  echo "Branche '$BRANCH' supprimée. Main à jour."
}

# --- main ---
[ $# -lt 1 ] && usage
CMD="$1"; shift
case "$CMD" in
  new)  cmd_new "$1" ;;
  push) cmd_push "$*" ;;
  pr)   cmd_pr ;;
  sync) cmd_sync ;;
  done) cmd_done ;;
  *)    usage ;;
esac
