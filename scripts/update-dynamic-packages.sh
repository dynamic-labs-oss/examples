#!/bin/sh
set -eu

# Ensure this script can assume it's run from the repo's
# root directory, even if the current working directory is
# different.
ROOT="$(git rev-parse --show-toplevel)"
if [ "$(pwd)" != "$ROOT" ]; then
    ( cd "$ROOT" && exec "$0" "$@" )
    exit $?
fi

usage () {
    echo "usage: update-dynamic-packages.sh [<version>]"
    echo
    echo "Upgrades all the example and starter projects by bumping the Dynamic Labs dependencies"
    echo "to the given version. If not provided, uses the latest version."
    echo
    echo "Options:"
    echo "-h    Show this help"
}

while getopts h flag; do
    case "$flag" in
        h) usage; exit 0;;
        *) usage; exit 2;;
    esac
done
shift $(($OPTIND - 1))

VERSION="${1:-latest}"

list_all_projects () {
    find examples starters \
        -type d '(' -name node_modules -o -name .next ')' -prune \
        -o \
        -name package.json \
        | grep -Ee package.json \
        | xargs -n1 dirname
}

list_dynamic_deps () {
    for dep in $(jq -r '(.dependencies // {})|keys[]' package.json | grep -Ee '^@dynamic-labs/|^@dynamic-labs-sdk/'); do
        # Skip dependencies that are explicitly pinned to "*"
        if [ "$(jq -r ".dependencies.\"$dep\"" package.json)" != "*" ]; then
            # Skip sdk-api-core as it has a different versioning scheme
            if [ "$dep" != "@dynamic-labs/sdk-api-core" ]; then
                echo "$dep"
            fi
        fi
    done
}

list_install_args () {
    for dep in $(list_dynamic_deps); do
        echo "$dep@$VERSION"
    done
}

detect_package_manager() {
    if [ -f "pnpm-lock.yaml" ]; then
        echo "pnpm"
    elif [ -f "package-lock.json" ]; then
        echo "npm"
    fi
}

for proj in $(list_all_projects); do
    echo "==> Upgrade $proj to $VERSION"
    ( cd "$proj" && 
        install_args=$(list_install_args)
        if [ -n "$install_args" ]; then
            case "$(detect_package_manager)" in
                pnpm)
                    pnpm add --ignore-workspace $install_args ;;
                npm)
                    npm install $install_args ;;
            esac
        else
            echo "No Dynamic Labs packages found, skipping..."
        fi
    )
done
