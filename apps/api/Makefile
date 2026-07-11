.PHONY: build test lint vet fmt

build:
	go build ./...

test:
	go test -race -coverprofile=coverage.out -timeout=45s ./...

lint:
	golangci-lint run ./...

vet:
	go vet ./...

fmt:
	gofmt -w .
