#!/usr/bin/env python3
"""
update_dated_brent.py
BUG 6: adaptado para escribir en data/brent-history.json (clave
"dated_brent") en vez de en public/index.html (const DATED_BRENT).

Dated Brent (físico, assessment de Platts) se publica una sola vez al
día (~16:30 Londres) y no cambia durante la sesión — por eso tiene su
propio workflow separado del de los futuros CO1-CO12.

Modos:
  nuevo      → agrega una fila nueva con la fecha indicada
  actualizar → reemplaza la última fila existente con el nuevo precio
"""

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

HISTORY_PATH = Path("data/brent-history.json")


def parse_args():
    parser = argparse.ArgumentParser(description="Actualizar Dated Brent en data/brent-history.json")
    parser.add_argument("--fecha", default="",   help="Fecha YYYY-MM-DD (vacío = hoy)")
    parser.add_argument("--db",    required=True, type=float, help="Precio Dated Brent USD/bbl")
    parser.add_argument("--modo",  default="nuevo", choices=["nuevo", "actualizar"])
    return parser.parse_args()


def get_fecha(raw: str) -> str:
    if raw and raw.strip():
        try:
            datetime.strptime(raw.strip(), "%Y-%m-%d")
            return raw.strip()
        except ValueError:
            print(f"ERROR: Fecha '{raw}' no tiene formato YYYY-MM-DD", file=sys.stderr)
            sys.exit(1)
    return date.today().isoformat()


def load_history() -> dict:
    if not HISTORY_PATH.exists():
        print(f"ERROR: No se encontró {HISTORY_PATH}. Corré primero desde la raíz del repo.", file=sys.stderr)
        sys.exit(1)
    return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))


def main():
    args = parse_args()
    fecha = get_fecha(args.fecha)

    history = load_history()
    data = history.get("dated_brent", [])
    new_row = {"Date": fecha, "DB": round(args.db, 3)}

    if args.modo == "nuevo":
        if data and data[-1]["Date"] == fecha:
            print(f"AVISO: Ya existe una fila para {fecha}. Usando modo 'actualizar'.")
            data[-1] = new_row
        else:
            data.append(new_row)
        action = f"Agregada fila nueva para {fecha}"
    else:  # actualizar
        if not data:
            print("ERROR: dated_brent está vacío, no hay nada que actualizar.", file=sys.stderr)
            sys.exit(1)
        old_date = data[-1]["Date"]
        data[-1] = new_row
        action = f"Actualizada fila {old_date} → {fecha}"

    data.sort(key=lambda r: r["Date"])

    history["dated_brent"] = data
    HISTORY_PATH.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    last = data[-1]
    prev = data[-2] if len(data) >= 2 else None
    print(f"\n✓ {action}  (escrito en {HISTORY_PATH})")
    print(f"  Fecha : {last['Date']}")
    print(f"  DB    : ${last['DB']}")
    if prev:
        v = (last["DB"] / prev["DB"] - 1) * 100
        arrow = "▲" if v > 0 else "▼"
        print(f"\n  VAR% 1D vs {prev['Date']}: {arrow} {v:+.2f}%")
        print(f"  Dif   : {last['DB'] - prev['DB']:+.3f} USD/bbl")
    print(f"\n  Total filas dated_brent: {len(data)}  ({data[0]['Date']} → {data[-1]['Date']})")


if __name__ == "__main__":
    main()
