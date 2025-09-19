# app.py — Hidden Stroke (AI Noir Investigation) with verbose logging
# Flask + Firebase Realtime DB + Firebase Storage + Gemini
# Envs required: FIREBASE, Firebase_DB, Firebase_Storage, Gemini
# Optional envs: GAME_SALT, ADMIN_KEY, IA_USER_AGENT, MIN_IA_POOL, IA_QUERY,
#                BOOTSTRAP_IA, LOG_LEVEL, ALLOW_DEV_BOOTSTRAP, ALLOW_DEV_DIAGNOSTICS

import os, io, uuid, json, hmac, hashlib, random, traceback, requests, re, hashlib as _hash
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple, List, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

# ----- Logging ---------------------------------------------------------------
import logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "DEBUG").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.DEBUG),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
log = logging.getLogger("hidden_stroke")

# ---------------- Firebase Admin (Realtime DB + Storage) ----------------
import firebase_admin
from firebase_admin import credentials, db, storage

# ---------------- Gemini (exact client & model names) -------------------
from google import genai
from google.genai import types

# -----------------------------------------------------------------------------
# 1) CONFIG & INIT
# -----------------------------------------------------------------------------
app = Flask(__name__)
CORS(app,
     resources={r"/*": {"origins": "*"}},
     supports_credentials=False,
     methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "X-Reddit-User", "X-Reddit-Id"])


# --- Firebase ---
try:
    credentials_json_string = os.environ.get("FIREBASE")
    if not credentials_json_string:
        raise ValueError("The FIREBASE environment variable is not set.")

    credentials_json = json.loads(credentials_json_string)
    firebase_db_url = os.environ.get("Firebase_DB")
    firebase_storage_bucket = os.environ.get("Firebase_Storage")
    if not firebase_db_url or not firebase_storage_bucket:
        raise ValueError("Firebase_DB and Firebase_Storage environment variables must be set.")

    cred = credentials.Certificate(credentials_json)
    firebase_admin.initialize_app(cred, {
        'databaseURL': firebase_db_url,
        'storageBucket': firebase_storage_bucket
    })
    bucket = storage.bucket()
    db_root = db.reference("/")
    log.info("Firebase Realtime DB + Storage initialized.")
except Exception:
    log.exception("FATAL: Firebase init failed")
    raise

# --- Gemini ---
try:
    GEMINI_API_KEY = os.environ.get("Gemini")
    if not GEMINI_API_KEY:
        raise ValueError("The 'Gemini' environment variable is not set.")
    client = genai.Client(api_key=GEMINI_API_KEY)
    log.info("Gemini client initialized.")
except Exception:
    log.exception("FATAL: Gemini init failed")
    raise

# --- Models (exact names) ---
CATEGORY_MODEL = "gemini-2.5-flash"
GENERATION_MODEL = "gemini-2.0-flash-exp-image-generation"

# --- Game constants ---
TIMER_SECONDS = 90
INITIAL_IP = 8
TOOL_COSTS = {"signature": 1, "metadata": 1, "financial": 2}
LEADERBOARD_TOP_N = 50

# --- Misc config ---
GAME_SALT = os.environ.get("GAME_SALT", "dev-salt")
ADMIN_KEY = os.environ.get("ADMIN_KEY")
IA_USER_AGENT = os.environ.get("IA_USER_AGENT", "HiddenStrokeBot/1.0 (+https://reddit.com)")
MIN_IA_POOL = int(os.environ.get("MIN_IA_POOL", "60"))
DEFAULT_IA_QUERY = os.environ.get(
    "IA_QUERY",
    '(collection:(metropolitanmuseum OR smithsonian OR getty OR artic) AND mediatype:image)'
)
ALLOW_DEV_BOOTSTRAP = os.environ.get("ALLOW_DEV_BOOTSTRAP", "0") == "1"
ALLOW_DEV_DIAGNOSTICS = os.environ.get("ALLOW_DEV_DIAGNOSTICS", "0") == "1"

FALLBACK_IA_QUERIES = [
    '(mediatype:image AND (format:JPEG OR format:PNG))',
    '(mediatype:image AND (format:JPEG OR format:PNG) AND (subject:portrait OR title:portrait))',
    '(mediatype:image AND format:JPEG)',
]

# -----------------------------------------------------------------------------
# 2) UTILS
# -----------------------------------------------------------------------------
def utc_today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")

def case_ref(case_id: str):
    return db_root.child(f"cases/{case_id}")

def plays_ref(case_id: str):
    return db_root.child(f"plays/{case_id}")

def leaderboard_ref(case_id: str):
    return db_root.child(f"leaderboards/{case_id}/top")

def sessions_ref():
    return db_root.child("sessions")

def ia_pool_ref():
    return db_root.child("ia_pool")

def hmac_hex(s: str) -> str:
    return hmac.new(GAME_SALT.encode(), s.encode(), hashlib.sha256).hexdigest()

# Firebase RTDB key sanitizer (no . $ # [ ] / or control chars)
_FB_BAD = re.compile(r'[.$#\[\]/\x00-\x1F\x7F]')

