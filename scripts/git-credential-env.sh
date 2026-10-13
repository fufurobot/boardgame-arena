#!/bin/sh
# Git credential helper that supplies the GitHub token from the git-ignored .env.
# Keeps the secret out of .git/config and out of `git remote -v` output.
# Usage: git config credential.helper "$PWD/scripts/git-credential-env.sh"
case "$1" in
  get)
    env_file="$(dirname "$0")/../.env"
    [ -f "$env_file" ] || exit 0
    token=$(sed -n 's/^GITHUB_TOKEN=//p' "$env_file" | head -1 | tr -d '"'"'"' \r')
    [ -n "$token" ] || exit 0
    echo "username=x-access-token"
    echo "password=$token"
    ;;
esac
exit 0
