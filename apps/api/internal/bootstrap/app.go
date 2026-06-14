package bootstrap

import (
	"log/slog"
	"net/http"
	"time"

	httpadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"
)

type App struct {
	httpServer *http.Server
}

func New(cfg config.Config, logger *slog.Logger) App {
	router := httpadapter.NewRouter(logger)

	return App{
		httpServer: &http.Server{
			Addr:              cfg.HTTPAddr,
			Handler:           router,
			ReadHeaderTimeout: 5 * time.Second,
		},
	}
}

func (a App) HTTPServer() *http.Server {
	return a.httpServer
}