def fb_key(raw: str) -> str:
    safe = _FB_BAD.sub('_', raw or '')
    if len(safe) > 700:
        safe = safe[:700]
    if safe != raw:
        suffix = _hash.sha1((raw or '').encode('utf-8')).hexdigest()[:8]
        safe = f"{safe}__{suffix}"
    return safe or _hash.sha1(b'empty').hexdigest()[:8]

def upload_bytes_to_storage(data: bytes, path: str, content_type: str) -> str:
    log.debug(f"Uploading to Storage: path={path}, content_type={content_type}, bytes={len(data)}")
    blob = bucket.blob(path)
    blob.upload_from_string(data, content_type=content_type)
    blob.make_public()
    url = blob.public_url
    log.debug(f"Uploaded: {url}")
    return url

def pil_from_inline_image_part(part) -> Image.Image:
    image_bytes = part.inline_data.data
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")

def save_image_return_url(img: Image.Image, path: str, quality=92) -> str:
    b = io.BytesIO()
    img.save(b, format="JPEG", quality=quality, optimize=True)
    return upload_bytes_to_storage(b.getvalue(), path, "image/jpeg")

def extract_user_from_headers(req) -> Tuple[str, str]:
    uname = (req.headers.get("X-Reddit-User") or "").strip()
    uid = (req.headers.get("X-Reddit-Id") or "").strip()
    if not uname:
        uname = "anon"
    if not uid:
        uid = uname
    return uid, uname

def seed_for_date(case_id: str) -> int:
    return int(hmac_hex(f"seed::{case_id}")[:12], 16)

def fifty_fifty_mode(case_seed: int) -> str:
    return "knowledge" if (case_seed % 2 == 0) else "observation"

def http_get_json(url: str, params: dict = None) -> dict:
    log.debug(f"HTTP GET JSON: {url} params={params}")
    headers = {"User-Agent": IA_USER_AGENT}
    r = requests.get(url, params=params, headers=headers, timeout=30)
    log.debug(f"HTTP {r.status_code} for {r.url}")
    r.raise_for_status()
    return r.json()

def http_get_bytes(url: str) -> bytes:
    log.debug(f"HTTP GET BYTES: {url}")
    headers = {"User-Agent": IA_USER_AGENT}
    r = requests.get(url, headers=headers, timeout=60)
    log.debug(f"HTTP {r.status_code} for {r.url} bytes={len(r.content)}")
    r.raise_for_status()
    return r.content

def ia_advanced_search(query: str, rows: int, page: int) -> List[dict]:
    url = "https://archive.org/advancedsearch.php"
    params = {"q": query, "rows": rows, "page": page, "output": "json"}
    try:
        data = http_get_json(url, params=params)
        docs = data.get("response", {}).get("docs", [])
        log.info(f"IA search page={page} rows={rows} -> {len(docs)} docs")
        return docs
    except Exception:
        log.exception("IA advanced search failed")
        raise

def ia_metadata(identifier: str) -> dict:
    url = f"https://archive.org/metadata/{identifier}"
    try:
        meta = http_get_json(url)
        log.debug(f"Fetched metadata for {identifier}, files={len(meta.get('files', []) or [])}")
        return meta
    except Exception:
        log.exception(f"IA metadata fetch failed for {identifier}")
        raise

def ia_best_image_from_metadata(meta: dict) -> Optional[dict]:
    files = meta.get("files", []) or []
    best, best_pixels = None, -1
    for f in files:
        fmt = (f.get("format") or "").lower()
        if any(x in fmt for x in ["jpeg", "jpg", "png", "tiff", "image"]):
            w = int(f.get("width") or 0)
            h = int(f.get("height") or 0)
            px = w * h if (w and h) else int(f.get("size") or 0)
            if px > best_pixels:
                best_pixels, best = px, f
    if best:
        log.debug(f"Best image: name={best.get('name')} fmt={best.get('format')} dims={best.get('width')}x{best.get('height')} size={best.get('size')}")
    else:
        log.warning("No suitable image file found in metadata")
    return best

def ingest_ia_doc(doc: dict) -> Optional[dict]:
    """Fetch /metadata and store best image entry into ia_pool (sanitized key)."""
    identifier = doc.get("identifier")
    if not identifier:
        return None
    pool_key = fb_key(identifier)
    log.info(f"Ingesting IA identifier={identifier} -> pool_key={pool_key}")
    meta = ia_metadata(identifier)
    best = ia_best_image_from_metadata(meta)
    if not best:
        log.warning(f"Skipping {identifier}: no image file")
        return None

    md = meta.get("metadata", {}) or {}
    title = md.get("title", "") or doc.get("title", "")
    date = md.get("date", "") or doc.get("date", "")
    creator = md.get("creator", "") or doc.get("creator", "")
    rights = md.get("rights", "") or doc.get("rights", "")
    licenseurl = md.get("licenseurl", "") or doc.get("licenseurl", "")

    download_url = f"https://archive.org/download/{identifier}/{best['name']}"
    record = {
        "identifier": identifier,       # original IA id preserved
        "_pool_key": pool_key,          # sanitized RTDB key
        "title": title,
        "date": str(date),
        "creator": creator,
        "rights": rights,
        "licenseurl": licenseurl,
        "download_url": download_url,
        "file_name": best["name"],
        "format": best.get("format"),
        "width": best.get("width"),
        "height": best.get("height"),
        "size": best.get("size"),
        "source": "internet_archive"
    }
    ia_pool_ref().child(pool_key).set(record)
    log.info(f"Ingested {identifier} -> ia_pool/{pool_key} (title='{title}')")
    return record

