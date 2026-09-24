"""Импорт реального каталога из catalog_export_v4.csv (материалы хакатона)."""

from __future__ import annotations

import csv
import io
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.catalog_meta import SolutionType
from app.models.import_batch import ImportBatch
from app.models.manufacturer import Manufacturer
from app.models.robot import Robot
from app.models.user import utcnow

CATALOG_FILENAME = "catalog_export_v4.csv"

def _project_data_dirs(*parts: str) -> list[Path]:
    """Prefer Docker /data, then repo data/, then cwd-relative."""
    root = Path(__file__).resolve().parents[3]
    return [
        Path("/data").joinpath(*parts),
        root.joinpath("data", *parts),
        Path("data").joinpath(*parts),
        Path("..").joinpath("data", *parts),
    ]


DEFAULT_CATALOG_CANDIDATES = [
    p / CATALOG_FILENAME for p in _project_data_dirs("sources")
]

PAYLOAD_RE = re.compile(
    r"(?:грузоподъ[её]мност[ьи]\s*)?(?:до\s+)?([\d\s\u00a0]+)\s*кг",
    re.IGNORECASE,
)

STATUS_MAP = {
    "operation": "available",
    "piloting": "pilot",
    "rnd": "rnd",
}

# Подтип / Тип → code, name_ru
SUBTYPE_MAP = {
    "amr": ("amr", "AMR (автономный мобильный робот)"),
    "fmr": ("fmr", "FMR (мобильный робот с вилами)"),
    "штабелёр": ("stacker", "Штабелёр"),
    "штабелер": ("stacker", "Штабелёр"),
    "тягач": ("tugger", "Тягач"),
    "беспилотный тягач": ("tugger", "Тягач"),
    "автопогрузчик": ("forklift", "Автопогрузчик"),
    "погрузчик": ("forklift", "Автопогрузчик"),
    "робот-уборщик": ("cleaner", "Клининговый робот"),
    "уборщик": ("cleaner", "Клининговый робот"),
    "клининг": ("cleaner", "Клининговый робот"),
    "робот-доставщик": ("delivery", "Робот-доставщик"),
    "доставщик": ("delivery", "Робот-доставщик"),
    "грузовик": ("truck", "Автономный грузовик"),
    "беспилотный грузовик": ("truck", "Автономный грузовик"),
    "шаттл": ("shuttle", "Шаттл-система"),
    "shuttle": ("shuttle", "Шаттл-система"),
    "as/rs": ("asrs", "Система хранения AS/RS"),
    "стационарный": ("stationary", "Стационарный робот"),
}

TYPE_HINTS = [
    ("мобильн", "amr", "Мобильные роботы"),
    ("вилочн", "fmr", "FMR"),
    ("штабел", "stacker", "Штабелёр"),
    ("тягач", "tugger", "Тягач"),
    ("уборщ", "cleaner", "Клининговый робот"),
    ("клининг", "cleaner", "Клининговый робот"),
    ("достав", "delivery", "Робот-доставщик"),
    ("грузовик", "truck", "Автономный грузовик"),
    ("шаттл", "shuttle", "Шаттл-система"),
    ("хранен", "asrs", "Система хранения"),
    ("беспилотн", "truck", "Беспилотный транспорт"),
    ("по", "software", "Программное обеспечение"),
    ("software", "software", "Программное обеспечение"),
]


@dataclass
class ImportErrorItem:
    file: str
    sheet: Optional[str]
    row: Optional[int]
    column: Optional[str]
    value: Any
    reason: str


@dataclass
class ImportReport:
    filename: str
    status: str = "completed"
    total_rows: int = 0
    added: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[ImportErrorItem] = field(default_factory=list)
    warnings: list[ImportErrorItem] = field(default_factory=list)
    batch_id: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "filename": self.filename,
            "status": self.status,
            "total_rows": self.total_rows,
            "added": self.added,
            "updated": self.updated,
            "skipped": self.skipped,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "errors": [asdict(e) for e in self.errors[:200]],
            "warnings": [asdict(w) for w in self.warnings[:200]],
            "batch_id": self.batch_id,
            "message": (
                f"Импорт каталога: добавлено {self.added}, обновлено {self.updated}, "
                f"пропущено {self.skipped}, ошибок {len(self.errors)}"
            ),
        }


