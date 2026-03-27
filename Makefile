#!/usr/bin/make -f

.ONESHELL:
.SHELL := /usr/bin/bash

PROJECTNAME := $(shell basename "$$(pwd)")

help: ## Show available commands
	@echo "Usage: make [command]\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

setup:
	@command -v bun >/dev/null 2>&1 || \
		{ echo "Bun is required: https://bun.sh/docs/installation"; exit 1; }
	@if [ ! -d ./web/node_modules ]; then \
		cd ./web && bun install; \
	fi

dev: setup ## Start the web dev server
	cd ./web && bun run dev

test: setup ## Run all tests
	cd ./web && bun test

bench: setup ## Benchmark pipeline transform (throughput, scaling, memory)
	cd ./web && bun run test/bench.ts