def choose_ia_item_for_case(case_id: str) -> Optional[dict]:
    pool = ia_pool_ref().get() or {}
    if not pool:
        log.warning("choose_ia_item_for_case: pool is empty")
        return None
    keys = sorted(pool.keys())
    case_seed = seed_for_date(case_id)
    pool_key = keys[case_seed % len(keys)]
    log.info(f"Chosen IA pool_key for case {case_id}: {pool_key}")
    return pool[pool_key]

def download_image_to_pil(url: str) -> Image.Image:
    data = http_get_bytes(url)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    log.debug(f"Opened image from {url} size={img.size}")
    return img

def crop_signature_macro(img: Image.Image, size: int = 512) -> Image.Image:
    w, h = img.size
    cw = min(size, w)
    ch = min(size, h)
    left = max(0, w - cw)
    top = max(0, h - ch)
    log.debug(f"Signature crop from ({left},{top}) to ({left+cw},{top+ch})")
    return img.crop((left, top, left + cw, top + ch))

# -----------------------------------------------------------------------------
# 3) IA -> Firebase Storage caching + Zero-admin bootstrap
# -----------------------------------------------------------------------------
def _resize_if_needed(img: Image.Image, max_dim: int = 4096) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    if w >= h:
        new_w = max_dim
        new_h = int(h * (max_dim / w))
    else:
        new_h = max_dim
        new_w = int(w * (max_dim / h))
    log.debug(f"Resizing image from {w}x{h} to {new_w}x{new_h}")
    return img.resize((new_w, new_h), Image.LANCZOS)

def cache_single_ia_identifier(
    pool_key: str,
    overwrite: bool = False,
    max_dim: int = 4096,
    jpeg_quality: int = 90,
    skip_if_restricted: bool = True,
) -> dict:
    rec_ref = ia_pool_ref().child(pool_key)
    rec = rec_ref.get() or {}
    if not rec:
        return {"pool_key": pool_key, "stored": False, "reason": "not_in_pool"}

    identifier = rec.get("identifier") or pool_key
    rights = (rec.get("rights") or "").lower()
    if skip_if_restricted and ("in copyright" in rights or "all rights reserved" in rights):
        log.info(f"Skipping {identifier}: restricted rights")
        return {"pool_key": pool_key, "stored": False, "reason": "restricted_rights"}

    if rec.get("storage_url") and not overwrite:
        log.info(f"Skipping {identifier}: already cached")
        return {"pool_key": pool_key, "stored": False, "reason": "already_cached", "storage_url": rec["storage_url"]}

    source_url = rec.get("storage_url") or rec.get("download_url")
    if not source_url:
        log.warning(f"{identifier}: missing source_url")
        return {"pool_key": pool_key, "stored": False, "reason": "missing_source_url"}

    try:
        log.info(f"Caching {identifier} from {source_url}")
        img = download_image_to_pil(source_url)
    except Exception as e:
        if rec.get("download_url") and source_url != rec.get("download_url"):
            try:
                log.warning(f"Retrying {identifier} from IA download_url")
                img = download_image_to_pil(rec["download_url"])
            except Exception as e2:
                log.exception(f"{identifier}: download failed")
                return {"pool_key": pool_key, "stored": False, "reason": f"download_failed: {e2}"}
        else:
            log.exception(f"{identifier}: download failed")
            return {"pool_key": pool_key, "stored": False, "reason": f"download_failed: {e}"}

    img = _resize_if_needed(img, max_dim=max_dim)
    w, h = img.size

    # Upload original
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="JPEG", quality=jpeg_quality, optimize=True)
    img_bytes.seek(0)
    img_path = f"ia_cache/{pool_key}/original.jpg"
    storage_url = upload_bytes_to_storage(img_bytes.getvalue(), img_path, "image/jpeg")

    # Upload macro crop
    crop = crop_signature_macro(img, 512)
    crop_bytes = io.BytesIO()
    crop.save(crop_bytes, format="JPEG", quality=jpeg_quality, optimize=True)
    crop_bytes.seek(0)
    crop_path = f"ia_cache/{pool_key}/signature_crop.jpg"
    signature_crop_url = upload_bytes_to_storage(crop_bytes.getvalue(), crop_path, "image/jpeg")

    rec_update = {
        "storage_url": storage_url,
        "signature_crop_url": signature_crop_url,
        "image_path": img_path,
        "crop_path": crop_path,
        "width": w,
        "height": h,
        "cached_at": datetime.now(timezone.utc).isoformat()
    }
    rec_ref.update(rec_update)
    log.info(f"Cached {identifier} -> {storage_url}")

    return {
        "pool_key": pool_key,
        "stored": True,
        "storage_url": storage_url,
        "signature_crop_url": signature_crop_url,
        "width": w,
        "height": h
    }