def resolve_catalog_path(explicit: Optional[str | Path] = None) -> Optional[Path]:
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    for candidate in DEFAULT_CATALOG_CANDIDATES:
        try:
            if candidate.is_file():
                return candidate.resolve()
        except OSError:
            continue
    return None


def parse_price(raw: Any) -> Optional[float]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in ("-", "н/д", "n/a", "none"):
        return None
    s = s.replace("\u00a0", " ").replace(" ", "").replace("₽", "").replace("руб.", "").replace("руб", "")
    s = s.replace(",", ".")
    # keep last dot as decimal if multiple
    if s.count(".") > 1:
        parts = s.split(".")
        s = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return float(s)
    except ValueError:
        return None


def parse_payload_from_name(name: str) -> Optional[float]:
    if not name:
        return None
    m = PAYLOAD_RE.search(name)
    if not m:
        return None
    num = m.group(1).replace("\u00a0", " ").replace(" ", "")
    try:
        return float(num)
    except ValueError:
        return None


def parse_float(raw: Any) -> Optional[float]:
    if raw is None or str(raw).strip() == "":
        return None
    return parse_price(raw)


def parse_int(raw: Any) -> Optional[int]:
    fv = parse_float(raw)
    if fv is None:
        return None
    return int(round(fv))


def _slug_code(text: str, fallback: str = "custom") -> str:
    text = (text or "").strip().lower()
    if not text:
        return fallback
    # latin/digits keep; cyrillic → simple translit for codes
    table = str.maketrans(
        {
            "а": "a",
            "б": "b",
            "в": "v",
            "г": "g",
            "д": "d",
            "е": "e",
            "ё": "e",
            "ж": "zh",
            "з": "z",
            "и": "i",
            "й": "y",
            "к": "k",
            "л": "l",
            "м": "m",
            "н": "n",
            "о": "o",
            "п": "p",
            "р": "r",
            "с": "s",
            "т": "t",
            "у": "u",
            "ф": "f",
            "х": "h",
            "ц": "ts",
            "ч": "ch",
            "ш": "sh",
            "щ": "sch",
            "ъ": "",
            "ы": "y",
            "ь": "",
            "э": "e",
            "ю": "yu",
            "я": "ya",
            " ": "_",
            "-": "_",
            "/": "_",
        }
    )
    code = text.translate(table)
    code = re.sub(r"[^a-z0-9_]+", "", code)
    code = re.sub(r"_+", "_", code).strip("_")
    return (code[:60] or fallback)


def _get_or_create_manufacturer(db: Session, name: str) -> Optional[Manufacturer]:
    name = (name or "").strip().strip('"').strip("'")
    if not name:
        return None
    m = db.query(Manufacturer).filter(Manufacturer.name == name).first()
    if m:
        return m
    m = Manufacturer(name=name, country="Россия")
    db.add(m)
    db.flush()
    return m


def _resolve_solution_type(
    db: Session,
    tip: str,
    podtip: str,
) -> Optional[SolutionType]:
    tip = (tip or "").strip()
    podtip = (podtip or "").strip()

    for key, (code, name_ru) in SUBTYPE_MAP.items():
        if podtip.lower() == key or key in podtip.lower():
            return _get_or_create_st(db, code, name_ru)

    combined = f"{podtip} {tip}".lower()
    for needle, code, name_ru in TYPE_HINTS:
        if needle in combined:
            return _get_or_create_st(db, code, name_ru)

    if podtip:
        code = _slug_code(podtip)
        return _get_or_create_st(db, code, podtip)
    if tip:
        code = _slug_code(tip)
        return _get_or_create_st(db, code, tip)
    return None


def _get_or_create_st(db: Session, code: str, name_ru: str) -> SolutionType:
    st = db.query(SolutionType).filter(SolutionType.code == code).first()
    if st:
        return st
    st = db.query(SolutionType).filter(SolutionType.name_ru == name_ru).first()
    if st:
        return st
    st = SolutionType(code=code, name_ru=name_ru)
    db.add(st)
    db.flush()
    return st


def confirmation_for_row(
    name: str,
    company: str,
    price: Optional[float],
    tip: str,
    podtip: str,
) -> tuple[str, str]:
    """Return (confirmation_level, source_status)."""
    complete = bool(name and company and price is not None and (tip or podtip))
    if complete:
        return "confirmed", "from_source"
    if name and company:
        return "needs_review", "needs_review"
    return "assumption", "assumption"


