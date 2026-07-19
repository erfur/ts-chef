.PHONY: build test lint docs release package upload clean help

help:
	@echo "vschef development commands:"
	@echo "  make build    - Build the project"
	@echo "  make test     - Run all tests"
	@echo "  make lint     - Run linting and formatting"
	@echo "  make docs     - Generate API documentation"
	@echo "  make release  - Build, test, and package (.vsix)"
	@echo "  make clean    - Remove build artifacts"

build:
	npm run build

test:
	npm run test

lint:
	npm run lint:fix
	npm run format

docs:
	npm run docs

package:
	npm run package

release:
	npm run release

upload:
	npm run upload

clean:
	rm -rf dist/ out/ coverage/ docs/api/ *.vsix
