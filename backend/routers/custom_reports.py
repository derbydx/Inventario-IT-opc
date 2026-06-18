from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import select, or_, and_
from typing import List, Optional
from datetime import datetime
import json

from database import get_db
import models
import schemas
from auth import require_permission

router = APIRouter(prefix="/api/custom-reports", tags=["Reportes Personalizados"])

FIELD_DEFINITIONS = [
    {"key": "asset_asset_tag_id", "label": "Asset Tag", "group": "Activos", "table": "asset", "column": "asset_tag_id"},
    {"key": "asset_asset_description", "label": "Descripcion", "group": "Activos", "table": "asset", "column": "asset_description"},
    {"key": "asset_purchase_date", "label": "Fecha Compra", "group": "Activos", "table": "asset", "column": "purchase_date"},
    {"key": "asset_cost", "label": "Costo", "group": "Activos", "table": "asset", "column": "cost"},
    {"key": "asset_purchased_from", "label": "Vendedor", "group": "Activos", "table": "asset", "column": "purchased_from"},
    {"key": "asset_brand", "label": "Marca", "group": "Activos", "table": "asset", "column": "brand"},
    {"key": "asset_model", "label": "Modelo", "group": "Activos", "table": "asset", "column": "model"},
    {"key": "asset_serial_no", "label": "Serie", "group": "Activos", "table": "asset", "column": "serial_no"},
    {"key": "asset_notas", "label": "Notas Adicionales", "group": "Activos", "table": "asset", "column": "notas_adicionales"},
    {"key": "asset_numero_telefono", "label": "Telefono", "group": "Activos", "table": "asset", "column": "numero_telefono"},
    {"key": "asset_status", "label": "Status", "group": "Activos", "table": "asset", "column": "status"},
    {"key": "asset_category", "label": "Categoria", "group": "Activos", "table": "asset", "column": "category"},
    {"key": "person_full_name", "label": "Nombre Completo", "group": "Personas", "table": "person", "column": "full_name"},
    {"key": "person_email", "label": "Email", "group": "Personas", "table": "person", "column": "email"},
    {"key": "person_employee_id", "label": "Employee ID", "group": "Personas", "table": "person", "column": "employee_id"},
    {"key": "person_title", "label": "Puesto/Titulo", "group": "Personas", "table": "person", "column": "title"},
    {"key": "person_is_active", "label": "Empleado Activo", "group": "Personas", "table": "person", "column": "is_active"},
    {"key": "hist_fecha_accion", "label": "Fecha Accion", "group": "Historial", "table": "history", "column": "fecha_accion"},
    {"key": "hist_tipo_accion", "label": "Tipo Accion", "group": "Historial", "table": "history", "column": "tipo_accion"},
    {"key": "hist_estado_anterior", "label": "Estado Anterior", "group": "Historial", "table": "history", "column": "estado_anterior"},
    {"key": "hist_estado_nuevo", "label": "Estado Nuevo", "group": "Historial", "table": "history", "column": "estado_nuevo"},
    {"key": "hist_notas", "label": "Notas Historial", "group": "Historial", "table": "history", "column": "notas_detalle"},
    {"key": "site_site_name", "label": "Nombre Sitio", "group": "Sitios", "table": "site", "column": "site_name"},
    {"key": "site_city", "label": "Ciudad", "group": "Sitios", "table": "site", "column": "city"},
    {"key": "site_state", "label": "Estado/Provincia", "group": "Sitios", "table": "site", "column": "state"},
    {"key": "site_country", "label": "Pais", "group": "Sitios", "table": "site", "column": "country"},
    {"key": "dept_department_name", "label": "Departamento", "group": "Departamentos", "table": "department", "column": "department_name"},
]

FIELD_MAP = {f["key"]: f for f in FIELD_DEFINITIONS}


def get_model_and_column(table_name, column_name):
    if table_name == "asset":
        return models.Asset, getattr(models.Asset, column_name)
    elif table_name == "person":
        return models.Person, getattr(models.Person, column_name)
    elif table_name == "history":
        return models.History, getattr(models.History, column_name)
    elif table_name == "site":
        return models.Site, getattr(models.Site, column_name)
    elif table_name == "department":
        return models.Department, getattr(models.Department, column_name)
    return None, None


