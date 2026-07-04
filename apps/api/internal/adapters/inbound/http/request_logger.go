package httpadapter

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// requestLogger emits one structured log line per HTTP request: method, path,
// status, response size, duration, the request id, the (real) client IP, and the
// user agent. It logs at Error for 5xx, Warn for 4xx, and Info otherwise, so the
// backend is no longer silent while handling requests (sign-up, OTP, checkout,
// …). It deliberately logs only the path — never the query string or body — so
// one-time codes, tokens, and other secrets are not written to logs.
func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			start := time.Now()

			defer func() {
				status := ww.Status()
				if status == 0 {
					// Handler returned without WriteHeader — net/http defaults to 200.
					status = http.StatusOK
				}
				attrs := []any{
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.Int("status", status),
					slog.Int("bytes", ww.BytesWritten()),
					slog.Int64("duration_ms", time.Since(start).Milliseconds()),
					slog.String("request_id", middleware.GetReqID(r.Context())),
					slog.String("remote_ip", r.RemoteAddr),
					slog.String("user_agent", r.UserAgent()),
				}
				switch {
				case status >= http.StatusInternalServerError:
					logger.Error("http request", attrs...)
				case status >= http.StatusBadRequest:
					logger.Warn("http request", attrs...)
				default:
					logger.Info("http request", attrs...)
				}
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
