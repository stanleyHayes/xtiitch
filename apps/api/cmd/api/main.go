package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/bootstrap"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"
	loggerpkg "github.com/xcreativs/xtiitch/apps/api/internal/platform/logger"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	logger := loggerpkg.New(cfg.Environment)

	app, err := bootstrap.New(ctx, cfg, logger)
	if err != nil {
		logger.Error("api bootstrap failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer app.Close()
	server := app.HTTPServer()

	errs := make(chan error, 1)
	go func() {
		logger.Info("api listening", slog.String("addr", cfg.HTTPAddr))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errs <- err
		}
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("api shutdown failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	case err := <-errs:
		logger.Error("api failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}