def build_custom_report_query(field_keys, filters_dict, db):
    field_defs = []
    for key in field_keys:
        fd = FIELD_MAP.get(key)
        if fd:
            field_defs.append(fd)

    select_cols = []
    for fd in field_defs:
        model_obj, col_obj = get_model_and_column(fd["table"], fd["column"])
        if model_obj and col_obj:
            select_cols.append(col_obj.label(fd["key"]))

    tables_needed = set(fd["table"] for fd in field_defs)

    PersonSite = aliased(models.Site)

    stmt = select(*select_cols).select_from(models.Asset)

    if "person" in tables_needed or "department" in tables_needed:
        stmt = stmt.outerjoin(models.Person, models.Asset.person_id == models.Person.id)
    if "site" in tables_needed:
        stmt = stmt.outerjoin(models.Site, models.Asset.site_id == models.Site.id)
    if "department" in tables_needed:
        stmt = stmt.outerjoin(models.Department, models.Person.department_id == models.Department.id)
    if "history" in tables_needed:
        stmt = stmt.outerjoin(models.History, models.History.asset_id == models.Asset.id)
    if "person_site" in tables_needed:
        stmt = stmt.outerjoin(PersonSite, models.Person.site_id == PersonSite.id)

    filters = filters_dict or {}

    if filters.get("status"):
        status_val = filters["status"].strip()
        if "," in status_val:
            status_list = [s.strip() for s in status_val.split(",")]
            stmt = stmt.where(models.Asset.status.in_(status_list))
        else:
            stmt = stmt.where(models.Asset.status == status_val)

    if filters.get("category"):
        stmt = stmt.where(models.Asset.category == filters["category"])

    if filters.get("site_id"):
        stmt = stmt.where(models.Asset.site_id == filters["site_id"])

    if filters.get("department_id"):
        stmt = stmt.where(models.Person.department_id == filters["department_id"])

    if filters.get("person_id"):
        stmt = stmt.where(models.Asset.person_id == filters["person_id"])

    if filters.get("cost_min") is not None:
        stmt = stmt.where(models.Asset.cost >= filters["cost_min"])
    if filters.get("cost_max") is not None:
        stmt = stmt.where(models.Asset.cost <= filters["cost_max"])

    text_search = filters.get("text_search")
    if text_search:
        like_val = f"%{text_search}%"
        search_conditions = []
        for fd in field_defs:
            model_obj, col_obj = get_model_and_column(fd["table"], fd["column"])
            if col_obj is not None:
                search_conditions.append(col_obj.like(like_val))
        if search_conditions:
            stmt = stmt.where(or_(*search_conditions))

    date_field_name = filters.get("date_field", "purchase_date")
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")

    if date_from:
        try:
            parsed = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            parsed = datetime.strptime(date_from, "%d/%m/%Y")
        if date_field_name == "purchase_date":
            stmt = stmt.where(models.Asset.purchase_date >= parsed.date())
        elif date_field_name == "assigned_date":
            subq = select(models.History.asset_id).where(
                models.History.tipo_accion == "Checkout",
                models.History.fecha_accion >= parsed
            )
            stmt = stmt.where(models.Asset.id.in_(subq))

    if date_to:
        try:
            parsed = datetime.strptime(date_to, "%Y-%m-%d")
        except ValueError:
            parsed = datetime.strptime(date_to, "%d/%m/%Y")
        if date_field_name == "purchase_date":
            stmt = stmt.where(models.Asset.purchase_date <= parsed.date())
        elif date_field_name == "assigned_date":
            subq = select(models.History.asset_id).where(
                models.History.tipo_accion == "Checkout",
                models.History.fecha_accion <= parsed
            )
            stmt = stmt.where(models.Asset.id.in_(subq))

    return db.execute(stmt).fetchall()


@router.get("/fields/")
def list_custom_fields():
    groups = {}
    for fd in FIELD_DEFINITIONS:
        g = fd["group"]
        if g not in groups:
            groups[g] = []
        groups[g].append({"key": fd["key"], "label": fd["label"]})
    result = []
    for g_name, g_fields in groups.items():
        result.append({"group": g_name, "fields": g_fields})
    return result


