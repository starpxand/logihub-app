"""Сводка выгрузки заказов дашборда (logihub-dashboard/data/logistics_orders.csv) для раздела «Аналитика».

KPI считаются так же, как в дашборде (logihub_dashboard/data.py): отменённые заказы в KPI не входят,
OTIF – доля заказов, доставленных и в срок (On Time), и в полном объёме (In Full).
Запуск: python tools/build_data.py  ->  data/analytics.json
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "logihub-dashboard" / "data" / "logistics_orders.csv"
OUT = ROOT / "data" / "analytics.json"
COSTS = {"cost_fuel": "Топливо", "cost_driver": "Оплата водителей", "cost_warehouse": "Складские операции",
         "cost_tolls": "Платные дороги", "cost_other": "Прочие и штрафы"}


def bucket():
    return {"n": 0, "cancelled": 0, "revenue": 0.0, "profit": 0.0, "cost": 0.0, "on_time": 0, "in_full": 0, "otif": 0}


def add(b, r):
    if r["status"] == "Отменён":
        b["cancelled"] += 1
        return
    b["n"] += 1
    b["revenue"] += float(r["revenue"])
    b["profit"] += float(r["profit"])
    b["cost"] += float(r["total_cost"])
    for k in ("on_time", "in_full", "otif"):
        b[k] += int(r[k])


def finish(b):
    n = b["n"] or 1
    return {"orders": b["n"], "cancelled": b["cancelled"], "revenue": round(b["revenue"]), "profit": round(b["profit"]),
            "cost": round(b["cost"]), "otif": round(b["otif"] / n * 100, 1), "on_time": round(b["on_time"] / n * 100, 1),
            "in_full": round(b["in_full"] / n * 100, 1)}


def main():
    rows = list(csv.DictReader(SRC.open(encoding="utf-8-sig")))
    month, region, cargo, transport, release = (defaultdict(bucket) for _ in range(5))
    costs = defaultdict(float)
    for r in rows:
        m = r["order_date"][:7]
        add(month[m], r)
        add(region[r["region"]], r)
        add(cargo[r["cargo_type"]], r)
        add(transport[r["transport_type"]], r)
        add(release[r["release"]], r)
        if r["status"] != "Отменён":
            for c in COSTS:
                costs[COSTS[c]] += float(r[c])
    data = {
        "source": "logihub-dashboard/data/logistics_orders.csv",
        "otif_target": 90.0,
        "total_rows": len(rows),
        "period": [rows[0]["order_date"], rows[-1]["order_date"]],
        "months": [{"month": k, **finish(v)} for k, v in sorted(month.items())],
        "regions": sorted(({"name": k, **finish(v)} for k, v in region.items()), key=lambda x: -x["revenue"]),
        "cargo": sorted(({"name": k, **finish(v)} for k, v in cargo.items()), key=lambda x: -x["revenue"]),
        "transport": sorted(({"name": k, **finish(v)} for k, v in transport.items()), key=lambda x: -x["revenue"]),
        "releases": [{"name": k, **finish(v)} for k, v in sorted(release.items())],
        "costs": [{"name": k, "value": round(v)} for k, v in sorted(costs.items(), key=lambda x: -x[1])],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(OUT, len(rows), "заказов,", len(data["months"]), "месяцев")


if __name__ == "__main__":
    main()
