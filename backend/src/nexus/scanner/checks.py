from __future__ import annotations

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

CHECK_TIMEOUT = 30
USER_AGENT = "NEXUS-Scanner/1.0"

EXPOSED_PATHS = [
    "/.env",
    "/.git/config",
    "/admin",
    "/api",
    "/api/docs",
    "/api/v1",
    "/api/v2",
    "/backup",
    "/config",
    "/console",
    "/dashboard",
    "/debug",
    "/docs",
    "/graphql",
    "/health",
    "/info",
    "/logs",
    "/phpinfo.php",
    "/robots.txt",
    "/server-status",
    "/sitemap.xml",
    "/swagger.json",
    "/test",
    "/wp-admin",
    "/wp-json",
]

TECHNOLOGY_PATTERNS: list[tuple[str, str, str]] = [
    (r"cloudflare", "Cloudflare", "header"),
    (r"server:.*nginx", "Nginx", "header"),
    (r"server:.*apache", "Apache HTTP Server", "header"),
    (r"server:.*iis", "Microsoft IIS", "header"),
    (r"x-powered-by:.*php", "PHP", "header"),
    (r"x-powered-by:.*express", "Express.js", "header"),
    (r"x-powered-by:.*asp\.net", "ASP.NET", "header"),
    (r"x-generator:.*drupal", "Drupal", "header"),
    (r"x-generator:.*wordpress", "WordPress", "header"),
    (r"<meta[^>]+generator[^>]+joomla", "Joomla", "html"),
    (r"<meta[^>]+generator[^>]+drupal", "Drupal", "html"),
    (r"<meta[^>]+generator[^>]+wordpress", "WordPress", "html"),
    (r"react", "React", "html"),
    (r"vue", "Vue.js", "html"),
    (r"angular", "Angular", "html"),
    (r"next\.js", "Next.js", "html"),
    (r"nuxt", "Nuxt.js", "html"),
    (r"jquery", "jQuery", "html"),
    (r"bootstrap", "Bootstrap", "html"),
    (r"tailwindcss", "Tailwind CSS", "html"),
    (r"vite", "Vite", "html"),
    (r"webpack", "Webpack", "html"),
    (r"django", "Django", "header"),
    (r"rails", "Ruby on Rails", "header"),
    (r"laravel", "Laravel", "header"),
]

KNOWN_CVES: list[dict[str, Any]] = [
    {
        "id": "CVE-2023-44487",
        "software": "HTTP/2",
        "severity": "high",
        "title": "HTTP/2 Rapid Reset Attack",
        "description": "HTTP/2 protocol vulnerable to DDoS via rapid stream resets",
    },
    {
        "id": "CVE-2023-38153",
        "software": "Apache HTTP Server",
        "severity": "high",
        "title": "Apache HTTP Server Chunked Encoding Vulnerability",
        "description": "Apache HTTP Server vulnerable to request smuggling via chunked encoding",
    },
    {
        "id": "CVE-2023-27535",
        "software": "Nginx",
        "severity": "high",
        "title": "Nginx HTTP/2 Heap Buffer Overflow",
        "description": "Nginx HTTP/2 module vulnerable to heap buffer overflow",
    },
    {
        "id": "CVE-2024-2961",
        "software": "PHP",
        "severity": "critical",
        "title": "PHP Remote Code Execution via iconv",
        "description": "PHP iconv function allows remote code execution",
    },
    {
        "id": "CVE-2024-3094",
        "software": "OpenSSH",
        "severity": "critical",
        "title": "OpenSSH Remote Code Execution (xz backdoor)",
        "description": "Critical RCE vulnerability in OpenSSH via compromised xz utils",
    },
]


async def fetch_url(url: str) -> httpx.Response | None:
    try:
        async with httpx.AsyncClient(
            timeout=CHECK_TIMEOUT, verify=False, follow_redirects=True
        ) as client:
            return await client.get(url, headers={"User-Agent": USER_AGENT})
    except Exception as e:
        logger.debug("fetch_url failed for %s: %s", url, e)
        return None