@router.get("/run/")
def run_custom_report_get(
    fields: str = Query(..., description="Comma-separated field keys"),
    status: str = None,
    category: str = None,
    site_id: int = None,
    department_id: int = None,
    date_from: str = None,
    date_to: str = None,
    date_field: str = "purchase_date",
    text_search: str = None,
    cost_min: float = None,
    cost_max: float = None,
    person_id: int = None,
    db: Session = Depends(get_db)
):
    field_keys = [f.strip() for f in fields.split(",") if f.strip()]
    if not field_keys:
        raise HTTPException(400, "Debe seleccionar al menos un campo")

    filters_dict = {
        "status": status,
        "category": category,
        "site_id": site_id,
        "department_id": department_id,
        "date_from": date_from,
        "date_to": date_to,
        "date_field": date_field,
        "text_search": text_search,
        "cost_min": cost_min,
        "cost_max": cost_max,
        "person_id": person_id,
    }

    rows = build_custom_report_query(field_keys, filters_dict, db)
    headers = [FIELD_MAP.get(k, {}).get("label", k) for k in field_keys]
    data = [dict(zip(field_keys, row)) for row in rows]
    return {"headers": headers, "keys": field_keys, "data": data, "count": len(data)}


@router.post("/run/")
def run_custom_report(body: schemas.CustomReportRunRequest, db: Session = Depends(get_db)):
    if not body.fields:
        raise HTTPException(400, "Debe seleccionar al menos un campo")

    filters_dict = body.model_dump(exclude={"fields"})
    rows = build_custom_report_query(body.fields, filters_dict, db)
    headers = [FIELD_MAP.get(k, {}).get("label", k) for k in body.fields]
    data = [dict(zip(body.fields, row)) for row in rows]
    return {"headers": headers, "keys": body.fields, "data": data, "count": len(data)}


@router.get("/export-csv/")
def export_custom_report_csv(
    fields: str = Query(..., description="Comma-separated field keys"),
    status: str = None,
    category: str = None,
    site_id: int = None,
    department_id: int = None,
    date_from: str = None,
    date_to: str = None,
    date_field: str = "purchase_date",
    text_search: str = None,
    cost_min: float = None,
    cost_max: float = None,
    person_id: int = None,
    db: Session = Depends(get_db)
):
    field_keys = [f.strip() for f in fields.split(",") if f.strip()]
    if not field_keys:
        raise HTTPException(400, "Debe seleccionar al menos un campo")

    filters_dict = {
        "status": status,
        "category": category,
        "site_id": site_id,
        "department_id": department_id,
        "date_from": date_from,
        "date_to": date_to,
        "date_field": date_field,
        "text_search": text_search,
        "cost_min": cost_min,
        "cost_max": cost_max,
        "person_id": person_id,
    }

    rows = build_custom_report_query(field_keys, filters_dict, db)
    headers = [FIELD_MAP.get(k, {}).get("label", k) for k in field_keys]

    import csv, io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([str(c) if c is not None else "" for c in row])

    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reporte_personalizado.csv"}
    )


@router.get("/saved/")
def list_saved_reports(db: Session = Depends(get_db)):
    reports = db.query(models.SavedReport).order_by(models.SavedReport.updated_at.desc()).all()
    result = []
    for r in reports:
        result.append({
            "id": r.id,
            "name": r.name,
            "fields": r.fields,
            "filters": r.filters,
            "created_by_id": r.created_by_id,
            "created_by": r.created_by.username if r.created_by else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return result


@router.post("/saved/", status_code=201)
def save_report(body: schemas.SavedReportCreate, db: Session = Depends(get_db), admin: models.Admin = Depends(require_permission("can_view"))):
    if not body.name or not body.fields:
        raise HTTPException(400, "Nombre y campos son requeridos")
    report = models.SavedReport(
        name=body.name,
        fields=json.dumps(body.fields),
        filters=body.filters,
        created_by_id=admin.id
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "name": report.name,
        "fields": report.fields,
        "filters": report.filters,
        "created_by_id": report.created_by_id,
        "created_by": admin.username,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


@router.put("/saved/{report_id}")
def update_saved_report(report_id: int, body: schemas.SavedReportUpdate, db: Session = Depends(get_db), admin: models.Admin = Depends(require_permission("can_view"))):
    report = db.query(models.SavedReport).filter(models.SavedReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Reporte no encontrado")
    if body.name:
        report.name = body.name
    if body.fields is not None:
        report.fields = json.dumps(body.fields)
    if body.filters is not None:
        report.filters = body.filters
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "name": report.name,
        "fields": report.fields,
        "filters": report.filters,
        "created_by_id": report.created_by_id,
        "created_by": report.created_by.username if report.created_by else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


@router.delete("/saved/{report_id}")
def delete_saved_report(report_id: int, db: Session = Depends(get_db), admin: models.Admin = Depends(require_permission("can_view"))):
    report = db.query(models.SavedReport).filter(models.SavedReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "Reporte no encontrado")
    db.delete(report)
    db.commit()
    return {"detail": "Reporte eliminado"}