def batch_cache_ia_pool(
    limit: int = 100,
    overwrite: bool = False,
    randomize: bool = True,
    min_width: int = 800,
    min_height: int = 800,
    max_dim: int = 4096,
    jpeg_quality: int = 90,
    skip_if_restricted: bool = True,
) -> dict:
    pool = ia_pool_ref().get() or {}
    log.info(f"batch_cache_ia_pool: pool_size={len(pool)}")
    if not pool:
        return {"ok": True, "processed": 0, "stored": 0, "skipped": 0, "results": []}

    candidates = []
    for pkey, rec in pool.items():
        if overwrite or not rec.get("storage_url"):
            w = int(rec.get("width") or 0)
            h = int(rec.get("height") or 0)
            if (w and h) and (w < min_width or h < min_height):
                log.debug(f"Skip {pkey}: too small {w}x{h}")
                continue
            candidates.append(pkey)

    if randomize:
        random.shuffle(candidates)
    candidates = candidates[:max(0, limit)]
    log.info(f"Caching candidates: {len(candidates)} (limit={limit})")

    results, stored, skipped = [], 0, 0
    for pkey in candidates:
        res = cache_single_ia_identifier(
            pkey,
            overwrite=overwrite,
            max_dim=max_dim,
            jpeg_quality=jpeg_quality,
            skip_if_restricted=skip_if_restricted,
        )
        results.append(res)
        if res.get("stored"):
            stored += 1
        else:
            skipped += 1

    log.info(f"batch_cache_ia_pool done: processed={len(candidates)} stored={stored} skipped={skipped}")
    return {"ok": True, "processed": len(candidates), "stored": stored, "skipped": skipped, "results": results}

def ensure_minimum_ia_pool(min_items: int = MIN_IA_POOL, rows: int = 100, max_pages: int = 5) -> dict:
    pool = ia_pool_ref().get() or {}
    have = len(pool)
    added = 0
    cached = 0
    log.info(f"ensure_minimum_ia_pool: have={have}, target={min_items}")

    candidate_queries = []
    if DEFAULT_IA_QUERY:
        candidate_queries.append(DEFAULT_IA_QUERY)
    candidate_queries.extend([q for q in FALLBACK_IA_QUERIES if q not in candidate_queries])

    for q in candidate_queries:
        if have + added >= min_items:
            break
        log.info(f"IA ingest: trying query: {q}")
        page = 1
        while have + added < min_items and page <= max_pages:
            try:
                docs = ia_advanced_search(q, rows=rows, page=page)
            except Exception:
                log.warning(f"IA search failed on page {page} for query {q!r}, moving on")
                break
            log.info(f"IA search page={page} -> {len(docs)} docs for query {q!r}")
            if not docs:
                break
            for d in docs:
                ident = d.get("identifier")
                if not ident:
                    continue
                if ia_pool_ref().child(fb_key(ident)).get():
                    continue
                try:
                    rec = ingest_ia_doc(d)
                    if rec:
                        added += 1
                except Exception:
                    log.exception(f"Ingest failed for {ident}")
                    continue
                if have + added >= min_items:
                    break
            page += 1

    pool = ia_pool_ref().get() or {}
    have_now = len(pool)
    need_cache = max(0, min_items - have_now)
    log.info(f"ensure_minimum_ia_pool: post-ingest have={have_now}, need_cache={need_cache}")
    if need_cache:
        res = batch_cache_ia_pool(limit=need_cache, randomize=True)
        cached = res.get("stored", 0)

    final_size = len(ia_pool_ref().get() or {})
    stats = {"ok": True, "had": have, "added": added, "cached": cached, "final_size": final_size}
    log.info(f"ensure_minimum_ia_pool: stats={stats}")
    return stats

