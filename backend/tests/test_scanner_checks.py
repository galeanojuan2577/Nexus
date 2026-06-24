from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from nexus.scanner.checks import (
    EXPOSED_PATHS,
    check_security_headers,
    check_technology,
    run_all_checks,
)


def _register(base_url: str, httpx_mock: HTTPXMock, count: int = 1):
    """Register N responses for the same URL."""
    for _ in range(count):
        httpx_mock.add_response(url=base_url, status_code=200, headers={})


def _register_paths(base_url: str, httpx_mock: HTTPXMock):
    """Register responses for all exposed paths."""
    for path in EXPOSED_PATHS:
        httpx_mock.add_response(
            url=f"{base_url.rstrip('/')}{path}", status_code=404, headers={}
        )


class TestScannerChecks:
    async def test_check_security_headers_full(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(
            status_code=200,
            url="http://example.com",
            headers={
                "Strict-Transport-Security": "max-age=31536000",
                "Content-Security-Policy": "default-src 'self'",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "X-XSS-Protection": "1; mode=block",
                "Referrer-Policy": "strict-origin-when-cross-origin",
                "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
            },
        )
        result = await check_security_headers("http://example.com")
        assert len(result) == 0  # all headers present

    async def test_check_security_headers_missing(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200, url="http://example.com", headers={})
        result = await check_security_headers("http://example.com")
        titles = [r["title"] for r in result]
        assert "Missing Strict-Transport-Security" in titles

    async def test_check_security_headers_timeout(self, httpx_mock: HTTPXMock):
        httpx_mock.add_exception(TimeoutError("timeout"), url="http://example.com")
        result = await check_security_headers("http://example.com")
        assert result == []

    async def test_check_technology_cloudflare(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(
            status_code=200,
            url="http://example.com",
            headers={"server": "cloudflare", "cf-ray": "12345"},
        )
        result = await check_technology("http://example.com")
        titles = [r["title"] for r in result]
        assert any("cloudflare" in t.lower() for t in titles)

    async def test_check_technology_nginx(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(
            status_code=200,
            url="http://example.com",
            headers={"server": "nginx/1.24.0"},
        )
        result = await check_technology("http://example.com")
        titles = [r["title"] for r in result]
        assert any("nginx" in t.lower() for t in titles)

    async def test_check_technology_no_server(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200, url="http://example.com", headers={})
        result = await check_technology("http://example.com")
        assert isinstance(result, list)

    async def test_run_all_checks_quick(self, httpx_mock: HTTPXMock):
        # quick runs: security_headers + info_disclosure + technology → 3 reqs
        _register("http://example.com", httpx_mock, count=3)
        result = await run_all_checks("example.com", "quick")
        assert isinstance(result, list)

    async def test_run_all_checks_headers(self, httpx_mock: HTTPXMock):
        # headers runs: security_headers + info_disclosure (2 reqs) + exposed_endpoints (~25 reqs)
        _register("http://example.com", httpx_mock, count=2)
        _register_paths("http://example.com", httpx_mock)
        result = await run_all_checks("example.com:80", "headers")
        assert isinstance(result, list)

    async def test_run_all_checks_ssl(self):
        result = await run_all_checks("example.com:443", "ssl")
        assert isinstance(result, list)

    async def test_run_all_checks_full(self, httpx_mock: HTTPXMock):
        # full runs: security_headers + info_disclosure + technology (3 reqs to base)
        # + exposed_endpoints (~25 reqs to paths) + SSL check (1 req to https)
        _register("http://example.com:443", httpx_mock, count=3)
        _register_paths("http://example.com:443", httpx_mock)
        httpx_mock.add_response(
            url="https://example.com:443", status_code=200, headers={}
        )
        result = await run_all_checks("example.com:443", "full")
        assert isinstance(result, list)