def _find_existing(
    db: Session,
    external_id: Optional[str],
    name: str,
    manufacturer_id: Optional[int],
) -> Optional[Robot]:
    if external_id:
        r = db.query(Robot).filter(Robot.external_id == external_id).first()
        if r:
            return r
    q = db.query(Robot).filter(Robot.name == name, Robot.archived.is_(False))
    if manufacturer_id is not None:
        q = q.filter(Robot.manufacturer_id == manufacturer_id)
    return q.first()


def _read_csv_rows(content: bytes | str, filename: str) -> tuple[list[dict[str, str]], list[ImportErrorItem]]:
    errors: list[ImportErrorItem] = []
    if isinstance(content, bytes):
        text = None
        for enc in ("utf-8-sig", "utf-8", "cp1251"):
            try:
                text = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            errors.append(
                ImportErrorItem(filename, None, None, None, None, "Не удалось декодировать CSV")
            )
            return [], errors
    else:
        text = content

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ";" if sample.count(";") >= sample.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        errors.append(ImportErrorItem(filename, None, None, None, None, "Пустой CSV или нет заголовков"))
        return [], errors
    rows = list(reader)
    return rows, errors


def import_source_catalog(
    db: Session,
    path: Optional[str | Path] = None,
    content: Optional[bytes] = None,
    filename: Optional[str] = None,
    write_normalized: bool = True,
    commit: bool = True,
) -> ImportReport:
    """Upsert robots from source catalog CSV. Never deletes existing source robots."""
    resolved: Optional[Path] = None
    fname = filename or CATALOG_FILENAME
    if content is None:
        resolved = resolve_catalog_path(path)
        if not resolved:
            report = ImportReport(filename=fname, status="failed")
            report.errors.append(
                ImportErrorItem(
                    fname,
                    None,
                    None,
                    None,
                    str(path) if path else "default",
                    "Файл каталога не найден",
                )
            )
            return report
        content = resolved.read_bytes()
        fname = resolved.name

    report = ImportReport(filename=fname)
    rows, read_errors = _read_csv_rows(content, fname)
    report.errors.extend(read_errors)
    report.total_rows = len(rows)
    if read_errors and not rows:
        report.status = "failed"
        _persist_batch(db, report, commit=commit)
        return report

    normalized_rows: list[dict[str, Any]] = []

    for idx, row in enumerate(rows):
        # CSV data rows start at line 2
        source_row = idx + 2
        try:
            external_id = (row.get("id") or "").strip() or None
            name = (row.get("Название") or "").strip()
            if not name:
                report.skipped += 1
                report.errors.append(
                    ImportErrorItem(fname, None, source_row, "Название", None, "Пустое название")
                )
                continue

            company = (row.get("компания") or "").strip()
            tip_raw = (row.get("тип") or "").strip()  # brs/bas/software
            tip_display = (row.get("Тип") or "").strip()
            podtip = (row.get("Подтип") or "").strip()
            status_raw = (row.get("статус") or "").strip()
            description = (row.get("описание") or "").strip() or None
            scenario = (row.get("Сценарий") or "").strip() or None
            cases_text = (row.get("Кейсы") or "").strip() or None
            region = (row.get("Регион") or "").strip() or None
            industry = (row.get("Отрасль") or "").strip() or None

            price_raw = row.get("Цена изделия")
            price = parse_price(price_raw)
            if price_raw and str(price_raw).strip() and price is None:
                report.warnings.append(
                    ImportErrorItem(fname, None, source_row, "Цена изделия", price_raw, "Не удалось разобрать цену")
                )

            trl = parse_int(row.get("УГТ"))
            market = parse_float(row.get("Рын Потенциал"))
            payload = parse_payload_from_name(name)

            manufacturer = _get_or_create_manufacturer(db, company)
            st = _resolve_solution_type(db, tip_display, podtip)
            conf, src_status = confirmation_for_row(name, company, price, tip_display, podtip)

            data: dict[str, Any] = {
                "name": name,
                "manufacturer_id": manufacturer.id if manufacturer else None,
                "solution_type_id": st.id if st else None,
                "purpose": description or scenario,
                "availability_status": STATUS_MAP.get(status_raw.lower(), status_raw or "available"),
                "payload_kg": payload,
                "price_rub": price,
                "source": f"Материалы проекта ({fname})",
                "source_url": None,
                "updated_at": utcnow(),
                "confirmation_level": conf,
                "archived": False,
                "external_id": external_id,
                "source_file": fname,
                "source_sheet": None,
                "source_row": source_row,
                "source_column": None,
                "source_date": utcnow(),
                "source_status": src_status,
                "catalog_type_raw": tip_raw or None,
                "subtype_raw": podtip or tip_display or None,
                "scenario_raw": scenario,
                "cases_text": cases_text,
                "trl_level": trl,
                "market_potential": market,
                "industry_raw": industry,
                "region_raw": region,
                "data_origin": "source",
                "cases": [{"title": "Кейс из каталога", "result": cases_text}] if cases_text else None,
                "raw_data": {k: (None if v == "" else v) for k, v in row.items()},
                "country": "Россия",
            }
            if region:
                data["operating_conditions"] = {"region": region, "industry": industry}

            existing = _find_existing(
                db,
                external_id,
                name,
                manufacturer.id if manufacturer else None,
            )
            if existing:
                # Do not demote demo→source overwrite of unrelated demo; if match by name
                # on a demo robot without external_id, convert to source provenance.
                for k, v in data.items():
                    setattr(existing, k, v)
                report.updated += 1
            else:
                db.add(Robot(**data))
                report.added += 1

            normalized_rows.append(
                {
                    "external_id": external_id,
                    "name": name,
                    "manufacturer": company,
                    "price_rub": price,
                    "payload_kg": payload,
                    "catalog_type": tip_raw,
                    "subtype": podtip,
                    "scenario": scenario,
                    "trl_level": trl,
                    "market_potential": market,
                    "region": region,
                    "industry": industry,
                    "source_row": source_row,
                    "confirmation_level": conf,
                }
            )
        except Exception as exc:  # noqa: BLE001
            report.skipped += 1
            report.errors.append(
                ImportErrorItem(fname, None, source_row, None, None, str(exc))
            )

    if write_normalized and normalized_rows:
        _write_normalized_csv(normalized_rows)

    report.status = "completed_with_errors" if report.errors else "completed"
    _persist_batch(db, report, commit=commit)
    return report