# -----------------------------------------------------------------------------
# 4) CASE GENERATION (uses IA for authentic image, Gemini for forgeries/meta)
# -----------------------------------------------------------------------------
def ensure_case_generated(case_id: str) -> Dict[str, Any]:
    existing_public = case_ref(case_id).child("public").get()
    if existing_public:
        log.info(f"Case {case_id} already exists")
        return existing_public

    # Ensure we have a cached pool ready
    try:
        stats = ensure_minimum_ia_pool()
        log.debug(f"Bootstrap stats for case {case_id}: {stats}")
    except Exception:
        log.exception("Bootstrap failed inside ensure_case_generated")

    ia_item = choose_ia_item_for_case(case_id)
    if not ia_item:
        raise RuntimeError("No IA items available. Ingest needed.")

    case_seed = seed_for_date(case_id)
    mode = "knowledge" if (case_seed % 2 == 0) else "observation"
    log.info(f"Case {case_id}: mode={mode}")

    style_period = "sourced from Internet Archive; museum catalog reproduction"

    source_url = ia_item.get("storage_url") or ia_item["download_url"]
    log.info(f"Case {case_id}: authentic source={source_url}")
    auth_img = download_image_to_pil(source_url)

    images_urls: List[str] = []
    signature_crops: List[str] = []

    url1 = save_image_return_url(auth_img, f"hidden_stroke/{case_id}/images/img_1.jpg")
    images_urls.append(url1)
    log.debug(f"Case {case_id}: saved authentic -> {url1}")

    crop1 = crop_signature_macro(auth_img, 512)
    crop1_url = save_image_return_url(crop1, f"hidden_stroke/{case_id}/signature_crops/crop_1.jpg", quality=88)
    signature_crops.append(crop1_url)
    log.debug(f"Case {case_id}: saved authentic crop -> {crop1_url}")

    if mode == "knowledge":
        for _ in [2, 3]:
            images_urls.append(images_urls[0])
            signature_crops.append(signature_crops[0])
    else:
        for i in range(2):
            forg_prompt = """
Create a near-identical variant of the provided painting. 
Keep composition, palette, and lighting the same.
Only introduce a subtle change in signature micro-geometry (baseline alignment, stroke overlap order, or curve spacing).
No annotations. Differences must be visible only at macro zoom.
"""
            log.info(f"Case {case_id}: generating forgery {i+1}")
            resp = client.models.generate_content(
                model=GENERATION_MODEL,
                contents=[forg_prompt, auth_img],
                config=types.GenerateContentConfig(response_modalities=["IMAGE"])
            )
            f_img = None
            for p in resp.candidates[0].content.parts:
                if getattr(p, "inline_data", None):
                    f_img = pil_from_inline_image_part(p)
                    break
            if f_img is None:
                log.warning("Gemini returned no image; falling back to copy of authentic")
                f_img = auth_img.copy()

            url = save_image_return_url(f_img, f"hidden_stroke/{case_id}/images/img_{i+2}.jpg")
            images_urls.append(url)
            crop = crop_signature_macro(f_img, 512)
            c_url = save_image_return_url(crop, f"hidden_stroke/{case_id}/signature_crops/crop_{i+2}.jpg", quality=88)
            signature_crops.append(c_url)
            log.debug(f"Case {case_id}: forgery saved -> {url}; crop -> {c_url}")

    title = ia_item.get("title") or "Untitled"
    creator = ia_item.get("creator") or ""
    date = ia_item.get("date") or ""
    rights = ia_item.get("rights") or ""
    licenseurl = ia_item.get("licenseurl") or ""
    log.info(f"Case {case_id}: prompting metadata with title='{title}' creator='{creator}' date='{date}'")

    meta_prompt = f"""
You are generating a daily case for a noir art investigation game.

MODE: {"KNOWLEDGE" if mode=="knowledge" else "OBSERVATION"}

AUTHENTIC CONTEXT (from Internet Archive):
- title: {title}
- creator: {creator}
- date: {date}
- rights: {rights}
- licenseurl: {licenseurl}

TASK:
1) Create a short, punchy "case_brief" (2–4 sentences) explaining why the artifact matters and why fraud is suspected — NO SPOILERS.
2) Prepare THREE metadata bundles for images A,B,C with NEARLY IDENTICAL fields.
   Ensure exactly ONE bundle is AUTHENTIC and that it corresponds to the above authentic context.
   The other two are FORGERIES with subtle, reality-checkable anomalies.
3) Provide a concise "ledger_summary" describing a believable ownership/payment trail.
4) Provide the solution with: "answer_index" (0 for A, 1 for B, 2 for C) and detailed flags for signature/metadata/financial, plus an "explanation".

OUTPUT STRICT JSON with this schema:
{{
  "case_brief": "...",
  "metadata": [
    {{"title":"...", "year": "...", "medium": "...", "ink_or_pigment": "...", "catalog_ref": "...", "ownership_chain": ["...","..."], "notes":"..."}},
    {{"title":"...", "year": "...", "medium": "...", "ink_or_pigment": "...", "catalog_ref": "...", "ownership_chain": ["...","..."], "notes":"..."}},
    {{"title":"...", "year": "...", "medium": "...", "ink_or_pigment": "...", "catalog_ref": "...", "ownership_chain": ["...","..."], "notes":"..."}}
  ],
  "ledger_summary": "short paragraph",
  "solution": {{
     "answer_index": 0,
     "flags_signature": [ "..." ],
     "flags_metadata": [ "..." ],
     "flags_financial": [ "..." ],
     "explanation": "A few sentences that justify the authentic pick without listing spoilers."
  }}
}}
"""
    meta_resp = client.models.generate_content(
        model=CATEGORY_MODEL,
        contents=[meta_prompt]
    )
    raw_text = meta_resp.text.strip()
    log.debug(f"Case {case_id}: raw meta JSON text len={len(raw_text)}")
    try:
        meta_json = json.loads(raw_text)
    except Exception:
        cleaned = raw_text
        if "```" in raw_text:
            parts = raw_text.split("```")
            if len(parts) >= 2:
                cleaned = parts[1]
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned.split("\n", 1)[1]
        meta_json = json.loads(cleaned)

    case_brief = meta_json.get("case_brief", "A resurfaced portrait raises questions—its paper trail glitters a little too perfectly.")
    metadata = meta_json.get("metadata", [])
    ledger_summary = meta_json.get("ledger_summary", "")
    solution = meta_json.get("solution", {})
    answer_index = int(solution.get("answer_index", 0))
    flags_signature = solution.get("flags_signature", [])
    flags_metadata = solution.get("flags_metadata", [])
    flags_financial = solution.get("flags_financial", [])
    explanation = solution.get("explanation", "The authentic work aligns with period-accurate details; the others contain subtle contradictions.")
    log.info(f"Case {case_id}: answer_index={answer_index}, meta_count={len(metadata)}")

    if len(metadata) != 3:
        log.error("Gemini did not return exactly 3 metadata bundles")
        raise RuntimeError("Expected exactly 3 metadata bundles.")

    public = {
        "case_id": case_id,
        "mode": mode,
        "brief": case_brief,
        "style_period": style_period,
        "images": images_urls,
        "signature_crops": signature_crops,
        "metadata": metadata,
        "ledger_summary": ledger_summary,
        "timer_seconds": TIMER_SECONDS,
        "initial_ip": INITIAL_IP,
        "tool_costs": TOOL_COSTS,
        "credits": {
            "source": "Internet Archive",
            "identifier": ia_item.get("identifier"),
            "title": title,
            "creator": creator,
            "rights": rights,
            "licenseurl": licenseurl
        }
    }
    solution_doc = {
        "answer_index": answer_index,
        "flags_signature": flags_signature,
        "flags_metadata": flags_metadata,
        "flags_financial": flags_financial,
        "explanation": explanation
    }

    cref = case_ref(case_id)
    cref.child("public").set(public)
    cref.child("solution").set(solution_doc)
    log.info(f"Case {case_id}: generated and stored")
    return public

