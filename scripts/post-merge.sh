#!/bin/bash
set -e
npm install
npm run db:migrate:workspaces
npm run db:migrate:project-work
npm run db:push
