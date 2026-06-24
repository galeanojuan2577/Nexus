from __future__ import annotations

import pytest

from nexus.ai.analyzer import AIAnalyzer


class TestAIAnalyzer:
    async def test_analyze_findings_llm_failure(self, monkeypatch):
        async def mock_ainvoke(*args, **kwargs):
            msg = args[0] if args else kwargs.get("prompt", "")
            raise ConnectionError("Ollama not available")

        monkeypatch.setattr(
            "nexus.ai.analyzer.OllamaLLM.ainvoke", mock_ainvoke
        )
        analyzer = AIAnalyzer()
        result = await analyzer.analyze_findings(
            [{"id": "1", "check_type": "ssl", "severity": "high", "title": "Bad TLS"}]
        )
        assert result["overall_risk"] == "unknown"
        assert result["top_remediation"] == "AI analysis unavailable - review manually"

    async def test_analyze_findings_parse_fallback(self, monkeypatch):
        async def mock_ainvoke(*args, **kwargs):
            return "this is not JSON at all"

        monkeypatch.setattr(
            "nexus.ai.analyzer.OllamaLLM.ainvoke", mock_ainvoke
        )
        analyzer = AIAnalyzer()
        result = await analyzer.analyze_findings(
            [{"id": "f1", "check_type": "header", "severity": "medium", "title": "Missing header"}]
        )
        assert result["overall_risk"] == "medium"
        assert "f1" in result["priority_order"]

    async def test_detect_anomalies_llm_failure(self, monkeypatch):
        async def mock_ainvoke(*args, **kwargs):
            raise ConnectionError("Ollama not available")

        monkeypatch.setattr(
            "nexus.ai.analyzer.OllamaLLM.ainvoke", mock_ainvoke
        )
        analyzer = AIAnalyzer()
        result = await analyzer.detect_anomalies(
            {"name": "test", "host": "example.com", "status": "online"},
            [{"alert_type": "downtime", "severity": "critical", "title": "DOWN", "resolved": False}],
        )
        assert result["device_health"] == "unknown"
        assert result["anomalies"] == []

    async def test_detect_anomalies_parse_fallback(self, monkeypatch):
        async def mock_ainvoke(*args, **kwargs):
            return "not json"

        monkeypatch.setattr(
            "nexus.ai.analyzer.OllamaLLM.ainvoke", mock_ainvoke
        )
        analyzer = AIAnalyzer()
        result = await analyzer.detect_anomalies(
            {"name": "test", "host": "example.com", "status": "online"},
            [],
        )
        assert result["device_health"] == "unknown"

    async def test_chat_failure(self, monkeypatch):
        async def mock_ainvoke(*args, **kwargs):
            raise ConnectionError("Ollama not available")

        monkeypatch.setattr(
            "nexus.ai.analyzer.OllamaLLM.ainvoke", mock_ainvoke
        )
        analyzer = AIAnalyzer()
        result = await analyzer.chat("Hello, Nexus")
        assert result == "AI service is currently unavailable."

    async def test_chat_with_context_failure(self, monkeypatch):
        async def mock_ainvoke(*args, **kwargs):
            raise ConnectionError("Ollama not available")

        monkeypatch.setattr(
            "nexus.ai.analyzer.OllamaLLM.ainvoke", mock_ainvoke
        )
        analyzer = AIAnalyzer()
        result = await analyzer.chat("Analyze this", context='{"test": "data"}')
        assert result == "AI service is currently unavailable."