# -----------------------------------------------------------------------------
# 5) SESSIONS, TOOLS, GUESS, LEADERBOARD
# -----------------------------------------------------------------------------
def create_session(user_id: str, username: str, case_id: str) -> Dict[str, Any]:
    session_id = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=TIMER_SECONDS)).isoformat()
    session_doc = {
        "session_id": session_id,
        "user_id": user_id,
        "username": username,
        "case_id": case_id,
        "ip_remaining": INITIAL_IP,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at,
        "actions": [],
        "status": "active"
    }
    sessions_ref().child(session_id).set(session_doc)
    log.info(f"New session {session_id} for user={username} case={case_id}")
    return session_doc

def get_session(session_id: str) -> Dict[str, Any]:
    return sessions_ref().child(session_id).get() or {}

def require_active_session(req) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    session_id = req.headers.get("X-Session-Id", "")
    if not session_id:
        return {}, {"error": "Missing X-Session-Id header."}
    sess = get_session(session_id)
    if not sess or sess.get("status") != "active":
        return {}, {"error": "Invalid or inactive session."}
    now = datetime.now(timezone.utc)
    exp = datetime.fromisoformat(sess["expires_at"].replace("Z", "+00:00"))
    if now > exp:
        sess["status"] = "expired"
        sessions_ref().child(session_id).child("status").set("expired")
        return {}, {"error": "Session expired."}
    return sess, {}

def spend_ip(session: Dict[str, Any], cost: int, action: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    if session["ip_remaining"] < cost:
        return session, {"error": "Not enough Investigation Points."}
    new_ip = session["ip_remaining"] - cost
    session["ip_remaining"] = new_ip
    action["ts"] = datetime.now(timezone.utc).isoformat()
    sessions_ref().child(session["session_id"]).child("ip_remaining").set(new_ip)
    sessions_ref().child(session["session_id"]).child("actions").push(action)
    log.debug(f"Spend IP: {cost} -> remaining={new_ip}")
    return session, {}

def score_result(correct: bool, session: Dict[str, Any]) -> Dict[str, Any]:
    exp = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    seconds_left = max(0, int((exp - now).total_seconds()))
    time_bonus = (seconds_left + 9) // 10
    ip_bonus = session["ip_remaining"] * 2
    base = 100 if correct else 0
    penalty = 40 if not correct else 0
    score = max(0, base + time_bonus + ip_bonus - penalty)
    return {"score": score, "seconds_left": seconds_left, "ip_left": session["ip_remaining"]}

def upsert_leaderboard(case_id: str, user_id: str, username: str, score: int):
    plays_ref(case_id).child(user_id).set({
        "user_id": user_id,
        "username": username,
        "score": score,
        "ts": datetime.now(timezone.utc).isoformat()
    })
    plays = plays_ref(case_id).get() or {}
    top = sorted(plays.values(), key=lambda x: x.get("score", 0), reverse=True)[:LEADERBOARD_TOP_N]
    leaderboard_ref(case_id).set(top)

# -----------------------------------------------------------------------------
# 6) ROUTES
# -----------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "time": datetime.now(timezone.utc).isoformat()})

# --- Admin: Internet Archive ingestion (manual) ---
@app.route("/admin/ingest-ia", methods=["POST"])
def admin_ingest_ia():
    if not ADMIN_KEY or request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"error": "Forbidden"}), 403

    body = request.get_json() or {}
    query = body.get("query") or DEFAULT_IA_QUERY
    pages = int(body.get("pages") or 2)
    rows = int(body.get("rows") or 100)
    ingested = 0
    errors = 0
    log.info(f"Manual ingest: query='{query}' pages={pages} rows={rows}")

    for page in range(1, pages + 1):
        try:
            docs = ia_advanced_search(query, rows=rows, page=page)
        except Exception:
            errors += 1
            continue
        for d in docs:
            ident = d.get("identifier")
            if not ident:
                continue
            if ia_pool_ref().child(fb_key(ident)).get():
                continue
            try:
                rec = ingest_ia_doc(d)
                if rec:
                    ingested += 1
            except Exception:
                errors += 1
                log.exception(f"Manual ingest failed for {ident}")
                continue

    pool_size = len(ia_pool_ref().get() or {})
    return jsonify({"ok": True, "ingested": ingested, "errors": errors, "pool_size": pool_size})

