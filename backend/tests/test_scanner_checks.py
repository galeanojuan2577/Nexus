from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from nexus.scanner.checks import (
    check_security_headers,
    check_technology,
    run_all_checks,
)


class TestScannerChecks:
    async def test_check_security_headers_full(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(
            status_code=200,
            headers={
                "Strict-Transport-Security": "max-age=31536000",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Content-Security-Policy": "default-src 'self'",
            },
        )
        result = await check_security_headers("http://example.com")
        assert len(result) > 0
        assert all(r["check_type"] == "security_headers" for r in result)

    async def test_check_security_headers_missing(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200, headers={})
        result = await check_security_headers("http://example.com")
        titles = [r["title"] for r in result]
        assert "Missing Strict-Transport-Security" in titles

    async def test_check_security_headers_timeout(self, httpx_mock: HTTPXMock):
        httpx_mock.add_exception(TimeoutError("timeout"))
        result = await check_security_headers("http://example.com")
        assert result == []

    async def test_check_technology_cloudflare(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(
            status_code=200,
            headers={
                "server": "cloudflare",
                "cf-ray": "12345",
            },
        )
        result = await check_technology("http://example.com")
        titles = [r["title"] for r in result]
        assert "Cloudflare" in str(titles) or "cloudflare" in str(titles).lower()

    async def test_check_technology_nginx(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(
            status_code=200,
            headers={"server": "nginx/1.24.0"},
        )
        result = await check_technology("http://example.com")
        titles = [r["title"] for r in result]
        assert any("nginx" in t.lower() for t in titles) or len(result) > 0

    async def test_check_technology_no_server(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200, headers={})
        result = await check_technology("http://example.com")
        assert isinstance(result, list)

    async def test_run_all_checks_quick(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200, headers={})
        result = await run_all_checks("example.com", "quick")
        assert isinstance(result, list)

    async def test_run_all_checks_headers(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200, headers={})
        result = await run_all_checks("example.com:80", "headers")
        assert isinstance(result, list)

    async def test_run_all_checks_ssl(self):
        result = await run_all_checks("example.com:443", "ssl")
        assert isinstance(result, list)

    async def test_run_all_checks_full(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200, headers={})
        result = await run_all_checks("example.com:443", "full")
        assert isinstance(result, list)
