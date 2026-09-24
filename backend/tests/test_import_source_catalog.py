"""Тесты импорта source-каталога (fixture, без изменения data/sources)."""

from pathlib import Path

from app.models.import_batch import ImportBatch
from app.models.robot import Robot
from app.services.import_source_catalog import (
    import_source_catalog,
    parse_payload_from_name,
    parse_price,
)

FIXTURE = Path(__file__).parent / "fixtures" / "catalog_mini.csv"


def test_parse_price_ru_format():
    assert parse_price("2 700 000,00") == 2_700_000.0
    assert parse_price("950 000,00") == 950_000.0
    assert parse_price(None) is None
    assert parse_price("-") is None


def test_parse_payload_from_name():
    assert parse_payload_from_name("Ronavi H1500 (грузоподъемность до 1 500 кг)") == 1500.0
    assert parse_payload_from_name("Ronavi SR (грузоподъемность до 50 кг)") == 50.0
    assert parse_payload_from_name("Без нагрузки") is None


def test_import_adds_and_sets_provenance(db_session):
    assert FIXTURE.is_file()
    before = db_session.query(Robot).filter(Robot.data_origin == "source").count()
    report = import_source_catalog(
        db_session,
        path=FIXTURE,
        write_normalized=False,
        commit=True,
    )
    assert report.added >= 3
    assert len(report.errors) == 0
    after = db_session.query(Robot).filter(Robot.data_origin == "source").count()
    assert after == before + report.added

    robot = (
        db_session.query(Robot)
        .filter(Robot.external_id.isnot(None), Robot.data_origin == "source")
        .first()
    )
    assert robot is not None
    assert robot.source_file == "catalog_mini.csv"
    assert robot.source_row is not None
    assert robot.data_origin == "source"
    assert robot.catalog_type_raw in ("brs", "bas", "software")
    assert robot.price_rub is not None

    batches = db_session.query(ImportBatch).count()
    assert batches >= 1


def test_import_update_by_external_id(db_session):
    report1 = import_source_catalog(db_session, path=FIXTURE, write_normalized=False, commit=True)
    assert report1.added >= 1

    # re-import same file → updates, no deletes
    source_count = db_session.query(Robot).filter(Robot.data_origin == "source").count()
    report2 = import_source_catalog(db_session, path=FIXTURE, write_normalized=False, commit=True)
    assert report2.updated >= report1.added
    assert report2.added == 0
    assert db_session.query(Robot).filter(Robot.data_origin == "source").count() == source_count


def test_import_duplicate_name_manufacturer_upsert(db_session):
    # First import
    import_source_catalog(db_session, path=FIXTURE, write_normalized=False, commit=True)
    first = (
        db_session.query(Robot)
        .filter(Robot.data_origin == "source")
        .order_by(Robot.id)
        .first()
    )
    assert first is not None
    old_price = first.price_rub
    ext = first.external_id

    # Build a one-row CSV with same external_id, new price
    header = FIXTURE.read_text(encoding="utf-8-sig").splitlines()[0]
    # Find the data line for this external_id
    lines = FIXTURE.read_text(encoding="utf-8-sig").splitlines()
    data_line = next(l for l in lines[1:] if l.startswith(ext))
    parts = data_line.split(";")
    # last column is price
    parts[-1] = "3 333 000,00"
    content = (header + "\n" + ";".join(parts) + "\n").encode("utf-8-sig")

    report = import_source_catalog(
        db_session,
        content=content,
        filename="catalog_mini.csv",
        write_normalized=False,
        commit=True,
    )
    assert report.updated == 1
    db_session.refresh(first)
    assert first.price_rub == 3_333_000.0
    assert first.price_rub != old_price or old_price == 3_333_000.0


def test_import_does_not_delete_source_robots(db_session):
    import_source_catalog(db_session, path=FIXTURE, write_normalized=False, commit=True)
    count = db_session.query(Robot).filter(Robot.data_origin == "source").count()
    # Import empty-ish content with only header — should not wipe
    header = FIXTURE.read_text(encoding="utf-8-sig").splitlines()[0] + "\n"
    report = import_source_catalog(
        db_session,
        content=header.encode("utf-8-sig"),
        filename="empty.csv",
        write_normalized=False,
        commit=True,
    )
    assert report.total_rows == 0
    assert db_session.query(Robot).filter(Robot.data_origin == "source").count() == count