# --- Admin: Cache IA images to Firebase Storage (manual) ---
@app.route("/admin/cache-ia", methods=["POST"])
def admin_cache_ia():
    if not ADMIN_KEY or request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"error": "Forbidden"}), 403

    cfg = request.get_json() or {}
    out = batch_cache_ia_pool(
        limit=int(cfg.get("limit", 100)),
        overwrite=bool(cfg.get("overwrite", False)),
        randomize=bool(cfg.get("randomize", True)),
        min_width=int(cfg.get("min_width", 800)),
        min_height=int(cfg.get("min_height", 800)),
        max_dim=int(cfg.get("max_dim", 4096)),
        jpeg_quality=int(cfg.get("jpeg_quality", 90)),
        skip_if_restricted=bool(cfg.get("skip_if_restricted", True)),
    )
    return jsonify(out)

# --- Admin: pool stats ---
@app.route("/admin/ia-pool/stats", methods=["GET"])
def ia_pool_stats():
    if not ADMIN_KEY or request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"error": "Forbidden"}), 403
    pool = ia_pool_ref().get() or {}
    cached = sum(1 for r in pool.values() if r.get("storage_url"))
    return jsonify({"pool_size": len(pool), "cached": cached})

# --- Admin: pre-generate today's case (manual) ---
@app.route("/admin/generate-today", methods=["POST"])
def admin_generate_today():
    if not ADMIN_KEY or request.headers.get("X-Admin-Key") != ADMIN_KEY:
        return jsonify({"error": "Forbidden"}), 403
    case_id = utc_today_str()
    public = ensure_case_generated(case_id)
    return jsonify({"generated": True, "case_id": case_id, "mode": public.get("mode")})

# --- DEV-ONLY: panic button bootstrap (no auth; gated by env) ---
@app.route("/admin/bootstrap-now", methods=["POST"])
def admin_bootstrap_now():
    if not ALLOW_DEV_BOOTSTRAP:
        return jsonify({"error": "Disabled. Set ALLOW_DEV_BOOTSTRAP=1 to enable."}), 403

    cfg = request.get_json() or {}
    min_items = int(cfg.get("min_items", MIN_IA_POOL))
    rows = int(cfg.get("rows", 100))
    max_pages = int(cfg.get("max_pages", 5))
    custom_q = cfg.get("query")

    global DEFAULT_IA_QUERY
    original_q = DEFAULT_IA_QUERY
    if custom_q:
        log.warning(f"DEV bootstrap using custom query: {custom_q!r}")
        DEFAULT_IA_QUERY = custom_q  # temporary override

    try:
        stats = ensure_minimum_ia_pool(min_items=min_items, rows=rows, max_pages=max_pages)
        return jsonify({"ok": True, "stats": stats, "effective_query": DEFAULT_IA_QUERY})
    except Exception as e:
        log.exception("bootstrap-now failed")
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        DEFAULT_IA_QUERY = original_q  # restore

# --- DEV-ONLY: diagnostics (network + firebase sanity) ---
@app.route("/admin/diagnostics", methods=["GET"])
def diagnostics():
    if not ALLOW_DEV_DIAGNOSTICS:
        return jsonify({"error": "Disabled. Set ALLOW_DEV_DIAGNOSTICS=1 to enable."}), 403
    info = {
        "bucket": bucket.name,
        "db_url": db_root.path,
        "log_level": LOG_LEVEL,
        "ia_query": DEFAULT_IA_QUERY,
    }
    diag = {"info": info, "ia": {}, "firebase": {}}
    try:
        docs = ia_advanced_search(DEFAULT_IA_QUERY, rows=3, page=1)
        diag["ia"]["search_docs"] = [d.get("identifier") for d in docs]
        if docs:
            ident = docs[0].get("identifier")
            meta = ia_metadata(ident)
            best = ia_best_image_from_metadata(meta)
            diag["ia"]["sample_identifier"] = ident
            diag["ia"]["best_file"] = (best or {}).get("name")
    except Exception as e:
        diag["ia"]["error"] = str(e)

    try:
        tiny = upload_bytes_to_storage(b"ping", f"diag/ping_{uuid.uuid4().hex}.txt", "text/plain")
        diag["firebase"]["upload_test"] = tiny
    except Exception as e:
        diag["firebase"]["error"] = str(e)

    return jsonify(diag)

# --- Player flow ---
@app.route("/cases/today/start", methods=["POST"])
def start_case():
    user_id, username = extract_user_from_headers(request)
    case_id = utc_today_str()
    public = ensure_case_generated(case_id)

    existing = sessions_ref().order_by_child("user_id").equal_to(user_id).get()
    sess = None
    if existing:
        for _, sdoc in existing.items():
            if sdoc.get("case_id") == case_id and sdoc.get("status") == "active":
                sess = sdoc
                break
    if not sess:
        sess = create_session(user_id, username, case_id)

    return jsonify({"session_id": sess["session_id"], "case": public})

