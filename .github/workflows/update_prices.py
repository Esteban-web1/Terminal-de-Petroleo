#!/usr/bin/env python3
"""
update_prices.py
BUG 6: adaptado para escribir en data/brent-history.json (clave "co_curve")
en vez de en public/index.html (const RAW). Mismos argumentos de CLI que
antes — el workflow update-prices.yml no necesita cambiar sus inputs,
solo el "git add" del archivo final (ver update-prices.yml).

Modos:
  nuevo      → agrega una fila nueva con la fecha indicada
  actualizar → reemplaza la última fila existente con los nuevos precios
"""

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path


CONTRACTS = ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6", "CO7", "CO8", "CO9", "CO10", "CO11", "CO12"]
HISTORY_PATH = Path("data/brent-history.json")


def parse_args():
    parser = argparse.ArgumentParser(description="Actualizar precios ICE Brent en data/brent-history.json")
    parser.add_argument("--fecha",  default="",   help="Fecha YYYY-MM-DD (vacío = hoy)")
    parser.add_argument("--co1",    required=True, type=float)
    parser.add_argument("--co2",    required=True, type=float)
    parser.add_argument("--co3",    required=True, type=float)
    parser.add_argument("--co4",    required=True, type=float)
    parser.add_argument("--co5",    required=True, type=float)
    parser.add_argument("--co6",    required=True, type=float)
    parser.add_argument("--co7",    required=True, type=float)
    parser.add_argument("--co8",    required=True, type=float)
    parser.add_argument("--co9",    required=True, type=float)
    parser.add_argument("--co10",   required=True, type=float)
    parser.add_argument("--co11",   required=True, type=float)
    parser.add_argument("--co12",   required=True, type=float)
    parser.add_argument("--modo",   default="nuevo", choices=["nuevo", "actualizar"])
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


def build_row(fecha: str, args) -> dict:
    return {
        "Date": fecha,
        "CO1":  round(args.co1, 2),
        "CO2":  round(args.co2, 2),
        "CO3":  round(args.co3, 2),
        "CO4":  round(args.co4, 2),
        "CO5":  round(args.co5, 2),
        "CO6":  round(args.co6, 2),
        "CO7":  round(args.co7, 2),
        "CO8":  round(args.co8, 2),
        "CO9":  round(args.co9, 2),
        "CO10": round(args.co10, 2),
        "CO11": round(args.co11, 2),
        "CO12": round(args.co12, 2),
    }


def main():
    args = parse_args()
    fecha = get_fecha(args.fecha)

    history = load_history()
    data = history.get("co_curve", [])
    new_row = build_row(fecha, args)

    existing_idx = next((i for i, r in enumerate(data) if r["Date"] == fecha), None)

    if args.modo == "nuevo":
        if existing_idx is not None:
            print(f"AVISO: Ya existe una fila para {fecha} (posición {existing_idx}). Se actualiza en vez de duplicar.")
            data[existing_idx] = new_row
            action = f"Actualizada fila existente {fecha}"
        else:
            data.append(new_row)
            action = f"Agregada fila nueva para {fecha}"
    else:  # actualizar
        if not data:
            print("ERROR: co_curve está vacío, no hay nada que actualizar.", file=sys.stderr)
            sys.exit(1)
        if existing_idx is not None:
            data[existing_idx] = new_row
            action = f"Actualizada fila {fecha}"
        else:
            old_date = data[-1]["Date"]
            data[-1] = new_row
            action = f"Actualizada última fila {old_date} → {fecha}"

    seen = {}
    for r in data:
        seen[r["Date"]] = r
    data = list(seen.values())
    data.sort(key=lambda r: r["Date"])

    history["co_curve"] = data
    HISTORY_PATH.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    last = data[-1]
    prev = data[-2] if len(data) >= 2 else None
    print(f"\n✓ {action}  (escrito en {HISTORY_PATH})")
    print(f"  Fecha : {last['Date']}")
    print(f"  CO1   : {last['CO1']}   CO2  : {last['CO2']}   CO3  : {last['CO3']}")
    print(f"  CO4   : {last['CO4']}   CO5  : {last['CO5']}   CO6  : {last['CO6']}")
    print(f"  CO7   : {last['CO7']}   CO8  : {last['CO8']}   CO9  : {last['CO9']}")
    print(f"  CO10  : {last['CO10']}  CO11 : {last['CO11']}  CO12 : {last['CO12']}")
    if prev:
        print(f"\n  VAR% 1D vs {prev['Date']}:")
        for c in CONTRACTS:
            if c in prev and prev[c]:
                v = (last[c] / prev[c] - 1) * 100
                arrow = "▲" if v > 0 else "▼"
                print(f"    {c:5s}: {arrow} {v:+.2f}%")
    print(f"\n  Total filas co_curve: {len(data)}  ({data[0]['Date']} → {data[-1]['Date']})")


if __name__ == "__main__":
    main()
