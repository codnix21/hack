"""Демо-витрина: разные проекты с предзаполненной окупаемостью."""

from app.models import Calculation, Project
from app.models.project import ProjectSolution
from app.services.demo_showcase import DEMO_SPECS, ensure_demo_showcase


def test_demo_showcase_creates_calcs_and_varied_paybacks(db_session):
    report = ensure_demo_showcase(db_session, force_recalc=True)
    assert report.get("ok") is True, report
    assert not report.get("errors"), report["errors"]

    demos = db_session.query(Project).filter(Project.is_demo.is_(True)).all()
    names = {p.name for p in demos}
    for spec in DEMO_SPECS:
        assert spec["name"] in names, spec["name"]

    paybacks = []
    for p in demos:
        calc = (
            db_session.query(Calculation)
            .filter(Calculation.project_id == p.id)
            .order_by(Calculation.version.desc())
            .first()
        )
        assert calc is not None, p.name
        assert calc.results and calc.results.get("payback") is not None, p.name
        selected = (
            db_session.query(ProjectSolution)
            .filter(ProjectSolution.project_id == p.id, ProjectSolution.selected.is_(True))
            .first()
        )
        assert selected is not None, p.name
        years = calc.results["payback"].get("payback_years")
        if years is not None:
            paybacks.append(float(years))

    # Хотя бы несколько проектов с числовой окупаемостью и разброс профилей
    assert len(paybacks) >= 4
    assert min(paybacks) < max(paybacks)


def test_demo_showcase_idempotent(db_session):
    ensure_demo_showcase(db_session, force_recalc=True)
    n1 = db_session.query(Project).filter(Project.is_demo.is_(True)).count()
    c1 = db_session.query(Calculation).count()
    report = ensure_demo_showcase(db_session, force_recalc=False)
    n2 = db_session.query(Project).filter(Project.is_demo.is_(True)).count()
    c2 = db_session.query(Calculation).count()
    assert n1 == n2 == len(DEMO_SPECS)
    assert c2 == c1  # без force не плодим версии
    assert report["created"] == []
