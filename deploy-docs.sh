#!/usr/bin/env bash
git add web_deploy
git commit -m "Update Swagger Documentation"
git subtree push --prefix web_deploy origin gh-pages