@app.route("/cases/<case_id>/tool/signature", methods=["POST"])
def tool_signature(case_id):
    session, err = require_active_session(request)
    if err: return jsonify(err), 400
    if session["case_id"] != case_id:
        return jsonify({"error": "Session/case mismatch."}), 400

    body = request.get_json() or {}
    img_index = int(body.get("image_index", 0))
    if img_index not in [0,1,2]:
        return jsonify({"error": "image_index must be 0,1,2"}), 400

    session, err = spend_ip(session, TOOL_COSTS["signature"], {"type": "tool_signature", "image_index": img_index})
    if err: return jsonify(err), 400

    public = case_ref(case_id).child("public").get() or {}
    crops = public.get("signature_crops", [])
    crop_url = crops[img_index] if img_index < len(crops) else ""
    hint = "Examine baseline alignment and stroke overlap." if public.get("mode") == "observation" else ""
    return jsonify({"crop_url": crop_url, "hint": hint, "ip_remaining": session["ip_remaining"]})

@app.route("/cases/<case_id>/tool/metadata", methods=["POST"])
def tool_metadata(case_id):
    session, err = require_active_session(request)
    if err: return jsonify(err), 400
    if session["case_id"] != case_id:
        return jsonify({"error": "Session/case mismatch."}), 400

    body = request.get_json() or {}
    img_index = int(body.get("image_index", 0))
    if img_index not in [0,1,2]:
        return jsonify({"error": "image_index must be 0,1,2"}), 400

    session, err = spend_ip(session, TOOL_COSTS["metadata"], {"type": "tool_metadata", "image_index": img_index})
    if err: return jsonify(err), 400

    solution = case_ref(case_id).child("solution").get() or {}
    flags_metadata: List[str] = solution.get("flags_metadata", [])
    hint = flags_metadata[0] if flags_metadata else "Check chronology, chemistry, and institutional formats."
    return jsonify({"flags": [hint], "ip_remaining": session["ip_remaining"]})

@app.route("/cases/<case_id>/tool/financial", methods=["POST"])
def tool_financial(case_id):
    session, err = require_active_session(request)
    if err: return jsonify(err), 400
    if session["case_id"] != case_id:
        return jsonify({"error": "Session/case mismatch."}), 400

    session, err = spend_ip(session, TOOL_COSTS["financial"], {"type": "tool_financial"})
    if err: return jsonify(err), 400

    solution = case_ref(case_id).child("solution").get() or {}
    flags_financial: List[str] = solution.get("flags_financial", [])
    hint = flags_financial[0] if flags_financial else "Follow currency, jurisdiction, and payment method timelines."
    return jsonify({"flags": [hint], "ip_remaining": session["ip_remaining"]})

@app.route("/cases/<case_id>/guess", methods=["POST"])
def submit_guess(case_id):
    session, err = require_active_session(request)
    if err: return jsonify(err), 400
    if session["case_id"] != case_id:
        return jsonify({"error": "Session/case mismatch."}), 400

    body = request.get_json() or {}
    guess_index = int(body.get("image_index", -1))
    rationale = (body.get("rationale") or "").strip()
    if guess_index not in [0,1,2]:
        return jsonify({"error": "image_index must be 0,1,2"}), 400

    sessions_ref().child(session["session_id"]).child("status").set("finished")
    session["status"] = "finished"

    solution = case_ref(case_id).child("solution").get() or {}
    answer_index = int(solution.get("answer_index", 0))
    correct = (guess_index == answer_index)

    summary = score_result(correct, session)
    upsert_leaderboard(case_id, session["user_id"], session["username"], summary["score"])

    reveal = {
        "authentic_index": answer_index,
        "explanation": solution.get("explanation", ""),
        "flags_signature": solution.get("flags_signature", []),
        "flags_metadata": solution.get("flags_metadata", []),
        "flags_financial": solution.get("flags_financial", [])
    }

    plays_ref(case_id).child(session["user_id"]).update({
        "rationale": rationale,
        "correct": correct,
        "score": summary["score"],
        "seconds_left": summary["seconds_left"],
        "ip_left": summary["ip_left"],
        "finished_at": datetime.now(timezone.utc).isoformat()
    })

    return jsonify({
        "correct": correct,
        "score": summary["score"],
        "timeLeft": summary["seconds_left"],
        "ipLeft": summary["ip_left"],
        "reveal": reveal
    })

@app.route("/leaderboard/daily", methods=["GET"])
def leaderboard_daily():
    case_id = utc_today_str()
    top = leaderboard_ref(case_id).get() or []
    user_id, _ = extract_user_from_headers(request)
    me = plays_ref(case_id).child(user_id).get() or {}
    rank = None
    if top:
        for i, row in enumerate(top):
            if row.get("user_id") == user_id:
                rank = i + 1
                break
    return jsonify({"case_id": case_id, "top": top, "me": {"score": me.get("score"), "rank": rank}})

# -----------------------------------------------------------------------------
# 7) MAIN
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    if os.environ.get("BOOTSTRAP_IA", "1") == "1":
        log.info("Bootstrapping Internet Archive pool...")
        try:
            stats = ensure_minimum_ia_pool()
            log.info(f"Bootstrap complete: {stats}")
        except Exception:
            log.exception("Bootstrap failed")

    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "7860")), debug=True)