def _write_normalized_csv(rows: list[dict[str, Any]]) -> None:
    # In Docker ./data is mounted at /data; on Windows Path('/data') == drive-root \data
    candidates: list[Path] = []
    docker_sources = Path("/data/sources")
    if docker_sources.is_dir() and (docker_sources / CATALOG_FILENAME).exists():
        candidates.append(Path("/data/imported"))
    root = Path(__file__).resolve().parents[3]
    candidates.extend(
        [
            root / "data" / "imported",
            Path("data/imported"),
        ]
    )
    out_dir = None
    for c in candidates:
        try:
            c.mkdir(parents=True, exist_ok=True)
            probe = c / ".write_probe"
            probe.write_text("", encoding="utf-8")
            probe.unlink(missing_ok=True)
            out_dir = c
            break
        except OSError:
            continue
    if not out_dir:
        return
    out = out_dir / "catalog_normalized.csv"
    fieldnames = list(rows[0].keys())
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        w.writeheader()
        w.writerows(rows)


def _persist_batch(db: Session, report: ImportReport, commit: bool = True) -> None:
    batch = ImportBatch(
        filename=report.filename,
        imported_at=utcnow(),
        status=report.status,
        total_rows=report.total_rows,
        added=report.added,
        updated=report.updated,
        skipped=report.skipped,
        errors=len(report.errors),
        warnings=len(report.warnings),
        report_json=report.to_dict(),
    )
    db.add(batch)
    if commit:
        db.commit()
        db.refresh(batch)
    else:
        db.flush()
    report.batch_id = batch.id


def has_source_robots(db: Session) -> bool:
    return (
        db.query(Robot.id).filter(Robot.data_origin == "source", Robot.archived.is_(False)).first()
        is not None
    )


def import_source_catalog_if_needed(db: Session, path: Optional[str | Path] = None) -> Optional[ImportReport]:
    if has_source_robots(db):
        return None
    resolved = resolve_catalog_path(path)
    if not resolved:
        return None
    return import_source_catalog(db, path=resolved, write_normalized=True, commit=True)
