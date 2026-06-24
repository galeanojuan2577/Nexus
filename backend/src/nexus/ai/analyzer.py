from __future__ import annotations

import json
import logging

from langchain_ollama import OllamaLLM

from nexus.core.config import settings

logger = logging.getLogger(__name__)


class AIAnalyzer:
    def __init__(self):
        self.llm = OllamaLLM(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            temperature=0.1,
        )

    async def analyze_findings(self, findings: list[dict]) -> dict:
        prompt = (
            "You are a security analyst. Analyze the following findings "
            "and provide a JSON response with:\n"
            "- overall_risk: critical|high|medium|low\n"
            "- priority_order: list of finding IDs ordered by priority\n"
            "- top_remediation: single most important action to take\n\n"
            f"Findings: {json.dumps(findings, indent=2)}"
        )
        try:
            response = await self.llm.ainvoke(prompt)
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            return {
                "overall_risk": "medium",
                "priority_order": [f.get("id") for f in findings],
                "top_remediation": "Review findings manually",
            }
        except Exception as e:
            logger.error("AI analysis failed: %s", e)
            return {
                "overall_risk": "unknown",
                "priority_order": [],
                "top_remediation": "AI analysis unavailable - review manually",
            }

    async def detect_anomalies(
        self, device: dict, recent_alerts: list[dict]
    ) -> dict:
        prompt = (
            "You are a site reliability engineer. Analyze the following "
            "device monitoring data and recent alerts for anomalies.\n\n"
            f"Device: {json.dumps(device, indent=2)}\n"
            f"Recent alerts: {json.dumps(recent_alerts, indent=2)}\n\n"
            "Respond with JSON:\n"
            "- anomalies: list of objects with severity (critical|high|medium|low), "
            "metric, description, recommendation\n"
            "- device_health: healthy|degraded|unhealthy\n"
            "- summary: one-line summary of the analysis\n\n"
            "Look for: response time degradation, flapping (frequent up/down), "
            "unusual alert patterns, prolonged downtime."
        )
        try:
            response = await self.llm.ainvoke(prompt)
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            return {
                "anomalies": [],
                "device_health": "unknown",
                "summary": "Could not parse AI response",
            }
        except Exception as e:
            logger.error("Anomaly detection failed: %s", e)
            return {
                "anomalies": [],
                "device_health": "unknown",
                "summary": "Anomaly detection unavailable",
            }

    async def chat(self, message: str, context: str | None = None) -> str:
        system = (
            "You are Nexus AI, a security and operations assistant. "
            "Answer concisely and factually."
        )
        if context:
            system += f"\n\nContext from scan results:\n{context}"
        prompt = f"{system}\n\nUser: {message}\nAssistant:"
        try:
            return await self.llm.ainvoke(prompt)
        except Exception as e:
            logger.error("AI chat failed: %s", e)
            return "AI service is currently unavailable."
