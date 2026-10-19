"""Разбор DXF в геометрию склада (метры). DWG не поддерживается."""

from __future__ import annotations

import io
import math
from typing import Any

from fastapi import HTTPException

from app.services.layout import _id


SUPPORTED = {"LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "INSERT"}

# INSUNITS → метры
_INSUNITS_TO_M = {
    0: None,
    1: 0.0254,  # inches
    2: 0.3048,  # feet
    4: 0.001,  # mm
    5: 0.01,  # cm
    6: 1.0,  # m
}


def _validate_dxf_bytes(filename: str | None, content: bytes, max_bytes: int) -> None:
    if not content:
        raise HTTPException(400, detail="Пустой файл")
    if len(content) > max_bytes:
        raise HTTPException(400, detail="Файл DXF слишком большой (лимит 8 МБ)")
    name = (filename or "").lower()
    if name.endswith(".dwg"):
        raise HTTPException(
            400,
            detail="Формат DWG не поддерживается. Сохраните чертёж как DXF и загрузите снова.",
        )
    if not name.endswith(".dxf") and not content[:20].lstrip().upper().startswith(b"0"):
        # DXF часто начинается с "  0\nSECTION"
        if b"SECTION" not in content[:400] and b"SECTION" not in content[:400].upper():
            raise HTTPException(400, detail="Ожидается файл DXF")


def _arc_points(cx, cy, r, a0, a1, n=12) -> list[tuple[float, float]]:
    pts = []
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        rad = math.radians(t)
        pts.append((cx + r * math.cos(rad), cy + r * math.sin(rad)))
    return pts


def parse_dxf(content: bytes, filename: str | None = None, max_bytes: int = 8 * 1024 * 1024) -> dict[str, Any]:
    _validate_dxf_bytes(filename, content, max_bytes)
    try:
        import ezdxf
        from ezdxf import DXFStructureError
    except ImportError as exc:
        raise HTTPException(
            500,
            detail=(
                "Библиотека ezdxf не установлена — DXF preview недоступен. "
                "Установите ezdxf==1.3.5 (см. backend/scripts/install_ezdxf_in_container.md) "
                "или пересоберите образ backend с offline wheels в backend/.wheels/."
            ),
        ) from exc

    try:
        # ezdxf.read(StringIO) на Linux теряет сущности при CRLF (Windows DXF).
        # Нормализуем переводы строк; бинарный readfile — запасной путь.
        text = content.decode("utf-8", errors="ignore")
        if "SECTION" not in text.upper() and "ENTITIES" not in text.upper():
            text = content.decode("cp1251", errors="ignore")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        doc = ezdxf.read(io.StringIO(text))
        if not list(doc.modelspace()):
            import os
            import tempfile

            fd, tmp_path = tempfile.mkstemp(suffix=".dxf")
            try:
                os.write(fd, content)
                os.close(fd)
                fd = -1
                doc = ezdxf.readfile(tmp_path)
            finally:
                if fd >= 0:
                    os.close(fd)
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
    except DXFStructureError as exc:
        from app.services.safe_errors import log_safe_exception

        log_safe_exception("dxf.parse.structure", exc, filename=filename)
        raise HTTPException(
            400,
            detail="Повреждённый файл DXF. Проверьте формат или экспортируйте чертёж заново.",
        ) from exc
    except Exception as exc:
        from app.services.safe_errors import log_safe_exception

        log_safe_exception("dxf.parse", exc, filename=filename)
        raise HTTPException(
            400,
            detail="Не удалось прочитать DXF. Убедитесь, что это корректный файл чертежа.",
        ) from exc

    msp = doc.modelspace()
    insunits = 4
    try:
        insunits = int(doc.header.get("$INSUNITS", 4) or 4)
    except Exception:
        insunits = 4
    unit_m = _INSUNITS_TO_M.get(insunits, 0.001) or 0.001

    entities: list[dict[str, Any]] = []
    warnings: list[str] = []
    skipped = 0
    xs: list[float] = []
    ys: list[float] = []

    def add_poly(pts: list[tuple[float, float]], etype: str, closed: bool, layer: str):
        if len(pts) < 2:
            return
        for x, y in pts:
            xs.append(x)
            ys.append(y)
        xmin, xmax = min(p[0] for p in pts), max(p[0] for p in pts)
        ymin, ymax = min(p[1] for p in pts), max(p[1] for p in pts)
        suggested = "rack" if closed and (xmax - xmin) > 0 and (ymax - ymin) > 0 else "wall"
        entities.append(
            {
                "id": _id("dxf"),
                "dxftype": etype,
                "layer": layer,
                "closed": closed,
                "suggested_kind": suggested,
                "kind": suggested,
                "points": [{"x": round(x, 4), "y": round(y, 4)} for x, y in pts],
                "bounds": {
                    "xmin": xmin,
                    "ymin": ymin,
                    "xmax": xmax,
                    "ymax": ymax,
                },
            }
        )

    for e in msp:
        t = e.dxftype()
        layer = ""
        try:
            layer = str(e.dxf.layer)
        except Exception:
            layer = ""
        if t not in SUPPORTED:
            skipped += 1
            if skipped <= 8:
                warnings.append(f"Пропущена неподдерживаемая сущность {t}")
            continue
        try:
            if t == "LINE":
                add_poly([(float(e.dxf.start.x), float(e.dxf.start.y)), (float(e.dxf.end.x), float(e.dxf.end.y))], t, False, layer)
            elif t == "CIRCLE":
                cx, cy, r = float(e.dxf.center.x), float(e.dxf.center.y), float(e.dxf.radius)
                pts = _arc_points(cx, cy, r, 0, 360, 16)
                add_poly(pts, t, True, layer)
            elif t == "ARC":
                pts = _arc_points(
                    float(e.dxf.center.x),
                    float(e.dxf.center.y),
                    float(e.dxf.radius),
                    float(e.dxf.start_angle),
                    float(e.dxf.end_angle),
                    10,
                )
                add_poly(pts, t, False, layer)
            elif t in ("LWPOLYLINE", "POLYLINE"):
                pts = []
                if t == "LWPOLYLINE":
                    pts = [(float(p[0]), float(p[1])) for p in e.get_points("xy")]
                    closed = bool(e.closed)
                else:
                    pts = [(float(v.dxf.location.x), float(v.dxf.location.y)) for v in e.vertices]
                    closed = bool(getattr(e, "is_closed", False))
                add_poly(pts, t, closed, layer)
            elif t == "INSERT":
                warnings.append("Блоки INSERT не разворачиваются автоматически — проверьте чертёж")
                skipped += 1
        except Exception:
            skipped += 1
            warnings.append(f"Не удалось разобрать сущность {t}")

    if not entities:
        raise HTTPException(400, detail="В DXF нет поддерживаемой геометрии (LINE, POLYLINE, ARC, CIRCLE)")

    bounds = {
        "xmin": min(xs),
        "ymin": min(ys),
        "xmax": max(xs),
        "ymax": max(ys),
    }
    return {
        "filename": filename,
        "unit_source": "INSUNITS",
        "insunits": insunits,
        "suggested_unit_to_m": unit_m,
        "bounds": bounds,
        "entities": entities,
        "skipped": skipped,
        "warnings": warnings,
        "note": "Масштаб и типы объектов нужно подтвердить вручную. Линии не считаются стенами автоматически.",
    }


def entities_to_layout(
    preview: dict[str, Any],
    *,
    unit_to_m: float | None = None,
    selected_ids: list[str] | None = None,
) -> dict[str, Any]:
    scale = float(unit_to_m if unit_to_m is not None else preview.get("suggested_unit_to_m") or 0.001)
    if scale <= 0:
        raise HTTPException(400, detail="Масштаб должен быть больше нуля")
    b = preview["bounds"]
    entities = preview["entities"]
    if selected_ids:
        allow = set(selected_ids)
        entities = [e for e in entities if e["id"] in allow]
    objects = []
    for e in entities:
        bb = e["bounds"]
        x0 = (bb["xmin"] - b["xmin"]) * scale
        y0 = (bb["ymin"] - b["ymin"]) * scale
        w = max(0.3, (bb["xmax"] - bb["xmin"]) * scale)
        h = max(0.3, (bb["ymax"] - bb["ymin"]) * scale)
        kind = e.get("kind") or e.get("suggested_kind") or "wall"
        objects.append(
            {
                "id": e["id"],
                "kind": kind if kind in ("rack", "wall", "obstacle", "zone", "charge", "load", "unload") else "obstacle",
                "name": f"{e['dxftype']} / {e.get('layer') or 'слой'}",
                "x": round(x0, 3),
                "y": round(y0, 3),
                "width": round(w, 3),
                "height": round(h, 3),
                "rotation": 0,
                "from_dxf": True,
            }
        )
    width_m = max(5.0, (b["xmax"] - b["xmin"]) * scale)
    length_m = max(5.0, (b["ymax"] - b["ymin"]) * scale)
    return {
        "version": 1,
        "unit": "m",
        "width_m": round(width_m, 3),
        "length_m": round(length_m, 3),
        "objects": objects,
        "source": "dxf",
        "dxf_meta": {
            "filename": preview.get("filename"),
            "unit_to_m": scale,
            "warnings": preview.get("warnings") or [],
            "example": False,
        },
    }
