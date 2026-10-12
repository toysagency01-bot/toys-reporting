"""Read-only Google Ads hierarchy delivery to the TOYS reporting receiver."""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import threading
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from .google_ads import GoogleAdsClient, GoogleAdsError

RECEIVER = "https://toys-agency-platform-staging.denys-shpodaris.workers.dev/api/internal/google-ads/v1/pages"
AUDIENCE = "https://toys-meta-media-buyer-ir6ahhggha-ew.a.run.app"
RUNTIME_EMAIL = "toys-meta-buyer-runtime@toys-codex-media-buyer.iam.gserviceaccount.com"
CUSTOMERS = ("2662445825", "9632942627")
LEVELS = ("campaign", "ad_group", "ad")
PAGE_SIZE = 200
DELIVERY_LOCK = threading.Lock()


def scheduler_authorized(authorization: str) -> bool:
    if not authorization.startswith("Bearer ") or len(authorization) > 16384:
        return False
    try:
        claims = id_token.verify_oauth2_token(authorization[7:], Request(), audience=AUDIENCE)
        return claims.get("email") == RUNTIME_EMAIL and claims.get("email_verified") is True
    except Exception:
        return False


def decimal_text(value: Any, *, integer: bool = False) -> str:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise GoogleAdsError("Invalid numeric reporting metric.") from None
    if not number.is_finite() or number < 0 or (integer and number != number.to_integral()):
        raise GoogleAdsError("Unsupported numeric reporting metric.")
    return format(number, "f") if not integer else str(int(number))


def entity(raw: dict[str, Any]) -> dict[str, Any]:
    identity = str(raw.get("id", ""))
    if not re.fullmatch(r"[0-9]+", identity):
        raise GoogleAdsError("Missing reporting entity identity.")
    return {"id": identity, "name": str(raw.get("name", "")), "status": raw.get("status")}


def period(account: dict[str, Any], params: dict[str, Any]) -> tuple[str, str]:
    today = datetime.now(ZoneInfo(account["time_zone"])).date()
    if set(params) - {"from", "to"} or (bool(params.get("from")) != bool(params.get("to"))):
        raise GoogleAdsError("Use both from and to, or an empty object.")
    start = date.fromisoformat(params["from"]) if params.get("from") else today - timedelta(days=89)
    end = date.fromisoformat(params["to"]) if params.get("to") else today
    if start > end or (end - start).days >= 90 or end > today:
        raise GoogleAdsError("Reporting period must be 1–90 days and cannot end in the future.")
    return start.isoformat(), end.isoformat()


async def hierarchy(client: GoogleAdsClient, account: dict[str, Any], start: str, end: str) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for level in LEVELS:
        fields = ["segments.date", "campaign.id", "campaign.name", "campaign.status"]
        if level != "campaign":
            fields += ["ad_group.id", "ad_group.name", "ad_group.status"]
        if level == "ad":
            fields += ["ad_group_ad.ad.id", "ad_group_ad.ad.name", "ad_group_ad.status", "ad_group_ad.ad.type", "ad_group_ad.ad.final_urls"]
        fields += ["metrics.impressions", "metrics.clicks", "metrics.cost_micros", "metrics.conversions", "metrics.conversions_value"]
        resource = "ad_group_ad" if level == "ad" else level
        # Include removed entities: historical delivery still belongs in totals.
        query = f"SELECT {', '.join(fields)} FROM {resource} WHERE segments.date BETWEEN '{start}' AND '{end}'"
        chunks = await client._request("POST", f"customers/{account['id']}/googleAds:searchStream", payload={"query": query})
        if not isinstance(chunks, list) or any(not isinstance(c, dict) or "error" in c or not isinstance(c.get("results", []), list) for c in chunks):
            raise GoogleAdsError("Incomplete Google reporting stream.")
        for chunk in chunks:
            for raw in chunk.get("results", []):
                metrics = raw.get("metrics", {})
                day = str(raw.get("segments", {}).get("date", ""))
                if not start <= day <= end or date.fromisoformat(day).isoformat() != day:
                    raise GoogleAdsError("Reporting date escaped the requested period.")
                ad_group_ad = raw.get("adGroupAd", {})
                ad = ad_group_ad.get("ad", {})
                urls = ad.get("finalUrls", [])
                if not isinstance(urls, list) or any(not isinstance(u, str) or not u.startswith("https://") for u in urls):
                    raise GoogleAdsError("Unsupported creative destination URL.")
                normalized = {
                    "level": level, "date": day, "campaign": entity(raw.get("campaign", {})),
                    "adGroup": entity(raw.get("adGroup", {})) if level != "campaign" else None,
                    "ad": entity({**ad, "status": ad_group_ad.get("status")}) if level == "ad" else None,
                    "creative": {"ref": f"google-ad:{ad.get('id')}", "type": ad.get("type"), "finalUrls": urls} if level == "ad" else None,
                    "metrics": {key: decimal_text(metrics.get(source, 0), integer=integer) for key, source, integer in (
                        ("impressions", "impressions", True), ("clicks", "clicks", True), ("costMicros", "costMicros", True),
                        ("conversions", "conversions", False), ("conversionValue", "conversionsValue", False))},
                }
                if level == "ad" and not normalized["creative"]["type"]:
                    raise GoogleAdsError("Missing creative type.")
                rows.append(normalized)
    def key(row: dict[str, Any]) -> tuple:
        return (row["date"], LEVELS.index(row["level"]), int(row["campaign"]["id"]), int((row["adGroup"] or {}).get("id", 0)), int((row["ad"] or {}).get("id", 0)))
    rows.sort(key=key)
    if len({key(row) for row in rows}) != len(rows):
        raise GoogleAdsError("Duplicate Google reporting rows.")
    snapshot = {
        "schemaVersion": "toys-google-ads-readonly-hierarchy/1", "readOnly": True, "writesEnabled": False,
        "provider": "google_ads", "apiVersion": "v25", "loginCustomerId": "7753894623",
        "customer": {"id": account["id"], "manager": False, "currencyCode": account["currency"], "timeZone": account["time_zone"]},
        "range": {"from": start, "to": end},
        "coverage": {level: {"complete": True, "totalRows": sum(r["level"] == level for r in rows)} for level in LEVELS},
        "rows": rows,
    }
    # Identical content can be re-delivered idempotently with identical pages.
    snapshot["snapshotId"] = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return snapshot


