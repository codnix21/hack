import io

import pandas as pd

from app.services.import_catalog import apply_import, preview_import, suggest_mapping, validate_mapped_rows, read_tabular


def test_suggest_mapping():
    cols = ["Название", "Производитель", "Грузоподъёмность кг", "Цена"]
    m = suggest_mapping(cols)
    assert "name" in m.values()
    assert "manufacturer" in m.values()


def test_preview_and_validate_csv():
    df = pd.DataFrame(
        {
            "name": ["TestBot A", "TestBot B"],
            "manufacturer": ["MiR", "Geek+"],
            "payload_kg": [100, 200],
            "price_rub": [500000, 800000],
            "solution_type": ["amr", "amr"],
        }
    )
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    content = buf.getvalue()
    preview = preview_import(content, "robots.csv")
    assert preview["row_count"] == 2
    assert "name" in preview["columns"]

    mapping = {c: c for c in preview["columns"] if c in ("name", "manufacturer", "payload_kg", "price_rub", "solution_type")}
    # identity mapping file_col -> canonical when already canonical
    mapping = {c: c for c in ["name", "manufacturer", "payload_kg", "price_rub", "solution_type"]}
    df2 = read_tabular(content, "robots.csv")
    v = validate_mapped_rows(df2, mapping)
    assert v["valid"] is True


def test_apply_import_adds_robots(db_session):
    df = pd.DataFrame(
        {
            "name": ["ImportBot Unique 1", "ImportBot Unique 2"],
            "manufacturer": ["Новый Вендор", "MiR"],
            "payload_kg": [120, 220],
            "price_rub": [600000, 900000],
            "solution_type": ["amr", "amr"],
            "width_mm": [700, 800],
        }
    )
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    mapping = {c: c for c in df.columns}
    result = apply_import(db_session, buf.getvalue(), "import.csv", mapping)
    assert result["added"] == 2
    assert result["error_count"] == 0

    # update existing
    df2 = pd.DataFrame(
        {
            "name": ["ImportBot Unique 1"],
            "manufacturer": ["Новый Вендор"],
            "payload_kg": [150],
            "price_rub": [650000],
            "solution_type": ["amr"],
        }
    )
    buf2 = io.BytesIO()
    df2.to_csv(buf2, index=False)
    result2 = apply_import(db_session, buf2.getvalue(), "import2.csv", {c: c for c in df2.columns})
    assert result2["updated"] == 1


def test_validate_missing_name():
    df = pd.DataFrame({"payload_kg": [1]})
    v = validate_mapped_rows(df, {"payload_kg": "payload_kg"})
    assert v["valid"] is False
