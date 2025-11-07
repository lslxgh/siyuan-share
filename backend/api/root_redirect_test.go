package main_test

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ZeroHawkeye/siyuan-share-api/routes"
)

//go:embed dist
var testDist embed.FS

func TestRootDoesNotRedirect(t *testing.T) {
	engine := routes.SetupRouter(&testDist)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d (Location=%q)", rec.Code, rec.Header().Get("Location"))
	}

	if location := rec.Header().Get("Location"); location != "" {
		t.Fatalf("unexpected redirect location: %s", location)
	}
}