def pages(snapshot: dict[str, Any]):
    rows = snapshot["rows"]
    for offset in range(0, max(1, len(rows)), PAGE_SIZE):
        part = rows[offset:offset + PAGE_SIZE]
        next_offset = offset + len(part)
        page = {**snapshot, "rows": part, "page": {"offset": offset, "pageSize": PAGE_SIZE, "returnedRows": len(part), "totalRows": len(rows), "nextCursor": str(next_offset) if next_offset < len(rows) else None}}
        if len(json.dumps(page, ensure_ascii=False).encode()) > 950_000:
            raise GoogleAdsError("Reporting page exceeds receiver size limit.")
        yield page


async def deliver(snapshot: dict[str, Any], transport: httpx.AsyncClient, token: str) -> dict[str, Any]:
    result = {}
    for page in pages(snapshot):
        for attempt in range(3):
            try:
                response = await transport.post(RECEIVER, json=page, headers={"Authorization": f"Bearer {token}"})
                if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    await asyncio.sleep(attempt + 1)
                    continue
                if response.is_error:
                    raise GoogleAdsError(f"Reporting receiver returned HTTP {response.status_code}.")
                result = response.json()
                break
            except httpx.TransportError:
                if attempt == 2:
                    raise GoogleAdsError("Reporting receiver is unreachable.") from None
                await asyncio.sleep(attempt + 1)
        if result.get("snapshotId") != snapshot["snapshotId"] or result.get("customerId") != snapshot["customer"]["id"]:
            raise GoogleAdsError("Reporting receiver acknowledgement scope mismatch.")
        expected_offset = page["page"]["offset"] + page["page"]["returnedRows"]
        if result.get("nextExpectedOffset", -1) < expected_offset:
            raise GoogleAdsError("Reporting receiver did not persist the page.")
    if result.get("accepted") is not True or result.get("persistedRows") != len(snapshot["rows"]):
        raise GoogleAdsError("Reporting receiver did not accept the complete snapshot.")
    return {key: result.get(key) for key in ("accepted", "snapshotId", "projectSlug", "customerId", "range", "totalRows", "persistedRows", "acceptedAt")}


async def run_reporting(settings: Any, params: dict[str, Any]) -> dict[str, Any]:
    if settings.google_ads_login_customer_id.replace("-", "") != "7753894623" or settings.google_ads_api_version != "v25":
        raise GoogleAdsError("Google reporting requires the configured MCC 7753894623 and API v25.")
    client = GoogleAdsClient(developer_token=settings.google_ads_developer_token, login_customer_id=settings.google_ads_login_customer_id, api_version="v25", writes_enabled=False)
    results = []
    try:
        accounts = await client.accounts()
        for customer_id in CUSTOMERS:
            try:
                account = next((a for a in accounts if a["id"] == customer_id and not a["manager"] and a["status"] == "ENABLED"), None)
                if account is None:
                    raise GoogleAdsError("Reporting customer is not accessible under the configured MCC.")
                start, end = period(account, params)
                snapshot = await hierarchy(client, account, start, end)
                token = await asyncio.to_thread(id_token.fetch_id_token, Request(), RECEIVER)
                async with httpx.AsyncClient(timeout=60, follow_redirects=False) as transport:
                    results.append(await deliver(snapshot, transport, token))
            except Exception as exc:
                # Do not serialize SDK errors, request headers or upstream payloads.
                results.append({"customerId": customer_id, "accepted": False, "error": str(exc) if isinstance(exc, GoogleAdsError) and str(exc).startswith(("Reporting", "Google reporting", "Incomplete", "Unsupported", "Missing", "Duplicate", "Invalid")) else "Google reporting failed; check provider access and configuration.", "type": type(exc).__name__})
    finally:
        await client.close()
    return {"ok": all(r.get("accepted") is True for r in results), "customers": results}