async def check_security_headers(url: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    resp = await fetch_url(url)
    if not resp:
        return findings

    headers = {k.lower(): v for k, v in resp.headers.items()}
    checks: list[tuple[str, str, str, str, str]] = [
        (
            "strict-transport-security",
            "Missing Strict-Transport-Security",
            "HSTS forces HTTPS connections, preventing MITM attacks",
            "Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains",
            "medium",
        ),
        (
            "content-security-policy",
            "Missing Content-Security-Policy",
            "CSP prevents XSS and data injection attacks",
            "Add header: Content-Security-Policy: default-src 'self'",
            "medium",
        ),
        (
            "x-content-type-options",
            "Missing X-Content-Type-Options",
            "Prevents MIME-type sniffing attacks",
            "Add header: X-Content-Type-Options: nosniff",
            "medium",
        ),
        (
            "x-frame-options",
            "Missing X-Frame-Options",
            "Prevents clickjacking attacks",
            "Add header: X-Frame-Options: DENY or SAMEORIGIN",
            "medium",
        ),
        (
            "x-xss-protection",
            "Missing X-XSS-Protection",
            "Enables browser XSS filter",
            "Add header: X-XSS-Protection: 1; mode=block",
            "low",
        ),
        (
            "referrer-policy",
            "Missing Referrer-Policy",
            "Controls referrer information leakage",
            "Add header: Referrer-Policy: strict-origin-when-cross-origin",
            "low",
        ),
        (
            "permissions-policy",
            "Missing Permissions-Policy",
            "Restricts browser API access",
            "Add header: Permissions-Policy: geolocation=(), microphone=(), camera=()",
            "low",
        ),
    ]
    for h, title, desc, remediation, severity in checks:
        if h not in headers:
            findings.append(
                {
                    "check_type": "security_headers",
                    "severity": severity,
                    "title": title,
                    "description": desc,
                    "remediation": remediation,
                    "raw_data": str({"missing_header": h}),
                }
            )
    return findings


async def check_exposed_endpoints(base_url: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for path in EXPOSED_PATHS:
        url = f"{base_url.rstrip('/')}{path}"
        resp = await fetch_url(url)
        if resp is None:
            continue
        if resp.status_code < 400:
            high_risk = ("/.env", "/.git/config", "/phpinfo.php", "/config")
            severity = (
                "high" if path in high_risk
                else "medium" if resp.status_code == 200
                else "low"
            )
            findings.append(
                {
                    "check_type": "exposed_endpoints",
                    "severity": severity,
                    "title": f"Exposed endpoint: {path}",
                    "description": f"Endpoint {path} returned HTTP {resp.status_code}",
                    "remediation": "Restrict access to this endpoint or remove if unnecessary",
                    "raw_data": str({"path": path, "status": resp.status_code}),
                }
            )
    return findings


async def check_info_disclosure(url: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    resp = await fetch_url(url)
    if not resp:
        return findings

    headers = resp.headers
    if "server" in headers:
        server = headers["server"]
        findings.append(
            {
                "check_type": "info_disclosure",
                "severity": "low",
                "title": "Server information disclosure",
                "description": f"Server header exposes: {server}",
                "remediation": "Remove or obfuscate the Server header",
                "raw_data": str({"header": "server", "value": server}),
            }
        )
    if "x-powered-by" in headers:
        findings.append(
            {
                "check_type": "info_disclosure",
                "severity": "low",
                "title": "X-Powered-By information disclosure",
                "description": f"X-Powered-By header exposes: {headers['x-powered-by']}",
                "remediation": "Remove the X-Powered-By header",
                "raw_data": str({"header": "x-powered-by", "value": headers["x-powered-by"]}),
            }
        )
    return findings


async def check_technology(url: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    resp = await fetch_url(url)
    if not resp:
        return findings

    body = resp.text.lower() if resp.text else ""
    headers_text = "\n".join(f"{k}: {v}" for k, v in resp.headers.items()).lower()
    combined = headers_text + " " + body
    detected: set[str] = set()

    for pattern, name, source in TECHNOLOGY_PATTERNS:
        if re.search(pattern, combined):
            detected.add(name)

    for tech in sorted(detected):
        findings.append(
            {
                "check_type": "technology_detection",
                "severity": "info",
                "title": f"Technology detected: {tech}",
                "description": f"The target appears to be running {tech}",
                "remediation": "Ensure all software is up to date with latest security patches",
                "raw_data": str({"technology": tech}),
            }
        )

    for cve in KNOWN_CVES:
        if cve["software"] in detected:
            findings.append(
                {
                    "check_type": "cve_detection",
                    "severity": cve["severity"],
                    "title": f"CVE: {cve['id']} — {cve['title']}",
                    "description": f"{cve['description']}. Affects: {cve['software']}",
                    "remediation": f"Apply vendor patch for {cve['id']}",
                    "raw_data": str({"cve": cve["id"], "software": cve["software"]}),
                }
            )

    return findings


async def check_sqli(url: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    payloads = ["'", "\"", "';--", "' OR '1'='1", "\" OR \"1\"=\"1"]
    error_patterns = [r"sql\s+error", r"mysql_fetch", r"ora-[0-9]{5}", r"sqlite", r"postgresql"]

    for payload in payloads:
        test_url = f"{url}?id={payload}"
        resp = await fetch_url(test_url)
        if resp is None:
            continue
        body_lower = (resp.text or "").lower()
        for pattern in error_patterns:
            if re.search(pattern, body_lower):
                findings.append(
                    {
                        "check_type": "sqli",
                        "severity": "high",
                        "title": "Potential SQL Injection vulnerability",
                        "description": (
                            f"Parameter 'id' with payload '{payload}' "
                            "triggered database error"
                        ),
                        "remediation": "Use parameterized queries and input validation",
                        "raw_data": str({"payload": payload, "evidence": pattern}),
                    }
                )
                return findings  # one finding is enough
    return findings


async def run_all_checks(target: str, scan_type: str) -> list[dict[str, Any]]:
    scheme = "https" if target.startswith("https") else "http"
    base_url = target if target.startswith("http") else f"{scheme}://{target}"

    findings: list[dict[str, Any]] = []

    if scan_type in ("full", "headers", "quick"):
        findings.extend(await check_security_headers(base_url))
        findings.extend(await check_info_disclosure(base_url))

    if scan_type in ("full", "headers"):
        findings.extend(await check_exposed_endpoints(base_url))

    if scan_type in ("full", "quick"):
        findings.extend(await check_technology(base_url))

    if scan_type in ("full", "ssl"):
        scheme_url = base_url.replace("http://", "https://")
        if scheme_url != base_url:
            findings.extend(await check_security_headers(scheme_url))

    return findings
